#!/usr/bin/env python3
"""
OpthaMiss Backend — FastAPI server wrapping BOTH models:
  1. MISS-EyeScreen v4  (anterior eye, 13 lesion classes)
  2. Tele-Ophthalmology v3 (fundus eye, 8 disease classes)

Render + Local compatible version
"""

import os
import sys
import warnings
import io
import gc
import json
import numpy as np
from datetime import datetime
from PIL import Image

# ── Memory & thread optimization for Render free tier ──
os.environ['OMP_NUM_THREADS'] = '1'
os.environ['MKL_NUM_THREADS'] = '1'
os.environ['OPENBLAS_NUM_THREADS'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
os.environ['TORCH_NUM_THREADS'] = '1'
os.environ['TORCH_NUM_INTEROP_THREADS'] = '1'

import torch
import torch.nn as nn
from torchvision import transforms
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional

# ── Check for OpenCV (optional for glare/enhancement) ──
try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False
    print("[WARNING] OpenCV not found. Glare removal / CLAHE disabled.")

warnings.filterwarnings('ignore')


# ==============================================================================
# Custom JSON encoder to handle numpy types
# ==============================================================================

class NumpySafeEncoder(json.JSONEncoder):
    """JSON encoder that handles numpy types."""
    def default(self, obj):
        if isinstance(obj, (np.bool_, )):
            return bool(obj)
        if isinstance(obj, (np.integer, )):
            return int(obj)
        if isinstance(obj, (np.floating, )):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def safe_json_response(data: dict, status_code: int = 200):
    """Create a JSONResponse that safely handles numpy types."""
    # Deep-convert all numpy types to native Python types
    clean_data = json.loads(json.dumps(data, cls=NumpySafeEncoder))
    return JSONResponse(content=clean_data, status_code=status_code)


# ==============================================================================
# Constants — Model 1: MISS-EyeScreen v4 (Anterior Eye)
# ==============================================================================

ANTERIOR_CLASSES = [
    'Cataract', 'Intraocular lens', 'Lens dislocation', 'Keratitis',
    'Corneal scarring', 'Corneal dystrophy', 'Corneal/conjunctival tumor',
    'Pinguecula', 'Pterygium', 'Subconjunctival hemorrhage',
    'Conjunctival injection', 'Conjunctival cyst', 'Pigmented nevus',
]
NUM_ANTERIOR_CLASSES = len(ANTERIOR_CLASSES)

ANTERIOR_URGENCY_MAP = {
    'Cataract': ('MODERATE', 'Refer to ophthalmologist within 1 month'),
    'Intraocular lens': ('LOW', 'Routine follow-up recommended'),
    'Lens dislocation': ('HIGH', 'URGENT: Refer within 24-48 hours'),
    'Keratitis': ('HIGH', 'URGENT: Refer immediately — vision risk'),
    'Corneal scarring': ('MODERATE', 'Refer to cornea specialist within 2 weeks'),
    'Corneal dystrophy': ('MODERATE', 'Refer to cornea specialist within 1 month'),
    'Corneal/conjunctival tumor': ('HIGH', 'URGENT: Refer to ocular oncologist within 1 week'),
    'Pinguecula': ('LOW', 'Reassure patient — monitor at next visit'),
    'Pterygium': ('LOW', 'Monitor — refer if approaching pupil'),
    'Subconjunctival hemorrhage': ('LOW', 'Usually self-resolving — check BP'),
    'Conjunctival injection': ('MODERATE', 'Assess for infection — may need treatment'),
    'Conjunctival cyst': ('LOW', 'Monitor size — refer if symptomatic'),
    'Pigmented nevus': ('MODERATE', 'Document and monitor for changes'),
}

ANTERIOR_THRESHOLDS = np.array([
    0.730, 0.950, 0.834, 0.824, 0.609, 0.517, 0.843,
    0.670, 0.780, 0.907, 0.630, 0.638, 0.722,
])


# ==============================================================================
# Constants — Model 2: Tele-Ophthalmology v3 (Fundus Eye)
# ==============================================================================

FUNDUS_CLASS_NAMES = ['N', 'D', 'G', 'C', 'A', 'H', 'M', 'O']
FUNDUS_CLASS_FULL_NAMES = [
    'Normal', 'Diabetes', 'Glaucoma', 'Cataract',
    'AMD', 'Hypertension', 'Myopia', 'Other'
]
FUNDUS_CLASS_DESCRIPTIONS = {
    'Normal': 'No significant pathology detected in fundus image.',
    'Diabetes': 'Diabetic retinopathy — damage to retinal blood vessels from diabetes.',
    'Glaucoma': 'Optic nerve damage, often from high intraocular pressure.',
    'Cataract': 'Clouding of the eye lens causing blurred vision.',
    'AMD': 'Age-related macular degeneration — central vision loss.',
    'Hypertension': 'Hypertensive retinopathy — retinal damage from high blood pressure.',
    'Myopia': 'Pathological myopia — severe nearsightedness with retinal changes.',
    'Other': 'Other ocular pathology not in the above categories.',
}
NUM_FUNDUS_CLASSES = len(FUNDUS_CLASS_NAMES)

FUNDUS_URGENCY_MAP = {
    'Normal': ('NONE', 'No action needed. Routine screening in 12 months.'),
    'Diabetes': ('HIGH', 'URGENT: Refer to retina specialist within 1-2 weeks. '
                         'Blood sugar and HbA1c assessment recommended.'),
    'Glaucoma': ('HIGH', 'URGENT: Refer to glaucoma specialist within 1 week. '
                         'Intraocular pressure measurement needed.'),
    'Cataract': ('MODERATE', 'Refer to ophthalmologist within 1 month. '
                             'Visual acuity assessment recommended.'),
    'AMD': ('HIGH', 'URGENT: Refer to retina specialist within 1 week. '
                    'OCT imaging recommended.'),
    'Hypertension': ('MODERATE', 'Refer within 2-4 weeks. Blood pressure monitoring '
                                 'and cardiovascular assessment recommended.'),
    'Myopia': ('MODERATE', 'Refer to ophthalmologist within 1 month. '
                           'Peripheral retinal examination recommended.'),
    'Other': ('MODERATE', 'Refer for comprehensive eye examination within 2-4 weeks.'),
}

FUNDUS_THRESHOLDS = np.array([
    0.553,  # N - Normal
    0.593,  # D - Diabetes
    0.601,  # G - Glaucoma
    0.625,  # C - Cataract
    0.609,  # A - AMD
    0.569,  # H - Hypertension
    0.666,  # M - Myopia
    0.561,  # O - Other
])


# ==============================================================================
# Shared Constants
# ==============================================================================

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
BACKBONE_DIM = 384
IMG_SIZE = 224


# ==============================================================================
# Checkpoint Path Resolution
# ==============================================================================

def _resolve_path(env_key, *candidates):
    """Return the first existing path from env var or candidate list."""
    env_val = os.environ.get(env_key, '')
    if env_val and os.path.exists(env_val):
        return env_val
    for p in candidates:
        if os.path.exists(p):
            return p
    return candidates[-1]  # fallback


ANTERIOR_CHECKPOINT = _resolve_path(
    'ANTERIOR_MODEL_CHECKPOINT',
    r"C:\Users\Bhargav M\Downloads\OpthaMiss-main\experiments\miss_v4_refined\checkpoints\best.pth",
    'experiments/miss_v4_refined/checkpoints/best.pth',
    'best.pth',
)

FUNDUS_CHECKPOINT = _resolve_path(
    'FUNDUS_MODEL_CHECKPOINT',
    r"C:\Users\Bhargav M\OneDrive\ドキュメント\OpthaMiss-main\backend\best_model.pth",
    'training_output_v3/checkpoints/best_model.pth',
    'best_model.pth',
)

print(f"[INFO] Anterior checkpoint: {ANTERIOR_CHECKPOINT}")
print(f"[INFO] Fundus   checkpoint: {FUNDUS_CHECKPOINT}")


# ==============================================================================
# Image Preprocessing
# ==============================================================================

def remove_glare(pil_image, threshold=240, inpaint_radius=3):
    """Remove glare spots from an image using OpenCV inpainting."""
    if not HAS_CV2:
        return pil_image

    img_np = np.array(pil_image)
    if img_np.ndim == 2:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
    elif img_np.shape[2] == 4:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
    else:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY)

    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

    if np.any(mask):
        inpainted = cv2.inpaint(img_np, mask, inpaint_radius, cv2.INPAINT_TELEA)
        return Image.fromarray(cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB))
    return pil_image


