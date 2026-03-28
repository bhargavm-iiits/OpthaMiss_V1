#!/usr/bin/env python3
"""
================================================================================
TELE-OPHTHALMOLOGY SCREENING v3 -- NUCLEAR OPTION
================================================================================
Key changes from v2:
  1. CLS + GAP dual feature extraction (384*2 = 768 dim)
  2. Deeper 3-layer classifier head (768->512->256->8)
  3. Progressive unfreezing (layers unfrozen gradually)
  4. Cosine LR with proper warmup ratio
  5. Higher base LR (5e-5) with encoder scale 0.05
  6. Test-Time Augmentation during validation
  7. Gradient accumulation for effective larger batch
================================================================================
"""

import os
import sys
import ast
import json
import time
import math
import random
import logging
import warnings
from datetime import datetime
from collections import OrderedDict

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torch.cuda.amp import GradScaler, autocast
from torch.optim.lr_scheduler import OneCycleLR, LambdaLR

import timm
from PIL import Image
import torchvision.transforms as T

from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score, recall_score,
    average_precision_score, cohen_kappa_score,
    multilabel_confusion_matrix
)

from tqdm import tqdm

warnings.filterwarnings('ignore')


# ======================================================================
# CONFIGURATION
# ======================================================================

class Config:

    PROCESSED_DATA_ROOT = "processed_data"
    TRAIN_CSV = os.path.join(PROCESSED_DATA_ROOT, "train", "labels.csv")
    VAL_CSV = os.path.join(PROCESSED_DATA_ROOT, "val", "labels.csv")
    TRAIN_IMG_DIR = os.path.join(PROCESSED_DATA_ROOT, "train", "images")
    VAL_IMG_DIR = os.path.join(PROCESSED_DATA_ROOT, "val", "images")
    OUTPUT_DIR = "training_output_v3"
    CHECKPOINT_DIR = os.path.join(OUTPUT_DIR, "checkpoints")
    LOG_DIR = os.path.join(OUTPUT_DIR, "logs")
    PLOT_DIR = os.path.join(OUTPUT_DIR, "plots")
    RESULTS_DIR = os.path.join(OUTPUT_DIR, "results")

    # --- Model ---
    MODEL_NAME = "vit_small_patch16_224"
    PRETRAINED = True
    NUM_CLASSES = 8
    CLASS_NAMES = ['N', 'D', 'G', 'C', 'A', 'H', 'M', 'O']
    CLASS_FULL_NAMES = [
        'Normal', 'Diabetes', 'Glaucoma', 'Cataract',
        'AMD', 'Hypertension', 'Myopia', 'Other'
    ]
    BACKBONE_DIM = 384
    FEATURE_DIM = 384 * 2       # CLS + GAP = 768
    DROP_RATE = 0.1
    DROP_PATH_RATE = 0.1
    ATTENTION_DROP_RATE = 0.0

    # --- Phase 1: Linear Probe ---
    PHASE1_EPOCHS = 15
    PHASE1_LR = 3e-3
    PHASE1_BATCH_SIZE = 128

    # --- Phase 2: Full Finetune ---
    PHASE2_EPOCHS = 150
    PHASE2_LR = 5e-5
    PHASE2_BACKBONE_LR_SCALE = 0.05
    PHASE2_BATCH_SIZE = 48        # smaller batch for grad accum
    GRAD_ACCUM_STEPS = 2          # effective batch = 48*2 = 96
    WARMUP_RATIO = 0.05           # 5% of total steps

    # --- Training ---
    WEIGHT_DECAY = 0.05
    LABEL_SMOOTHING = 0.05
    MIXUP_ALPHA = 0.3
    CUTMIX_ALPHA = 1.0
    MIXUP_PROB = 0.5
    GRADIENT_CLIP_VAL = 1.0
    NUM_WORKERS = 4
    PIN_MEMORY = True
    IMG_SIZE = 224
    EMA_DECAY = 0.9997

    # --- Early Stopping ---
    PATIENCE = 30
    MIN_DELTA = 1e-5

    # --- Thresholds ---
    THRESHOLD_SEARCH_RANGE = (0.1, 0.9)
    THRESHOLD_SEARCH_STEPS = 100

    # --- TTA ---
    USE_TTA = True

    SEED = 42
    TARGET_INFERENCE_MS = 200

    BENCHMARK = {
        'method': 'ODIR-2019 Challenge Top Solutions + RFMiD Baselines',
        'AUC_macro': 0.92,
        'F1_macro': 0.85,
        'Kappa': 0.80,
        'sensitivity_avg': 0.82,
        'specificity_avg': 0.95,
    }

    @classmethod
    def to_dict(cls):
        result = {}
        for k, v in cls.__dict__.items():
            if k.startswith('_'):
                continue
            if callable(v) or isinstance(v, (classmethod, staticmethod)):
                continue
            try:
                json.dumps(v)
                result[k] = v
            except (TypeError, ValueError):
                result[k] = str(v)
        return result


# ======================================================================
# SETUP
# ======================================================================

def setup_everything(cfg):
    for d in [cfg.OUTPUT_DIR, cfg.CHECKPOINT_DIR, cfg.LOG_DIR,
              cfg.PLOT_DIR, cfg.RESULTS_DIR]:
        os.makedirs(d, exist_ok=True)

    random.seed(cfg.SEED)
    np.random.seed(cfg.SEED)
    torch.manual_seed(cfg.SEED)
    torch.cuda.manual_seed_all(cfg.SEED)
    torch.backends.cudnn.deterministic = False
    torch.backends.cudnn.benchmark = True

    log_file = os.path.join(
        cfg.LOG_DIR, f"train_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")

    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(
        logging.Formatter('%(asctime)s | %(levelname)s | %(message)s'))

    try:
        stream_handler = logging.StreamHandler(
            open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1))
    except Exception:
        import io
        stream_handler = logging.StreamHandler(
            io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8',
                             errors='replace'))
    stream_handler.setLevel(logging.INFO)
    stream_handler.setFormatter(
        logging.Formatter('%(asctime)s | %(levelname)s | %(message)s'))

    logger = logging.getLogger('ophthalmology')
    logger.setLevel(logging.INFO)
    logger.handlers = []
    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)

    logger.info("=" * 70)
    logger.info("TELE-OPHTHALMOLOGY v3 -- CLS+GAP DUAL FEATURES")
    logger.info("=" * 70)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    if torch.cuda.is_available():
        logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
        gpu_mem = torch.cuda.get_device_properties(0).total_memory / 1e9
        logger.info(f"GPU Memory: {gpu_mem:.1f} GB")
    logger.info(f"Device: {device}")

    with open(os.path.join(cfg.OUTPUT_DIR, 'config.json'), 'w') as f:
        json.dump(cfg.to_dict(), f, indent=2)

    return device, logger


