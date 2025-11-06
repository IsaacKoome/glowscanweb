# backend/main.py

import os
from fastapi import FastAPI, File, UploadFile, Header, HTTPException, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from google.generativeai import configure, GenerativeModel
import base64
from io import BytesIO
from PIL import Image
import json
import re
from datetime import datetime, date, timedelta
import hmac # For webhook verification
import hashlib # For webhook verification
import traceback
from typing import List, Dict, Any

import httpx

from openai import OpenAI
import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin import auth as firebase_auth

# ✅ 1. Initialize FastAPI
app = FastAPI( )

# ✅ 2. Allow CORS for frontend
origins = [
    "https://www.wonderjoyai.com",
    "https://wonderjoyai.com",
    "http://localhost:3000",
    "https://glowscanweb-1.onrender.com",
    "https://glowscanweb-git-recovery-from-mvp-isaac-koomes-projects.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
 )

# ✅ 3. Configure AI APIs
try:
    GOOGLE_API_KEY = os.environ["GEMINI_API_KEY"]
    configure(api_key=GOOGLE_API_KEY)
    # We only need one model instance for all tasks
    gemini_model = GenerativeModel("gemini-1.5-flash")
    print("Gemini AI Model configured successfully.")
except KeyError:
    print("CRITICAL WARNING: GEMINI_API_KEY environment variable not set. AI features will not work.")
    gemini_model = None

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
else:
    print("WARNING: OPENAI_API_KEY environment variable not set. GPT-4o will not be available.")
    openai_client = None

# Configure Paystack Secret Key
PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY")
if not PAYSTACK_SECRET_KEY:
    print("WARNING: PAYSTACK_SECRET_KEY environment variable not set. Paystack payments will not work.")
PAYSTACK_API_BASE_URL = "https://api.paystack.co"


# ✅ 4. Initialize Firebase Admin SDK for Firestore (using JSON from environment variable)
db = None
try:
    print("Attempting to initialize Firebase Admin SDK from environment variable..." )
    # Read service account JSON from environment
    firebase_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if firebase_json:
        try:
            sa_info = json.loads(firebase_json)
            cred = credentials.Certificate(sa_info)
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            db = firestore.client()
            print("Firebase Admin SDK initialized successfully from GOOGLE_APPLICATION_CREDENTIALS_JSON and Firestore client obtained.")
        except json.JSONDecodeError as jde:
            print("ERROR: GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON:", jde)
        except Exception as e:
            print("ERROR: Failed to initialize Firebase Admin SDK from JSON:", e)
    else:
        # Fallback to Application Default Credentials (if present)
        print("GOOGLE_APPLICATION_CREDENTIALS_JSON not found; falling back to ApplicationDefault()")
        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase Admin SDK initialized via ApplicationDefault().")
except Exception as e:
    print(f"CRITICAL ERROR: Failed to initialize Firebase Admin SDK: {e}")

# Define subscription plans and their details for Paystack
SUBSCRIPTION_PLANS = {
    "free": {"gemini_quota": 500, "gpt4o_quota": 0, "model_preference": "gemini", "amount_cents": 0, "currency": "USD", "paystack_plan_code": None},
    "basic": {"gemini_quota": 10, "gpt4o_quota": 3, "model_preference": "gpt4o", "amount_cents": 500, "currency": "USD", "paystack_plan_code": "PLN_s7gnbckddqplh9e"},
    "standard": {"gemini_quota": -1, "gpt4o_quota": 10, "model_preference": "gpt4o", "amount_cents": 2000, "currency": "USD", "paystack_plan_code": "PLN_fv2x1v23kup2w0f"},
    "premium": {"gemini_quota": -1, "gpt4o_quota": -1, "model_preference": "gpt4o", "amount_cents": 10000, "currency": "USD", "paystack_plan_code": "PLN_ugyl1iiqo5vn4g3"},
}