def enhance_fundus(pil_image):
    """CLAHE enhancement on LAB L-channel for fundus images."""
    if not HAS_CV2:
        return pil_image

    img_np = np.array(pil_image)
    if img_np.ndim == 2:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_GRAY2RGB)
    elif img_np.shape[2] == 4:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_RGBA2RGB)

    lab = cv2.cvtColor(img_np, cv2.COLOR_RGB2LAB)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lab[:, :, 0] = clahe.apply(lab[:, :, 0])
    enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
    return Image.fromarray(enhanced)


def remove_black_borders(pil_image, threshold=15):
    """Remove black borders common in fundus camera images."""
    if not HAS_CV2:
        return pil_image

    img_np = np.array(pil_image)
    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)

    coords = np.column_stack(np.where(gray > threshold))
    if len(coords) == 0:
        return pil_image

    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)

    margin = 5
    y_min = max(0, y_min - margin)
    x_min = max(0, x_min - margin)
    y_max = min(img_np.shape[0], y_max + margin)
    x_max = min(img_np.shape[1], x_max + margin)

    cropped = img_np[y_min:y_max, x_min:x_max]
    return Image.fromarray(cropped)


# ==============================================================================
# Model Architectures
# ==============================================================================

class TimmWrapper(nn.Module):
    """Wrapper to extract features from a timm ViT."""
    def __init__(self, model, dim):
        super().__init__()
        self.model = model
        self.embed_dim = dim

    def forward(self, x, return_all=False):
        f = self.model.forward_features(x)
        return f if return_all else (f[:, 0] if f.dim() == 3 else f)