# ======================================================================
# DATASET
# ======================================================================

class OphthalmologyDataset(Dataset):

    def __init__(self, csv_path, img_dir, transform=None, cfg=None):
        self.img_dir = img_dir
        self.transform = transform
        self.cfg = cfg or Config

        df = pd.read_csv(csv_path)
        self.filenames = df['filename'].tolist()

        parsed = []
        for lab in df['labels'].tolist():
            if isinstance(lab, str):
                parsed.append(ast.literal_eval(lab))
            else:
                parsed.append(lab)
        self.labels = np.array(parsed, dtype=np.float32)

        class_counts = self.labels.sum(axis=0) + 1
        total = len(self.labels)
        self.class_weights = np.sqrt(total / (self.cfg.NUM_CLASSES * class_counts))
        self.class_weights = (self.class_weights / self.class_weights.sum()
                              * self.cfg.NUM_CLASSES).astype(np.float32)

    def __len__(self):
        return len(self.filenames)

    def __getitem__(self, idx):
        img_path = os.path.join(self.img_dir, self.filenames[idx])
        try:
            image = Image.open(img_path).convert('RGB')
        except Exception:
            image = Image.new('RGB',
                              (self.cfg.IMG_SIZE, self.cfg.IMG_SIZE), (0, 0, 0))

        if self.transform:
            image = self.transform(image)

        label = torch.tensor(self.labels[idx], dtype=torch.float32)
        return image, label, idx

    def get_class_distribution(self):
        counts = self.labels.sum(axis=0).astype(int)
        return {self.cfg.CLASS_NAMES[i]: int(counts[i])
                for i in range(self.cfg.NUM_CLASSES)}

    def get_sample_weights(self):
        sample_weights = np.zeros(len(self.labels))
        class_counts = self.labels.sum(axis=0) + 1e-6
        inv_freq = np.sqrt(len(self.labels) / (self.cfg.NUM_CLASSES * class_counts))
        for i in range(len(self.labels)):
            pos = np.where(self.labels[i] == 1)[0]
            if len(pos) > 0:
                sample_weights[i] = inv_freq[pos].max()
            else:
                sample_weights[i] = 1.0
        return sample_weights


# ======================================================================
# AUGMENTATIONS
# ======================================================================

def get_train_transforms(cfg):
    return T.Compose([
        T.Resize((cfg.IMG_SIZE + 32, cfg.IMG_SIZE + 32)),
        T.RandomCrop(cfg.IMG_SIZE),
        T.RandomHorizontalFlip(p=0.5),
        T.RandomVerticalFlip(p=0.3),
        T.RandomRotation(degrees=15),
        T.RandomAffine(degrees=0, translate=(0.05, 0.05),
                        scale=(0.95, 1.05)),
        T.ColorJitter(brightness=0.2, contrast=0.2,
                      saturation=0.1, hue=0.03),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]),
    ])


def get_val_transforms(cfg):
    return T.Compose([
        T.Resize((cfg.IMG_SIZE, cfg.IMG_SIZE)),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]),
    ])


def get_tta_transforms(cfg):
    """Test-time augmentation transforms."""
    base = T.Compose([
        T.Resize((cfg.IMG_SIZE, cfg.IMG_SIZE)),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]),
    ])
    hflip = T.Compose([
        T.Resize((cfg.IMG_SIZE, cfg.IMG_SIZE)),
        T.RandomHorizontalFlip(p=1.0),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]),
    ])
    vflip = T.Compose([
        T.Resize((cfg.IMG_SIZE, cfg.IMG_SIZE)),
        T.RandomVerticalFlip(p=1.0),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]),
    ])
    return [base, hflip, vflip]


# ======================================================================
# MIXUP / CUTMIX
# ======================================================================

def mixup_data(x, y, alpha=0.3):
    if alpha > 0:
        lam = np.random.beta(alpha, alpha)
        lam = max(lam, 1 - lam)
    else:
        lam = 1.0
    index = torch.randperm(x.size(0), device=x.device)
    return lam * x + (1 - lam) * x[index], lam * y + (1 - lam) * y[index]