# --- START: REFACTORED AI LOGIC ---

async def analyze_image_with_ai(image_bytes: bytes, content_type: str) -> Dict[str, Any]:
    """
    Analyzes an image using the Gemini AI model with a specific prompt
    and returns a structured JSON result. This function is now the single
    source of truth for image analysis.
    """
    if not gemini_model:
        raise HTTPException(status_code=503, detail="AI Model is not available.")

    image_part = {"mime_type": content_type, "data": image_bytes}
    
    analysis_prompt = """
You are a highly experienced, friendly, and encouraging AI skincare and makeup expert named WonderJoy AI. Your goal is to provide precise, actionable, and personalized feedback based on the user's selfie. Analyze the attached selfie for both skin health and makeup application. Provide your analysis as a JSON object with the following keys. Each field should contain concise, direct advice or observations.
Expected JSON Structure:
{
  "hydration": "...", "acne": "...", "redness": "...", "skin_tone": "...", "makeup_coverage": "...", "makeup_blend": "...", "makeup_color_match": "...", "overall_glow_score": number, "skincare_advice_tips": [], "makeup_enhancement_tips": [], "overall_summary": "..."
}
Crucial Instructions:
1.  **Output ONLY the JSON object.** Do not include any conversational text, markdown, or explanations.
2.  Be specific in `makeup_blend` and `makeup_color_match`, noting *where* improvements are needed.
3.  If no makeup is detected, state "no makeup detected" for relevant fields.
4.  For `skincare_advice_tips` and `makeup_enhancement_tips`, provide concise, actionable sentences.
"""
    contents = [analysis_prompt, image_part]
    generation_config = {"response_mime_type": "application/json"}

    try:
        # Use the async version of the method for better performance
        response = await gemini_model.generate_content_async(
            contents=contents,
            generation_config=generation_config
        )
        raw_response_text = response.text
        return json.loads(raw_response_text)
    except json.JSONDecodeError:
        print(f"AI JSON Decode Error. Raw response: {raw_response_text}")
        raise HTTPException(status_code=500, detail="AI returned an unparseable response.")
    except Exception as e:
        print(f"Error during AI content generation: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred while communicating with the AI: {e}")

# --- END: REFACTORED AI LOGIC ---


# ✅ 5. Test route
@app.get("/")
def root():
    return {"message": "WonderJoy AI Backend is running"}


# ✅ 6. SIMPLIFIED AI analysis endpoint for LIVE ANALYSIS (app/page.tsx)
@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    x_user_id: str = Header(..., alias="X-User-ID")
):
    print(f"Received LIVE ANALYSIS request for user: {x_user_id}")
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized.")

    try:
        image_bytes = await file.read()
        # Call the single, reusable function to get the analysis
        analysis_result = await analyze_image_with_ai(image_bytes, file.content_type)

        # Update user's last analysis date in Firestore
        user_ref = db.collection("users").document(x_user_id)
        user_ref.set({"lastAnalysisDate": date.today().isoformat()}, merge=True)
        print(f"Live analysis for {x_user_id} successful.")

        return analysis_result

    except HTTPException as e:
        raise e  # Re-raise known HTTP exceptions from the helper
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error for live analysis: {str(e)}")


