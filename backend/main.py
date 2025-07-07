# backend/main.py

import os
from fastapi import FastAPI, File, UploadFile, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.generativeai import configure, GenerativeModel
import base64
from io import BytesIO
from PIL import Image
import json
import re
from datetime import datetime, date, timedelta # Import for date handling

# NEW IMPORTS FOR OPENAI AND FIREBASE ADMIN
from openai import OpenAI
import firebase_admin
from firebase_admin import credentials, firestore

# ✅ 1. Initialize FastAPI
app = FastAPI()

# ✅ 2. Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Later: replace with Vercel URL
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ 3. Configure AI APIs
# Gemini API Key
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
if GOOGLE_API_KEY:
    configure(api_key=GOOGLE_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY environment variable not set. This might cause issues.")

gemini_model = GenerativeModel("gemini-1.5-flash")

# OpenAI API Key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
else:
    print("WARNING: OPENAI_API_KEY environment variable not set. GPT-4o will not be available.")
    openai_client = None # Set to None if key is missing

# ✅ 4. Initialize Firebase Admin SDK for Firestore
# For Cloud Run, Firebase Admin SDK usually picks up credentials automatically
# if running in a Google Cloud environment with appropriate service account permissions.
# If running locally, you might need a service account key file.
try:
    if not firebase_admin._apps: # Initialize only if not already initialized
        cred = credentials.ApplicationDefault() # Uses default credentials for Cloud Run
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase Admin SDK initialized successfully.")
except Exception as e:
    print(f"ERROR: Failed to initialize Firebase Admin SDK: {e}")
    db = None # Set db to None if initialization fails

# Define subscription plans and their quotas
SUBSCRIPTION_PLANS = {
    "free": {
        "gemini_quota": 5,
        "gpt4o_quota": 0,
        "model_preference": "gemini" # Default model for free users
    },
    "basic": {
        "gemini_quota": 10,
        "gpt4o_quota": 3,
        "model_preference": "gpt4o" # Prefer GPT-4o for basic users
    },
    "standard": {
        "gemini_quota": -1, # -1 for unlimited
        "gpt4o_quota": 10,
        "model_preference": "gpt4o"
    },
    "premium": {
        "gemini_quota": -1,
        "gpt4o_quota": -1,
        "model_preference": "gpt4o"
    }
}

# ✅ 5. Test route
@app.get("/")
def root():
    return {"message": "WonderJoy AI Backend is running"}

# ✅ 6. Real AI analysis endpoint with user_id and model selection
@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    x_user_id: str = Header(..., alias="X-User-ID") # Expect user ID in custom header
):
    print(f"Received request for user: {x_user_id}, file: {file.filename}")

    if not db:
        raise HTTPException(status_code=500, detail="Firestore not initialized. Cannot manage quotas.")
    
    user_ref = db.collection("users").document(x_user_id)
    user_doc = await user_ref.get() # Await the get() call

    user_data = user_doc.to_dict() if user_doc.exists else {}
    
    # Initialize user data if it's new or missing
    current_plan = user_data.get("subscriptionPlan", "free")
    last_analysis_date_str = user_data.get("lastAnalysisDate")
    gemini_count_today = user_data.get("geminiCountToday", 0)
    gpt4o_count_today = user_data.get("gpt4oCountToday", 0)

    today_str = date.today().isoformat()

    # Reset daily counts if it's a new day
    if last_analysis_date_str != today_str:
        gemini_count_today = 0
        gpt4o_count_today = 0
        print(f"Daily quotas reset for user {x_user_id}.")

    plan_quotas = SUBSCRIPTION_PLANS.get(current_plan, SUBSCRIPTION_PLANS["free"])
    
    model_to_use = ""
    # Determine which model to use based on plan preference and quota
    if plan_quotas["model_preference"] == "gpt4o" and openai_client:
        if plan_quotas["gpt4o_quota"] == -1 or gpt4o_count_today < plan_quotas["gpt4o_quota"]:
            model_to_use = "gpt4o"
        elif plan_quotas["gemini_quota"] == -1 or gemini_count_today < plan_quotas["gemini_quota"]:
            model_to_use = "gemini"
        else:
            raise HTTPException(status_code=429, detail="Daily quota exceeded for all available models.")
    else: # Prefer Gemini or OpenAI client not available
        if plan_quotas["gemini_quota"] == -1 or gemini_count_today < plan_quotas["gemini_quota"]:
            model_to_use = "gemini"
        elif openai_client and (plan_quotas["gpt4o_quota"] == -1 or gpt4o_count_today < plan_quotas["gpt4o_quota"]):
             model_to_use = "gpt4o" # Fallback to GPT-4o if Gemini quota is hit but GPT-4o is available
        else:
            raise HTTPException(status_code=429, detail="Daily quota exceeded for all available models.")

    print(f"User {x_user_id} (Plan: {current_plan}) will use model: {model_to_use}")

    try:
        image_bytes = await file.read()
        
        # Prepare image for the chosen model
        if model_to_use == "gemini":
            gemini_image_part = {
                "mime_type": file.content_type,
                "data": image_bytes
            }
            # Use the existing prompt for Gemini
            prompt = """
You are a highly experienced, friendly, and encouraging AI skincare and makeup expert named WonderJoy AI. Your goal is to provide precise, actionable, and personalized feedback based on the user's selfie.

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
            generation_config = {
                "response_mime_type": "application/json"
            }
            response = gemini_model.generate_content(
                contents=[prompt, gemini_image_part],
                generation_config=generation_config
            )
            raw_response_text = response.text

        elif model_to_use == "gpt4o":
            if not openai_client:
                raise HTTPException(status_code=500, detail="OpenAI client not initialized. API Key missing.")

            # Convert image to base64 for OpenAI Vision
            buffered = BytesIO(image_bytes)
            img = Image.open(buffered)
            # Ensure it's RGB for JPEG conversion
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Save as JPEG for consistent base64 encoding
            img_byte_arr = BytesIO()
            img.save(img_byte_arr, format='JPEG')
            base64_image = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')

            # Prompt for GPT-4o (can be more detailed/nuanced if needed)
            gpt_prompt = """
