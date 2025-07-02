# backend/main.py

import os
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google.generativeai import configure, GenerativeModel, upload_file
import base64
from io import BytesIO
from PIL import Image
import json
import re

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
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
if GOOGLE_API_KEY:
    configure(api_key=GOOGLE_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY environment variable not set. This might cause issues.")

model = GenerativeModel("gemini-1.5-flash")

# ✅ 4. Test route
@app.get("/")
def root():
    return {"message": "Glowscan API is running"}

# ✅ 5. Real AI analysis endpoint
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    print(f"Received file: {file.filename}, content_type: {file.content_type}")
    try:
        image_bytes = await file.read()
        
        gemini_image_part = {
            "mime_type": file.content_type,
            "data": image_bytes
        }

        # --- UPDATED PROMPT ---
        prompt = """
You are a highly experienced, friendly, and encouraging AI skincare and makeup expert named Glowscan AI. Your goal is to provide precise, actionable, and personalized feedback based on the user's selfie.

Analyze the attached selfie for both skin health and makeup application. Provide your analysis as a JSON object with the following keys. Each field should contain concise, direct advice or observations.

Expected JSON Structure:
{
  "hydration": "...", // e.g., "low", "moderate", "high"
  "acne": "...", // e.g., "none", "mild (few blemishes)", "moderate (several active breakouts)", "severe (widespread breakouts)"
  "redness": "...", // e.g., "none", "mild (slight flush)", "moderate (visible redness)", "significant (widespread inflammation)"
  "skin_tone": "...", // e.g., "fair", "light", "medium", "dark", "deep"
  "makeup_coverage": "...", // e.g., "light", "medium", "full", "no makeup detected"
  "makeup_blend": "...", // e.g., "excellent", "good", "needs blending around jawline", "uneven on forehead", "no makeup detected"
  "makeup_color_match": "...", // e.g., "perfect", "good", "slightly off (too warm)", "too light", "too dark", "no makeup detected"
  "overall_glow_score": number, // An integer score from 1 to 10, where 10 is maximum glow and health.
  "skincare_advice_tips": [ // An array of 2-3 specific, actionable skincare tips based on observations.
    "Tip 1: ...",
    "Tip 2: ..."
  ],
  "makeup_enhancement_tips": [ // An array of 2-3 specific, actionable makeup tips, including directional advice (e.g., "blend more on the left side"). If no makeup, suggest basic enhancements.
    "Tip 1: ...",
    "Tip 2: ..."
  ],
  "overall_summary": "..." // A brief, encouraging summary of the analysis.
}

Crucial Instructions:
1.  **Output ONLY the JSON object.** Do not include any conversational text, markdown outside the JSON, or explanations before or after the JSON.
2.  Be as specific as possible in `makeup_blend` and `makeup_color_match` feedback, noting *where* improvements are needed (e.g., "blend more around the nose," "foundation appears slightly too warm for your neck").
3.  If no makeup is detected, state "no makeup detected" for relevant fields and provide general makeup enhancement tips.
4.  For `skincare_advice_tips` and `makeup_enhancement_tips`, provide concise, actionable sentences.
"""
        # --- END UPDATED PROMPT ---

        generation_config = {
            "response_mime_type": "application/json"
        }

        response = model.generate_content(
            contents=[prompt, gemini_image_part],
            generation_config=generation_config
        )

        if response.text:
            try:
                result = json.loads(response.text)
                print(f"Gemini response successfully parsed: {result}")
                return result
            except json.JSONDecodeError:
                print("Gemini response not direct JSON, attempting to extract from markdown.")
                json_match = re.search(r"```json\n(.*)\n```", response.text, re.DOTALL)
                if json_match:
                    json_string = json_match.group(1)
                    result = json.loads(json_string)
                    print(f"Gemini response extracted and parsed from markdown: {result}")
                    return result
                else:
                    print(f"Gemini response not parsable as JSON, raw text: {response.text}")
                    return {"error": "Gemini did not return valid JSON. Raw response: " + response.text}
        else:
            print("Gemini response.text is empty.")
            return {"error": "Gemini returned an empty response."}

    except Exception as e:
        import traceback
        print(f"Error in backend /predict: {e}\n{traceback.format_exc()}")
        return {"error": f"Internal Server Error: {str(e)}"}