class AnteriorHead(nn.Module):
    """Multi-label head for anterior eye model."""
    def __init__(self, embed_dim, n_classes=NUM_ANTERIOR_CLASSES, hidden=512, drop=0.3):
        super().__init__()
        self.head = nn.Sequential(
            nn.LayerNorm(embed_dim * 2),
            nn.Linear(embed_dim * 2, hidden),
            nn.GELU(),
            nn.Dropout(drop),
            nn.Linear(hidden, hidden // 2),
            nn.GELU(),
            nn.Dropout(drop * 0.5),
            nn.Linear(hidden // 2, n_classes),
        )

    def forward(self, all_tokens):
        cls = all_tokens[:, 0]
        gap = all_tokens[:, 1:].mean(dim=1)
        return self.head(torch.cat([cls, gap], dim=1))


class AnteriorModel(nn.Module):
    """Complete anterior eye model: encoder + head."""
    def __init__(self, encoder, head):
        super().__init__()
        self.encoder = encoder
        self.head = head

    def forward(self, x):
        tokens = self.encoder(x, return_all=True)
        if tokens.dim() == 2:
            return self.head.head(torch.cat([tokens, tokens], dim=1))
        return self.head(tokens)


class FundusModel(nn.Module):
    """ViT-S/16 with CLS + GAP dual feature extraction for fundus."""
    def __init__(self):
        super().__init__()
        import timm
        self.backbone = timm.create_model(
            'vit_small_patch16_224',
            pretrained=False,
            num_classes=0,
            drop_rate=0.1,
            drop_path_rate=0.1,
            attn_drop_rate=0.0,
        )
        feature_dim = BACKBONE_DIM * 2  # 768
        self.classifier = nn.Sequential(
            nn.LayerNorm(feature_dim),
            nn.Linear(feature_dim, 512),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(512, 256),
            nn.GELU(),
            nn.Dropout(0.15),
            nn.Linear(256, NUM_FUNDUS_CLASSES),
        )

    def forward_features(self, x):
        features = self.backbone.forward_features(x)
        if features.dim() == 3:
            cls_token = features[:, 0]
            gap = features[:, 1:].mean(dim=1)
        else:
            cls_token = features
            gap = features
        return torch.cat([cls_token, gap], dim=1)

    def forward(self, x):
        return self.classifier(self.forward_features(x))


# ==============================================================================
# Global Model State
# ==============================================================================

ANTERIOR_MODEL = None
FUNDUS_MODEL = None
DEVICE = None


def _build_and_load_anterior():
    """Build and load the anterior eye model."""
    global ANTERIOR_MODEL
    import timm

    raw = timm.create_model('vit_small_patch16_224', pretrained=False, num_classes=0)
    encoder = TimmWrapper(raw, BACKBONE_DIM)
    head = AnteriorHead(BACKBONE_DIM, NUM_ANTERIOR_CLASSES, hidden=512, drop=0.3)
    model = AnteriorModel(encoder, head)

    if os.path.exists(ANTERIOR_CHECKPOINT):
        sz = os.path.getsize(ANTERIOR_CHECKPOINT) / 1024 / 1024
        print(f"[INFO] Anterior checkpoint size: {sz:.2f} MB")
        try:
            ckpt = torch.load(ANTERIOR_CHECKPOINT, map_location='cpu', weights_only=False)
            state = ckpt.get('model_state_dict', ckpt)
            model.load_state_dict(state, strict=False)
            print("[OK] Anterior model checkpoint loaded")
            del ckpt, state
        except Exception as e:
            print(f"[WARNING] Anterior checkpoint load failed: {e}")
    else:
        print(f"[WARNING] Anterior checkpoint not found: {ANTERIOR_CHECKPOINT}")

    model = model.to(DEVICE).eval()
    for p in model.parameters():
        p.requires_grad = False
    ANTERIOR_MODEL = model
    print("[OK] Anterior model ready")


def _build_and_load_fundus():
    """Build and load the fundus eye model."""
    global FUNDUS_MODEL

    model = FundusModel()

    if os.path.exists(FUNDUS_CHECKPOINT):
        sz = os.path.getsize(FUNDUS_CHECKPOINT) / 1024 / 1024
        print(f"[INFO] Fundus checkpoint size: {sz:.2f} MB")
        try:
            ckpt = torch.load(FUNDUS_CHECKPOINT, map_location='cpu', weights_only=False)
            if 'ema_state_dict' in ckpt:
                model.load_state_dict(ckpt['ema_state_dict'], strict=True)
                wt = "EMA"
            elif 'model_state_dict' in ckpt:
                model.load_state_dict(ckpt['model_state_dict'], strict=True)
                wt = "standard"
            else:
                model.load_state_dict(ckpt, strict=False)
                wt = "raw"
            best_epoch = ckpt.get('epoch', '?')
            best_auc = ckpt.get('val_auc', '?')
            print(f"[OK] Fundus model checkpoint loaded ({wt} weights, epoch {best_epoch}, AUC {best_auc})")
            del ckpt
        except Exception as e:
            print(f"[WARNING] Fundus checkpoint load failed: {e}")
    else:
        print(f"[WARNING] Fundus checkpoint not found: {FUNDUS_CHECKPOINT}")

    model = model.to(DEVICE).eval()
    for p in model.parameters():
        p.requires_grad = False
    FUNDUS_MODEL = model
    print("[OK] Fundus model ready")


def load_all_models():
    """Load both models."""
    global DEVICE
    DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"[INFO] Using device: {DEVICE}")
    _build_and_load_anterior()
    gc.collect()
    _build_and_load_fundus()
    gc.collect()
    print("[OK] All models loaded")


# ==============================================================================
# Prediction Logic
# ==============================================================================

def _get_transform():
    return transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE),
                          interpolation=transforms.InterpolationMode.BICUBIC),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])