You are a highly experienced, friendly, and encouraging AI skincare and makeup expert named WonderJoy AI. Analyze the attached selfie and provide a JSON object with the following keys, offering precise, actionable, and personalized feedback.

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
            
            chat_completion = await openai_client.chat.completions.create( # Use await for async call
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": gpt_prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                        ]
                    }
                ],
                response_format={"type": "json_object"}, # Instruct GPT-4o to return JSON
                max_tokens=1000, # Limit response length
            )
            raw_response_text = chat_completion.choices[0].message.content

        else:
            raise HTTPException(status_code=500, detail="No valid AI model selected or available.")

        # Parse the response text
        if raw_response_text:
            try:
                result = json.loads(raw_response_text)
                print(f"AI response successfully parsed: {result}")
            except json.JSONDecodeError:
                print(f"AI response not direct JSON, attempting to extract from markdown. Raw: {raw_response_text[:200]}...")
                json_match = re.search(r"```json\n(.*)\n```", raw_response_text, re.DOTALL)
                if json_match:
                    json_string = json_match.group(1)
                    result = json.loads(json_string)
                    print(f"AI response extracted and parsed from markdown: {result}")
                else:
                    print(f"AI response not parsable as JSON. Raw text: {raw_response_text}")
                    raise HTTPException(status_code=500, detail="AI did not return valid JSON. Raw response: " + raw_response_text)
        else:
            print("AI response text is empty.")
            raise HTTPException(status_code=500, detail="AI returned an empty response.")

        # Update user's quota in Firestore
        if model_to_use == "gemini":
            gemini_count_today += 1
        elif model_to_use == "gpt4o":
            gpt4o_count_today += 1

        await user_ref.set({ # Await the set() call
            "subscriptionPlan": current_plan, # Persist current plan
            "lastAnalysisDate": today_str,
            "geminiCountToday": gemini_count_today,
            "gpt4oCountToday": gpt4o_count_today
        }, merge=True) # Use merge=True to only update specified fields

        return result

    except HTTPException as e:
        raise e # Re-raise HTTPExceptions directly
    except Exception as e:
        import traceback
        print(f"Error in backend /predict: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")