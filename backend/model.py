import numpy as np
from PIL import Image
import io
import random

class EyeDiseaseModel:
    def __init__(self):
        self.load_model()

    def load_model(self):
        # Replace with your actual model loading
        print("Model loaded (simulated)")
        pass

    def preprocess(self, image_bytes):
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        img = img.resize((224, 224))
        img = np.array(img) / 255.0
        img = np.expand_dims(img, axis=0)
        return img

    def predict(self, image_bytes):
        # Dummy prediction – replace with real model inference
        diseases = ['Cataract', 'Glaucoma', 'Diabetic Retinopathy', 'Normal']
        probs = np.random.dirichlet(np.ones(len(diseases)), size=1)[0]
        idx = np.argmax(probs)
        return {
            'disease': diseases[idx],
            'confidence': float(probs[idx]),
            'all_probabilities': {d: float(p) for d, p in zip(diseases, probs)}
        }

model = EyeDiseaseModel()