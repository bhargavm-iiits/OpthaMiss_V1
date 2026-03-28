#!/usr/bin/env python3
"""
================================================================================
MISS-EyeScreen | Multi-way Self-Supervised Pretraining & Finetuning (v1.0)
================================================================================
MISS Framework for SLID Dataset — Smartphone Tele-Ophthalmology Screening

Architecture:
  Phase 1: Multi-way Self-Supervised Pretraining (all 2617 images)
    - Task A: Masked Image Modeling (MAE-style)
    - Task B: Anatomical Region Prediction (3-class segmentation from patches)
    - Task C: Contrastive Learning (NT-Xent across augmented views)
    - Task D: Rotation Prediction (4-way classification)

  Phase 2: Supervised Finetuning (train/val/test splits)
    - Pretrained ViT encoder + Anatomical Attention + 13-class multi-label head
    - Progressive unfreezing with discriminative learning rates

Benchmark: YOLOv8 mAP 0.873 (image-level) / 0.736 (patient-level) from paper

Run:
  # Phase 1 only
  python train_miss.py --phase pretrain --data_dir ./processed --epochs_pretrain 200

  # Phase 2 only (assumes pretrained checkpoint exists)
  python train_miss.py --phase finetune --data_dir ./processed --pretrained_ckpt ./checkpoints/miss_pretrain_best.pth

  # Both phases
  python train_miss.py --phase both --data_dir ./processed --epochs_pretrain 200 --epochs_finetune 100

  # Quick debug
  python train_miss.py --phase both --data_dir ./processed --epochs_pretrain 2 --epochs_finetune 2 --debug
================================================================================
"""

import os
import sys
import json
import math
import copy
import time
import random
import logging
import argparse
import warnings
from pathlib import Path
from datetime import datetime
from collections import OrderedDict, defaultdict
from typing import Dict, List, Tuple, Optional, Any

import numpy as np
import pandas as pd
from PIL import Image

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torch.cuda.amp import GradScaler, autocast
from torchvision import transforms

try:
    from sklearn.metrics import (
        roc_auc_score, average_precision_score, f1_score,
        precision_score, recall_score, classification_report,
        precision_recall_curve
    )
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    print("WARNING: sklearn not found. Install for full metrics.")

warnings.filterwarnings('ignore')

# ==============================================================================
# Constants
# ==============================================================================

LESION_CLASSES = [
    'Cataract', 'Intraocular lens', 'Lens dislocation',
    'Keratitis', 'Corneal scarring', 'Corneal dystrophy',
    'Corneal/conjunctival tumor', 'Pinguecula', 'Pterygium',
    'Subconjunctival hemorrhage', 'Conjunctival injection',
    'Conjunctival cyst', 'Pigmented nevus',
]
NUM_CLASSES = len(LESION_CLASSES)  # 13

ANATOMICAL_REGIONS = ['Pupil', 'Cornea', 'Conjunctiva']
NUM_REGIONS = 3

# Region-disease routing: which anatomical region is most relevant for each disease
REGION_DISEASE_MAP = {
    'Cataract': 'Pupil', 'Intraocular lens': 'Pupil', 'Lens dislocation': 'Pupil',
    'Keratitis': 'Cornea', 'Corneal scarring': 'Cornea', 'Corneal dystrophy': 'Cornea',
    'Corneal/conjunctival tumor': 'Cornea',  # spans both but primarily corneal
    'Pinguecula': 'Conjunctiva', 'Pterygium': 'Conjunctiva',
    'Subconjunctival hemorrhage': 'Conjunctiva', 'Conjunctival injection': 'Conjunctiva',
    'Conjunctival cyst': 'Conjunctiva', 'Pigmented nevus': 'Conjunctiva',
}

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# Paper benchmark
BENCHMARK_YOLOV8_MAP = 0.873  # image-level from paper


# ==============================================================================
# Logging
# ==============================================================================

def setup_logging(log_dir: str) -> logging.Logger:
    os.makedirs(log_dir, exist_ok=True)
    logger = logging.getLogger('MISS_Train')
    logger.setLevel(logging.DEBUG)
    if logger.handlers:
        logger.handlers.clear()

    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.INFO)
    ch.setFormatter(logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s', '%H:%M:%S'))
    logger.addHandler(ch)

    fh = logging.FileHandler(os.path.join(log_dir, 'training.log'), encoding='utf-8')
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter('[%(asctime)s] %(levelname)s [%(funcName)s]: %(message)s'))
    logger.addHandler(fh)
    return logger


# ==============================================================================
# Datasets
# ==============================================================================

class SLIDPretrainDataset(Dataset):
    """
    Dataset for MISS Phase 1: Self-Supervised Pretraining.
    Returns: image, augmented_view, rotation_label, anatomical_mask
    Uses ALL images (no label needed).
    """

    def __init__(self, img_dir: str, mask_dir: str, img_size: int = 224,
                 filenames: Optional[List[str]] = None):
        self.img_dir = img_dir
        self.mask_dir = mask_dir
        self.img_size = img_size

        if filenames is not None:
            self.filenames = sorted(filenames)
        else:
            self.filenames = sorted([
                f for f in os.listdir(img_dir)
                if f.lower().endswith(('.png', '.jpg', '.jpeg'))
            ])

        # Base transform (no augmentation — for clean view)
        self.base_transform = transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ])

        # Augmented transform (for contrastive view)
        self.aug_transform = transforms.Compose([
            transforms.Resize((int(img_size * 1.1), int(img_size * 1.1))),
            transforms.RandomCrop(img_size),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.ColorJitter(brightness=0.4, contrast=0.4, saturation=0.3, hue=0.1),
            transforms.RandomGrayscale(p=0.1),
            transforms.GaussianBlur(kernel_size=5, sigma=(0.1, 2.0)),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ])

    def __len__(self):
        return len(self.filenames)

    def __getitem__(self, idx):
        fname = self.filenames[idx]
        img_path = os.path.join(self.img_dir, fname)

        try:
            img = Image.open(img_path).convert('RGB')
        except Exception:
            # Fallback: random noise image
            img = Image.fromarray(
                np.random.randint(0, 255, (self.img_size, self.img_size, 3), dtype=np.uint8))

        # Base view
        view1 = self.base_transform(img)

        # Augmented view (for contrastive)
        view2 = self.aug_transform(img)

        # Rotation: randomly rotate and provide label
        rot_label = random.randint(0, 3)
        if rot_label > 0:
            # Rotate PIL image before transform
            rot_img = img.rotate(-90 * rot_label, expand=False)
            view_rot = self.base_transform(rot_img)
        else:
            view_rot = view1.clone()

        # Anatomical mask (3, H, W) — Pupil/Cornea/Conjunctiva
        mask_path = os.path.join(
            self.mask_dir, fname.replace('.png', '_mask.npy').replace('.jpg', '_mask.npy'))
        if os.path.exists(mask_path):
            mask = np.load(mask_path).astype(np.float32)  # (3, H, W)
            # Resize mask to patch grid (14x14 for 224/16)
            patch_size = self.img_size // 16
            mask_resized = np.zeros((3, patch_size, patch_size), dtype=np.float32)
            for c in range(3):
                mask_c = Image.fromarray((mask[c] * 255).astype(np.uint8))
                mask_c = mask_c.resize((patch_size, patch_size), Image.NEAREST)
                mask_resized[c] = np.array(mask_c).astype(np.float32) / 255.0
            mask_tensor = torch.from_numpy(mask_resized)
        else:
            patch_size = self.img_size // 16
            mask_tensor = torch.zeros(3, patch_size, patch_size)

        return {
            'view1': view1,
            'view2': view2,
            'view_rot': view_rot,
            'rot_label': rot_label,
            'mask': mask_tensor,
            'filename': fname,
        }


