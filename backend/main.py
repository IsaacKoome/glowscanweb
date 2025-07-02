# backend/main.py

import os
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
# Ensure you have google-generativeai installed: pip install google-generativeai
from google.generativeai import configure, GenerativeModel, upload_file
import base64
from io import BytesIO
from PIL import Image
import json # Ensure json module is imported
import re # Import regex for parsing

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
# It's better to configure this once globally or use a client library that handles it.
# For Google Cloud Run, you typically don't set API_KEY directly if using service accounts.
# If you are using an API key, ensure it's set as an environment variable in Cloud Run.
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
        # Read image bytes directly
        image_bytes = await file.read()
        
        # Prepare image for Gemini.
        # Gemini API expects image data in a specific format, not base64 string directly in parts.
        # For direct API calls (which the Python SDK does), you can often pass bytes directly
        # or use `upload_file` if you need to manage larger files or specific MIME types.
        # Let's use the direct bytes method here for simplicity with `generate_content`.

        # If you need to convert to PIL.Image first (e.g., for resizing/processing), then convert back to bytes for Gemini
        # img = Image.open(BytesIO(image_bytes)).convert("RGB")
        # # If you need to resize, do it here: img = img.resize((desired_width, desired_height))
        # buffered = BytesIO()
        # img.save(buffered, format="JPEG") # Save as JPEG for consistency
        # gemini_image_part = {
        #     "mime_type": "image/jpeg",
        #     "data": buffered.getvalue() # Pass raw bytes, not base64 string
        # }

        # Simpler: pass the raw image bytes directly if Gemini accepts it (which it usually does for common types)
        gemini_image_part = {
            "mime_type": file.content_type, # Use the content type from the uploaded file
            "data": image_bytes
        }

        # Prepare the prompt
        prompt = """
You are a highly experienced and friendly AI skincare and makeup expert. Analyze the attached selfie and return a JSON object with the following keys:
- "hydration": "...", // e.g. "low", "moderate", "high"
- "acne": "...", // e.g. "none", "mild", "moderate", "severe"
- "skin_tone": "...", // e.g. "fair", "medium", "dark", "neutral", etc.
- "makeup_feedback": "..." // Detailed feedback on makeup (blend, color match, coverage, areas for improvement).
- "overall_glow_score": number // An integer score from 1 to 10, where 10 is maximum glow.

Ensure the response is ONLY the JSON object, with no additional text or markdown formatting outside the JSON.
"""
        # Add a more specific instruction for JSON output
        generation_config = {
            "response_mime_type": "application/json"
        }

        # Send image and prompt to Gemini
        # Use parts=[prompt, gemini_image_part]
        response = model.generate_content(
            contents=[prompt, gemini_image_part],
            generation_config=generation_config
        )

        # Check if response.text is directly available and valid JSON
        if response.text:
            try:
                # Attempt to parse directly if response_mime_type worked
                result = json.loads(response.text)
                print(f"Gemini response successfully parsed: {result}")
                return result
            except json.JSONDecodeError:
                # Fallback: If direct parse fails, try to extract JSON from markdown block
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