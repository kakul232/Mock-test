import os
import io
import json
import re
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
from huggingface_hub import InferenceClient

app = FastAPI(title="PDF Mock Test Question Extractor API", version="1.0.0")

# Enable CORS for frontend web app (Firebase Hosting / localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Question(BaseModel):
    id: str
    questionNumber: int
    text: str
    options: List[str]
    correctAnswer: Optional[int] = 0
    explanation: Optional[str] = ""
    marks: Optional[int] = 4

class ExtractionResponse(BaseModel):
    success: bool
    totalQuestions: int
    questions: List[Question]
    rawTextLength: int

def parse_pdf_bytes(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    full_text = []
    for idx, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        full_text.append(f"--- Page {idx + 1} ---\n{text}")
    return "\n\n".join(full_text)

def rule_based_fallback_extractor(text: str) -> List[dict]:
    """Fallback parser if no LLM key is configured."""
    questions = []
    # Match patterns like "1. Question", "Q1.", "Question 1:"
    pattern = r'(?:(?:Question\s*|Q\.?\s*)?(\d+)[\.\:\)]\s*)([\s\S]*?)(?=(?:(?:Question\s*|Q\.?\s*)?\d+[\.\:\)]|\Z))'
    matches = re.findall(pattern, text, re.IGNORECASE)
    
    q_counter = 1
    for match in matches:
        q_num = match[0]
        q_body = match[1].strip()
        
        # Split options like (A), (B), (C), (D) or A), B), C), D)
        opt_pattern = r'(?:\([A-Da-d]\)|[A-Da-d][\.\)])\s*([^\n\(\)]+)'
        opts = re.findall(opt_pattern, q_body)
        
        # Extract main text before options
        main_text_match = re.split(r'(?:\([A-Da-d]\)|[A-Da-d][\.\)])', q_body)
        main_text = main_text_match[0].strip() if main_text_match else q_body
        
        options_list = [f"{chr(65+i)}) {opt.strip()}" for i, opt in enumerate(opts[:4])] if opts else [
            "A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"
        ]
        
        if len(main_text) > 10:
            questions.append({
                "id": f"q_{q_counter}",
                "questionNumber": q_counter,
                "text": main_text,
                "options": options_list,
                "correctAnswer": 0,
                "explanation": "Extracted via rule-based document parser.",
                "marks": 4
            })
            q_counter += 1
            
    return questions

def llm_structured_extractor(text: str, hf_token: Optional[str] = None) -> List[dict]:
    token = hf_token or os.environ.get("HF_TOKEN")
    
    prompt = f"""You are an expert exam paper parser.
Extract ALL multiple-choice or objective questions from the following exam paper text.
Output MUST be a valid JSON array of question objects only, with no markdown, backticks, or comments.

Schema per question:
{{
  "questionNumber": 1,
  "text": "Full text of the question",
  "options": ["A) option 1", "B) option 2", "C) option 3", "D) option 4"],
  "correctAnswer": 0, // 0 for A, 1 for B, 2 for C, 3 for D, or null if not detected
  "explanation": "Brief explanation or derivation if provided in text, else empty string",
  "marks": 4
}}

Exam Paper Content:
{text[:12000]}
"""

    if token:
        try:
            client = InferenceClient("meta-llama/Llama-3.1-8B-Instruct", token=token)
            response = client.chat_completion(
                messages=[
                    {"role": "system", "content": "You are a specialized question extraction engine. Output JSON only."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=4000,
                temperature=0.1
            )
            raw_content = response.choices[0].message.content.strip()
            # Clean possible markdown wrap
            raw_content = re.sub(r'^```json\s*', '', raw_content, flags=re.IGNORECASE)
            raw_content = re.sub(r'^```\s*', '', raw_content)
            raw_content = re.sub(r'\s*```$', '', raw_content)
            
            data = json.loads(raw_content)
            if isinstance(data, list):
                for idx, q in enumerate(data):
                    q["id"] = f"q_{idx + 1}"
                    q["questionNumber"] = idx + 1
                    if "marks" not in q:
                        q["marks"] = 4
                return data
        except Exception as e:
            print(f"HF Inference error, falling back to rule-based: {e}")

    # Fallback to rule based
    return rule_based_fallback_extractor(text)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "PDF Mock Test Extractor",
        "docs": "/docs"
    }

@app.post("/extract-questions", response_model=ExtractionResponse)
async def extract_questions(
    files: List[UploadFile] = File(...),
    hf_token: Optional[str] = Form(None)
):
    if not files:
        raise HTTPException(status_code=400, detail="No PDF files uploaded.")

    combined_text = []
    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            continue
        content = await file.read()
        extracted_text = parse_pdf_bytes(content)
        combined_text.append(f"=== File: {file.filename} ===\n" + extracted_text)

    full_corpus = "\n\n".join(combined_text)
    if not full_corpus.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from uploaded PDFs. Ensure they are not scanned image-only PDFs without OCR.")

    questions_data = llm_structured_extractor(full_corpus, hf_token)

    return ExtractionResponse(
        success=True,
        totalQuestions=len(questions_data),
        questions=[Question(**q) for q in questions_data],
        rawTextLength=len(full_corpus)
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=7860, reload=True)

