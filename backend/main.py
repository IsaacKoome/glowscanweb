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

# Define subscription plans and their details for Paystack - UPDATED WITH YOUR NEW PLAN CODES
SUBSCRIPTION_PLANS = {
    "free": {
        "gemini_quota": 500, # This will be overridden in /predict for now
        "gpt4o_quota": 0,
        "model_preference": "gemini",
        "amount_kes_cents": 0,
        "currency": "USD",
        "paystack_plan_code": None
    },
    "basic": {
        "gemini_quota": 10,
        "gpt4o_quota": 3,
        "model_preference": "gpt4o",
        "amount_cents": 5, # USD 5.00 -> 500 cents
        "currency": "USD",
        "paystack_plan_code": "PLN_s7gnbckddqplh9e" # YOUR ACTUAL BASIC PLAN CODE - UPDATED
    },
    "standard": {
        "gemini_quota": -1,
        "gpt4o_quota": 10,
        "model_preference": "gpt4o",
        "amount_cents": 2000, # USD 20.00 -> 2000 cents
        "currency": "USD",
        "paystack_plan_code": "PLN_fv2x1v23kup2w0f" # YOUR ACTUAL STANDARD PLAN CODE - UPDATED
    },
    "premium": {
        "gemini_quota": -1,
        "gpt4o_quota": -1,
        "model_preference": "gpt4o",
        "amount_cents": 10000, # USD 100.00 -> 10000 cents
        "currency": "USD",
        "paystack_plan_code": "PLN_ugyl1iiqo5vn4g3" # YOUR ACTUAL PREMIUM PLAN CODE - UPDATED
    },
}