def predict_anterior(pil_image):
    """Run anterior model with 3-view TTA."""
    transform = _get_transform()
    img = pil_image.convert('RGB')
    tensor = transform(img)

    tta_fns = [
        lambda x: x,
        lambda x: torch.flip(x, dims=[2]),
        lambda x: torch.flip(x, dims=[1]),
    ]

    ANTERIOR_MODEL.eval()
    probs_list = []
    with torch.no_grad():
        for t_fn in tta_fns:
            inp = t_fn(tensor).unsqueeze(0).to(DEVICE)
            logits = ANTERIOR_MODEL(inp)
            probs_list.append(torch.sigmoid(logits).cpu().numpy()[0])

    probs = np.mean(probs_list, axis=0).astype(np.float64)
    preds = (probs >= ANTERIOR_THRESHOLDS).astype(int)
    return probs, preds


def predict_fundus(pil_image):
    """Run fundus model with 5-view TTA."""
    transform = _get_transform()
    img = pil_image.convert('RGB')
    tensor = transform(img)

    tta_fns = [
        lambda x: x,
        lambda x: torch.flip(x, [2]),
        lambda x: torch.flip(x, [1]),
        lambda x: torch.rot90(x, 1, [1, 2]),
        lambda x: torch.rot90(x, 3, [1, 2]),
    ]

    FUNDUS_MODEL.eval()
    probs_list = []
    with torch.no_grad():
        for t_fn in tta_fns:
            inp = t_fn(tensor).unsqueeze(0).to(DEVICE)
            logits = FUNDUS_MODEL(inp)
            probs_list.append(torch.sigmoid(logits.float()).cpu().numpy()[0])

    probs = np.mean(probs_list, axis=0).astype(np.float64)
    preds = (probs >= FUNDUS_THRESHOLDS).astype(int)
    return probs, preds


