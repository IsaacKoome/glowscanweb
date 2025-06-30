from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow your frontend on Vercel to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or restrict to your Vercel domain later
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Glowscan API is running"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    # TODO: replace this with real model logic
    return {"hydration": "75%", "acne": "mild", "skin_tone": "neutral"}