# Removed FREE_GEMINI_LAUNCH_END_DATE as Gemini will be unlimited for all for now.


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
    
    # We still fetch user data for logging/future use, but it won't impact model selection for now
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
        # Do not raise HTTPException here, allow prediction to proceed with Gemini
        # raise HTTPException(status_code=500, detail=f"Failed to retrieve user data: {str(e)}")
    
    current_plan = user_data.get("subscriptionPlan", "free") # Keep track of current plan for logging

    # --- NEW LOGIC: Force Gemini Flash for all users, unlimited ---
    model_to_use = "gemini"
    print(f"User {x_user_id} (Plan: {current_plan}). Forcing unlimited Gemini Flash analysis.")
    # No quota checks or OpenAI calls for now, directly proceed with Gemini
    # --- END NEW LOGIC ---

    try:
        image_bytes = await file.read()
        
        # Always use Gemini for analysis
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

        # Quota update logic is temporarily skipped for Gemini for now
        # You might still want to log usage for analytics, but not enforce limits.
        # For now, we'll just update the last analysis date.
        try:
            today_str = date.today().isoformat()
            user_ref.set({
                "lastAnalysisDate": today_str,
                # Not updating geminiCountToday or gpt4oCountToday for now to ensure unlimited
            }, merge=True)
            print(f"Last analysis date updated for user {x_user_id}.")
        except Exception as e:
            print(f"ERROR: Failed to update last analysis date in Firestore for {x_user_id}: {e}")
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
# This endpoint handles initiating payments with Paystack.
# It receives the selected planId and userEmail from the frontend.
# It communicates with Paystack to get a checkout URL and returns it to the frontend.
@app.post("/create-paystack-payment")
async def create_paystack_payment(request: Request, x_user_id: str = Header(..., alias="X-User-ID")):
    data = await request.json()
    plan_id = data.get("planId")
    user_email = data.get("userEmail", f"{x_user_id}@wonderjoy.ai") # Default email for unauth users
    
    if not plan_id:
        raise HTTPException(status_code=400, detail="Plan ID is required.")

    plan_info = SUBSCRIPTION_PLANS.get(plan_id)
    # Ensure the plan exists and is not the free plan (which doesn't require Paystack payment)
    if not plan_info or plan_info["amount_kes_cents"] == 0:
        raise HTTPException(status_code=404, detail="Invalid plan ID or free plan selected for payment.")

    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Paystack secret key not configured on backend.")

    # Generate a unique transaction reference
    # This reference helps you track the transaction in Paystack and your system.
    tx_ref = f"WJA-{x_user_id}-{plan_id}-{datetime.now().timestamp()}"

    # Prepare data for Paystack transaction initialization
    # Paystack expects amount in kobo (for NGN) or cents (for USD, KES, etc.)
    amount_in_cents = plan_info["amount_kes_cents"] # Assuming this is correctly set for KES or USD cents

    try:
        async with httpx.AsyncClient() as client:
            print(f"Initiating Paystack transaction for user {x_user_id}, plan {plan_id}...")
            response = await client.post(
                f"{PAYSTACK_API_BASE_URL}/transaction/initialize",
                headers={
                    "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "email": user_email,
                    "amount": amount_in_cents, # Amount in smallest currency unit (e.g., KES cents)
                    "currency": plan_info["currency"], # Currency code (e.g., "KES", "USD")
                    "reference": tx_ref,
                    "plan": plan_info["paystack_plan_code"], # Link to the subscription plan
                    "metadata": {
                        "userId": x_user_id,
                        "planId": plan_id
                    },
                    # The callback_url is where Paystack redirects the user after payment.
                    # It's crucial for your frontend to handle this redirect and verify the payment.
                    "callback_url": f"https://www.wonderjoyai.com/payment-status?tx_ref={tx_ref}&status=callback&planId={plan_id}&userId={x_user_id}"
                }
            )
            response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
            
            paystack_response = response.json()
            print(f"Paystack initialization response: {json.dumps(paystack_response, indent=2)}")

            if paystack_response and paystack_response.get("status"):
                # Return the authorization_url (checkout URL) to the frontend
                return {"checkout_url": paystack_response["data"]["authorization_url"]}
            else:
                # Log the full Paystack response if initiation failed
                print(f"Paystack initiation failed (status false): {paystack_response}")
                raise HTTPException(status_code=500, detail=f"Paystack initiation failed: {paystack_response.get('message', 'Unknown error')}")

    except httpx.HTTPStatusError as e:
        # Catch HTTP errors from Paystack API (e.g., 400 Bad Request, 401 Unauthorized)
        print(f"HTTP error from Paystack: {e.response.status_code} - {e.response.text}")
        try:
            error_detail = e.response.json().get('message', 'Unknown HTTP error from Paystack.')
        except json.JSONDecodeError:
            error_detail = e.response.text # Fallback if response is not JSON
        raise HTTPException(status_code=500, detail=f"Paystack API error: {error_detail}")
    except Exception as e:
        # Catch any other unexpected errors during the process
        print(f"Error creating Paystack payment: {e}")
        import traceback
        print(traceback.format_exc()) # Print full traceback for debugging
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


    
@app.post("/cancel-subscription")
async def cancel_subscription(request: Request): # Changed to async def
    user_id = request.headers.get("X-User-ID")

    if not user_id:
        print("❌ Missing X-User-ID header") # Added logging
        raise HTTPException(status_code=400, detail="Missing X-User-ID header")

    print(f"🔍 Cancelling subscription for user: {user_id}")
    
    # Ensure Firestore is initialized
    if not db:
        print("❌ Firestore client is not initialized.") # Added logging
        raise HTTPException(status_code=500, detail="Firestore not initialized.")
    
    # Fetch user doc
    user_ref = db.collection("users").document(user_id)
    doc = user_ref.get()

    if not doc.exists:
        print(f"❌ Firestore: No document found for user {user_id}.") # Added logging
        raise HTTPException(status_code=404, detail="User not found in Firestore")

    user_data = doc.to_dict()
    subscription_code = user_data.get("paystackSubscriptionCode")

    if not subscription_code:
        print(f"❌ paystackSubscriptionCode missing in Firestore for user {user_id}: {user_data}") # Added logging
        raise HTTPException(status_code=400, detail="No subscription code found for this user.")

    # Ensure Paystack Secret Key is configured
    if not PAYSTACK_SECRET_KEY:
        print("❌ PAYSTACK_SECRET_KEY is not set for cancellation.") # Added logging
        raise HTTPException(status_code=500, detail="Paystack secret key not configured for cancellation.")

    # Now cancel using Paystack API
    try:
        async with httpx.AsyncClient() as client: # Use httpx.AsyncClient for async
            print(f"🚀 Attempting to disable subscription {subscription_code} via Paystack API.") # Added logging
            response = await client.post( # Use await with client.post
                "https://api.paystack.co/subscription/disable",
                headers={
                    "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "code": subscription_code,
                    # "token": "access"   # This 'token' field is typically not required for disabling a subscription.
                                        # It's more for enabling or managing specific authorization tokens.
                                        # Removing it to align with standard Paystack disable API usage.
                }
            )
            response.raise_for_status() # Raise for bad status codes (4xx or 5xx)
            paystack_response_data = response.json()
            print(f"✅ Paystack disable response: {paystack_response_data}") # Added logging

        # Update user's plan to free in Firestore
        user_ref.update({
            "subscriptionPlan": "free",
            "paystackSubscriptionStatus": "disabled", # Changed to 'disabled' to match Paystack's status
            "paystackSubscriptionCode": firestore.DELETE # Optionally remove the code after disabling
        })

        print(f"✅ Subscription for user {user_id} cancelled successfully and Firestore updated.")
        return {"status": "success", "message": "Subscription cancelled and user downgraded to Free."}

    except httpx.HTTPStatusError as e:
        print(f"❌ Paystack API error during cancellation for user {user_id}: {e.response.status_code} - {e.response.text}")
        try:
            error_detail = e.response.json().get('message', 'Unknown error from Paystack.')
        except json.JSONDecodeError:
            error_detail = e.response.text
        raise HTTPException(status_code=e.response.status_code, detail=f"Failed to cancel subscription on Paystack: {error_detail}")
    except Exception as e:
        print(f"❌ Unexpected error cancelling subscription for {user_id}: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="An unexpected error occurred during cancellation.")


# NEW ENDPOINT: Paystack Webhook Handler
@app.post("/paystack-webhook")
async def paystack_webhook(request: Request): # Removed raw_body parameter
    raw_body = await request.body() # Get raw body using request.body()
    
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
        subscription_data = event['data']
        customer_code = subscription_data.get('customer', {}).get('customer_code')
        # Correctly extract subscription_status and subscription_code directly from subscription_data
        subscription_status_from_webhook = subscription_data.get('status')
        subscription_code_from_webhook = subscription_data.get('subscription_code')
        plan_code = subscription_data.get('plan', {}).get('plan_code')
        
        print(f"Paystack subscription event: {event_type} for customer: {customer_code}, status: {subscription_status_from_webhook}, plan: {plan_code}, subscription_code: {subscription_code_from_webhook}")
        print(f"Full subscription_data from webhook: {json.dumps(subscription_data, indent=2)}") # Added for full payload inspection

        if customer_code and db:
            users_ref = db.collection("users")
            query = users_ref.where("paystackCustomerId", "==", customer_code).limit(1)
            
            try:
                docs = query.get()
                if docs:
                    user_doc = docs[0]
                    user_id = user_doc.id
                    
                    new_plan_id = "free"
                    if subscription_status_from_webhook != 'disabled': # Use the extracted status
                        for p_id, p_info in SUBSCRIPTION_PLANS.items():
                            if p_info.get("paystack_plan_code") == plan_code:
                                new_plan_id = p_id
                                break
                    
                    # --- CRITICAL FIX: Ensure these fields are explicitly saved ---
                    update_data = {
                        "subscriptionPlan": new_plan_id,
                        "paystackSubscriptionStatus": subscription_status_from_webhook, # Using the extracted status
                        "paystackSubscriptionCode": subscription_code_from_webhook,     # Using the extracted code
                        "lastAnalysisDate": date.today().isoformat(),
                        "geminiCountToday": 0,
                        "gpt4oCountToday": 0,
                    }
                    user_doc.reference.set(update_data, merge=True)
                    print(f"User {user_id} subscription status updated to {subscription_status_from_webhook} and plan to {new_plan_id} in Firestore via webhook.")
                    print(f"Firestore update for user {user_id}: {json.dumps(update_data, indent=2)}") # Confirming update with full data
                else:
                    print(f"WARNING: User not found in Firestore for Paystack customer code: {customer_code}")
            except Exception as e:
                print(f"ERROR: Failed to handle subscription event for customer {customer_code} and update Firestore: {e}")
                import traceback
                print(traceback.format_exc())
        else:
            print(f"WARNING: Missing customer_code ({customer_code}) or db not initialized for subscription event.")

    return {"status": "success"}