# ==============================================================================
# Response Builders — ALL values converted to native Python types
# ==============================================================================

def _to_python(val):
    """Convert any numpy type to native Python type."""
    if isinstance(val, (np.bool_, )):
        return bool(val)
    if isinstance(val, (np.integer, )):
        return int(val)
    if isinstance(val, (np.floating, )):
        return float(val)
    if isinstance(val, np.ndarray):
        return val.tolist()
    return val


def _compute_risk(detected_list):
    """Compute overall risk from a list of detected dicts."""
    urgencies = [d['urgency'] for d in detected_list]
    if 'HIGH' in urgencies:
        return 'HIGH', 'red', 'URGENT REFERRAL — See ophthalmologist within 48 hours'
    elif 'MODERATE' in urgencies:
        return 'MODERATE', 'yellow', 'Referral recommended within 2-4 weeks'
    elif detected_list:
        return 'LOW', 'green', 'Monitor at next routine visit'
    else:
        return 'NORMAL', 'green', 'No significant findings — routine screening in 12 months'


def build_anterior_response(probs, preds):
    """Build JSON-safe response for anterior model."""
    # Force native Python types
    probs_list = [float(probs[i]) for i in range(len(probs))]
    preds_list = [int(preds[i]) for i in range(len(preds))]

    detected = []
    for i, cls in enumerate(ANTERIOR_CLASSES):
        if preds_list[i] == 1:
            urg, action = ANTERIOR_URGENCY_MAP[cls]
            detected.append({
                'condition': str(cls),
                'probability': round(probs_list[i], 4),
                'urgency': str(urg),
                'action': str(action),
            })
    detected.sort(key=lambda x: x['probability'], reverse=True)

    overall_risk, risk_icon, risk_action = _compute_risk(detected)

    sorted_idx = sorted(range(len(probs_list)), key=lambda i: probs_list[i], reverse=True)
    all_results = []
    for i in sorted_idx:
        all_results.append({
            'condition': str(ANTERIOR_CLASSES[i]),
            'probability': round(probs_list[i], 4),
            'detected': True if preds_list[i] == 1 else False,
            'watch': True if (probs_list[i] > 0.3 and preds_list[i] == 0) else False,
        })

    return {
        'model_type': 'anterior',
        'model_name': 'MISS-EyeScreen v4',
        'overall_risk': str(overall_risk),
        'risk_icon': str(risk_icon),
        'risk_action': str(risk_action),
        'detected': detected,
        'all_results': all_results,
        'screened_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'map_score': 0.922,
        'auc_score': 0.982,
        'disclaimer': 'AI-assisted screening only. Must be confirmed by a qualified ophthalmologist.',
    }