class SLIDFinetuneDataset(Dataset):
    """
    Dataset for MISS Phase 2: Supervised Finetuning.
    Returns: image, label_vector, anatomical_mask
    """

    def __init__(self, csv_path: str, img_dir: str, mask_dir: str,
                 img_size: int = 224, is_train: bool = True):
        self.img_dir = img_dir
        self.mask_dir = mask_dir
        self.img_size = img_size
        self.is_train = is_train

        self.df = pd.read_csv(csv_path)
        self.filenames = self.df['filename'].tolist()

        # Extract label vectors
        self.labels = self.df[LESION_CLASSES].values.astype(np.float32)

        if is_train:
            self.transform = transforms.Compose([
                transforms.Resize((int(img_size * 1.1), int(img_size * 1.1))),
                transforms.RandomCrop(img_size),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.05),
                transforms.RandomAffine(degrees=15, translate=(0.1, 0.1), scale=(0.9, 1.1)),
                transforms.ToTensor(),
                transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            ])
        else:
            self.transform = transforms.Compose([
                transforms.Resize((img_size, img_size)),
                transforms.ToTensor(),
                transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            ])

    def __len__(self):
        return len(self.filenames)

    def __getitem__(self, idx):
        fname = self.filenames[idx]
        img_path = os.path.join(self.img_dir, fname)

        try:
            img = Image.open(img_path).convert('RGB')
        except Exception:
            img = Image.fromarray(
                np.random.randint(0, 255, (self.img_size, self.img_size, 3), dtype=np.uint8))

        img_tensor = self.transform(img)
        label = torch.from_numpy(self.labels[idx])

        # Mask
        mask_path = os.path.join(
            self.mask_dir, fname.replace('.png', '_mask.npy').replace('.jpg', '_mask.npy'))
        if os.path.exists(mask_path):
            mask = np.load(mask_path).astype(np.float32)
            mask_tensor = torch.from_numpy(mask)  # (3, 224, 224) or target size
        else:
            mask_tensor = torch.zeros(3, self.img_size, self.img_size)

        return {
            'image': img_tensor,
            'label': label,
            'mask': mask_tensor,
            'filename': fname,
        }


# ==============================================================================
# Model Components
# ==============================================================================

class PatchEmbed(nn.Module):
    """Image to Patch Embedding (ViT-style)."""

    def __init__(self, img_size=224, patch_size=16, in_chans=3, embed_dim=384):
        super().__init__()
        self.img_size = img_size
        self.patch_size = patch_size
        self.num_patches = (img_size // patch_size) ** 2  # 196 for 224/16
        self.proj = nn.Conv2d(in_chans, embed_dim, kernel_size=patch_size, stride=patch_size)

    def forward(self, x):
        # x: (B, C, H, W) -> (B, num_patches, embed_dim)
        x = self.proj(x)  # (B, embed_dim, H/P, W/P)
        x = x.flatten(2).transpose(1, 2)  # (B, num_patches, embed_dim)
        return x


class Attention(nn.Module):
    """Multi-head Self-Attention."""

    def __init__(self, dim, num_heads=6, qkv_bias=True, attn_drop=0., proj_drop=0.):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = dim // num_heads
        self.scale = self.head_dim ** -0.5

        self.qkv = nn.Linear(dim, dim * 3, bias=qkv_bias)
        self.attn_drop = nn.Dropout(attn_drop)
        self.proj = nn.Linear(dim, dim)
        self.proj_drop = nn.Dropout(proj_drop)

    def forward(self, x):
        B, N, C = x.shape
        qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim).permute(2, 0, 3, 1, 4)
        q, k, v = qkv.unbind(0)

        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)
        attn = self.attn_drop(attn)

        x = (attn @ v).transpose(1, 2).reshape(B, N, C)
        x = self.proj(x)
        x = self.proj_drop(x)
        return x


class MLP(nn.Module):
    """MLP block for Transformer."""

    def __init__(self, in_features, hidden_features=None, out_features=None,
                 act_layer=nn.GELU, drop=0.):
        super().__init__()
        out_features = out_features or in_features
        hidden_features = hidden_features or in_features
        self.fc1 = nn.Linear(in_features, hidden_features)
        self.act = act_layer()
        self.fc2 = nn.Linear(hidden_features, out_features)
        self.drop = nn.Dropout(drop)

    def forward(self, x):
        x = self.fc1(x)
        x = self.act(x)
        x = self.drop(x)
        x = self.fc2(x)
        x = self.drop(x)
        return x


class TransformerBlock(nn.Module):
    """Standard Transformer Encoder Block."""

    def __init__(self, dim, num_heads, mlp_ratio=4., qkv_bias=True,
                 drop=0., attn_drop=0., drop_path=0.):
        super().__init__()
        self.norm1 = nn.LayerNorm(dim)
        self.attn = Attention(dim, num_heads, qkv_bias, attn_drop, drop)
        self.norm2 = nn.LayerNorm(dim)
        self.mlp = MLP(dim, int(dim * mlp_ratio), drop=drop)

        # Stochastic depth
        self.drop_path = DropPath(drop_path) if drop_path > 0. else nn.Identity()

    def forward(self, x):
        x = x + self.drop_path(self.attn(self.norm1(x)))
        x = x + self.drop_path(self.mlp(self.norm2(x)))
        return x


class DropPath(nn.Module):
    """Stochastic Depth."""

    def __init__(self, drop_prob=0.):
        super().__init__()
        self.drop_prob = drop_prob

    def forward(self, x):
        if not self.training or self.drop_prob == 0.:
            return x
        keep_prob = 1 - self.drop_prob
        shape = (x.shape[0],) + (1,) * (x.ndim - 1)
        random_tensor = torch.rand(shape, dtype=x.dtype, device=x.device)
        random_tensor = torch.floor(random_tensor + keep_prob)
        output = x / keep_prob * random_tensor
        return output


