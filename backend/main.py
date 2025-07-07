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

# NEW: Import httpx for async HTTP requests
import httpx

from openai import OpenAI
import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin import auth as firebase_auth

# ✅ 1. Initialize FastAPI
app = FastAPI()

# ✅ 2. Allow CORS for frontend
origins = [
    "https://www.wonderjoyai.com",
    "https://wonderjoyai.com",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ 3. Configure AI APIs
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
if GOOGLE_API_KEY:
    configure(api_key=GOOGLE_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY environment variable not set. This might cause issues.")

gemini_model = GenerativeModel("gemini-1.5-flash")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
else:
    print("WARNING: OPENAI_API_KEY environment variable not set. GPT-4o will not be available.")
    openai_client = None

# NEW: Configure Paystack Secret Key
PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY")

if not PAYSTACK_SECRET_KEY:
    print("WARNING: PAYSTACK_SECRET_KEY environment variable not set. Paystack payments will not work.")

# Base URL for Paystack API
PAYSTACK_API_BASE_URL = "https://api.paystack.co"


# ✅ 4. Initialize Firebase Admin SDK for Firestore
db = None
try:
    print("Attempting to initialize Firebase Admin SDK...")
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase Admin SDK initialized successfully and Firestore client obtained.")
except Exception as e:
    print(f"CRITICAL ERROR: Failed to initialize Firebase Admin SDK: {e}")

# Define subscription plans and their details for Paystack - UPDATED WITH YOUR PLAN CODES
SUBSCRIPTION_PLANS = {
    "free": {
        "gemini_quota": 500, # TEMPORARILY INCREASED FOR TESTING
        "gpt4o_quota": 0,
        "model_preference": "gemini",
        "amount_kes_cents": 0,
        "currency": "KES",
        "paystack_plan_code": None
    },
    "basic": {
        "gemini_quota": 10,
        "gpt4o_quota": 3,
        "model_preference": "gpt4o",
        "amount_kes_cents": 70000, # KES 700.00 -> 70000 cents
        "currency": "KES",
        "paystack_plan_code": "PLN_pb8kloxtu8n3bh1" # YOUR ACTUAL BASIC PLAN CODE
    },
    "standard": {
        "gemini_quota": -1,
        "gpt4o_quota": 10,
        "model_preference": "gpt4o",
        "amount_kes_cents": 280000, # KES 2800.00 -> 280000 cents
        "currency": "KES",
        "paystack_plan_code": "PLN_qc9ae75bvut0h0h" # YOUR ACTUAL STANDARD PLAN CODE
    },
    "premium": {
        "gemini_quota": -1,
        "gpt4o_quota": -1,
        "model_preference": "gpt4o",
        "amount_kes_cents": 1400000, # KES 14000.00 -> 1400000 cents
        "currency": "KES",
        "paystack_plan_code": "PLN_x3g9ffyjwiy74" # YOUR ACTUAL PREMIUM PLAN CODE
    },
}

# ✅ 5. Test route
@app.get("/")
def root():
    return {"message": "WonderJoy AI Backend is running"}

# ✅ 6. Real AI analysis endpoint with user_id and model selection (existing)
@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    x_user_id: str = Header(..., alias="X-User-ID")
):
    print(f"Received request for user: {x_user_id}, file: {file.filename}")

    if not db:
        print("ERROR: Firestore client is not initialized. Cannot manage quotas.")
        raise HTTPException(status_code=500, detail="Firestore not initialized. Cannot manage quotas.")
    
    user_data = {}
    try:
        user_ref = db.collection("users").document(x_user_id)
        user_doc = user_ref.get()
        user_data = user_doc.to_dict() if user_doc.exists else {}
        print(f"Successfully fetched user data for {x_user_id}. Exists: {user_doc.exists}")
    except Exception as e:
        print(f"ERROR: Failed to fetch user data from Firestore for {x_user_id}: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to retrieve user data: {str(e)}")
    
    current_plan = user_data.get("subscriptionPlan", "free")
    last_analysis_date_str = user_data.get("lastAnalysisDate")
    gemini_count_today = user_data.get("geminiCountToday", 0)
    gpt4o_count_today = user_data.get("gpt4oCountToday", 0)

    today_str = date.today().isoformat()

    if last_analysis_date_str != today_str:
        gemini_count_today = 0
        gpt4o_count_today = 0
        print(f"Daily quotas reset for user {x_user_id}.")

    plan_quotas = SUBSCRIPTION_PLANS.get(current_plan, SUBSCRIPTION_PLANS["free"])
    
    model_to_use = ""
    if plan_quotas["model_preference"] == "gpt4o" and openai_client:
        if plan_quotas["gpt4o_quota"] == -1 or gpt4o_count_today < plan_quotas["gpt4o_quota"]:
            model_to_use = "gpt4o"
        elif plan_quotas["gemini_quota"] == -1 or gemini_count_today < plan_quotas["gemini_quota"]:
            model_to_use = "gemini"
        else:
            raise HTTPException(status_code=429, detail="Daily quota exceeded for all available models.")
    else:
        if plan_quotas["gemini_quota"] == -1 or gemini_count_today < plan_quotas["gemini_quota"]:
            model_to_use = "gemini"
        elif openai_client and (plan_quotas["gpt4o_quota"] == -1 or gpt4o_count_today < plan_quotas["gpt4o_quota"]):
             model_to_use = "gpt4o"
        else:
            raise HTTPException(status_code=429, detail="Daily quota exceeded for all available models.")

    print(f"User {x_user_id} (Plan: {current_plan}) will use model: {model_to_use}")

    try:
        image_bytes = await file.read()
        
        if model_to_use == "gemini":
            gemini_image_part = {
                "mime_type": file.content_type,
                "data": image_bytes
            }
            prompt = """
You are a highly experienced, friendly, and encouraging AI skincare and makeup expert named WonderJoy AI. Your goal is to provide precise, actionable, and personalized feedback based on the user's selfie.

Analyze the attached selfie for both skin health and makeup application. Provide your analysis as a JSON object with the following keys. Each field should contain concise, direct advice or observations.

Expected JSON Structure:
{
  "hydration": "...",
  "acne": "...",
  "redness": "...",
  "skin_tone": "...",
  "makeup_coverage": "...",
  "makeup_blend": "...",
  "makeup_color_match": "...",
  "overall_glow_score": number,
  "skincare_advice_tips": [],
  "makeup_enhancement_tips": [],
  "overall_summary": "..."
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

            buffered = BytesIO(image_bytes)
            img = Image.open(buffered)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            img_byte_arr = BytesIO()
            img.save(img_byte_arr, format='JPEG')
            base64_image = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')

            gpt_prompt = """
You are a highly experienced, friendly, and encouraging AI skincare and makeup expert named WonderJoy AI. Analyze the attached selfie and provide a JSON object with the following keys, offering precise, actionable, and personalized feedback.

Expected JSON Structure:
{
  "hydration": "...",
  "acne": "...",
  "redness": "...",
  "skin_tone": "...",
  "makeup_coverage": "...",
  "makeup_blend": "...",
  "makeup_color_match": "...",
  "overall_glow_score": number,
  "skincare_advice_tips": [],
  "makeup_enhancement_tips": [],
  "overall_summary": "..."
}

Crucial Instructions:
1.  **Output ONLY the JSON object.** Do not include any conversational text, markdown outside the JSON, or explanations before or after the JSON.
2.  Be as specific as possible in `makeup_blend` and `makeup_color_match` feedback, noting *where* improvements are needed (e.g., "blend more around the nose," "foundation appears slightly too warm for your neck").
3.  If no makeup is detected, state "no makeup detected" for relevant fields and provide general makeup enhancement tips.
4.  For `skincare_advice_tips` and `makeup_enhancement_tips`, provide concise, actionable sentences.
"""
            
            chat_completion = await openai_client.chat.completions.create(
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
                response_format={"type": "json_object"},
                max_tokens=1000,
            )
            raw_response_text = chat_completion.choices[0].message.content

        else:
            raise HTTPException(status_code=500, detail="No valid AI model selected or available.")

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

        try:
            if model_to_use == "gemini":
                gemini_count_today += 1
            elif model_to_use == "gpt4o":
                gpt4o_count_today += 1

            user_ref.set({
                "subscriptionPlan": current_plan,
                "lastAnalysisDate": today_str,
                "geminiCountToday": gemini_count_today,
                "gpt4oCountToday": gpt4o_count_today
            }, merge=True)
            print(f"Quota updated successfully for user {x_user_id}.")
        except Exception as e:
            print(f"ERROR: Failed to update user quota in Firestore for {x_user_id}: {e}")
            import traceback
            print(traceback.format_exc())

        return result

    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        print(f"Error in backend /predict: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

# NEW ENDPOINT: Create Paystack Payment Initiation
@app.post("/create-paystack-payment")
async def create_paystack_payment(request: Request, x_user_id: str = Header(..., alias="X-User-ID")):
    data = await request.json()
    plan_id = data.get("planId")
    user_email = data.get("userEmail", f"{x_user_id}@wonderjoy.ai") # Default email for unauth users
    
    if not plan_id:
        raise HTTPException(status_code=400, detail="Plan ID is required.")

    plan_info = SUBSCRIPTION_PLANS.get(plan_id)
    if not plan_info or plan_info["amount_kes_cents"] == 0:
        raise HTTPException(status_code=404, detail="Invalid plan ID or free plan selected.")

    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Paystack secret key not configured on backend.")

    # Generate a unique transaction reference
    tx_ref = f"WJA-{x_user_id}-{plan_id}-{datetime.now().timestamp()}"

    # Prepare data for Paystack transaction initialization
    amount_in_cents = plan_info["amount_kes_cents"]

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PAYSTACK_API_BASE_URL}/transaction/initialize",
                headers={
                    "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "email": user_email,
                    "amount": amount_in_cents, # Paystack expects amount in kobo/cents
                    "currency": plan_info["currency"],
                    "reference": tx_ref,
                    "plan": plan_info["paystack_plan_code"], # Link to the subscription plan
                    "metadata": {
                        "userId": x_user_id,
                        "planId": plan_id
                    },
                    "callback_url": f"https://www.wonderjoyai.com/payment-status?tx_ref={tx_ref}&status=callback&planId={plan_id}&userId={x_user_id}"
                }
            )
            response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
            
            paystack_response = response.json()

            if paystack_response and paystack_response.get("status"):
                return {"checkout_url": paystack_response["data"]["authorization_url"]}
            else:
                print(f"Paystack initiation failed: {paystack_response}")
                raise HTTPException(status_code=500, detail=f"Paystack initiation failed: {paystack_response.get('message', 'Unknown error')}")

    except httpx.HTTPStatusError as e:
        print(f"HTTP error from Paystack: {e.response.text}")
        try:
            error_detail = e.response.json().get('message', 'Unknown HTTP error from Paystack.')
        except json.JSONDecodeError:
            error_detail = e.response.text
        raise HTTPException(status_code=500, detail=f"Paystack API error: {error_detail}")
    except Exception as e:
        print(f"Error creating Paystack payment: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

# NEW ENDPOINT: Paystack Webhook Handler
@app.post("/paystack-webhook")
async def paystack_webhook(request: Request, raw_body: bytes = Body(...)):
    if not PAYSTACK_SECRET_KEY:
        print("ERROR: PAYSTACK_SECRET_KEY is not set. Webhook verification skipped.")
        raise HTTPException(status_code=500, detail="Paystack secret key not configured for webhooks.")

    # Verify webhook signature
    paystack_signature = request.headers.get('x-paystack-signature')
    if not paystack_signature:
        print("Webhook Error: No x-paystack-signature header.")
        raise HTTPException(status_code=400, detail="No x-paystack-signature header.")

    generated_hash = hmac.new(
        PAYSTACK_SECRET_KEY.encode('utf-8'),
        raw_body,
        hashlib.sha512
    ).hexdigest()
    
    if not hmac.compare_digest(generated_hash, paystack_signature):
        print(f"Webhook Error: Invalid signature. Expected {generated_hash}, Got {paystack_signature}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        event = json.loads(raw_body.decode('utf-8'))
    except json.JSONDecodeError:
        print("Webhook Error: Invalid JSON payload.")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = event.get('event')
    print(f"Received Paystack webhook event: {event_type}")

    # Handle different event types
    if event_type == 'charge.success':
        transaction_data = event['data']
        tx_ref = transaction_data.get('reference')
        customer_email = transaction_data.get('customer', {}).get('email')
        amount_paid = transaction_data.get('amount') # In smallest currency unit
        currency = transaction_data.get('currency')
        
        metadata = transaction_data.get('metadata', {})
        user_id = metadata.get('userId')
        plan_id = metadata.get('planId')

        print(f"Successful Paystack charge for tx_ref: {tx_ref}, email: {customer_email}, amount: {amount_paid} {currency}")

        if user_id and plan_id and db:
            try:
                user_ref = db.collection("users").document(user_id)
                user_ref.set({
                    "subscriptionPlan": plan_id,
                    "paystackCustomerId": transaction_data.get('customer', {}).get('customer_code'),
                    "paystackLastTxRef": tx_ref,
                    "lastAnalysisDate": date.today().isoformat(),
                    "geminiCountToday": 0,
                    "gpt4oCountToday": 0,
                }, merge=True)
                print(f"User {user_id} plan updated to {plan_id} in Firestore via webhook (charge.success).")
            except Exception as e:
                print(f"ERROR: Failed to update user {user_id} plan in Firestore via webhook (charge.success): {e}")
                import traceback
                print(traceback.format_exc())
        else:
            print(f"WARNING: Missing user_id ({user_id}) or plan_id ({plan_id}) or db not initialized for Paystack webhook (charge.success).")

    elif event_type == 'subscription.create' or event_type == 'subscription.not_renew' or event_type == 'subscription.disable':
        # subscription.disable is important for cancellations
        subscription_data = event['data']
        customer_code = subscription_data.get('customer', {}).get('customer_code')
        subscription_status = subscription_data.get('status')
        plan_code = subscription_data.get('plan', {}).get('plan_code')

        print(f"Paystack subscription event: {event_type} for customer: {customer_code}, status: {subscription_status}, plan: {plan_code}")

        if customer_code and db:
            users_ref = db.collection("users")
            query = users_ref.where("paystackCustomerId", "==", customer_code).limit(1)
            
            try:
                docs = query.get()
                if docs:
                    user_doc = docs[0]
                    user_id = user_doc.id
                    
                    new_plan_id = "free" # Default to free if no matching plan found or subscription is disabled
                    if subscription_status != 'disabled': # Only map to paid plan if not disabled
                        for p_id, p_info in SUBSCRIPTION_PLANS.items():
                            if p_info.get("paystack_plan_code") == plan_code:
                                new_plan_id = p_id
                                break
                    
                    user_doc.reference.set({
                        "subscriptionPlan": new_plan_id,
                        "paystackSubscriptionStatus": subscription_status,
                        "paystackSubscriptionCode": subscription_data.get('subscription_code'),
                        "lastAnalysisDate": date.today().isoformat(),
                        "geminiCountToday": 0,
                        "gpt4oCountToday": 0,
                    }, merge=True)
                    print(f"User {user_id} subscription status updated to {subscription_status} and plan to {new_plan_id} in Firestore via webhook.")
                else:
                    print(f"WARNING: User not found in Firestore for Paystack customer code: {customer_code}")
            except Exception as e:
                print(f"ERROR: Failed to handle subscription event for customer {customer_code}: {e}")
                import traceback
                print(traceback.format_exc())
        else:
            print(f"WARNING: Missing customer_code ({customer_code}) or db not initialized for subscription event.")

    return {"status": "success"}
