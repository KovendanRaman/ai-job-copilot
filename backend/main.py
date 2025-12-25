from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
import re
import nltk
from nltk.stem import WordNetLemmatizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

app = FastAPI()

# Download NLTK resources on startup
try:
    nltk.download('wordnet', quiet=True)
    nltk.download('omw-1.4', quiet=True)
except:
    pass  # Resources may already be downloaded

# Initialize lemmatizer
lemmatizer = WordNetLemmatizer()

# 1. Allow the Chrome Extension to talk to us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Updated WEB_NOISE_WORDS with more UI terms
WEB_NOISE_WORDS = {
    "apply", "save", "share", "notification", "linkedin", "search", 
    "home", "skip", "content", "copyright", "accessibility", "cookie", 
    "policy", "settings", "profile", "messages", "jobs", "network",
    "followers", "connections", "view", "premium", "sign", "join"
}

# Programming languages and technologies
PROGRAMMING_LANGUAGES = {
    "python", "java", "javascript", "typescript", "c++", "c#", "cpp", "c",
    "ruby", "php", "go", "rust", "swift", "kotlin", "scala", "r", "matlab",
    "sql", "html", "css", "react", "angular", "vue", "node", "express",
    "spring", "django", "flask", "net", "dotnet", "asp"
}

# Development-related terms to add when programming languages are detected
DEV_SYNONYMS = ["programming", "developer", "development", "code", "coding", 
                "software", "application", "program", "implement", "build"]

def expand_with_dev_synonyms(text: str) -> str:
    """
    If programming languages are detected, add development-related synonyms.
    This helps bridge the gap between student CVs (which list languages) 
    and job descriptions (which use professional terms).
    """
    words = set(text.split())
    
    # Check if any programming languages are present
    has_programming_lang = any(lang in words for lang in PROGRAMMING_LANGUAGES)
    
    if has_programming_lang:
        # Add development synonyms that aren't already present
        synonyms_to_add = [syn for syn in DEV_SYNONYMS if syn not in words]
        if synonyms_to_add:
            text += " " + " ".join(synonyms_to_add)
            print(f"  Added synonyms: {', '.join(synonyms_to_add)}")
    
    return text

def clean_text(text: str) -> str:
    """
    Improved cleaning: removes headers, lemmatizes words, preserves technical terms.
    """
    # Convert to lowercase
    text = text.lower()
    
    # Remove header noise explicitly
    text = text.replace("about the job job description", "")
    text = text.replace("about the job", "")
    text = text.replace("job description", "", 1)  # Remove first occurrence only
    
    # Preserve technical terms: keep alphanumeric, +, #, ., and spaces
    # This preserves: C++, C#, .NET, Node.js, Python 3.8, etc.
    text = re.sub(r'[^a-z0-9+#\.\s]', ' ', text)
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Filter out WEB NOISE words and pure numeric tokens, then lemmatize
    words = text.split()
    filtered_words = []
    for word in words:
        # Skip web noise words
        if word in WEB_NOISE_WORDS:
            continue
        # Skip pure numeric tokens (phone numbers, standalone years like "2021", "2022")
        # But keep tokens with letters (like "python3", "java8", "2nd")
        if word.isdigit() and len(word) >= 4:  # Skip 4+ digit numbers (years, phone numbers)
            continue
        # Skip very short pure numbers (like "01", "04", "17") that are likely IDs
        if word.isdigit() and len(word) <= 2:
            continue
        
        # Lemmatize the word (convert to base form)
        # e.g., "implemented" -> "implement", "developing" -> "develop"
        lemmatized = lemmatizer.lemmatize(word)
        filtered_words.append(lemmatized)
    
    cleaned = ' '.join(filtered_words)
    
    # Expand with development synonyms if programming languages are detected
    cleaned = expand_with_dev_synonyms(cleaned)
    
    return cleaned

