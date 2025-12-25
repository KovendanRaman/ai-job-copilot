from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import fitz

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

@app.get("/")
def home():
    return {"message": "AI Job Copilot Backend is Running!"}

@app.post("/analyze")
async def analyze_job(
    file: UploadFile = File(...),
    job_text: str = Form(...)
):
    # Read the PDF file bytes
    pdf_bytes = await file.read()
    
    # Open PDF using PyMuPDF (fitz)
    pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    # Extract text from all pages
    cv_text = ""
    for page_num in range(len(pdf_document)):
        page = pdf_document[page_num]
        cv_text += page.get_text()
    
    # Close the document
    pdf_document.close()
    
    # Log what we received (for debugging in terminal)
    print(f"Received PDF file: {file.filename}")
    print(f"CV text length: {len(cv_text)} chars")
    print(f"Job text length: {len(job_text)} chars")
    print(f"Job description preview: {job_text[:50]}...")
    
    return {
        "status": "success",
        "message": "Python received the data!",
        "cv_text_length": len(cv_text),
        "job_text_length": len(job_text)
    }