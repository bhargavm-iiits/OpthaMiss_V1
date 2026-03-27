#!/usr/bin/env python3
"""
OpthaMiss Backend — FastAPI server wrapping the MISS-EyeScreen model
Render + Local compatible version
"""

import os
import sys
import warnings
import io
import numpy as np
from datetime import datetime
from PIL import Image

# ── Memory & thread optimization for Render free tier ──
os.environ['OMP_NUM_THREADS']               = '1'
os.environ['MKL_NUM_THREADS']               = '1'
os.environ['OPENBLAS_NUM_THREADS']          = '1'
os.environ['TOKENIZERS_PARALLELISM']        = 'false'
os.environ['TORCH_NUM_THREADS']             = '1'   # intra‑op threads
os.environ['TORCH_NUM_INTEROP_THREADS']     = '1'   # inter‑op threads

import torch
import torch.nn as nn
from torchvision import transforms
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ── Check for OpenCV (optional for glare removal) ──
try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False
    print("[WARNING] OpenCV not found. Glare removal disabled.")

warnings.filterwarnings('ignore')

# ==============================================================================
# Constants
# ==============================================================================

LESION_CLASSES = [
    'Cataract', 'Intraocular lens', 'Lens dislocation', 'Keratitis',
    'Corneal scarring', 'Corneal dystrophy', 'Corneal/conjunctival tumor',
    'Pinguecula', 'Pterygium', 'Subconjunctival hemorrhage',
    'Conjunctival injection', 'Conjunctival cyst', 'Pigmented nevus',
]
NUM_CLASSES   = len(LESION_CLASSES)
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

URGENCY_MAP = {
    'Cataract':                   ('MODERATE', 'Refer to ophthalmologist within 1 month'),
    'Intraocular lens':           ('LOW',      'Routine follow-up recommended'),
    'Lens dislocation':           ('HIGH',     'URGENT: Refer within 24-48 hours'),
    'Keratitis':                  ('HIGH',     'URGENT: Refer immediately — vision risk'),
    'Corneal scarring':           ('MODERATE', 'Refer to cornea specialist within 2 weeks'),
    'Corneal dystrophy':          ('MODERATE', 'Refer to cornea specialist within 1 month'),
    'Corneal/conjunctival tumor': ('HIGH',     'URGENT: Refer to ocular oncologist within 1 week'),
    'Pinguecula':                 ('LOW',      'Reassure patient — monitor at next visit'),
    'Pterygium':                  ('LOW',      'Monitor — refer if approaching pupil'),
    'Subconjunctival hemorrhage': ('LOW',      'Usually self-resolving — check BP'),
    'Conjunctival injection':     ('MODERATE', 'Assess for infection — may need treatment'),
    'Conjunctival cyst':          ('LOW',      'Monitor size — refer if symptomatic'),
    'Pigmented nevus':            ('MODERATE', 'Document and monitor for changes'),
}

DEFAULT_THRESHOLDS = np.array([
    0.730, 0.950, 0.834, 0.824, 0.609, 0.517, 0.843,
    0.670, 0.780, 0.907, 0.630, 0.638, 0.722,
])

# ── Checkpoint path resolution (absolute path from your system) ──
_ABSOLUTE_PATH = r"C:\Users\Bhargav M\Downloads\OpthaMiss-main\experiments\miss_v4_refined\checkpoints\best.pth"
_ENV_PATH      = os.environ.get('MODEL_CHECKPOINT', '')
_LOCAL_PATH    = 'experiments/miss_v4_refined/checkpoints/best.pth'
_FALLBACK_PATH = 'best.pth'

if _ENV_PATH and os.path.exists(_ENV_PATH):
    CHECKPOINT_PATH = _ENV_PATH
elif os.path.exists(_ABSOLUTE_PATH):
    CHECKPOINT_PATH = _ABSOLUTE_PATH
elif os.path.exists(_LOCAL_PATH):
    CHECKPOINT_PATH = _LOCAL_PATH
elif os.path.exists(_FALLBACK_PATH):
    CHECKPOINT_PATH = _FALLBACK_PATH
else:
    CHECKPOINT_PATH = _LOCAL_PATH   # will show warning at load time

print(f"[INFO] Checkpoint path: {CHECKPOINT_PATH}")

# ==============================================================================
# Glare Removal
# ==============================================================================