def calculate_match(text1: str, text2: str) -> float:
    """
    Calculate similarity using TF-IDF vectorization and cosine similarity.
    Uses n-grams to capture phrases like "Java Developer".
    """
    try:
        print(f"\n=== MATCHING DIAGNOSTICS (TF-IDF) ===")
        
        # Create TF-IDF vectorizer with n-grams
        # sublinear_tf=True reduces the impact of very frequent terms
        # This helps balance the score when one document is much longer than the other
        vectorizer = TfidfVectorizer(
            stop_words='english',
            ngram_range=(1, 3),  # Capture unigrams, bigrams, and trigrams
            sublinear_tf=True,  # Apply sublinear scaling to term frequency
            # No min_df or max_df to avoid filtering issues with 2 documents
        )
        
        # Fit and transform both texts
        tfidf_matrix = vectorizer.fit_transform([text1, text2])
        
        # Calculate cosine similarity
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        
        # Debug: Get feature names and find overlapping terms
        feature_names = vectorizer.get_feature_names_out()
        cv_vector = tfidf_matrix[0].toarray()[0]
        job_vector = tfidf_matrix[1].toarray()[0]
        
        # Find overlapping terms (terms with score > 0 in both vectors)
        overlapping_terms = []
        for i, feature in enumerate(feature_names):
            if cv_vector[i] > 0 and job_vector[i] > 0:
                overlapping_terms.append((feature, cv_vector[i], job_vector[i]))
        
        # Sort by combined score
        overlapping_terms.sort(key=lambda x: x[1] + x[2], reverse=True)
        
        print(f"Total features: {len(feature_names)}")
        print(f"Overlapping terms: {len(overlapping_terms)}")
        
        # Always show top features from both texts for debugging
        cv_features = [(feature_names[i], cv_vector[i]) for i in range(len(feature_names)) if cv_vector[i] > 0]
        cv_features.sort(key=lambda x: x[1], reverse=True)
        
        job_features = [(feature_names[i], job_vector[i]) for i in range(len(feature_names)) if job_vector[i] > 0]
        job_features.sort(key=lambda x: x[1], reverse=True)
        
        if overlapping_terms:
            print(f"\nTop 10 overlapping terms:")
            for term, cv_score, job_score in overlapping_terms[:10]:
                print(f"  '{term}': CV={cv_score:.4f}, Job={job_score:.4f}")
        else:
            print("⚠️ WARNING: No overlapping terms found!")
        
        # Always show top features from both texts
        print(f"\nTop 15 CV features:")
        for term, score in cv_features[:15]:
            print(f"  '{term}': {score:.4f}")
        
        print(f"\nTop 15 Job features:")
        for term, score in job_features[:15]:
            print(f"  '{term}': {score:.4f}")
        
        # Calculate match score as percentage
        match_score = round(similarity * 100, 2)
        
        print(f"\nCosine similarity: {similarity:.4f}")
        print(f"Match Score: {match_score}%")
        print("=" * 30 + "\n")
        
        return match_score
    except Exception as e:
        print(f"Error in calculation: {e}")
        import traceback
        traceback.print_exc()
        return 0.0

@app.post("/analyze")
async def analyze_job(
    file: UploadFile = File(...), 
    job_text: str = Form(...)
):
    # 1. Read PDF
    pdf_content = await file.read()
    doc = fitz.open(stream=pdf_content, filetype="pdf")
    cv_text = ""
    for page in doc:
        cv_text += page.get_text()
    doc.close()
    
    # Debug: Print raw CV text preview
    print(f"\n=== PDF EXTRACTION ===")
    print(f"Raw CV text (first 300 chars): {cv_text[:300]}")
    print(f"Raw CV text length: {len(cv_text)}")
    
    # 2. Clean Data
    cv_clean = clean_text(cv_text)
    job_clean = clean_text(job_text)
    
    # Debug: Print cleaned text preview
    print(f"\n=== TEXT CLEANING ===")
    print(f"Cleaned CV text (first 500 chars): {cv_clean[:500]}")
    print(f"Cleaned Job text (first 500 chars): {job_clean[:500]}")
    print(f"CV Length (cleaned): {len(cv_clean)} | Job Length (cleaned): {len(job_clean)}")
    
    # Check for key terms
    key_terms = ["python", "java", "developer", "programming", "code", "software", "computer", "science"]
    print(f"\nKey term presence check:")
    for term in key_terms:
        cv_has = term in cv_clean.lower()
        job_has = term in job_clean.lower()
        print(f"  '{term}': CV={cv_has}, Job={job_has}")
    
    # Check if CV extraction failed
    if len(cv_clean) < 50:
        print("⚠️ WARNING: CV text is very short! PDF extraction may have failed.")
        print("   This could be a scanned PDF or image-based PDF.")
    
    # 3. Calculate Match
    match_score = calculate_match(cv_clean, job_clean)
    
    # Final summary
    print(f"\n=== FINAL RESULT ===")
    print(f"Match Score: {match_score}%")
    print("=" * 30 + "\n")

    return {
        "match_score": match_score,
        "cv_text_length": len(cv_clean),
        "job_text_length": len(job_clean)
    }