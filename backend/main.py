from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google.generativeai import configure, GenerativeModel
import base64
from io import BytesIO
from PIL import Image

# ✅ 1. Initialize FastAPI
app = FastAPI()

# ✅ 2. Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Later: replace with Vercel URL
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ 3. Configure Gemini API
configure(api_key="AIzaSyBWoVzBQF_kBHSKN2883-3tgCoP-_-JSSg")  # <--- Replace with your real Gemini key

model = GenerativeModel("gemini-1.5-flash")

# ✅ 4. Test route
@app.get("/")
def root():
    return {"message": "Glowscan API is running"}

# ✅ 5. Real AI analysis endpoint
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        # Read and convert to base64
        image_bytes = await file.read()
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        buffered = BytesIO()
        image.save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        # Prepare the prompt
        prompt = """
You are a skin and makeup analysis expert. Analyze this selfie and return a JSON object with:
{
  "hydration": "...",     // e.g. "low", "moderate", "high"
  "acne": "...",          // e.g. "none", "mild", "moderate", "severe"
  "skin_tone": "...",     // e.g. "fair", "medium", "dark", "neutral", etc.
  "makeup_feedback": "..." // Feedback on makeup (blend, color match, etc.)
}
Be concise. Only output JSON — no explanation.
"""

        # Send to Gemini
        response = model.generate_content([
            prompt,
            {
                "mime_type": "image/jpeg",
                "data": img_base64
            }
        ])

        # Parse and return result
        import json
        result = json.loads(response.text)
        return result

    except Exception as e:
        return {"error": str(e)}