def remove_glare(pil_image, threshold=240, inpaint_radius=3):
    """Remove glare spots from an image using OpenCV inpainting."""
    if not HAS_CV2:
        return pil_image

    img_np = np.array(pil_image)

    # Convert to BGR for OpenCV
    if img_np.ndim == 2:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
    elif img_np.shape[2] == 4:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
    else:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY)

    kernel = np.ones((3, 3), np.uint8)
    mask   = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    mask   = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  kernel, iterations=1)

    if np.any(mask):
        inpainted = cv2.inpaint(img_np, mask, inpaint_radius, cv2.INPAINT_TELEA)
        return Image.fromarray(cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB))

    return pil_image

# ==============================================================================
# Model Architecture (same as in the Gradio reference)
# ==============================================================================

class TimmWrapper(nn.Module):
    """Wrapper to extract features from a timm vision transformer."""
    def __init__(self, model, dim):
        super().__init__()
        self.model     = model
        self.embed_dim = dim

    def forward(self, x, return_all=False):
        f = self.model.forward_features(x)
        return f if return_all else (f[:, 0] if f.dim() == 3 else f)


class MultiLabelHead(nn.Module):
    """Multi-label classification head that concatenates CLS and GAP tokens."""
    def __init__(self, embed_dim, n_classes=NUM_CLASSES, hidden=512, drop=0.3):
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


class FullModel(nn.Module):
    """Complete model: encoder + classification head."""
    def __init__(self, encoder, head):
        super().__init__()
        self.encoder = encoder
        self.head    = head

    def forward(self, x):
        tokens = self.encoder(x, return_all=True)
        if tokens.dim() == 2:
            return self.head.head(torch.cat([tokens, tokens], dim=1))
        return self.head(tokens)

# ==============================================================================
# Global Model State
# ==============================================================================

MODEL  = None
DEVICE = None

def load_model():
    """Load the model and its checkpoint."""
    global MODEL, DEVICE

    DEVICE = torch.device('cpu')  # Force CPU on Render
    print(f"[INFO] Using device: {DEVICE}")

    try:
        import timm

        # Use ViT-S/16 (small model to save memory)
        raw     = timm.create_model(
            'vit_small_patch16_224',
            pretrained  = False,
            num_classes = 0,
        )
        encoder = TimmWrapper(raw, 384)
        print("[OK] ViT-S/16 architecture built")

    except ImportError:
        print("[ERROR] timm not installed")
        sys.exit(1)

    head  = MultiLabelHead(384, NUM_CLASSES, hidden=512, drop=0.3)
    model = FullModel(encoder, head)

    if os.path.exists(CHECKPOINT_PATH):
        file_size = os.path.getsize(CHECKPOINT_PATH)
        size_mb   = file_size / 1024 / 1024
        print(f"[INFO] Checkpoint size: {size_mb:.2f} MB")

        try:
            # Load to CPU explicitly (weights_only=False for compatibility)
            ckpt  = torch.load(
                CHECKPOINT_PATH,
                map_location = 'cpu',
                weights_only = False,
            )
            state = ckpt.get('model_state_dict', ckpt)
            model.load_state_dict(state, strict=False)
            print(f"[OK] Checkpoint loaded")
            del ckpt, state  # free memory immediately

        except Exception as e:
            print(f"[WARNING] Checkpoint load failed: {e}")
            print("[WARNING] Using random weights")
    else:
        print(f"[WARNING] No checkpoint at: {CHECKPOINT_PATH}")
        print("[WARNING] Using random weights")

    # Put model in eval mode and optimize memory
    MODEL = model.to(DEVICE).eval()

    # Disable gradients globally to save memory
    for param in MODEL.parameters():
        param.requires_grad = False

    print("[OK] Model ready")

# ==============================================================================
# Prediction Logic (with Test‑Time Augmentation)
# ==============================================================================

