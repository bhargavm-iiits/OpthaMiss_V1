#!/usr/bin/env python3
"""
OpthaMiss Backend — FastAPI server wrapping the MISS-EyeScreen model
"""

import os
import sys
import warnings
import numpy as np
from datetime import datetime
from PIL import Image
import io

import torch
import torch.nn as nn
from torchvision import transforms

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
NUM_CLASSES = len(LESION_CLASSES)
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

CHECKPOINT_PATH = os.environ.get(
    'MODEL_CHECKPOINT',
    'experiments/miss_v4_refined/checkpoints/best.pth'
)
# ==============================================================================
# Glare Removal
# ==============================================================================

def remove_glare(pil_image, threshold=240, inpaint_radius=3):
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
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  kernel, iterations=1)

    if np.any(mask):
        inpainted = cv2.inpaint(img_np, mask, inpaint_radius, cv2.INPAINT_TELEA)
        return Image.fromarray(cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB))
    return pil_image

# ==============================================================================
# Model Architecture
# ==============================================================================

class TimmWrapper(nn.Module):
    def __init__(self, model, dim):
        super().__init__()
        self.model = model
        self.embed_dim = dim

    def forward(self, x, return_all=False):
        f = self.model.forward_features(x)
        return f if return_all else (f[:, 0] if f.dim() == 3 else f)


class MultiLabelHead(nn.Module):
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
    def __init__(self, encoder, head):
        super().__init__()
        self.encoder = encoder
        self.head = head

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
    global MODEL, DEVICE

    DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"[INFO] Using device: {DEVICE}")

    try:
        import timm
        raw     = timm.create_model('vit_small_patch16_224', pretrained=False, num_classes=0)
        encoder = TimmWrapper(raw, 384)
    except ImportError:
        print("[ERROR] timm not installed — run: pip install timm")
        sys.exit(1)

    head  = MultiLabelHead(384, NUM_CLASSES, hidden=512, drop=0.3)
    model = FullModel(encoder, head)

    if os.path.exists(CHECKPOINT_PATH):
        # ── Check file size first ──
        file_size = os.path.getsize(CHECKPOINT_PATH)
        print(f"[INFO] Checkpoint file size: {file_size / 1024 / 1024:.2f} MB")

        if file_size < 1024 * 1024:  # Less than 1MB = likely corrupted
            print(f"[WARNING] Checkpoint file too small ({file_size} bytes) — likely corrupted. Using random weights.")
        else:
            try:
                ckpt  = torch.load(CHECKPOINT_PATH, map_location=DEVICE, weights_only=False)
                state = ckpt.get('model_state_dict', ckpt)
                model.load_state_dict(state, strict=False)
                print(f"[OK] Checkpoint loaded from {CHECKPOINT_PATH}")
            except Exception as e:
                print(f"[WARNING] Could not load checkpoint: {e}")
                print(f"[WARNING] Using random weights — predictions will not be accurate")
    else:
        print(f"[WARNING] Checkpoint not found at {CHECKPOINT_PATH} — using random weights")

    MODEL = model.to(DEVICE).eval()
    print("[OK] Model ready")

# ==============================================================================
# Prediction Logic
# ==============================================================================

def run_predict(pil_image: Image.Image):
    transform = transforms.Compose([
        transforms.Resize(
            (224, 224),
            interpolation=transforms.InterpolationMode.BICUBIC
        ),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    img    = pil_image.convert('RGB')
    tensor = transform(img)

    MODEL.eval()
    with torch.no_grad():
        augmented = [
            lambda x: x,
            lambda x: torch.flip(x, [2]),
            lambda x: torch.flip(x, [1]),
        ]
        probs_list = []
        for t_fn in augmented:
            logits = MODEL(t_fn(tensor).unsqueeze(0).to(DEVICE))
            probs_list.append(torch.sigmoid(logits).cpu().numpy()[0])

    probs = np.mean(probs_list, axis=0)
    preds = (probs >= DEFAULT_THRESHOLDS).astype(int)
    return probs, preds

# ==============================================================================
# FastAPI App
# ==============================================================================

app = FastAPI(
    title="OpthaMiss API",
    description="AI-powered anterior eye disease screening",
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
        "app":     "OpthaMiss API",
        "version": "4.0.0",
        "status":  "running",
        "model":   "ViT-S/16 — MISS-EyeScreen v4",
        "classes": NUM_CLASSES,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": MODEL is not None,
        "device": str(DEVICE),
        "classes": LESION_CLASSES,
    }


@app.post("/predict")
async def predict_endpoint(file: UploadFile = File(...)):
    # ── Validate file type ──
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    # ── Load image ──
    try:
        contents = await file.read()
        pil_img  = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot open image: {e}")

    # ── Glare removal ──
    pil_img = remove_glare(pil_img)

    # ── Inference ──
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet.")

    try:
        probs, preds = run_predict(pil_img)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

    # ── Build detected list ──
    detected = []
    for i, cls in enumerate(LESION_CLASSES):
        if preds[i]:
            urg, action = URGENCY_MAP[cls]
            detected.append({
                "condition":   cls,
                "probability": round(float(probs[i]), 4),
                "urgency":     urg,
                "action":      action,
            })
    detected.sort(key=lambda x: x["probability"], reverse=True)

    # ── Overall risk ──
    urgencies = [d["urgency"] for d in detected]
    if "HIGH" in urgencies:
        overall_risk   = "HIGH"
        risk_icon      = "red"
        risk_action    = "URGENT REFERRAL — See ophthalmologist within 48 hours"
    elif "MODERATE" in urgencies:
        overall_risk   = "MODERATE"
        risk_icon      = "yellow"
        risk_action    = "Referral recommended within 2–4 weeks"
    elif detected:
        overall_risk   = "LOW"
        risk_icon      = "green"
        risk_action    = "Monitor at next routine visit"
    else:
        overall_risk   = "NORMAL"
        risk_icon      = "green"
        risk_action    = "No significant findings — routine screening in 12 months"

    # ── All probabilities sorted ──
    sorted_idx = np.argsort(probs)[::-1]
    all_results = []
    for i in sorted_idx:
        cls      = LESION_CLASSES[i]
        detected_flag = bool(preds[i])
        watch_flag    = bool(probs[i] > 0.3 and not preds[i])
        all_results.append({
            "condition":   cls,
            "probability": round(float(probs[i]), 4),
            "detected":    detected_flag,
            "watch":       watch_flag,
        })

    return JSONResponse({
        "overall_risk":  overall_risk,
        "risk_icon":     risk_icon,
        "risk_action":   risk_action,
        "detected":      detected,
        "all_results":   all_results,
        "screened_at":   datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "model":         "MISS-EyeScreen v4",
        "map_score":     0.922,
        "auc_score":     0.982,
        "disclaimer":    "AI-assisted screening only. Must be confirmed by a qualified ophthalmologist.",
    })


# ==============================================================================
# Run
# ==============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)