def build_fundus_response(probs, preds):
    """Build JSON-safe response for fundus model."""
    # Force native Python types — this is the critical fix
    probs_list = [float(probs[i]) for i in range(len(probs))]
    preds_list = [int(preds[i]) for i in range(len(preds))]

    detected = []
    for i in range(NUM_FUNDUS_CLASSES):
        if FUNDUS_CLASS_NAMES[i] == 'N':
            continue
        if preds_list[i] == 1:
            urg, action = FUNDUS_URGENCY_MAP[FUNDUS_CLASS_FULL_NAMES[i]]
            detected.append({
                'condition': str(FUNDUS_CLASS_FULL_NAMES[i]),
                'short_name': str(FUNDUS_CLASS_NAMES[i]),
                'probability': round(probs_list[i], 4),
                'urgency': str(urg),
                'action': str(action),
                'description': str(FUNDUS_CLASS_DESCRIPTIONS[FUNDUS_CLASS_FULL_NAMES[i]]),
            })
    detected.sort(key=lambda x: x['probability'], reverse=True)

    overall_risk, risk_icon, risk_action = _compute_risk(detected)

    # Check if normal
    is_normal = (preds_list[0] == 1) and (len(detected) == 0)
    if is_normal:
        overall_risk = 'NORMAL'
        risk_icon = 'green'
        risk_action = 'No significant findings — routine screening in 12 months'

    sorted_idx = sorted(range(len(probs_list)), key=lambda i: probs_list[i], reverse=True)
    all_results = []
    for i in sorted_idx:
        name = str(FUNDUS_CLASS_FULL_NAMES[i])
        prob_val = probs_list[i]
        thresh_val = float(FUNDUS_THRESHOLDS[i])
        is_detected = (preds_list[i] == 1)
        is_watch = (prob_val > thresh_val * 0.7) and (not is_detected)
        all_results.append({
            'condition': name,
            'short_name': str(FUNDUS_CLASS_NAMES[i]),
            'probability': round(prob_val, 4),
            'threshold': round(thresh_val, 4),
            'detected': True if is_detected else False,
            'watch': True if is_watch else False,
        })

    return {
        'model_type': 'fundus',
        'model_name': 'Tele-Ophthalmology ViT-S/16 v3',
        'is_normal': True if is_normal else False,
        'normal_probability': round(probs_list[0], 4),
        'overall_risk': str(overall_risk),
        'risk_icon': str(risk_icon),
        'risk_action': str(risk_action),
        'detected': detected,
        'all_results': all_results,
        'screened_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'auc_score': 0.889,
        'f1_score': 0.631,
        'map_score': 0.665,
        'tta_views': 5,
        'disclaimer': 'AI-assisted screening only. Must be confirmed by a qualified ophthalmologist.',
    }


# ==============================================================================
# FastAPI App
# ==============================================================================

# ==============================================================================
# FastAPI App
# ==============================================================================