class ViTEncoder(nn.Module):
    """
    Vision Transformer Encoder (ViT-Small/16).

    Config: embed_dim=384, depth=12, num_heads=6, mlp_ratio=4
    ~22M parameters — right capacity for 2617-image dataset with SSL
    """

    def __init__(self, img_size=224, patch_size=16, in_chans=3,
                 embed_dim=384, depth=12, num_heads=6, mlp_ratio=4.,
                 drop_rate=0., attn_drop_rate=0., drop_path_rate=0.1):
        super().__init__()
        self.embed_dim = embed_dim
        self.num_patches = (img_size // patch_size) ** 2  # 196

        # Patch embedding
        self.patch_embed = PatchEmbed(img_size, patch_size, in_chans, embed_dim)

        # CLS token + position embeddings
        self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
        self.pos_embed = nn.Parameter(torch.zeros(1, 1 + self.num_patches, embed_dim))
        self.pos_drop = nn.Dropout(p=drop_rate)

        # Transformer blocks with stochastic depth
        dpr = [x.item() for x in torch.linspace(0, drop_path_rate, depth)]
        self.blocks = nn.ModuleList([
            TransformerBlock(embed_dim, num_heads, mlp_ratio, True,
                             drop_rate, attn_drop_rate, dpr[i])
            for i in range(depth)
        ])
        self.norm = nn.LayerNorm(embed_dim)

        # Initialize
        nn.init.trunc_normal_(self.pos_embed, std=0.02)
        nn.init.trunc_normal_(self.cls_token, std=0.02)
        self.apply(self._init_weights)

    def _init_weights(self, m):
        if isinstance(m, nn.Linear):
            nn.init.trunc_normal_(m.weight, std=0.02)
            if m.bias is not None:
                nn.init.constant_(m.bias, 0)
        elif isinstance(m, nn.LayerNorm):
            nn.init.constant_(m.bias, 0)
            nn.init.constant_(m.weight, 1.0)

    def forward(self, x, return_all_tokens=False):
        B = x.shape[0]

        # Patch embedding
        x = self.patch_embed(x)  # (B, 196, 384)

        # Prepend CLS token
        cls_tokens = self.cls_token.expand(B, -1, -1)
        x = torch.cat((cls_tokens, x), dim=1)  # (B, 197, 384)

        # Add positional embedding
        x = x + self.pos_embed
        x = self.pos_drop(x)

        # Transformer blocks
        for blk in self.blocks:
            x = blk(x)

        x = self.norm(x)

        if return_all_tokens:
            return x  # (B, 197, 384)
        else:
            return x[:, 0]  # CLS token only: (B, 384)

    def get_patch_tokens(self, x):
        """Return patch tokens only (no CLS), shape (B, 196, 384)."""
        all_tokens = self.forward(x, return_all_tokens=True)
        return all_tokens[:, 1:]  # Remove CLS


# ==============================================================================
# MISS Pretraining Model (Phase 1)
# ==============================================================================

class MISSPretrainModel(nn.Module):
    """
    Multi-way Self-Supervised (MISS) Pretraining Model.

    Four simultaneous pretext tasks:
    A) Masked Image Modeling (MAE-style reconstruction)
    B) Anatomical Region Prediction (patch -> pupil/cornea/conjunctiva)
    C) Contrastive Learning (NT-Xent across views)
    D) Rotation Prediction (0/90/180/270 degrees)
    """

    def __init__(self, img_size=224, patch_size=16, embed_dim=384, depth=12,
                 num_heads=6, mask_ratio=0.75, temperature=0.07):
        super().__init__()
        self.mask_ratio = mask_ratio
        self.temperature = temperature
        self.patch_size = patch_size
        self.num_patches = (img_size // patch_size) ** 2  # 196
        self.grid_size = img_size // patch_size  # 14

        # Shared encoder
        self.encoder = ViTEncoder(
            img_size=img_size, patch_size=patch_size, embed_dim=embed_dim,
            depth=depth, num_heads=num_heads
        )

        # === Task A: Masked Image Modeling ===
        # Lightweight decoder for pixel reconstruction
        self.mim_decoder = nn.Sequential(
            nn.Linear(embed_dim, embed_dim),
            nn.GELU(),
            nn.Linear(embed_dim, patch_size * patch_size * 3),  # Reconstruct RGB patches
        )
        self.mask_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
        nn.init.trunc_normal_(self.mask_token, std=0.02)

        # === Task B: Anatomical Region Prediction ===
        # Per-patch classification: which region does this patch belong to?
        self.region_head = nn.Sequential(
            nn.Linear(embed_dim, embed_dim // 2),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(embed_dim // 2, NUM_REGIONS),  # 3: Pupil, Cornea, Conjunctiva
        )

        # === Task C: Contrastive Learning ===
        # Projection head for NT-Xent
        self.contrastive_proj = nn.Sequential(
            nn.Linear(embed_dim, embed_dim),
            nn.GELU(),
            nn.Linear(embed_dim, 128),  # Project to 128-d for contrastive
        )

        # === Task D: Rotation Prediction ===
        self.rotation_head = nn.Sequential(
            nn.Linear(embed_dim, embed_dim // 2),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(embed_dim // 2, 4),  # 4 rotation classes
        )

    def random_masking(self, x, mask_ratio):
        """
        Random masking for MAE-style MIM.
        x: (B, N, D) patch embeddings
        Returns: masked_x, mask, ids_restore
        """
        B, N, D = x.shape
        len_keep = int(N * (1 - mask_ratio))

        noise = torch.rand(B, N, device=x.device)
        ids_shuffle = torch.argsort(noise, dim=1)
        ids_restore = torch.argsort(ids_shuffle, dim=1)

        # Keep subset
        ids_keep = ids_shuffle[:, :len_keep]
        x_masked = torch.gather(x, 1, ids_keep.unsqueeze(-1).expand(-1, -1, D))

        # Binary mask: 1 = masked, 0 = kept
        mask = torch.ones(B, N, device=x.device)
        mask[:, :len_keep] = 0
        mask = torch.gather(mask, 1, ids_restore)

        return x_masked, mask, ids_restore

    def forward_mim(self, x):
        """Masked Image Modeling forward pass."""
        B = x.shape[0]

        # Get patch embeddings (before transformer)
        patch_embeds = self.encoder.patch_embed(x)  # (B, 196, 384)

        # Random masking
        x_masked, mask, ids_restore = self.random_masking(patch_embeds, self.mask_ratio)

        # Add CLS token
        cls_tokens = self.encoder.cls_token.expand(B, -1, -1)
        x_with_cls = torch.cat((cls_tokens, x_masked), dim=1)

        # Add positional embedding for visible patches
        # Need to handle position embedding for visible patches only
        cls_pos = self.encoder.pos_embed[:, :1, :]
        patch_pos = self.encoder.pos_embed[:, 1:, :]

        len_keep = x_masked.shape[1]
        # We need ids_keep from the masking
        noise = torch.rand(B, self.num_patches, device=x.device)
        ids_shuffle = torch.argsort(noise, dim=1)
        ids_keep = ids_shuffle[:, :len_keep]

        # Simpler approach: just add positional embedding to all, then mask
        # Re-do: use full sequence with mask tokens
        mask_tokens = self.mask_token.expand(B, self.num_patches, -1)

        # Create full sequence: visible patches + mask tokens at masked positions
        full_patches = patch_embeds.clone()
        # Apply mask: replace masked positions with mask_token
        mask_expanded = mask.unsqueeze(-1).expand_as(full_patches)
        full_patches = full_patches * (1 - mask_expanded) + mask_tokens * mask_expanded

        # Add CLS + positional embedding
        x_full = torch.cat((cls_tokens, full_patches), dim=1)
        x_full = x_full + self.encoder.pos_embed
        x_full = self.encoder.pos_drop(x_full)

        # Pass through transformer
        for blk in self.encoder.blocks:
            x_full = blk(x_full)
        x_full = self.encoder.norm(x_full)

        # Decode masked patches
        patch_tokens = x_full[:, 1:]  # Remove CLS: (B, 196, 384)
        pred = self.mim_decoder(patch_tokens)  # (B, 196, patch_size^2 * 3)

        # Target: original image patchified
        target = self.patchify(x)  # (B, 196, patch_size^2 * 3)

        # Loss only on masked patches
        loss = (pred - target) ** 2
        loss = loss.mean(dim=-1)  # Per-patch MSE: (B, 196)
        loss = (loss * mask).sum() / (mask.sum() + 1e-8)

        return loss

    def patchify(self, imgs):
        """Convert images to patches for MIM target."""
        p = self.patch_size
        B, C, H, W = imgs.shape
        h, w = H // p, W // p
        x = imgs.reshape(B, C, h, p, w, p)
        x = x.permute(0, 2, 4, 3, 5, 1)  # (B, h, w, p, p, C)
        x = x.reshape(B, h * w, p * p * C)  # (B, num_patches, patch_size^2 * 3)
        return x

    def forward_region(self, x, mask_target):
        """Anatomical Region Prediction."""
        patch_tokens = self.encoder.get_patch_tokens(x)  # (B, 196, 384)
        region_pred = self.region_head(patch_tokens)  # (B, 196, 3)

        # Reshape to grid
        B = x.shape[0]
        region_pred = region_pred.reshape(B, self.grid_size, self.grid_size, NUM_REGIONS)
        region_pred = region_pred.permute(0, 3, 1, 2)  # (B, 3, 14, 14)

        # mask_target: (B, 3, 14, 14) — multi-label per patch
        # Use BCE loss (a patch can belong to multiple regions)
        loss = F.binary_cross_entropy_with_logits(region_pred, mask_target)
        return loss

    def forward_contrastive(self, view1, view2):
        """NT-Xent Contrastive Loss."""
        # Get CLS embeddings
        z1 = self.encoder(view1, return_all_tokens=False)  # (B, 384)
        z2 = self.encoder(view2, return_all_tokens=False)  # (B, 384)

        # Project
        z1 = self.contrastive_proj(z1)  # (B, 128)
        z2 = self.contrastive_proj(z2)  # (B, 128)

        # Normalize
        z1 = F.normalize(z1, dim=-1)
        z2 = F.normalize(z2, dim=-1)

        # NT-Xent loss
        B = z1.shape[0]
        z = torch.cat([z1, z2], dim=0)  # (2B, 128)
        sim = torch.mm(z, z.t()) / self.temperature  # (2B, 2B)

        # Create labels: positive pairs are (i, i+B) and (i+B, i)
        labels = torch.cat([torch.arange(B) + B, torch.arange(B)]).to(z.device)

        # Mask out self-similarity
        mask = torch.eye(2 * B, dtype=torch.bool, device=z.device)
        sim.masked_fill_(mask, -1e4)

        loss = F.cross_entropy(sim, labels)
        return loss

    def forward_rotation(self, x_rot, rot_label):
        """Rotation Prediction (4-way)."""
        cls_feat = self.encoder(x_rot, return_all_tokens=False)  # (B, 384)
        rot_pred = self.rotation_head(cls_feat)  # (B, 4)
        loss = F.cross_entropy(rot_pred, rot_label)

        # Accuracy for logging
        acc = (rot_pred.argmax(dim=-1) == rot_label).float().mean()
        return loss, acc

    def forward(self, batch, task_weights=None):
        """
        Combined forward pass for all 4 pretext tasks.
        Returns total loss and per-task losses.
        """
        if task_weights is None:
            task_weights = {'mim': 1.0, 'region': 1.0, 'contrastive': 0.5, 'rotation': 0.5}

        view1 = batch['view1']
        view2 = batch['view2']
        view_rot = batch['view_rot']
        rot_label = batch['rot_label']
        mask = batch['mask']

        losses = {}

        # Task A: Masked Image Modeling
        loss_mim = self.forward_mim(view1)
        losses['mim'] = loss_mim

        # Task B: Anatomical Region Prediction
        loss_region = self.forward_region(view1, mask)
        losses['region'] = loss_region

        # Task C: Contrastive Learning
        loss_contrastive = self.forward_contrastive(view1, view2)
        losses['contrastive'] = loss_contrastive

        # Task D: Rotation Prediction
        loss_rotation, rot_acc = self.forward_rotation(view_rot, rot_label)
        losses['rotation'] = loss_rotation
        losses['rot_acc'] = rot_acc

        # Weighted total
        total = sum(task_weights.get(k, 1.0) * v for k, v in losses.items()
                    if k != 'rot_acc')
        losses['total'] = total

        return losses


# ==============================================================================
# Anatomical Attention Module (Phase 2)
# ==============================================================================

class AnatomicalAttention(nn.Module):
    """
    Region-guided attention: routes patch features through anatomical
    region masks to produce region-specific representations.

    Key insight: Cataract lives in Pupil region, Pterygium in Conjunctiva.
    By pooling features from the relevant anatomical region, we give the
    classifier focused evidence.
    """

    def __init__(self, embed_dim=384, num_regions=3, num_classes=13):
        super().__init__()
        self.embed_dim = embed_dim
        self.num_regions = num_regions

        # Per-region attention projection
        self.region_query = nn.Parameter(torch.randn(num_regions, embed_dim))
        nn.init.trunc_normal_(self.region_query, std=0.02)

        # Cross-attention: region queries attend to patch tokens
        self.cross_attn = nn.MultiheadAttention(
            embed_dim, num_heads=6, dropout=0.1, batch_first=True)

        # Region-to-disease routing weights (learnable)
        # Shape: (num_classes, num_regions) — which region matters for each disease
        self.region_routing = nn.Parameter(torch.zeros(num_classes, num_regions))
        self._init_routing()

        # Final fusion
        self.fusion = nn.Sequential(
            nn.LayerNorm(embed_dim),
            nn.Linear(embed_dim, embed_dim),
            nn.GELU(),
            nn.Dropout(0.1),
        )

    def _init_routing(self):
        """Initialize routing based on medical knowledge."""
        routing_init = torch.zeros(NUM_CLASSES, NUM_REGIONS)
        for i, cls in enumerate(LESION_CLASSES):
            region = REGION_DISEASE_MAP.get(cls, 'Conjunctiva')
            region_idx = ANATOMICAL_REGIONS.index(region)
            routing_init[i, region_idx] = 2.0  # Strong prior
            # Also give some weight to other regions
            for j in range(NUM_REGIONS):
                if j != region_idx:
                    routing_init[i, j] = 0.5
        self.region_routing.data = routing_init

    def forward(self, patch_tokens, masks=None):
        """
        Args:
            patch_tokens: (B, N, D) — patch embeddings from ViT
            masks: (B, 3, H, W) — anatomical region masks (optional)

        Returns:
            region_features: (B, D) — fused region-aware features
            routing_weights: (B, num_classes, num_regions) — for interpretability
        """
        B, N, D = patch_tokens.shape

        # Region queries: (num_regions, D) -> (B, num_regions, D)
        queries = self.region_query.unsqueeze(0).expand(B, -1, -1)

        # Cross-attention: region queries attend to patch tokens
        region_feats, attn_weights = self.cross_attn(queries, patch_tokens, patch_tokens)
        # region_feats: (B, num_regions, D)

        # If masks available, apply mask-guided weighting
        if masks is not None and masks.shape[-1] > 1:
            # Resize masks to match patch grid
            grid = int(math.sqrt(N))
            masks_resized = F.interpolate(masks, size=(grid, grid), mode='nearest')
            masks_flat = masks_resized.flatten(2)  # (B, 3, N)

            # Weight patch tokens by region masks
            for r in range(self.num_regions):
                mask_weight = masks_flat[:, r:r+1, :].transpose(1, 2)  # (B, N, 1)
                # Soft attention: combine cross-attention with mask guidance
                masked_tokens = patch_tokens * mask_weight  # (B, N, D)
                region_feats[:, r] = region_feats[:, r] + masked_tokens.mean(dim=1)

        # Apply routing: weighted combination of region features per class
        routing_weights = F.softmax(self.region_routing, dim=-1)  # (num_classes, num_regions)

        # Compute per-class features: (B, num_classes, D)
        # class_feats[b, c] = sum_r routing[c,r] * region_feats[b, r]
        class_feats = torch.einsum('cr,brd->bcd', routing_weights, region_feats)
        # Average across classes for final representation
        fused = class_feats.mean(dim=1)  # (B, D)

        fused = self.fusion(fused)
        return fused, routing_weights.unsqueeze(0).expand(B, -1, -1)


# ==============================================================================
# MISS Finetuning Model (Phase 2)
# ==============================================================================

class MISSFinetuneModel(nn.Module):
    """
    Multi-label classifier with Anatomical Attention.

    Architecture:
      ViT Encoder (pretrained) -> Anatomical Attention -> 13-class sigmoid head
    """

    def __init__(self, encoder: ViTEncoder, embed_dim=384, num_classes=13,
                 dropout=0.3):
        super().__init__()
        self.encoder = encoder
        self.anatomical_attn = AnatomicalAttention(embed_dim, NUM_REGIONS, num_classes)

        # Classification head
        self.classifier = nn.Sequential(
            nn.LayerNorm(embed_dim),
            nn.Dropout(dropout),
            nn.Linear(embed_dim, embed_dim // 2),
            nn.GELU(),
            nn.Dropout(dropout * 0.5),
            nn.Linear(embed_dim // 2, num_classes),
        )

        # Also use CLS token
        self.cls_proj = nn.Sequential(
            nn.LayerNorm(embed_dim),
            nn.Linear(embed_dim, embed_dim),
            nn.GELU(),
        )

        # Final fusion of CLS + anatomical attention
        self.final_head = nn.Sequential(
            nn.Linear(embed_dim * 2, embed_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(embed_dim, num_classes),
        )

    def forward(self, x, masks=None):
        """
        Args:
            x: (B, 3, 224, 224) images
            masks: (B, 3, H, W) anatomical masks

        Returns:
            logits: (B, 13) raw logits for BCEWithLogitsLoss
            routing_weights: (B, 13, 3) for interpretability
        """
        # Get all tokens from encoder
        all_tokens = self.encoder(x, return_all_tokens=True)  # (B, 197, 384)
        cls_token = all_tokens[:, 0]  # (B, 384)
        patch_tokens = all_tokens[:, 1:]  # (B, 196, 384)

        # CLS pathway
        cls_feat = self.cls_proj(cls_token)  # (B, 384)

        # Anatomical Attention pathway
        anat_feat, routing_weights = self.anatomical_attn(patch_tokens, masks)

        # Fuse both pathways
        combined = torch.cat([cls_feat, anat_feat], dim=-1)  # (B, 768)
        logits = self.final_head(combined)  # (B, 13)

        return logits, routing_weights

    def freeze_encoder(self):
        """Freeze encoder for initial finetuning."""
        for param in self.encoder.parameters():
            param.requires_grad = False

# In MISSFinetuneModel, replace unfreeze_encoder():
    def unfreeze_encoder(self, unfreeze_last_n=4):
        """Freeze all encoder first, then unfreeze last N blocks."""
        # First freeze everything
        for param in self.encoder.parameters():
            param.requires_grad = False

        # Unfreeze norm
        for param in self.encoder.norm.parameters():
            param.requires_grad = True

        # Unfreeze last N blocks
        total_blocks = len(self.encoder.blocks)
        for i in range(total_blocks - unfreeze_last_n, total_blocks):
            for param in self.encoder.blocks[i].parameters():
                param.requires_grad = True
    def unfreeze_all(self):
        """Unfreeze everything."""
        for param in self.parameters():
            param.requires_grad = True


# ==============================================================================
# Training Utilities
# ==============================================================================

class EarlyStopping:
    def __init__(self, patience=15, min_delta=1e-4, mode='max'):
        self.patience = patience
        self.min_delta = min_delta
        self.mode = mode
        self.counter = 0
        self.best_score = None
        self.early_stop = False

    def __call__(self, score):
        if self.best_score is None:
            self.best_score = score
            return False

        if self.mode == 'max':
            improved = score > self.best_score + self.min_delta
        else:
            improved = score < self.best_score - self.min_delta

        if improved:
            self.best_score = score
            self.counter = 0
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.early_stop = True
                return True
        return False


class CosineWarmupScheduler:
    """Cosine schedule with linear warmup."""

    def __init__(self, optimizer, warmup_epochs, total_epochs, min_lr=1e-6):
        self.optimizer = optimizer
        self.warmup_epochs = warmup_epochs
        self.total_epochs = total_epochs
        self.min_lr = min_lr
        self.base_lrs = [pg['lr'] for pg in optimizer.param_groups]

    def step(self, epoch):
        if epoch < self.warmup_epochs:
            # Linear warmup
            alpha = epoch / max(self.warmup_epochs, 1)
            for pg, base_lr in zip(self.optimizer.param_groups, self.base_lrs):
                pg['lr'] = base_lr * alpha
        else:
            # Cosine decay
            progress = (epoch - self.warmup_epochs) / max(
                self.total_epochs - self.warmup_epochs, 1)
            alpha = 0.5 * (1 + math.cos(math.pi * progress))
            for pg, base_lr in zip(self.optimizer.param_groups, self.base_lrs):
                pg['lr'] = self.min_lr + (base_lr - self.min_lr) * alpha


def load_class_weights(processed_dir: str, device: torch.device) -> torch.Tensor:
    """Load precomputed class weights from preprocessing."""
    weights_path = os.path.join(processed_dir, 'class_weights.json')
    if os.path.exists(weights_path):
        with open(weights_path) as f:
            weights = json.load(f)
        w = weights.get('recommended_array', None)
        if w:
            return torch.tensor(w, dtype=torch.float32, device=device)

    # Fallback: uniform weights
    return torch.ones(NUM_CLASSES, dtype=torch.float32, device=device)


# ==============================================================================
# Evaluation Metrics
# ==============================================================================

def find_optimal_thresholds(labels: np.ndarray, probs: np.ndarray,
                            metric='f1') -> np.ndarray:
    """Find optimal per-class thresholds using validation set."""
    thresholds = np.full(NUM_CLASSES, 0.5)

    if not HAS_SKLEARN:
        return thresholds

    for i in range(NUM_CLASSES):
        if labels[:, i].sum() == 0:
            continue

        precisions, recalls, thresh = precision_recall_curve(labels[:, i], probs[:, i])

        if metric == 'f1':
            f1_scores = 2 * precisions * recalls / (precisions + recalls + 1e-8)
            best_idx = np.argmax(f1_scores)
            if best_idx < len(thresh):
                thresholds[i] = thresh[best_idx]

    return thresholds


def compute_metrics(labels: np.ndarray, probs: np.ndarray,
                    thresholds: Optional[np.ndarray] = None,
                    prefix: str = '') -> dict:
    """
    Comprehensive multi-label evaluation metrics.

    Computes:
    - Per-class: AUC-ROC, AP, F1, Precision, Recall
    - Macro/micro averages
    - Exact match ratio
    - Hamming loss
    - mAP (to compare with paper's YOLOv8 benchmark)
    """
    metrics = {}

    if thresholds is None:
        thresholds = np.full(NUM_CLASSES, 0.5)

    preds = (probs >= thresholds).astype(int)

    # Per-class metrics
    per_class = {}
    valid_aucs = []
    valid_aps = []

    for i, cls in enumerate(LESION_CLASSES):
        cls_metrics = {}
        n_pos = int(labels[:, i].sum())
        n_neg = int((1 - labels[:, i]).sum())
        cls_metrics['n_positive'] = n_pos
        cls_metrics['n_negative'] = n_neg
        cls_metrics['threshold'] = float(thresholds[i])

        if n_pos > 0 and n_neg > 0 and HAS_SKLEARN:
            try:
                cls_metrics['auc_roc'] = float(roc_auc_score(labels[:, i], probs[:, i]))
                valid_aucs.append(cls_metrics['auc_roc'])
            except ValueError:
                cls_metrics['auc_roc'] = 0.0

            cls_metrics['ap'] = float(average_precision_score(labels[:, i], probs[:, i]))
            valid_aps.append(cls_metrics['ap'])
        else:
            cls_metrics['auc_roc'] = 0.0
            cls_metrics['ap'] = 0.0

        if n_pos > 0:
            cls_metrics['f1'] = float(f1_score(labels[:, i], preds[:, i], zero_division=0))
            cls_metrics['precision'] = float(precision_score(
                labels[:, i], preds[:, i], zero_division=0))
            cls_metrics['recall'] = float(recall_score(
                labels[:, i], preds[:, i], zero_division=0))
        else:
            cls_metrics['f1'] = 0.0
            cls_metrics['precision'] = 0.0
            cls_metrics['recall'] = 0.0

        per_class[cls] = cls_metrics

    metrics[prefix + 'per_class'] = per_class

    # Aggregated metrics
    if valid_aucs:
        metrics[prefix + 'macro_auc'] = float(np.mean(valid_aucs))
    else:
        metrics[prefix + 'macro_auc'] = 0.0

    if valid_aps:
        metrics[prefix + 'mAP'] = float(np.mean(valid_aps))  # Comparable to paper's mAP
    else:
        metrics[prefix + 'mAP'] = 0.0

    if HAS_SKLEARN:
        metrics[prefix + 'macro_f1'] = float(f1_score(
            labels, preds, average='macro', zero_division=0))
        metrics[prefix + 'micro_f1'] = float(f1_score(
            labels, preds, average='micro', zero_division=0))
        metrics[prefix + 'weighted_f1'] = float(f1_score(
            labels, preds, average='weighted', zero_division=0))

    # Exact match ratio
    exact_match = float((preds == labels).all(axis=1).mean())
    metrics[prefix + 'exact_match'] = exact_match

    # Hamming loss
    hamming = float((preds != labels).mean())
    metrics[prefix + 'hamming_loss'] = hamming

    # Comparison with benchmark
    metrics[prefix + 'benchmark_yolov8_mAP'] = BENCHMARK_YOLOV8_MAP
    if valid_aps:
        metrics[prefix + 'vs_benchmark'] = float(np.mean(valid_aps)) - BENCHMARK_YOLOV8_MAP

    return metrics


def print_metrics_table(metrics: dict, logger: logging.Logger, prefix: str = ''):
    """Print formatted metrics table."""
    logger.info("")
    logger.info("=" * 90)
    logger.info("EVALUATION RESULTS %s", prefix)
    logger.info("=" * 90)

    # Per-class table
    logger.info("%-32s %8s %8s %8s %8s %8s %8s",
                'Class', 'AUC', 'AP', 'F1', 'Prec', 'Recall', 'Thresh')
    logger.info("-" * 90)

    per_class = metrics.get('per_class', metrics.get(prefix + 'per_class', {}))
    for cls in LESION_CLASSES:
        cm = per_class.get(cls, {})
        logger.info("%-32s %8.4f %8.4f %8.4f %8.4f %8.4f %8.3f",
                     cls,
                     cm.get('auc_roc', 0), cm.get('ap', 0),
                     cm.get('f1', 0), cm.get('precision', 0),
                     cm.get('recall', 0), cm.get('threshold', 0.5))

    logger.info("-" * 90)

    # Summary
    mAP = metrics.get('mAP', metrics.get(prefix + 'mAP', 0))
    macro_auc = metrics.get('macro_auc', metrics.get(prefix + 'macro_auc', 0))
    macro_f1 = metrics.get('macro_f1', metrics.get(prefix + 'macro_f1', 0))
    micro_f1 = metrics.get('micro_f1', metrics.get(prefix + 'micro_f1', 0))
    exact_match = metrics.get('exact_match', metrics.get(prefix + 'exact_match', 0))
    hamming = metrics.get('hamming_loss', metrics.get(prefix + 'hamming_loss', 0))

    logger.info("")
    logger.info("  mAP (mean Average Precision):  %.4f", mAP)
    logger.info("  Macro AUC-ROC:                 %.4f", macro_auc)
    logger.info("  Macro F1:                      %.4f", macro_f1)
    logger.info("  Micro F1:                      %.4f", micro_f1)
    logger.info("  Exact Match Ratio:             %.4f", exact_match)
    logger.info("  Hamming Loss:                  %.4f", hamming)
    logger.info("")
    logger.info("  --- Benchmark Comparison ---")
    logger.info("  YOLOv8 mAP (paper, img-level): %.3f", BENCHMARK_YOLOV8_MAP)
    logger.info("  MISS mAP (ours):               %.3f", mAP)
    logger.info("  Delta:                         %+.3f", mAP - BENCHMARK_YOLOV8_MAP)

    if mAP > BENCHMARK_YOLOV8_MAP:
        logger.info("  >>> EXCEEDS PAPER BENCHMARK! <<<")
    elif mAP > 0.736:
        logger.info("  >>> Exceeds patient-level benchmark (0.736) <<<")

    logger.info("=" * 90)


# ==============================================================================
# Phase 1: Self-Supervised Pretraining
# ==============================================================================

def pretrain(args, logger):
    """MISS Phase 1: Multi-way Self-Supervised Pretraining."""
    logger.info("=" * 60)
    logger.info("MISS Phase 1: Self-Supervised Pretraining")
    logger.info("=" * 60)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    logger.info("Device: %s", device)

    # Dataset: use ALL images
    img_dir = os.path.join(args.data_dir, 'images')
    mask_dir = os.path.join(args.data_dir, 'masks')

    dataset = SLIDPretrainDataset(img_dir, mask_dir, args.img_size)
    logger.info("Pretraining dataset: %d images", len(dataset))

    dataloader = DataLoader(
        dataset, batch_size=args.batch_size_pretrain,
        shuffle=True, num_workers=args.num_workers,
        pin_memory=True, drop_last=True
    )

    # Model
    model = MISSPretrainModel(
        img_size=args.img_size,
        patch_size=16,
        embed_dim=args.embed_dim,
        depth=args.depth,
        num_heads=args.num_heads,
        mask_ratio=args.mask_ratio,
        temperature=args.temperature,
    ).to(device)

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    logger.info("Model parameters: %.2fM total, %.2fM trainable",
                total_params / 1e6, trainable_params / 1e6)

    # Optimizer
    optimizer = optim.AdamW(
        model.parameters(),
        lr=args.lr_pretrain,
        weight_decay=args.weight_decay,
        betas=(0.9, 0.95),
    )

    scheduler = CosineWarmupScheduler(
        optimizer, warmup_epochs=args.warmup_epochs,
        total_epochs=args.epochs_pretrain, min_lr=1e-6
    )

    scaler = GradScaler() if device.type == 'cuda' else None

    # Task weights (can be tuned)
    task_weights = {
        'mim': 1.0,
        'region': 1.0,
        'contrastive': 0.5,
        'rotation': 0.5,
    }

    # Checkpoint directory
    ckpt_dir = os.path.join(args.checkpoint_dir, 'pretrain')
    os.makedirs(ckpt_dir, exist_ok=True)

    best_loss = float('inf')
    history = []

    for epoch in range(args.epochs_pretrain):
        model.train()
        scheduler.step(epoch)

        epoch_losses = defaultdict(float)
        n_batches = 0

        for batch in dataloader:
            # Move to device
            batch = {k: v.to(device) if isinstance(v, torch.Tensor) else v
                     for k, v in batch.items()}

            optimizer.zero_grad()

            if scaler:
                with autocast():
                    losses = model(batch, task_weights)
                scaler.scale(losses['total']).backward()
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                scaler.step(optimizer)
                scaler.update()
            else:
                losses = model(batch, task_weights)
                losses['total'].backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()

            for k, v in losses.items():
                epoch_losses[k] += v.item() if isinstance(v, torch.Tensor) else v
            n_batches += 1

        # Average losses
        avg_losses = {k: v / max(n_batches, 1) for k, v in epoch_losses.items()}
        history.append(avg_losses)

        lr = optimizer.param_groups[0]['lr']
        logger.info(
            "Epoch %3d/%d | lr=%.2e | total=%.4f | mim=%.4f | region=%.4f | "
            "contrast=%.4f | rotation=%.4f | rot_acc=%.3f",
            epoch + 1, args.epochs_pretrain, lr,
            avg_losses['total'], avg_losses['mim'], avg_losses['region'],
            avg_losses['contrastive'], avg_losses['rotation'],
            avg_losses.get('rot_acc', 0)
        )

        # Save best
        if avg_losses['total'] < best_loss:
            best_loss = avg_losses['total']
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'encoder_state_dict': model.encoder.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'loss': best_loss,
                'task_weights': task_weights,
                'args': vars(args),
            }, os.path.join(ckpt_dir, 'miss_pretrain_best.pth'))

        # Periodic save
        if (epoch + 1) % 50 == 0 or epoch == args.epochs_pretrain - 1:
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'encoder_state_dict': model.encoder.state_dict(),
                'loss': avg_losses['total'],
            }, os.path.join(ckpt_dir, f'miss_pretrain_ep{epoch+1}.pth'))

    logger.info("Pretraining complete. Best loss: %.4f", best_loss)
    logger.info("Checkpoint: %s", os.path.join(ckpt_dir, 'miss_pretrain_best.pth'))

    # Save history
    with open(os.path.join(ckpt_dir, 'pretrain_history.json'), 'w') as f:
        json.dump(history, f, indent=2)

    return os.path.join(ckpt_dir, 'miss_pretrain_best.pth')


# ==============================================================================
# Phase 2: Supervised Finetuning
# ==============================================================================

def finetune(args, logger, pretrained_path: Optional[str] = None):
    """MISS Phase 2: Supervised Finetuning with Anatomical Attention."""
    logger.info("=" * 60)
    logger.info("MISS Phase 2: Supervised Finetuning")
    logger.info("=" * 60)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    logger.info("Device: %s", device)

    # Datasets
    split_dir = os.path.join(args.data_dir, 'splits')
    img_dir = os.path.join(args.data_dir, 'images')
    mask_dir = os.path.join(args.data_dir, 'masks')

    train_dataset = SLIDFinetuneDataset(
        os.path.join(split_dir, 'train.csv'), img_dir, mask_dir,
        args.img_size, is_train=True)
    val_dataset = SLIDFinetuneDataset(
        os.path.join(split_dir, 'val.csv'), img_dir, mask_dir,
        args.img_size, is_train=False)
    test_dataset = SLIDFinetuneDataset(
        os.path.join(split_dir, 'test.csv'), img_dir, mask_dir,
        args.img_size, is_train=False)

    logger.info("Train: %d, Val: %d, Test: %d",
                len(train_dataset), len(val_dataset), len(test_dataset))

    # Weighted sampler for imbalanced training
    train_labels = train_dataset.labels
    sample_weights = np.ones(len(train_labels))
    for i in range(NUM_CLASSES):
        pos_mask = train_labels[:, i] == 1
        n_pos = pos_mask.sum()
        if n_pos > 0:
            weight = len(train_labels) / (NUM_CLASSES * n_pos)
            sample_weights[pos_mask] += weight

    sampler = WeightedRandomSampler(
        weights=sample_weights,
        num_samples=len(train_labels),
        replacement=True
    )

    train_loader = DataLoader(
        train_dataset, batch_size=args.batch_size_finetune,
        sampler=sampler, num_workers=args.num_workers,
        pin_memory=True, drop_last=True)
    val_loader = DataLoader(
        val_dataset, batch_size=args.batch_size_finetune * 2,
        shuffle=False, num_workers=args.num_workers, pin_memory=True)
    test_loader = DataLoader(
        test_dataset, batch_size=args.batch_size_finetune * 2,
        shuffle=False, num_workers=args.num_workers, pin_memory=True)

    # Build model
    encoder = ViTEncoder(
        img_size=args.img_size, patch_size=16,
        embed_dim=args.embed_dim, depth=args.depth, num_heads=args.num_heads,
        drop_rate=0.1, attn_drop_rate=0.1, drop_path_rate=0.2
    )

    # Load pretrained weights
    if pretrained_path and os.path.exists(pretrained_path):
        logger.info("Loading pretrained encoder from: %s", pretrained_path)
        ckpt = torch.load(pretrained_path, map_location='cpu')
        encoder_state = ckpt.get('encoder_state_dict', {})
        if encoder_state:
            missing, unexpected = encoder.load_state_dict(encoder_state, strict=False)
            logger.info("  Loaded encoder: %d missing, %d unexpected keys",
                        len(missing), len(unexpected))
        else:
            logger.warning("  No encoder_state_dict found in checkpoint")
    else:
        logger.warning("No pretrained weights — training from scratch")

    model = MISSFinetuneModel(
        encoder=encoder,
        embed_dim=args.embed_dim,
        num_classes=NUM_CLASSES,
        dropout=0.3
    ).to(device)

    total_params = sum(p.numel() for p in model.parameters())
    logger.info("Finetune model: %.2fM parameters", total_params / 1e6)

    # Loss function with class weights
    pos_weight = load_class_weights(args.data_dir, device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    logger.info("Class weights: %s", pos_weight.cpu().numpy().round(2).tolist())

    # === Progressive Unfreezing Schedule ===
    #   Stage 1 (epochs 0-19):    Freeze encoder, train only head + attention
    #   Stage 2 (epochs 20-49):   Unfreeze last 4 transformer blocks
    #   Stage 3 (epochs 50+):     Unfreeze all, lower LR

    ckpt_dir = os.path.join(args.checkpoint_dir, 'finetune')
    os.makedirs(ckpt_dir, exist_ok=True)

    best_val_mAP = 0.0
    best_epoch = 0
    best_thresholds = np.full(NUM_CLASSES, 0.5)
    early_stopping = EarlyStopping(patience=args.patience, mode='max')
    history = []

    scaler = GradScaler() if device.type == 'cuda' else None

# In finetune(), replace the stages definition (around line ~1380):
    stages = [
        {'name': 'frozen', 'start': 0,
         'end': max(1, min(20, args.epochs_finetune // 5)),  # ← add max(1, ...)
         'lr': args.lr_finetune, 'action': 'freeze'},
        {'name': 'partial', 'start': max(1, min(20, args.epochs_finetune // 5)),
         'end': max(2, min(50, args.epochs_finetune * 2 // 5)),  # ← add max(2, ...)
         'lr': args.lr_finetune * 0.5, 'action': 'partial'},
        {'name': 'full', 'start': max(2, min(50, args.epochs_finetune * 2 // 5)),
         'end': args.epochs_finetune,
         'lr': args.lr_finetune * 0.1, 'action': 'full'},
    ]
    current_stage = -1
    optimizer = None

    for epoch in range(args.epochs_finetune):
        # Check stage transitions
        new_stage = None
        for s_idx, stage in enumerate(stages):
            if stage['start'] <= epoch < stage['end']:
                new_stage = s_idx
                break

        if new_stage != current_stage and new_stage is not None:
            current_stage = new_stage
            stage = stages[current_stage]
            logger.info("")
            logger.info(">>> STAGE %d: %s (epochs %d-%d, lr=%.2e) <<<",
                        current_stage + 1, stage['name'],
                        stage['start'], stage['end'] - 1, stage['lr'])

            # Apply unfreezing
            if stage['action'] == 'freeze':
                model.freeze_encoder()
                params = [p for p in model.parameters() if p.requires_grad]
                logger.info("  Encoder frozen. Trainable params: %d",
                            sum(p.numel() for p in params))
            elif stage['action'] == 'partial':
                model.unfreeze_encoder(unfreeze_last_n=4)
                params = [p for p in model.parameters() if p.requires_grad]
                logger.info("  Last 4 blocks unfrozen. Trainable params: %d",
                            sum(p.numel() for p in params))
            elif stage['action'] == 'full':
                model.unfreeze_all()
                params = [p for p in model.parameters() if p.requires_grad]
                logger.info("  All params unfrozen. Trainable params: %d",
                            sum(p.numel() for p in params))

            # Create new optimizer for this stage with discriminative LR
            param_groups = []
            if stage['action'] in ['partial', 'full']:
                # Encoder params: lower LR
                encoder_params = [p for n, p in model.encoder.named_parameters()
                                  if p.requires_grad]
                if encoder_params:
                    param_groups.append({
                        'params': encoder_params,
                        'lr': stage['lr'] * 0.1  # 10x lower for encoder
                    })
                # Head params: full LR
                head_params = [p for n, p in model.named_parameters()
                               if p.requires_grad and 'encoder' not in n]
                if head_params:
                    param_groups.append({
                        'params': head_params,
                        'lr': stage['lr']
                    })
            else:
                param_groups.append({
                    'params': [p for p in model.parameters() if p.requires_grad],
                    'lr': stage['lr']
                })

            optimizer = optim.AdamW(param_groups, weight_decay=args.weight_decay)

        # === Training ===
        model.train()
        train_loss = 0.0
        n_batches = 0

        for batch in train_loader:
            images = batch['image'].to(device)
            labels = batch['label'].to(device)
            masks = batch['mask'].to(device)

            optimizer.zero_grad()

            if scaler:
                with autocast():
                    logits, _ = model(images, masks)
                    loss = criterion(logits, labels)
                scaler.scale(loss).backward()
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                scaler.step(optimizer)
                scaler.update()
            else:
                logits, _ = model(images, masks)
                loss = criterion(logits, labels)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()

            train_loss += loss.item()
            n_batches += 1

        avg_train_loss = train_loss / max(n_batches, 1)

        # === Validation ===
        val_metrics, val_loss = evaluate(model, val_loader, criterion, device)
        val_mAP = val_metrics.get('mAP', 0)
        val_macro_auc = val_metrics.get('macro_auc', 0)
        val_macro_f1 = val_metrics.get('macro_f1', 0)

        # Find optimal thresholds on validation
        val_labels, val_probs = collect_predictions(model, val_loader, device)
        optimal_thresholds = find_optimal_thresholds(val_labels, val_probs)

        # Recompute with optimal thresholds
        val_metrics_opt = compute_metrics(val_labels, val_probs, optimal_thresholds)
        val_mAP_opt = val_metrics_opt.get('mAP', val_mAP)

        history.append({
            'epoch': epoch + 1,
            'train_loss': avg_train_loss,
            'val_loss': val_loss,
            'val_mAP': val_mAP,
            'val_mAP_optimized': val_mAP_opt,
            'val_macro_auc': val_macro_auc,
            'val_macro_f1': val_macro_f1,
        })

        lr_str = ", ".join(["%.2e" % pg['lr'] for pg in optimizer.param_groups])
        logger.info(
            "Epoch %3d/%d [%s] | lr=[%s] | train_loss=%.4f | val_loss=%.4f | "
            "mAP=%.4f(%.4f) | AUC=%.4f | F1=%.4f",
            epoch + 1, args.epochs_finetune, stages[current_stage]['name'],
            lr_str, avg_train_loss, val_loss,
            val_mAP, val_mAP_opt, val_macro_auc, val_macro_f1
        )

        # Save best
        if val_mAP_opt > best_val_mAP:
            best_val_mAP = val_mAP_opt
            best_epoch = epoch + 1
            best_thresholds = optimal_thresholds.copy()
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'val_mAP': best_val_mAP,
                'thresholds': best_thresholds.tolist(),
                'val_metrics': val_metrics_opt,
                'args': vars(args),
            }, os.path.join(ckpt_dir, 'miss_finetune_best.pth'))
            logger.info("  --> New best mAP: %.4f (saved)", best_val_mAP)

        # Early stopping
        if early_stopping(val_mAP_opt):
            logger.info("Early stopping at epoch %d", epoch + 1)
            break

    # === Final Test Evaluation ===
    logger.info("")
    logger.info("=" * 60)
    logger.info("FINAL TEST EVALUATION")
    logger.info("=" * 60)

    # Load best model
    best_ckpt = torch.load(os.path.join(ckpt_dir, 'miss_finetune_best.pth'),
                            map_location=device)
    model.load_state_dict(best_ckpt['model_state_dict'])
    best_thresholds = np.array(best_ckpt.get('thresholds', [0.5] * NUM_CLASSES))
    logger.info("Loaded best model from epoch %d (val mAP=%.4f)",
                best_ckpt['epoch'] + 1, best_ckpt['val_mAP'])

    # Evaluate on test set
    test_labels, test_probs = collect_predictions(model, test_loader, device)
    test_metrics = compute_metrics(test_labels, test_probs, best_thresholds)

    print_metrics_table(test_metrics, logger, prefix='TEST: ')

    # Save results
    results = {
        'best_epoch': best_epoch,
        'best_val_mAP': best_val_mAP,
        'test_metrics': test_metrics,
        'thresholds': best_thresholds.tolist(),
        'history': history,
        'benchmark_comparison': {
            'yolov8_mAP_image_level': BENCHMARK_YOLOV8_MAP,
            'yolov8_mAP_patient_level': 0.736,
            'miss_mAP': test_metrics.get('mAP', 0),
            'delta_image': test_metrics.get('mAP', 0) - BENCHMARK_YOLOV8_MAP,
            'delta_patient': test_metrics.get('mAP', 0) - 0.736,
        },
        'model_config': {
            'embed_dim': args.embed_dim,
            'depth': args.depth,
            'num_heads': args.num_heads,
            'img_size': args.img_size,
            'total_params_M': total_params / 1e6,
        }
    }

    with open(os.path.join(ckpt_dir, 'test_results.json'), 'w') as f:
        json.dump(results, f, indent=2, default=str)

    logger.info("")
    logger.info("Results saved to %s", os.path.join(ckpt_dir, 'test_results.json'))

    return test_metrics


def evaluate(model, dataloader, criterion, device):
    """Evaluate model on a dataloader."""
    model.eval()
    all_labels = []
    all_probs = []
    total_loss = 0.0
    n_batches = 0

    with torch.no_grad():
        for batch in dataloader:
            images = batch['image'].to(device)
            labels = batch['label'].to(device)
            masks = batch['mask'].to(device)

            logits, _ = model(images, masks)
            loss = criterion(logits, labels)

            probs = torch.sigmoid(logits)
            all_labels.append(labels.cpu().numpy())
            all_probs.append(probs.cpu().numpy())
            total_loss += loss.item()
            n_batches += 1

    all_labels = np.concatenate(all_labels, axis=0)
    all_probs = np.concatenate(all_probs, axis=0)
    avg_loss = total_loss / max(n_batches, 1)

    metrics = compute_metrics(all_labels, all_probs)
    return metrics, avg_loss


def collect_predictions(model, dataloader, device):
    """Collect all predictions for threshold optimization."""
    model.eval()
    all_labels = []
    all_probs = []

    with torch.no_grad():
        for batch in dataloader:
            images = batch['image'].to(device)
            labels = batch['label']
            masks = batch['mask'].to(device)

            logits, _ = model(images, masks)
            probs = torch.sigmoid(logits)

            all_labels.append(labels.numpy())
            all_probs.append(probs.cpu().numpy())

    return np.concatenate(all_labels), np.concatenate(all_probs)


# ==============================================================================
# Main
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='MISS-EyeScreen: Multi-way Self-Supervised Training')

    # Phase
    parser.add_argument('--phase', type=str, default='both',
                        choices=['pretrain', 'finetune', 'both'],
                        help='Training phase')

    # Data
    parser.add_argument('--data_dir', type=str, default='./processed',
                        help='Preprocessed data directory')
    parser.add_argument('--checkpoint_dir', type=str, default='./checkpoints')
    parser.add_argument('--img_size', type=int, default=224)

    # Architecture
    parser.add_argument('--embed_dim', type=int, default=384,
                        help='ViT embedding dimension (384=Small)')
    parser.add_argument('--depth', type=int, default=12,
                        help='Number of transformer blocks')
    parser.add_argument('--num_heads', type=int, default=6)

    # Pretraining
    parser.add_argument('--epochs_pretrain', type=int, default=200)
    parser.add_argument('--batch_size_pretrain', type=int, default=32)
    parser.add_argument('--lr_pretrain', type=float, default=1.5e-4)
    parser.add_argument('--mask_ratio', type=float, default=0.75,
                        help='MAE mask ratio')
    parser.add_argument('--temperature', type=float, default=0.07,
                        help='NT-Xent temperature')
    parser.add_argument('--warmup_epochs', type=int, default=10)

    # Finetuning
    parser.add_argument('--epochs_finetune', type=int, default=100)
    parser.add_argument('--batch_size_finetune', type=int, default=32)
    parser.add_argument('--lr_finetune', type=float, default=5e-4)
    parser.add_argument('--pretrained_ckpt', type=str, default=None,
                        help='Path to pretrained checkpoint')
    parser.add_argument('--patience', type=int, default=20,
                        help='Early stopping patience')

    # General
    parser.add_argument('--weight_decay', type=float, default=0.05)
    parser.add_argument('--num_workers', type=int, default=4)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--debug', action='store_true',
                        help='Quick debug run')

    args = parser.parse_args()

    # Debug mode
    if args.debug:
        args.epochs_pretrain = 2
        args.epochs_finetune = 3
        args.batch_size_pretrain = 8
        args.batch_size_finetune = 8

    # Seed
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)

    # Logging
    log_dir = os.path.join(args.checkpoint_dir, 'logs')
    logger = setup_logging(log_dir)

    logger.info("MISS-EyeScreen Training Pipeline")
    logger.info("Phase: %s", args.phase)
    logger.info("Config: %s", json.dumps(vars(args), indent=2))

    pretrained_path = args.pretrained_ckpt

    if args.phase in ['pretrain', 'both']:
        pretrained_path = pretrain(args, logger)

    if args.phase in ['finetune', 'both']:
        if pretrained_path is None:
            # Check default location
            default_ckpt = os.path.join(
                args.checkpoint_dir, 'pretrain', 'miss_pretrain_best.pth')
            if os.path.exists(default_ckpt):
                pretrained_path = default_ckpt

        test_metrics = finetune(args, logger, pretrained_path)

        # Final summary
        logger.info("")
        logger.info("=" * 60)
        logger.info("HACKATHON SUBMISSION SUMMARY")
        logger.info("=" * 60)
        logger.info("  Model: MISS (Multi-way Self-Supervised) ViT-Small/16")
        logger.info("  Dataset: SLID (2617 slit-lamp images, 13 lesion classes)")
        logger.info("  Pretraining: 4 pretext tasks (MIM + Region + Contrastive + Rotation)")
        logger.info("  Finetuning: Anatomical Attention + Progressive Unfreezing")
        logger.info("  Test mAP: %.4f", test_metrics.get('mAP', 0))
        logger.info("  Test Macro AUC: %.4f", test_metrics.get('macro_auc', 0))
        logger.info("  Test Macro F1: %.4f", test_metrics.get('macro_f1', 0))
        logger.info("  Benchmark YOLOv8: mAP=%.3f (image) / %.3f (patient)",
                     BENCHMARK_YOLOV8_MAP, 0.736)
        logger.info("=" * 60)


if __name__ == '__main__':
    main()