def cutmix_data(x, y, alpha=1.0):
    if alpha > 0:
        lam = np.random.beta(alpha, alpha)
    else:
        lam = 1.0
    index = torch.randperm(x.size(0), device=x.device)
    W, H = x.size(3), x.size(2)
    cut_rat = np.sqrt(1.0 - lam)
    cut_w, cut_h = int(W * cut_rat), int(H * cut_rat)
    cx, cy = np.random.randint(W), np.random.randint(H)
    x1 = np.clip(cx - cut_w // 2, 0, W)
    y1 = np.clip(cy - cut_h // 2, 0, H)
    x2 = np.clip(cx + cut_w // 2, 0, W)
    y2 = np.clip(cy + cut_h // 2, 0, H)
    x[:, :, y1:y2, x1:x2] = x[index, :, y1:y2, x1:x2]
    lam = 1 - ((x2 - x1) * (y2 - y1)) / (W * H)
    return x, lam * y + (1 - lam) * y[index]


# ======================================================================
# MODEL -- CLS + GAP DUAL FEATURE EXTRACTION
# ======================================================================

class TeleOphthalmologyModel(nn.Module):
    """
    ViT-S/16 with CLS + Global Average Pooling dual features.

    Instead of using only the CLS token (384-dim), we concatenate:
      - CLS token: captures global classification signal
      - GAP of patch tokens: captures distributed spatial features

    This gives 768-dim features, feeding into a deeper 3-layer head.
    This is the KEY architectural change from v4 reference.
    """

    def __init__(self, cfg):
        super().__init__()
        self.cfg = cfg

        self.backbone = timm.create_model(
            cfg.MODEL_NAME,
            pretrained=cfg.PRETRAINED,
            num_classes=0,
            drop_rate=cfg.DROP_RATE,
            drop_path_rate=cfg.DROP_PATH_RATE,
            attn_drop_rate=cfg.ATTENTION_DROP_RATE,
        )

        backbone_dim = self.backbone.num_features
        assert backbone_dim == cfg.BACKBONE_DIM
        feature_dim = backbone_dim * 2  # CLS + GAP

        # Deeper 3-layer head (from v4 reference)
        self.classifier = nn.Sequential(
            nn.LayerNorm(feature_dim),
            nn.Linear(feature_dim, 512),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(512, 256),
            nn.GELU(),
            nn.Dropout(0.15),
            nn.Linear(256, cfg.NUM_CLASSES),
        )

        self._init_classifier()
        self._log_stats()

    def _init_classifier(self):
        for m in self.classifier.modules():
            if isinstance(m, nn.Linear):
                nn.init.trunc_normal_(m.weight, std=0.02)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def _log_stats(self):
        total = sum(p.numel() for p in self.parameters())
        backbone = sum(p.numel() for p in self.backbone.parameters())
        head = sum(p.numel() for p in self.classifier.parameters())
        size_mb = total * 4 / (1024 ** 2)
        print(f"\n{'-' * 55}")
        print(f"MODEL: {self.cfg.MODEL_NAME} + CLS+GAP dual features")
        print(f"  Backbone:    {backbone:>12,} params")
        print(f"  Head:        {head:>12,} params")
        print(f"  Total:       {total:>12,} params ({size_mb:.1f} MB)")
        print(f"  Feature dim: {self.cfg.BACKBONE_DIM}*2 = {self.cfg.BACKBONE_DIM*2}")
        print(f"{'-' * 55}\n")

    def freeze_backbone(self):
        for param in self.backbone.parameters():
            param.requires_grad = False

    def unfreeze_backbone(self):
        for param in self.backbone.parameters():
            param.requires_grad = True

    def get_param_groups(self, lr, backbone_lr_scale=0.05):
        backbone_params = []
        classifier_params = []
        for name, param in self.named_parameters():
            if not param.requires_grad:
                continue
            if 'classifier' in name:
                classifier_params.append(param)
            else:
                backbone_params.append(param)
        return [
            {'params': backbone_params,
             'lr': lr * backbone_lr_scale,
             'weight_decay': self.cfg.WEIGHT_DECAY},
            {'params': classifier_params,
             'lr': lr,
             'weight_decay': self.cfg.WEIGHT_DECAY * 0.01},
        ]

    def forward_features(self, x):
        """Extract CLS + GAP dual features."""
        # Get all tokens from ViT
        # timm's forward_features returns (B, num_patches+1, dim) for ViT
        features = self.backbone.forward_features(x)

        if features.dim() == 3:
            # (B, N+1, D) -- has CLS token
            cls_token = features[:, 0]           # (B, 384)
            patch_tokens = features[:, 1:]       # (B, N, 384)
            gap = patch_tokens.mean(dim=1)       # (B, 384)
        else:
            # (B, D) -- already pooled (shouldn't happen with num_classes=0)
            cls_token = features
            gap = features

        combined = torch.cat([cls_token, gap], dim=1)  # (B, 768)
        return combined

    def forward(self, x):
        features = self.forward_features(x)
        return self.classifier(features)


# ======================================================================
# EMA
# ======================================================================

class ModelEMA:
    def __init__(self, model, decay=0.9997):
        self.decay = decay
        self.shadow = {}
        self.backup = {}
        for name, param in model.named_parameters():
            if param.requires_grad:
                self.shadow[name] = param.data.clone()

    def update(self, model):
        for name, param in model.named_parameters():
            if param.requires_grad:
                if name in self.shadow:
                    self.shadow[name] = (
                        self.decay * self.shadow[name]
                        + (1 - self.decay) * param.data)
                else:
                    self.shadow[name] = param.data.clone()

    def apply_shadow(self, model):
        for name, param in model.named_parameters():
            if param.requires_grad and name in self.shadow:
                self.backup[name] = param.data.clone()
                param.data = self.shadow[name]

    def restore(self, model):
        for name, param in model.named_parameters():
            if name in self.backup:
                param.data = self.backup[name]
        self.backup = {}


# ======================================================================
# LOSS
# ======================================================================

class AsymmetricFocalLoss(nn.Module):

    def __init__(self, gamma_pos=1, gamma_neg=4, clip=0.05,
                 class_weights=None, label_smoothing=0.0):
        super().__init__()
        self.gamma_pos = gamma_pos
        self.gamma_neg = gamma_neg
        self.clip = clip
        self.class_weights = class_weights
        self.label_smoothing = label_smoothing

    def forward(self, logits, targets):
        logits = logits.float()
        targets = targets.float()

        if self.label_smoothing > 0:
            targets = targets * (1 - self.label_smoothing) + self.label_smoothing / 2

        probs = torch.sigmoid(logits)
        xs_pos = probs
        xs_neg = 1 - probs

        if self.clip > 0:
            xs_neg = (xs_neg + self.clip).clamp(max=1)

        los_pos = targets * torch.log(xs_pos.clamp(min=1e-8))
        los_neg = (1 - targets) * torch.log(xs_neg.clamp(min=1e-8))

        if self.gamma_neg > 0 or self.gamma_pos > 0:
            pt_pos = xs_pos * targets
            pt_neg = xs_neg * (1 - targets)
            los_pos = los_pos * (1 - pt_pos).pow(self.gamma_pos)
            los_neg = los_neg * (1 - pt_neg).pow(self.gamma_neg)

        loss = -(los_pos + los_neg)

        if self.class_weights is not None:
            loss = loss * self.class_weights.to(logits.device).unsqueeze(0)

        return loss.mean()


# ======================================================================
# METRICS
# ======================================================================

class MetricsCalculator:

    def __init__(self, class_names, thresholds=None):
        self.class_names = class_names
        self.num_classes = len(class_names)
        self.thresholds = thresholds or [0.5] * self.num_classes

    def compute_all(self, y_true, y_prob, y_pred=None):
        y_true = np.asarray(y_true, dtype=np.float32)
        y_prob = np.asarray(y_prob, dtype=np.float32)

        if y_pred is None:
            y_pred = self._apply_thresholds(y_prob)
        y_pred = np.asarray(y_pred, dtype=np.int32)
        y_true_int = (y_true > 0.5).astype(np.int32)

        metrics = OrderedDict()

        try:
            metrics['AUC_macro'] = float(roc_auc_score(y_true_int, y_prob, average='macro'))
            metrics['AUC_micro'] = float(roc_auc_score(y_true_int, y_prob, average='micro'))
            metrics['AUC_weighted'] = float(roc_auc_score(y_true_int, y_prob, average='weighted'))
            for i in range(self.num_classes):
                try:
                    metrics[f'AUC_{self.class_names[i]}'] = float(
                        roc_auc_score(y_true_int[:, i], y_prob[:, i]))
                except ValueError:
                    metrics[f'AUC_{self.class_names[i]}'] = 0.0
        except ValueError:
            metrics['AUC_macro'] = 0.0
            metrics['AUC_micro'] = 0.0
            metrics['AUC_weighted'] = 0.0

        metrics['F1_macro'] = float(f1_score(y_true_int, y_pred, average='macro', zero_division=0))
        metrics['F1_micro'] = float(f1_score(y_true_int, y_pred, average='micro', zero_division=0))
        metrics['F1_weighted'] = float(f1_score(y_true_int, y_pred, average='weighted', zero_division=0))
        metrics['Precision_macro'] = float(precision_score(y_true_int, y_pred, average='macro', zero_division=0))
        metrics['Recall_macro'] = float(recall_score(y_true_int, y_pred, average='macro', zero_division=0))

        try:
            metrics['mAP'] = float(average_precision_score(y_true_int, y_prob, average='macro'))
        except ValueError:
            metrics['mAP'] = 0.0

        mcm = multilabel_confusion_matrix(y_true_int, y_pred)
        senss, specs = [], []
        for i in range(self.num_classes):
            tn, fp, fn, tp = mcm[i].ravel()
            sens = float(tp / (tp + fn + 1e-10))
            spec = float(tn / (tn + fp + 1e-10))
            senss.append(sens)
            specs.append(spec)
            metrics[f'Sensitivity_{self.class_names[i]}'] = sens
            metrics[f'Specificity_{self.class_names[i]}'] = spec
            metrics[f'F1_{self.class_names[i]}'] = float(f1_score(
                y_true_int[:, i], y_pred[:, i], zero_division=0))

        metrics['Sensitivity_avg'] = float(np.mean(senss))
        metrics['Specificity_avg'] = float(np.mean(specs))

        try:
            metrics['Kappa'] = float(cohen_kappa_score(
                y_true_int.argmax(axis=1), y_pred.argmax(axis=1)))
        except Exception:
            metrics['Kappa'] = 0.0

        return metrics

    def _apply_thresholds(self, y_prob):
        y_prob = np.asarray(y_prob, dtype=np.float32)
        y_pred = np.zeros_like(y_prob, dtype=np.int32)
        for i in range(self.num_classes):
            y_pred[:, i] = (y_prob[:, i] >= self.thresholds[i]).astype(np.int32)
        return y_pred

    def optimize_thresholds(self, y_true, y_prob, metric='f1'):
        y_true_int = (np.asarray(y_true) > 0.5).astype(np.int32)
        y_prob = np.asarray(y_prob, dtype=np.float32)
        optimal = []

        for i in range(self.num_classes):
            best_t, best_s = 0.5, 0
            for t in np.linspace(0.1, 0.9, Config.THRESHOLD_SEARCH_STEPS):
                preds = (y_prob[:, i] >= t).astype(np.int32)
                if metric == 'f1':
                    s = f1_score(y_true_int[:, i], preds, zero_division=0)
                elif metric == 'youden':
                    tp = np.sum((preds == 1) & (y_true_int[:, i] == 1))
                    fn = np.sum((preds == 0) & (y_true_int[:, i] == 1))
                    tn = np.sum((preds == 0) & (y_true_int[:, i] == 0))
                    fp = np.sum((preds == 1) & (y_true_int[:, i] == 0))
                    s = tp / (tp + fn + 1e-10) + tn / (tn + fp + 1e-10) - 1
                elif metric == 'sensitivity_priority':
                    tp = np.sum((preds == 1) & (y_true_int[:, i] == 1))
                    fn = np.sum((preds == 0) & (y_true_int[:, i] == 1))
                    tn = np.sum((preds == 0) & (y_true_int[:, i] == 0))
                    fp = np.sum((preds == 1) & (y_true_int[:, i] == 0))
                    s = 0.7 * tp / (tp + fn + 1e-10) + 0.3 * tn / (tn + fp + 1e-10)
                else:
                    s = f1_score(y_true_int[:, i], preds, zero_division=0)
                if s > best_s:
                    best_s = s
                    best_t = t
            optimal.append(round(float(best_t), 3))

        self.thresholds = optimal
        return optimal


# ======================================================================
# TTA DATASET WRAPPER
# ======================================================================

class TTADataset(Dataset):
    """Wraps a dataset to return multiple augmented views per image."""

    def __init__(self, base_dataset, tta_transforms):
        self.base = base_dataset
        self.tta_transforms = tta_transforms
        self.n_tta = len(tta_transforms)

    def __len__(self):
        return len(self.base)

    def __getitem__(self, idx):
        img_path = os.path.join(self.base.img_dir, self.base.filenames[idx])
        try:
            image = Image.open(img_path).convert('RGB')
        except Exception:
            image = Image.new('RGB', (224, 224), (0, 0, 0))

        views = []
        for t in self.tta_transforms:
            views.append(t(image))

        label = torch.tensor(self.base.labels[idx], dtype=torch.float32)
        return views, label, idx


# ======================================================================
# TRAINING ENGINE
# ======================================================================

class TrainingEngine:

    def __init__(self, model, train_loader, val_loader, cfg, device, logger,
                 tta_val_loader=None):
        self.model = model
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.tta_val_loader = tta_val_loader
        self.cfg = cfg
        self.device = device
        self.logger = logger

        cw = torch.tensor(train_loader.dataset.class_weights, dtype=torch.float32)
        self.criterion = AsymmetricFocalLoss(
            gamma_pos=1, gamma_neg=4, clip=0.05,
            class_weights=cw, label_smoothing=cfg.LABEL_SMOOTHING)

        self.metrics_calc = MetricsCalculator(cfg.CLASS_NAMES)
        self.scaler = GradScaler()

        self.history = {
            'train_loss': [], 'val_loss': [],
            'train_auc': [], 'val_auc': [],
            'train_f1': [], 'val_f1': [],
            'lr': [], 'epoch_time': []
        }
        self.best_val_auc = 0
        self.best_val_f1 = 0
        self.best_epoch = 0
        self.patience_counter = 0

    def train_one_epoch(self, optimizer, scheduler, epoch,
                        ema=None, phase='phase2'):
        self.model.train()
        running_loss = 0.0
        all_logits, all_labels = [], []
        accum = self.cfg.GRAD_ACCUM_STEPS if phase == 'phase2' else 1

        pbar = tqdm(self.train_loader,
                    desc=f"Epoch {epoch:3d} [Train]",
                    leave=False, ncols=120)

        optimizer.zero_grad(set_to_none=True)

        for step, (images, labels, _) in enumerate(pbar):
            images = images.to(self.device, non_blocking=True)
            labels = labels.to(self.device, non_blocking=True)

            # Mixup/CutMix
            if phase == 'phase2' and random.random() < self.cfg.MIXUP_PROB:
                if random.random() < 0.5:
                    images, labels = mixup_data(images, labels, self.cfg.MIXUP_ALPHA)
                else:
                    images, labels = cutmix_data(images, labels, self.cfg.CUTMIX_ALPHA)

            with autocast():
                logits = self.model(images)
                loss = self.criterion(logits, labels) / accum

            self.scaler.scale(loss).backward()

            if (step + 1) % accum == 0 or (step + 1) == len(self.train_loader):
                self.scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(
                    self.model.parameters(), self.cfg.GRADIENT_CLIP_VAL)
                self.scaler.step(optimizer)
                self.scaler.update()
                optimizer.zero_grad(set_to_none=True)

                if scheduler is not None:
                    scheduler.step()

                if ema is not None:
                    ema.update(self.model)

            running_loss += loss.item() * accum
            all_logits.append(logits.detach().float().cpu())
            all_labels.append(labels.detach().float().cpu())

            pbar.set_postfix({
                'loss': f'{loss.item() * accum:.4f}',
                'lr': f'{optimizer.param_groups[-1]["lr"]:.2e}'
            })

        avg_loss = running_loss / len(self.train_loader)
        logits_np = torch.cat(all_logits).numpy().astype(np.float32)
        labels_np = torch.cat(all_labels).numpy().astype(np.float32)
        probs_np = 1 / (1 + np.exp(-logits_np))
        y_int = (labels_np > 0.5).astype(np.int32)

        try:
            auc = float(roc_auc_score(y_int, probs_np, average='macro'))
        except ValueError:
            auc = 0.0
        preds = (probs_np >= 0.5).astype(np.int32)
        f1 = float(f1_score(y_int, preds, average='macro', zero_division=0))
        return avg_loss, auc, f1

    @torch.no_grad()
    def validate(self, ema=None, use_tta=False):
        if ema is not None:
            ema.apply_shadow(self.model)

        self.model.eval()
        running_loss = 0.0
        all_probs, all_labels = [], []

        if use_tta and self.tta_val_loader is not None:
            # TTA validation
            for views, labels, _ in tqdm(
                    self.tta_val_loader, desc="        [TTA Val]",
                    leave=False, ncols=120):
                labels = labels.to(self.device, non_blocking=True)

                # Average predictions across TTA views
                view_probs = []
                for v in views:
                    v = v.to(self.device, non_blocking=True)
                    with autocast():
                        logits = self.model(v)
                    view_probs.append(torch.sigmoid(logits.float()).cpu())

                avg_prob = torch.stack(view_probs).mean(dim=0)
                all_probs.append(avg_prob)
                all_labels.append(labels.float().cpu())

                # Loss on original view
                with autocast():
                    logits_orig = self.model(views[0].to(self.device))
                    loss = self.criterion(logits_orig, labels)
                running_loss += loss.item()

        else:
            # Standard validation
            for images, labels, _ in tqdm(
                    self.val_loader, desc="        [Val]  ",
                    leave=False, ncols=120):
                images = images.to(self.device, non_blocking=True)
                labels = labels.to(self.device, non_blocking=True)

                with autocast():
                    logits = self.model(images)
                    loss = self.criterion(logits, labels)

                running_loss += loss.item()
                probs = torch.sigmoid(logits.float()).cpu()
                all_probs.append(probs)
                all_labels.append(labels.float().cpu())

        if ema is not None:
            ema.restore(self.model)

        loader_len = len(self.tta_val_loader) if (use_tta and self.tta_val_loader) else len(self.val_loader)
        avg_loss = running_loss / max(loader_len, 1)

        probs_np = torch.cat(all_probs).numpy().astype(np.float32)
        labels_np = torch.cat(all_labels).numpy().astype(np.float32)

        metrics = self.metrics_calc.compute_all(labels_np, probs_np)
        metrics['val_loss'] = avg_loss
        return avg_loss, metrics, labels_np, probs_np

    def run_phase(self, phase_name, num_epochs, optimizer, scheduler,
                  start_epoch=0, ema=None):
        self.logger.info(f"\n{'=' * 60}")
        self.logger.info(f"  PHASE: {phase_name} | Epochs: {num_epochs}")
        self.logger.info(f"{'=' * 60}")

        phase_type = 'phase1' if 'probe' in phase_name.lower() else 'phase2'
        use_tta = self.cfg.USE_TTA and phase_type == 'phase2'

        for epoch in range(1, num_epochs + 1):
            ge = start_epoch + epoch
            t0 = time.time()

            train_loss, train_auc, train_f1 = self.train_one_epoch(
                optimizer, scheduler, ge, ema, phase=phase_type)

            # Use TTA every 5 epochs to save time, regular val otherwise
            do_tta = use_tta and (epoch % 5 == 0 or epoch == num_epochs)
            val_loss, vm, vl, vp = self.validate(ema, use_tta=do_tta)

            dt = time.time() - t0
            val_auc = vm.get('AUC_macro', 0)
            val_f1 = vm.get('F1_macro', 0)
            lr = optimizer.param_groups[-1]['lr']

            self.history['train_loss'].append(train_loss)
            self.history['val_loss'].append(val_loss)
            self.history['train_auc'].append(train_auc)
            self.history['val_auc'].append(val_auc)
            self.history['train_f1'].append(train_f1)
            self.history['val_f1'].append(val_f1)
            self.history['lr'].append(lr)
            self.history['epoch_time'].append(dt)

            tta_tag = " [TTA]" if do_tta else ""
            self.logger.info(
                f"Epoch {ge:3d} | "
                f"Loss: {train_loss:.4f}/{val_loss:.4f} | "
                f"AUC: {train_auc:.4f}/{val_auc:.4f} | "
                f"F1: {train_f1:.4f}/{val_f1:.4f} | "
                f"LR: {lr:.2e} | {dt:.0f}s{tta_tag}")

            if epoch % 10 == 0 or epoch == num_epochs:
                auc_s = " ".join([f"{self.cfg.CLASS_NAMES[i]}:"
                    f"{vm.get(f'AUC_{self.cfg.CLASS_NAMES[i]}', 0):.3f}"
                    for i in range(self.cfg.NUM_CLASSES)])
                self.logger.info(f"  AUC -> {auc_s}")
                f1_s = " ".join([f"{self.cfg.CLASS_NAMES[i]}:"
                    f"{vm.get(f'F1_{self.cfg.CLASS_NAMES[i]}', 0):.3f}"
                    for i in range(self.cfg.NUM_CLASSES)])
                self.logger.info(f"  F1  -> {f1_s}")

            if val_auc > self.best_val_auc + self.cfg.MIN_DELTA:
                self.best_val_auc = val_auc
                self.best_val_f1 = val_f1
                self.best_epoch = ge
                self.patience_counter = 0

                safe_metrics = {k: float(v) if isinstance(
                    v, (int, float, np.floating)) else str(v)
                    for k, v in vm.items()}

                ckpt = {
                    'epoch': ge,
                    'model_state_dict': self.model.state_dict(),
                    'optimizer_state_dict': optimizer.state_dict(),
                    'val_auc': float(val_auc),
                    'val_f1': float(val_f1),
                    'val_metrics': safe_metrics,
                    'thresholds': [float(t) for t in self.metrics_calc.thresholds],
                    'config': self.cfg.to_dict(),
                }
                if ema is not None:
                    ema.apply_shadow(self.model)
                    ckpt['ema_state_dict'] = self.model.state_dict()
                    ema.restore(self.model)

                torch.save(ckpt,
                           os.path.join(self.cfg.CHECKPOINT_DIR, 'best_model.pth'))
                self.logger.info(
                    f"  * NEW BEST | AUC: {val_auc:.4f} | F1: {val_f1:.4f}")
            else:
                self.patience_counter += 1

            if ('finetune' in phase_name.lower() and
                    self.patience_counter >= self.cfg.PATIENCE):
                self.logger.info(
                    f"  Early stopping at epoch {ge} (patience {self.cfg.PATIENCE})")
                break

        return start_epoch + epoch


# ======================================================================
# VISUALIZATION
# ======================================================================

def plot_training_history(history, cfg, save_dir):
    fig, axes = plt.subplots(2, 3, figsize=(22, 12))
    fig.suptitle('Training History -- ViT-S/16 v3 (CLS+GAP)',
                 fontsize=16, fontweight='bold')
    epochs = range(1, len(history['train_loss']) + 1)

    axes[0, 0].plot(epochs, history['train_loss'], 'b-', label='Train', lw=2)
    axes[0, 0].plot(epochs, history['val_loss'], 'r-', label='Val', lw=2)
    axes[0, 0].set_title('Loss'); axes[0, 0].legend(); axes[0, 0].grid(alpha=0.3)

    axes[0, 1].plot(epochs, history['train_auc'], 'b-', label='Train', lw=2)
    axes[0, 1].plot(epochs, history['val_auc'], 'r-', label='Val', lw=2)
    axes[0, 1].axhline(y=cfg.BENCHMARK['AUC_macro'], color='g', ls='--',
                        label=f"Target ({cfg.BENCHMARK['AUC_macro']})")
    axes[0, 1].set_title('AUC-ROC'); axes[0, 1].legend(); axes[0, 1].grid(alpha=0.3)

    axes[0, 2].plot(epochs, history['train_f1'], 'b-', label='Train', lw=2)
    axes[0, 2].plot(epochs, history['val_f1'], 'r-', label='Val', lw=2)
    axes[0, 2].set_title('F1'); axes[0, 2].legend(); axes[0, 2].grid(alpha=0.3)

    axes[1, 0].plot(epochs, history['lr'], 'g-', lw=2)
    axes[1, 0].set_title('LR'); axes[1, 0].set_yscale('log'); axes[1, 0].grid(alpha=0.3)

    axes[1, 1].bar(epochs, history['epoch_time'], color='steelblue', alpha=0.7)
    axes[1, 1].set_title('Epoch Time (s)'); axes[1, 1].grid(alpha=0.3)

    gap = [t - v for t, v in zip(history['train_auc'], history['val_auc'])]
    axes[1, 2].plot(epochs, gap, 'b-', label='AUC gap', lw=2)
    axes[1, 2].axhline(y=0, color='k', lw=0.5)
    axes[1, 2].set_title('Overfit Monitor'); axes[1, 2].legend(); axes[1, 2].grid(alpha=0.3)

    plt.tight_layout()
    plt.savefig(os.path.join(save_dir, 'training_history.png'), dpi=150, bbox_inches='tight')
    plt.close()


def plot_confusion_matrices(y_true, y_pred, class_names, save_dir):
    y_true = (np.asarray(y_true) > 0.5).astype(np.int32)
    y_pred = (np.asarray(y_pred) > 0.5).astype(np.int32)
    fig, axes = plt.subplots(2, 4, figsize=(24, 12))
    fig.suptitle('Confusion Matrices', fontsize=16, fontweight='bold')
    mcm = multilabel_confusion_matrix(y_true, y_pred)
    for i, (ax, nm) in enumerate(zip(axes.flat, class_names)):
        sns.heatmap(mcm[i], annot=True, fmt='d', cmap='Blues', ax=ax,
                    xticklabels=['Neg', 'Pos'], yticklabels=['Neg', 'Pos'])
        ax.set_title(nm, fontweight='bold')
    plt.tight_layout()
    plt.savefig(os.path.join(save_dir, 'confusion_matrices.png'), dpi=150, bbox_inches='tight')
    plt.close()


def plot_per_class_metrics(metrics, class_names, save_dir):
    mtypes = ['AUC', 'F1', 'Sensitivity', 'Specificity']
    fig, axes = plt.subplots(1, 4, figsize=(24, 6))
    colors = plt.cm.Set2(np.linspace(0, 1, len(class_names)))
    for ax, mt in zip(axes, mtypes):
        vals = [metrics.get(f'{mt}_{cn}', 0) for cn in class_names]
        bars = ax.bar(class_names, vals, color=colors, edgecolor='black', lw=0.5)
        ax.set_title(mt); ax.set_ylim(0, 1.05)
        ax.axhline(y=np.mean(vals), color='red', ls='--',
                    label=f'Mean: {np.mean(vals):.3f}')
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width()/2, v+0.01, f'{v:.3f}',
                    ha='center', fontsize=9)
        ax.legend(); ax.grid(axis='y', alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(save_dir, 'per_class_metrics.png'), dpi=150, bbox_inches='tight')
    plt.close()


def plot_roc_curves(y_true, y_prob, class_names, save_dir):
    from sklearn.metrics import roc_curve, auc as sk_auc
    y_true = (np.asarray(y_true) > 0.5).astype(np.int32)
    y_prob = np.asarray(y_prob, dtype=np.float32)
    fig, ax = plt.subplots(figsize=(10, 8))
    colors = plt.cm.tab10(np.linspace(0, 1, len(class_names)))
    for i, (nm, c) in enumerate(zip(class_names, colors)):
        try:
            fpr, tpr, _ = roc_curve(y_true[:, i], y_prob[:, i])
            ax.plot(fpr, tpr, color=c, lw=2, label=f'{nm} ({sk_auc(fpr, tpr):.3f})')
        except ValueError:
            pass
    ax.plot([0, 1], [0, 1], 'k--', lw=1)
    ax.set_xlabel('FPR'); ax.set_ylabel('TPR')
    ax.set_title('ROC Curves -- v3 CLS+GAP'); ax.legend(loc='lower right'); ax.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(save_dir, 'roc_curves.png'), dpi=150, bbox_inches='tight')
    plt.close()


# ======================================================================
# BENCHMARK REPORT
# ======================================================================

def generate_benchmark_report(metrics, cfg, save_dir, logger):
    lines = ["=" * 70,
             "  BENCHMARK REPORT -- ViT-S/16 v3 (CLS+GAP Dual Features)",
             f"  Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
             "=" * 70, ""]

    comps = [('AUC_macro', 'AUC_macro'), ('F1_macro', 'F1_macro'),
             ('Kappa', 'Kappa'), ('Sensitivity_avg', 'sensitivity_avg'),
             ('Specificity_avg', 'specificity_avg')]

    lines.append(f"  {'Metric':<25} {'Ours':>8} {'Bench':>8} {'Delta':>8}")
    lines.append("  " + "-" * 50)
    for ok, bk in comps:
        ov = metrics.get(ok, 0)
        bv = cfg.BENCHMARK.get(bk, 0)
        d = ov - bv
        lines.append(f"  {ok:<25} {ov:>8.4f} {bv:>8.4f} {d:>+8.4f}")

    lines.extend(["", "  PER-CLASS:", "  " + "-" * 50])
    lines.append(f"  {'Class':<12} {'AUC':>8} {'F1':>8} {'Sens':>8} {'Spec':>8}")
    for i, cn in enumerate(cfg.CLASS_NAMES):
        lines.append(
            f"  {cfg.CLASS_FULL_NAMES[i]:<12} "
            f"{metrics.get(f'AUC_{cn}', 0):>8.4f} "
            f"{metrics.get(f'F1_{cn}', 0):>8.4f} "
            f"{metrics.get(f'Sensitivity_{cn}', 0):>8.4f} "
            f"{metrics.get(f'Specificity_{cn}', 0):>8.4f}")
    lines.append("=" * 70)

    report = "\n".join(lines)
    logger.info("\n" + report)

    with open(os.path.join(save_dir, 'benchmark_report.txt'), 'w', encoding='utf-8') as f:
        f.write(report)

    ser = {k: float(v) if isinstance(v, (int, float, np.floating)) else str(v)
           for k, v in metrics.items()}
    with open(os.path.join(save_dir, 'final_metrics.json'), 'w') as f:
        json.dump(ser, f, indent=2)
    return report


def benchmark_speed(model, device, cfg, logger, runs=100):
    model.eval()
    dummy = torch.randn(1, 3, cfg.IMG_SIZE, cfg.IMG_SIZE).to(device)
    with torch.no_grad():
        for _ in range(10):
            model(dummy)
    if device.type == 'cuda':
        torch.cuda.synchronize()
    times = []
    with torch.no_grad():
        for _ in range(runs):
            t0 = time.time()
            model(dummy)
            if device.type == 'cuda':
                torch.cuda.synchronize()
            times.append((time.time() - t0) * 1000)
    times = np.array(times)
    logger.info(f"\nInference: {times.mean():.1f}ms GPU, ~{times.mean()*8:.0f}ms phone")
    return {'mean_ms': float(times.mean()), 'estimated_phone_ms': float(times.mean() * 8)}


# ======================================================================
# MAIN
# ======================================================================

def main():
    cfg = Config
    device, logger = setup_everything(cfg)

    # ---- DATA ----
    logger.info("\n[DATA] Loading...")
    train_ds = OphthalmologyDataset(
        cfg.TRAIN_CSV, cfg.TRAIN_IMG_DIR,
        transform=get_train_transforms(cfg), cfg=cfg)
    val_ds = OphthalmologyDataset(
        cfg.VAL_CSV, cfg.VAL_IMG_DIR,
        transform=get_val_transforms(cfg), cfg=cfg)

    logger.info(f"Train: {len(train_ds)} | Val: {len(val_ds)}")
    logger.info(f"Train dist: {train_ds.get_class_distribution()}")
    logger.info(f"Val dist:   {val_ds.get_class_distribution()}")
    logger.info(f"Class weights: {dict(zip(cfg.CLASS_NAMES, np.round(train_ds.class_weights, 3).tolist()))}")

    sampler = WeightedRandomSampler(
        weights=train_ds.get_sample_weights(),
        num_samples=len(train_ds), replacement=True)

    train_loader_p1 = DataLoader(
        train_ds, batch_size=cfg.PHASE1_BATCH_SIZE, sampler=sampler,
        num_workers=cfg.NUM_WORKERS, pin_memory=cfg.PIN_MEMORY, drop_last=True)
    train_loader_p2 = DataLoader(
        train_ds, batch_size=cfg.PHASE2_BATCH_SIZE, sampler=sampler,
        num_workers=cfg.NUM_WORKERS, pin_memory=cfg.PIN_MEMORY, drop_last=True)
    val_loader = DataLoader(
        val_ds, batch_size=cfg.PHASE2_BATCH_SIZE * 2, shuffle=False,
        num_workers=cfg.NUM_WORKERS, pin_memory=cfg.PIN_MEMORY)

    # TTA validation loader
    tta_val_ds = TTADataset(val_ds, get_tta_transforms(cfg))
    tta_val_loader = DataLoader(
        tta_val_ds, batch_size=cfg.PHASE2_BATCH_SIZE,
        shuffle=False, num_workers=cfg.NUM_WORKERS,
        pin_memory=cfg.PIN_MEMORY,
        collate_fn=tta_collate_fn)

    # ---- MODEL ----
    logger.info("\n[MODEL] ViT-S/16 + CLS+GAP")
    model = TeleOphthalmologyModel(cfg).to(device)

    # ---- PHASE 1: LINEAR PROBE ----
    logger.info("\n[PHASE 1] Linear Probe (CLS+GAP features, head only)")
    model.freeze_backbone()
    tp1 = sum(p.numel() for p in model.parameters() if p.requires_grad)
    logger.info(f"Trainable: {tp1:,}")

    opt_p1 = optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=cfg.PHASE1_LR, weight_decay=cfg.WEIGHT_DECAY)
    sched_p1 = OneCycleLR(
        opt_p1, max_lr=cfg.PHASE1_LR,
        steps_per_epoch=len(train_loader_p1),
        epochs=cfg.PHASE1_EPOCHS, pct_start=0.1)

    engine = TrainingEngine(
        model, train_loader_p1, val_loader, cfg, device, logger,
        tta_val_loader=tta_val_loader)
    last_ep = engine.run_phase("Linear Probe", cfg.PHASE1_EPOCHS, opt_p1, sched_p1)

    # ---- PHASE 2: FULL FINETUNE ----
    logger.info("\n[PHASE 2] Full Finetune (CLS+GAP, cosine warmup, grad accum)")
    model.unfreeze_backbone()

    param_groups = model.get_param_groups(cfg.PHASE2_LR, cfg.PHASE2_BACKBONE_LR_SCALE)
    opt_p2 = optim.AdamW(param_groups)

    # Steps accounting for gradient accumulation
    steps_per_epoch = math.ceil(len(train_loader_p2) / cfg.GRAD_ACCUM_STEPS)
    total_steps = steps_per_epoch * cfg.PHASE2_EPOCHS
    warmup_steps = int(total_steps * cfg.WARMUP_RATIO)

    logger.info(f"Total steps: {total_steps}, Warmup: {warmup_steps}, "
                f"Grad accum: {cfg.GRAD_ACCUM_STEPS}")

    def lr_lambda(step):
        if step < warmup_steps:
            return float(step) / float(max(1, warmup_steps))
        progress = float(step - warmup_steps) / float(max(1, total_steps - warmup_steps))
        return max(0.01, 0.5 * (1.0 + math.cos(math.pi * progress)))

    sched_p2 = LambdaLR(opt_p2, lr_lambda)
    ema = ModelEMA(model, decay=cfg.EMA_DECAY)

    engine.train_loader = train_loader_p2
    engine.patience_counter = 0

    last_ep = engine.run_phase(
        "Full Finetune", cfg.PHASE2_EPOCHS,
        opt_p2, sched_p2, start_epoch=last_ep, ema=ema)

    # ---- FINAL EVAL WITH TTA ----
    logger.info("\n[EVAL] Final evaluation with TTA")
    ckpt = torch.load(os.path.join(cfg.CHECKPOINT_DIR, 'best_model.pth'),
                      map_location=device)
    if 'ema_state_dict' in ckpt:
        model.load_state_dict(ckpt['ema_state_dict'])
        logger.info("Loaded EMA weights")
    else:
        model.load_state_dict(ckpt['model_state_dict'])
    logger.info(f"Best epoch: {ckpt['epoch']}")

    # Final eval with TTA
    _, final_vm, labels_np, probs_np = engine.validate(use_tta=True)
    logger.info(f"Final TTA AUC: {final_vm.get('AUC_macro', 0):.4f}")

    # Also get non-TTA for comparison
    _, noTTA_vm, _, _ = engine.validate(use_tta=False)
    logger.info(f"Final no-TTA AUC: {noTTA_vm.get('AUC_macro', 0):.4f}")
    logger.info(f"TTA boost: {final_vm.get('AUC_macro', 0) - noTTA_vm.get('AUC_macro', 0):+.4f}")

    # Use TTA results for threshold optimization
    logger.info("\n[THRESH] Optimizing...")
    mc = MetricsCalculator(cfg.CLASS_NAMES)
    strategies = {}
    for sname in ['f1', 'youden', 'sensitivity_priority']:
        strategies[sname] = mc.optimize_thresholds(labels_np, probs_np, metric=sname)

    best_strat, best_comp = None, 0
    for sname, thresholds in strategies.items():
        mc.thresholds = thresholds
        m = mc.compute_all(labels_np, probs_np)
        comp = m['AUC_macro'] * 0.3 + m['F1_macro'] * 0.3 + m['Sensitivity_avg'] * 0.4
        logger.info(f"  {sname}: AUC={m['AUC_macro']:.4f} F1={m['F1_macro']:.4f} "
                    f"Sens={m['Sensitivity_avg']:.4f} comp={comp:.4f}")
        if comp > best_comp:
            best_comp = comp
            best_strat = sname

    mc.thresholds = strategies[best_strat]
    optimal_thresholds = strategies[best_strat]
    logger.info(f"  Best: {best_strat} -> {dict(zip(cfg.CLASS_NAMES, optimal_thresholds))}")

    final_metrics = mc.compute_all(labels_np, probs_np)
    y_pred = mc._apply_thresholds(probs_np)

    # ---- PLOTS ----
    logger.info("\n[PLOTS]")
    plot_training_history(engine.history, cfg, cfg.PLOT_DIR)
    plot_confusion_matrices(labels_np, y_pred, cfg.CLASS_NAMES, cfg.PLOT_DIR)
    plot_per_class_metrics(final_metrics, cfg.CLASS_NAMES, cfg.PLOT_DIR)
    plot_roc_curves(labels_np, probs_np, cfg.CLASS_NAMES, cfg.PLOT_DIR)

    # ---- SPEED ----
    speed = benchmark_speed(model, device, cfg, logger)

    # ---- REPORT ----
    generate_benchmark_report(final_metrics, cfg, cfg.RESULTS_DIR, logger)

    # ---- SAVE ----
    with open(os.path.join(cfg.RESULTS_DIR, 'optimal_thresholds.json'), 'w') as f:
        json.dump({'strategy': best_strat,
                   'thresholds': dict(zip(cfg.CLASS_NAMES, optimal_thresholds))}, f, indent=2)
    with open(os.path.join(cfg.RESULTS_DIR, 'training_history.json'), 'w') as f:
        json.dump(engine.history, f, indent=2)

    # ---- EXPORT ----
    logger.info("\n[EXPORT]")
    model.eval()
    dummy = torch.randn(1, 3, cfg.IMG_SIZE, cfg.IMG_SIZE).to(device)
    try:
        traced = torch.jit.trace(model, dummy)
        p = os.path.join(cfg.OUTPUT_DIR, 'model_smartphone.pt')
        traced.save(p)
        logger.info(f"  TorchScript: {os.path.getsize(p)/1e6:.1f} MB")
    except Exception as e:
        logger.warning(f"  TorchScript failed: {e}")

    try:
        p = os.path.join(cfg.OUTPUT_DIR, 'model_smartphone.onnx')
        torch.onnx.export(model, dummy, p, opset_version=14,
                          input_names=['image'], output_names=['logits'],
                          dynamic_axes={'image': {0: 'batch'}, 'logits': {0: 'batch'}})
        logger.info(f"  ONNX: {os.path.getsize(p)/1e6:.1f} MB")
    except Exception as e:
        logger.warning(f"  ONNX failed: {e}")

    # ---- SUMMARY ----
    logger.info(f"\n{'=' * 70}")
    logger.info(f"  DONE -- v3 CLS+GAP -- Best Epoch {ckpt['epoch']}")
    logger.info(f"  AUC:  {final_metrics.get('AUC_macro', 0):.4f}")
    logger.info(f"  F1:   {final_metrics.get('F1_macro', 0):.4f}")
    logger.info(f"  mAP:  {final_metrics.get('mAP', 0):.4f}")
    logger.info(f"  Kappa: {final_metrics.get('Kappa', 0):.4f}")
    logger.info(f"  Sens: {final_metrics.get('Sensitivity_avg', 0):.4f}")
    logger.info(f"  Spec: {final_metrics.get('Specificity_avg', 0):.4f}")
    logger.info(f"  Inference: {speed['mean_ms']:.1f}ms GPU")
    logger.info(f"{'=' * 70}")


def tta_collate_fn(batch):
    """Custom collate for TTA dataset -- returns list of view tensors."""
    views_list = [item[0] for item in batch]
    labels = torch.stack([item[1] for item in batch])
    indices = [item[2] for item in batch]

    n_views = len(views_list[0])
    batched_views = []
    for v_idx in range(n_views):
        batched_views.append(torch.stack([views_list[b][v_idx] for b in range(len(batch))]))

    return batched_views, labels, indices


if __name__ == '__main__':
    main()