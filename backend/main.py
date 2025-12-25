from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# 1. Allow the Chrome Extension to talk to us
# In production, we would swap "*" for the specific Extension ID
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class JobRequest(BaseModel):
    text: str  # We only need text for now

@app.get("/")
def home():
    return {"message": "AI Job Copilot Backend is Running!"}

@app.post("/analyze")
def analyze_job(request: JobRequest):
    # Log what we received (for debugging in terminal)
    print(f"Received job description: {request.text[:50]}...")
    
    return {
        "status": "success",
        "message": "Python received the data!",
        "char_count": len(request.text)
    }