# OpthaMiss

OpthaMiss is an AI-assisted eye screening project with:

- a `frontend/` React + Vite web app for image upload and result visualization
- a `backend/` FastAPI inference API for two vision models
- a `Train/` workspace for dataset preprocessing and model training experiments

The current backend supports two screening pipelines:

- `anterior`: external/anterior eye screening for 13 conditions
- `fundus`: retinal fundus screening for 8 classes including normal and pathology cases

This is a screening tool, not a diagnostic device. All predictions must be confirmed by a qualified ophthalmologist.

## Live Demo

- Vercel: https://optha-miss-v1-vkr7-ac3aha987-bhargavm-iiits-projects.vercel.app/

## Features

- Dual-model screening flow for anterior and fundus images
- FastAPI backend with dedicated prediction endpoints
- Drag-and-drop React UI with model-specific instructions
- Risk stratification and referral guidance in API responses
- OpenCV-based preprocessing:
  - glare removal for anterior images
  - black-border removal and CLAHE enhancement for fundus images
- Test-time augmentation during inference:
  - 3-view TTA for anterior images
  - 5-view TTA for fundus images

## Repository Structure

```text
OpthaMiss-main/
|- backend/        FastAPI app, model loading, inference, checkpoints
|- frontend/       React + Vite UI
|- experiments/    experiment outputs/checkpoints for anterior model work
|- Train/          preprocessing and training utilities, plus older snapshots
|- Dockerfile      multi-stage build for frontend + backend image
|- requirements.txt
```

## Tech Stack

### Frontend

- React 18
- Vite
- Tailwind CSS
- Axios
- Framer Motion
- react-dropzone
- Three.js / react-three libraries for animated presentation

### Backend

- FastAPI
- Uvicorn
- PyTorch
- torchvision
- timm
- Pillow
- NumPy
- OpenCV

## Models

### 1. MISS-EyeScreen v4

Anterior eye model used for 13 classes:

- Cataract
- Intraocular lens
- Lens dislocation
- Keratitis
- Corneal scarring
- Corneal dystrophy
- Corneal/conjunctival tumor
- Pinguecula
- Pterygium
- Subconjunctival hemorrhage
- Conjunctival injection
- Conjunctival cyst
- Pigmented nevus

### 2. Tele-Ophthalmology ViT-S/16 v3

Fundus model used for 8 classes:

- Normal
- Diabetes
- Glaucoma
- Cataract
- AMD
- Hypertension
- Myopia
- Other

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.10+ recommended
- `pip`

### 1. Start the backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The backend starts on `http://localhost:8000` by default.

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend uses:

- `frontend/.env`
- `VITE_API_URL=http://localhost:8000`

If `VITE_API_URL` is empty, Vite proxy settings in `frontend/vite.config.js` forward `/predict` and `/health` to the backend during local development.

## Environment Variables

### Frontend

`frontend/.env`

```env
VITE_API_URL=http://localhost:8000
```

Optional production example:

```env
VITE_API_URL=https://your-backend-host.example.com
```

### Backend

`backend/.env`

```env
PORT=8000
ANTERIOR_MODEL_CHECKPOINT=path/to/best.pth
FUNDUS_MODEL_CHECKPOINT=path/to/best_model.pth
```

The backend resolves checkpoints from environment variables first, then falls back to known local paths and bundled files such as `backend/best.pth` and `backend/best_model.pth`.

## API Endpoints

Base URL: `http://localhost:8000`

### Health

`GET /health`

Returns model load status, device, and checkpoint metadata.

### Root

`GET /`

Returns API metadata and available routes.

### Unified prediction

`POST /predict`

Multipart form fields:

- `file`: image file
- `model`: `anterior` or `fundus`

### Dedicated prediction routes

- `POST /predict/anterior`
- `POST /predict/fundus`
- `POST /predict/both`

## Example cURL Requests

### Anterior image

```bash
curl -X POST "http://localhost:8000/predict/anterior" ^
  -F "file=@sample-eye.jpg"
```

### Fundus image

```bash
curl -X POST "http://localhost:8000/predict/fundus" ^
  -F "file=@sample-fundus.jpg"
```

### Unified endpoint

```bash
curl -X POST "http://localhost:8000/predict" ^
  -F "file=@sample.jpg" ^
  -F "model=fundus"
```

Note: the examples above use Windows shell line continuation (`^`) to match this repository's current environment.

## Response Shape

Prediction responses include fields such as:

- `model_type`
- `model_name`
- `overall_risk`
- `risk_action`
- `detected`
- `all_results`
- `screened_at`
- evaluation metrics included by the backend for display
- disclaimer text

Fundus responses also include fields like:

- `is_normal`
- `normal_probability`
- `tta_views`

## Docker

The root `Dockerfile`:

- builds the frontend with Node.js
- installs backend Python dependencies
- copies backend code into the image
- copies frontend build output into `/app/static`
- starts the API with Uvicorn on port `10000`

Build and run:

```bash
docker build -t opthamiss .
docker run -p 10000:10000 opthamiss
```

## Training Workspace

The `Train/` directory contains training-related utilities and experiments, including:

- `preprocess_anterior.py`
- `preprocess_fundus.py`
- `fundus_train.py`
- extra backend/frontend snapshots

### Dataset Links

- ODIR-5K: https://www.kaggle.com/datasets/andrewmvd/ocular-disease-recognition-odir5k
- RFMiD: https://www.kaggle.com/datasets/ozlemhakdagli/retinal-fundus-multi-disease-image-dataset-rfmid
- SLID: https://github.com/xumingyu-hub/SLID

This folder appears to be a research/training workspace rather than the main runtime application. For day-to-day app development, use:

- `frontend/`
- `backend/`

## Notes About the Current Codebase

- The active product app is rooted in `frontend/` and `backend/`.
- The backend loads models at startup and keeps them in memory for inference.
- The frontend presents a landing page, upload workflow, result cards, condition lists, and capture guidance.
- Model checkpoints are already present in `backend/` as `best.pth` and `best_model.pth`.

## Install References

- Backend dependencies: `backend/requirements.txt`
- Frontend dependencies: `frontend/package.json`
- Root `requirements.txt` also exists, but the main backend runtime currently uses `backend/requirements.txt`

## Disclaimer

OpthaMiss is intended for AI-assisted screening and triage support only. It is not a substitute for clinical diagnosis, treatment planning, or emergency ophthalmic care.
