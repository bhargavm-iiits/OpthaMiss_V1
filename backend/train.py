#!/usr/bin/env python3
"""
Quick training script to generate a real best.pth checkpoint
Uses random synthetic data if you don't have a dataset yet
"""

import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np

# ── Constants ──
NUM_CLASSES   = 13
EMBED_DIM     = 384
HIDDEN        = 512
DROP          = 0.3
EPOCHS        = 5
BATCH_SIZE    = 8
SAVE_PATH     = r'C:\Users\Bhargav M\Downloads\OpthaMiss-main\experiments\miss_v4_refined\checkpoints\best.pth'

# ── Model (same architecture as main.py) ──
class TimmWrapper(nn.Module):
    def __init__(self, model, dim):
        super().__init__()
        self.model     = model
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
        self.head    = head

    def forward(self, x):
        tokens = self.encoder(x, return_all=True)
        if tokens.dim() == 2:
            return self.head.head(torch.cat([tokens, tokens], dim=1))
        return self.head(tokens)


def train():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"[INFO] Training on: {device}")

    # ── Build model ──
    try:
        import timm
        raw     = timm.create_model('vit_small_patch16_224', pretrained=True, num_classes=0)
        encoder = TimmWrapper(raw, EMBED_DIM)
        print("[OK] ViT-S/16 loaded with ImageNet pretrained weights")
    except Exception as e:
        print(f"[ERROR] {e}")
        return

    head  = MultiLabelHead(EMBED_DIM, NUM_CLASSES, HIDDEN, DROP)
    model = FullModel(encoder, head).to(device)

    # ── Synthetic dataset (replace with real data if available) ──
    print("[INFO] Generating synthetic training data...")
    N       = 200   # number of synthetic samples
    X       = torch.randn(N, 3, 224, 224)          # fake images
    Y       = (torch.rand(N, NUM_CLASSES) > 0.7).float()  # fake labels

    dataset    = TensorDataset(X, Y)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

    # ── Optimizer + Loss ──
    optimizer = optim.AdamW(model.parameters(), lr=1e-4, weight_decay=1e-4)
    criterion = nn.BCEWithLogitsLoss()
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    # ── Training loop ──
    best_loss = float('inf')

    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0.0

        for batch_idx, (images, labels) in enumerate(dataloader):
            images = images.to(device)
            labels = labels.to(device)

            optimizer.zero_grad()
            logits = model(images)
            loss   = criterion(logits, labels)
            loss.backward()

            # Gradient clipping
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)

            optimizer.step()
            total_loss += loss.item()

            if batch_idx % 5 == 0:
                print(f"  Epoch {epoch+1}/{EPOCHS} | "
                      f"Batch {batch_idx+1}/{len(dataloader)} | "
                      f"Loss: {loss.item():.4f}")

        avg_loss = total_loss / len(dataloader)
        scheduler.step()
        print(f"[Epoch {epoch+1}] Avg Loss: {avg_loss:.4f}")

        # ── Save best checkpoint ──
        if avg_loss < best_loss:
            best_loss = avg_loss

            # Make sure directory exists
            os.makedirs(os.path.dirname(SAVE_PATH), exist_ok=True)

            torch.save({
                'epoch':              epoch + 1,
                'model_state_dict':   model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'loss':               avg_loss,
                'num_classes':        NUM_CLASSES,
                'embed_dim':          EMBED_DIM,
            }, SAVE_PATH)

            print(f"[SAVED] Best checkpoint → {SAVE_PATH}")

    print("\n" + "="*50)
    print("Training complete!")
    print(f"Best loss:       {best_loss:.4f}")
    print(f"Checkpoint saved: {SAVE_PATH}")

    # ── Verify the saved file ──
    size = os.path.getsize(SAVE_PATH)
    print(f"File size:       {size / 1024 / 1024:.1f} MB")
    print("="*50)


if __name__ == '__main__':
    train()