def run_predict(pil_image: Image.Image):
    """
    Run inference on a PIL image.
    Returns: (probabilities array, binary predictions array)
    Uses test‑time augmentation (3 flips) to improve robustness.
    """
    transform = transforms.Compose([
        transforms.Resize(
            (224, 224),
            interpolation=transforms.InterpolationMode.BICUBIC,
        ),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    img    = pil_image.convert('RGB')
    tensor = transform(img)                     # shape: [C, H, W]

    # TTA: original, horizontal flip, vertical flip
    tta_transforms = [
        lambda x: x,                                 # original
        lambda x: torch.flip(x, dims=[2]),           # horizontal flip (width)
        lambda x: torch.flip(x, dims=[1]),           # vertical flip (height)
    ]

    MODEL.eval()
    probs_list = []
    with torch.no_grad():
        for t_fn in tta_transforms:
            # Apply transform, add batch dimension, move to device
            input_tensor = t_fn(tensor).unsqueeze(0).to(DEVICE)
            logits = MODEL(input_tensor)
            probs  = torch.sigmoid(logits).cpu().numpy()[0]
            probs_list.append(probs)

    # Average probabilities across augmentations
    probs = np.mean(probs_list, axis=0)

    # Apply thresholds to get binary predictions
    preds = (probs >= DEFAULT_THRESHOLDS).astype(int)

    # Free memory (optional, helps on low‑memory systems)
    del tensor, probs_list
    torch.cuda.empty_cache() if torch.cuda.is_available() else None

    return probs, preds

# ==============================================================================
# FastAPI App
# ==============================================================================

app = FastAPI(
    title       = "OpthaMiss API",
    description = "AI-powered anterior eye disease screening — 13 conditions",
    version     = "4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

@app.on_event("startup")
async def startup_event():
    load_model()

# ==============================================================================
# Routes
# ==============================================================================

@app.get("/")
def root():
    return {
        "app"     : "OpthaMiss API",
        "version" : "4.0.0",
        "status"  : "running",
        "model"   : "ViT-S/16 — MISS-EyeScreen v4",
        "classes" : NUM_CLASSES,
        "endpoint": "/predict  (POST — multipart/form-data, field: file)",
    }

@app.get("/health")
def health():
    return {
        "status"      : "healthy",
        "model_loaded": MODEL is not None,
        "device"      : str(DEVICE),
        "num_classes" : NUM_CLASSES,
        "classes"     : LESION_CLASSES,
        "checkpoint"  : CHECKPOINT_PATH,
    }

@app.post("/predict")
async def predict_endpoint(file: UploadFile = File(...)):
    """Predict diseases from an uploaded eye image."""
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code = 400,
            detail      = f"File must be an image. Received: {file.content_type}",
        )

    # Load image
    try:
        contents = await file.read()
        pil_img  = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot open image: {e}")

    # Glare removal
    try:
        pil_img = remove_glare(pil_img)
    except Exception as e:
        print(f"[WARNING] Glare removal failed: {e} — using original image")

    # Check model is loaded
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet. Try again shortly.")

    # Run inference
    try:
        probs, preds = run_predict(pil_img)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

    # Build detected conditions list
    detected = []
    for i, cls in enumerate(LESION_CLASSES):
        if preds[i]:
            urg, action = URGENCY_MAP[cls]
            detected.append({
                "condition"  : cls,
                "probability": round(float(probs[i]), 4),
                "urgency"    : urg,
                "action"     : action,
            })
    detected.sort(key=lambda x: x["probability"], reverse=True)

    # Determine overall risk level
    urgencies = [d["urgency"] for d in detected]

    if "HIGH" in urgencies:
        overall_risk = "HIGH"
        risk_icon    = "red"
        risk_action  = "URGENT REFERRAL — See ophthalmologist within 48 hours"
    elif "MODERATE" in urgencies:
        overall_risk = "MODERATE"
        risk_icon    = "yellow"
        risk_action  = "Referral recommended within 2–4 weeks"
    elif detected:
        overall_risk = "LOW"
        risk_icon    = "green"
        risk_action  = "Monitor at next routine visit"
    else:
        overall_risk = "NORMAL"
        risk_icon    = "green"
        risk_action  = "No significant findings — routine screening in 12 months"

    # Build all-conditions results sorted by probability
    sorted_idx  = np.argsort(probs)[::-1]
    all_results = []
    for i in sorted_idx:
        cls           = LESION_CLASSES[i]
        detected_flag = bool(preds[i])
        watch_flag    = bool(float(probs[i]) > 0.3 and not preds[i])
        all_results.append({
            "condition"  : cls,
            "probability": round(float(probs[i]), 4),
            "detected"   : detected_flag,
            "watch"      : watch_flag,
        })

    return JSONResponse({
        "overall_risk": overall_risk,
        "risk_icon"   : risk_icon,
        "risk_action" : risk_action,
        "detected"    : detected,
        "all_results" : all_results,
        "screened_at" : datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "model"       : "MISS-EyeScreen v4",
        "map_score"   : 0.922,
        "auc_score"   : 0.982,
        "disclaimer"  : "AI-assisted screening only. Must be confirmed by a qualified ophthalmologist.",
    })

# ==============================================================================
# Run locally
# ==============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host   = "0.0.0.0",
        port   = int(os.environ.get("PORT", 8000)),
        reload = False,
    )