# ✅ 7. ENHANCED AI Chat Endpoint with Conversational Context
@app.post("/chat-predict")
async def chat_predict(
    x_user_id: str = Header(..., alias="X-User-ID"),
    chat_history: List[Dict[str, str]] = Body(None, description="A list of previous messages for context."),
    user_message: str = Body(None, description="The user's new text message"),
    file: UploadFile = File(None, description="Optional image file for analysis")
):
    print(f"Received CHAT request for user: {x_user_id}. Message: '{user_message}', File: {file.filename if file else 'None'}")
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized.")
    if not gemini_model:
        raise HTTPException(status_code=503, detail="AI Model is not available.")

    try:
        # --- A. Handle Image Analysis in Chat ---
        if file:
            image_bytes = await file.read()
            # Call the same reusable function for a consistent analysis experience
            analysis_result = await analyze_image_with_ai(image_bytes, file.content_type)
            return {
                "type": "analysis_result",
                "overall_summary": analysis_result.get("overall_summary", "Here's your beauty analysis."),
                "analysisData": analysis_result
            }

        # --- B. Handle Text-Only Follow-up Questions with CONTEXT ---
        if not user_message:
            raise HTTPException(status_code=400, detail="No message provided for chat.")

        # Build a history for the AI to understand the context of the conversation.
        # This is the key enhancement for conversational memory.
        conversational_prompt_parts = [
            "You are WonderJoy AI, an encouraging and friendly AI skincare and makeup expert.",
            "You are having a follow-up conversation with a user. Use the provided chat history to understand the context and give a helpful, relevant, and conversational response.",
            "Do not repeat advice they've already received unless you are elaborating on it."
        ]
        
        if chat_history:
            for message in chat_history:
                role = "user" if message.get("sender") == "user" else "model"
                content = message.get("content", "")
                conversational_prompt_parts.append(f"Previous {role} message: {content}")

        conversational_prompt_parts.append(f"User's new question: {user_message}")
        
        final_prompt = "\n".join(conversational_prompt_parts)
        
        response = await gemini_model.generate_content_async(final_prompt)
        
        return {
            "type": "text",
            "message": response.text,
            "overall_summary": response.text
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error for chat: {str(e)}")


# --- All Paystack and other endpoints remain unchanged ---

@app.post("/create-paystack-payment")
async def create_paystack_payment(request: Request, x_user_id: str = Header(..., alias="X-User-ID")):
    data = await request.json()
    plan_id = data.get("planId")
    user_email = data.get("userEmail", f"{x_user_id}@wonderjoy.ai")
    
    if not plan_id:
        raise HTTPException(status_code=400, detail="Plan ID is required.")

    plan_info = SUBSCRIPTION_PLANS.get(plan_id)
    if not plan_info or plan_info["amount_cents"] == 0:
        raise HTTPException(status_code=404, detail="Invalid plan ID or free plan selected for payment.")

    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Paystack secret key not configured on backend.")

    tx_ref = f"WJA-{x_user_id}-{plan_id}-{datetime.now().timestamp()}"
    amount_in_cents = plan_info["amount_cents"]

    try:
        async with httpx.AsyncClient( ) as client:
            print(f"Initiating Paystack transaction for user {x_user_id}, plan {plan_id}...")
            response = await client.post(
                f"{PAYSTACK_API_BASE_URL}/transaction/initialize",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={
                    "email": user_email,
                    "amount": amount_in_cents,
                    "currency": plan_info["currency"],
                    "reference": tx_ref,
                    "plan": plan_info["paystack_plan_code"],
                    "metadata": {"userId": x_user_id, "planId": plan_id},
                    "callback_url": f"https://www.wonderjoyai.com/payment-status?tx_ref={tx_ref}&status=callback&planId={plan_id}&userId={x_user_id}"
                }
             )
            response.raise_for_status()
            paystack_response = response.json()
            print(f"Paystack initialization response: {json.dumps(paystack_response, indent=2)}")

            if paystack_response and paystack_response.get("status"):
                return {"checkout_url": paystack_response["data"]["authorization_url"]}
            else:
                raise HTTPException(status_code=500, detail=f"Paystack initiation failed: {paystack_response.get('message', 'Unknown error')}")

    except httpx.HTTPStatusError as e:
        error_detail = e.response.json( ).get('message', e.response.text)
        raise HTTPException(status_code=500, detail=f"Paystack API error: {error_detail}")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/cancel-subscription")
async def cancel_subscription(request: Request):
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing X-User-ID header")

    print(f"Cancelling subscription for user: {user_id}")
    if not db:
        raise HTTPException(status_code=500, detail="Firestore not initialized.")
    
    user_ref = db.collection("users").document(user_id)
    doc = user_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found in Firestore")

    user_data = doc.to_dict()
    subscription_code = user_data.get("paystackSubscriptionCode")
    if not subscription_code:
        raise HTTPException(status_code=400, detail="No subscription code found for this user.")

    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Paystack secret key not configured for cancellation.")

    try:
        async with httpx.AsyncClient( ) as client:
            response = await client.post(
                "https://api.paystack.co/subscription/disable",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"},
                json={"code": subscription_code}
             )
            response.raise_for_status()
            print(f"Paystack disable response: {response.json()}")

        user_ref.update({
            "subscriptionPlan": "free",
            "paystackSubscriptionStatus": "disabled",
            "paystackSubscriptionCode": firestore.DELETE
        })
        print(f"Subscription for user {user_id} cancelled successfully.")
        return {"status": "success", "message": "Subscription cancelled and user downgraded to Free."}

    except httpx.HTTPStatusError as e:
        error_detail = e.response.json( ).get('message', e.response.text)
        raise HTTPException(status_code=e.response.status_code, detail=f"Failed to cancel subscription on Paystack: {error_detail}")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An unexpected error occurred during cancellation.")

@app.post("/paystack-webhook")
async def paystack_webhook(request: Request):
    raw_body = await request.body()
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Paystack secret key not configured for webhooks.")

    paystack_signature = request.headers.get('x-paystack-signature')
    if not paystack_signature:
        raise HTTPException(status_code=400, detail="No x-paystack-signature header.")

    generated_hash = hmac.new(PAYSTACK_SECRET_KEY.encode('utf-8'), raw_body, hashlib.sha512).hexdigest()
    if not hmac.compare_digest(generated_hash, paystack_signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        event = json.loads(raw_body.decode('utf-8'))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = event.get('event')
    print(f"Received Paystack webhook event: {event_type}")

    if event_type == 'charge.success':
        data = event['data']
        metadata = data.get('metadata', {})
        user_id, plan_id = metadata.get('userId'), metadata.get('planId')
        if user_id and plan_id and db:
            try:
                user_ref = db.collection("users").document(user_id)
                user_ref.set({
                    "subscriptionPlan": plan_id,
                    "paystackCustomerId": data.get('customer', {}).get('customer_code'),
                    "paystackLastTxRef": data.get('reference'),
                    "lastAnalysisDate": date.today().isoformat(),
                    "geminiCountToday": 0, "gpt4oCountToday": 0,
                }, merge=True)
                print(f"User {user_id} plan updated to {plan_id} via webhook.")
            except Exception as e:
                traceback.print_exc()
    elif event_type in ['subscription.create', 'subscription.not_renew', 'subscription.disable']:
        data = event['data']
        customer_code = data.get('customer', {}).get('customer_code')
        if customer_code and db:
            users_ref = db.collection("users")
            query = users_ref.where("paystackCustomerId", "==", customer_code).limit(1)
            try:
                docs = query.get()
                if docs:
                    user_doc = docs[0]
                    status = data.get('status')
                    plan_code = data.get('plan', {}).get('plan_code')
                    new_plan_id = "free"
                    if status != 'disabled':
                        for p_id, p_info in SUBSCRIPTION_PLANS.items():
                            if p_info.get("paystack_plan_code") == plan_code:
                                new_plan_id = p_id
                                break
                    update_data = {
                        "subscriptionPlan": new_plan_id,
                        "paystackSubscriptionStatus": status,
                        "paystackSubscriptionCode": data.get('subscription_code'),
                    }
                    user_doc.reference.set(update_data, merge=True)
                    print(f"User {user_doc.id} subscription status updated to {status}.")
            except Exception as e:
                traceback.print_exc()

    return {"status": "success"}
 