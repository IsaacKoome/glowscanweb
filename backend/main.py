from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import numpy as np
import cv2
import random

app = FastAPI()

# Allow frontend to communicate with backend (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        # Read image into PIL Image
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Convert to OpenCV format
        open_cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        # 🔍 You can now pass open_cv_image to your ML model here
        # For demo, generate fake prediction
        result = {
            "hydration": f"{random.randint(60, 95)}%",
            "acne_level": random.choice(["Clear", "Mild", "Moderate", "Severe"]),
            "pores": random.choice(["Small", "Medium", "Visible"]),
            "recommendation": "Use a gentle cleanser and hydrate well."
        }

        return result

    except Exception as e:
        return {"error": str(e)}