app = FastAPI(
    title="OpthaMiss Multi-Model API",
    description="AI-powered eye disease screening — anterior (13 classes) + fundus (8 classes)",
    version="5.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ── Mount auth router ──
from auth import router as auth_router
app.include_router(auth_router)


@app.on_event("startup")
async def startup_event():
    load_all_models()


# ==============================================================================
# Routes
# ==============================================================================

@app.get("/")
def root():
    return {
        "app": "OpthaMiss Multi-Model API",
        "version": "5.0.0",
        "status": "running",
        "models": {
            "anterior": {
                "name": "MISS-EyeScreen v4",
                "classes": NUM_ANTERIOR_CLASSES,
                "description": "Anterior eye — 13 lesion classes",
                "checkpoint_found": os.path.exists(ANTERIOR_CHECKPOINT),
            },
            "fundus": {
                "name": "Tele-Ophthalmology v3",
                "classes": NUM_FUNDUS_CLASSES,
                "description": "Fundus eye — 8 disease classes (Normal + 7 conditions)",
                "checkpoint_found": os.path.exists(FUNDUS_CHECKPOINT),
            },
        },
        "endpoints": {
            "/predict": "POST — multipart/form-data, fields: file (image), model ('anterior' or 'fundus')",
            "/predict/anterior": "POST — multipart/form-data, field: file (image)",
            "/predict/fundus": "POST — multipart/form-data, field: file (image)",
            "/health": "GET — health check",
        },
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "device": str(DEVICE),
        "models": {
            "anterior": {
                "loaded": ANTERIOR_MODEL is not None,
                "num_classes": NUM_ANTERIOR_CLASSES,
                "checkpoint": ANTERIOR_CHECKPOINT,
                "checkpoint_exists": os.path.exists(ANTERIOR_CHECKPOINT),
            },
            "fundus": {
                "loaded": FUNDUS_MODEL is not None,
                "num_classes": NUM_FUNDUS_CLASSES,
                "checkpoint": FUNDUS_CHECKPOINT,
                "checkpoint_exists": os.path.exists(FUNDUS_CHECKPOINT),
            },
        },
    }


async def _read_image(file: UploadFile):
    """Read and validate an uploaded image."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=f"File must be an image. Received: {file.content_type}")
    try:
        contents = await file.read()
        return Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot open image: {e}")


# ── Unified predict endpoint ──

@app.post("/predict")
async def predict_endpoint(
    file: UploadFile = File(...),
    model: str = Form("anterior"),
):
    """Predict with selected model. model = 'anterior' or 'fundus'."""
    model_key = model.strip().lower()
    if model_key not in ('anterior', 'fundus'):
        raise HTTPException(status_code=400, detail=f"Invalid model '{model}'. Must be 'anterior' or 'fundus'.")

    pil_img = await _read_image(file)

    if model_key == 'anterior':
        return await _predict_anterior_impl(pil_img)
    else:
        return await _predict_fundus_impl(pil_img)


# ── Dedicated endpoints ──

@app.post("/predict/anterior")
async def predict_anterior_endpoint(file: UploadFile = File(...)):
    """Predict anterior eye conditions."""
    pil_img = await _read_image(file)
    return await _predict_anterior_impl(pil_img)


@app.post("/predict/fundus")
async def predict_fundus_endpoint(file: UploadFile = File(...)):
    """Predict fundus eye conditions."""
    pil_img = await _read_image(file)
    return await _predict_fundus_impl(pil_img)


# ── Internal implementations ──

async def _predict_anterior_impl(pil_img):
    """Run anterior model pipeline."""
    if ANTERIOR_MODEL is None:
        raise HTTPException(status_code=503, detail="Anterior model not loaded.")

    try:
        pil_img = remove_glare(pil_img)
    except Exception as e:
        print(f"[WARNING] Glare removal failed: {e}")

    try:
        probs, preds = predict_anterior(pil_img)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Anterior inference error: {e}")

    response_data = build_anterior_response(probs, preds)
    return safe_json_response(response_data)


async def _predict_fundus_impl(pil_img):
    """Run fundus model pipeline."""
    if FUNDUS_MODEL is None:
        raise HTTPException(status_code=503, detail="Fundus model not loaded.")

    try:
        pil_img = remove_black_borders(pil_img)
        pil_img = enhance_fundus(pil_img)
    except Exception as e:
        print(f"[WARNING] Fundus preprocessing failed: {e}")

    try:
        probs, preds = predict_fundus(pil_img)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Fundus inference error: {e}")

    response_data = build_fundus_response(probs, preds)
    return safe_json_response(response_data)


# ── Predict with both models ──

@app.post("/predict/both")
async def predict_both_endpoint(file: UploadFile = File(...)):
    """Run BOTH models on the same image."""
    pil_img = await _read_image(file)

    results = {}

    if ANTERIOR_MODEL is not None:
        try:
            img_a = remove_glare(pil_img.copy()) if HAS_CV2 else pil_img.copy()
            probs_a, preds_a = predict_anterior(img_a)
            results['anterior'] = build_anterior_response(probs_a, preds_a)
        except Exception as e:
            results['anterior'] = {'error': str(e)}
    else:
        results['anterior'] = {'error': 'Model not loaded'}

    if FUNDUS_MODEL is not None:
        try:
            img_f = pil_img.copy()
            if HAS_CV2:
                img_f = remove_black_borders(img_f)
                img_f = enhance_fundus(img_f)
            probs_f, preds_f = predict_fundus(img_f)
            results['fundus'] = build_fundus_response(probs_f, preds_f)
        except Exception as e:
            results['fundus'] = {'error': str(e)}
    else:
        results['fundus'] = {'error': 'Model not loaded'}

    results['screened_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    results['disclaimer'] = 'AI-assisted screening only. Must be confirmed by a qualified ophthalmologist.'

    return safe_json_response(results)


# ==============================================================================
# Run locally
# ==============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
        reload=False,
    )
