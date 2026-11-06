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

app = FastAPI(title="PDF Mock Test Question Extractor API", version="2.0.0")

# Enable CORS for frontend web app
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

def is_boilerplate_header(line: str) -> bool:
    """Filter out non-question instructions, cover page text, and margins."""
    line_lower = line.strip().lower()
    skip_keywords = [
        "instructions for candidates",
        "read carefully the instructions",
        "main test booklet",
        "omr answer sheet",
        "space for rough work",
        "facsimile signature",
        "candidate's signature",
        "invigilator's signature",
        "centre of examination",
        "direction : answer the following",
        "candidates should attempt",
        "rough work should be done",
        "part - i",
        "part - ii",
        "part - iii",
        "part - iv",
        "part - v"
    ]
    return any(k in line_lower for k in skip_keywords)

def clean_page_lines(text: str) -> str:
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Page indicators: "P-I !JSS-24-I! 2 A", "10 A", etc.
        if re.match(r'^(?:P-[I|V\d]+)?\s*(?:![\w\-]+!)?\s*\d+\s*[A-Z]?$', stripped):
            continue
        if is_boilerplate_header(stripped):
            continue
        cleaned.append(line)
    return "\n".join(cleaned)

def parse_pdf_bytes(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    full_text = []
    total_pages = len(reader.pages)
    
    # Skip cover pages & end instruction pages if full booklet
    start_page = 1 if total_pages > 2 else 0
    end_page = total_pages - 1 if total_pages > 4 else total_pages
    
    for idx in range(start_page, end_page):
        page = reader.pages[idx]
        text = page.extract_text() or ""
        cleaned = clean_page_lines(text)
        if cleaned.strip():
            full_text.append(cleaned)
            
    return "\n\n".join(full_text)

def parse_english_exam_question(raw_body: str) -> tuple[str, List[str]]:
    """
    Parses bilingual and monolingual questions cleanly:
    - Isolates English stem (skips Assertion (A) false-positives)
    - Extracts 4 options whether (1)-(4) or (A)-(D)
    - Strips legacy non-ASCII / Indic fonts from English options
    """
    # 1. First attempt to match numeric options: (1) ... (2) ... (3) ... (4) ...
    opt_match = re.search(
        r'(?:\n|\s)\(1\)\s+(.*?)(?:\n|\s)\(2\)\s+(.*?)(?:\n|\s)\(3\)\s+(.*?)(?:\n|\s)\(4\)\s+([^\n]+)',
        raw_body,
        re.DOTALL
    )
    if not opt_match:
        # Inline single-line format
        opt_match = re.search(
            r'\(1\)\s+(.*?)\s+\(2\)\s+(.*?)\s+\(3\)\s+(.*?)\s+\(4\)\s+([^\n\(\)]+)',
            raw_body
        )
    
    # 2. If no numeric options, check letter options (A)-(D) that are NOT "Assertion (A)"
    if not opt_match:
        opt_match = re.search(
            r'(?:\n|\s)\((?:A|a)\)\s+(.*?)(?:\n|\s)\((?:B|b)\)\s+(.*?)(?:\n|\s)\((?:C|c)\)\s+(.*?)(?:\n|\s)\((?:D|d)\)\s+([^\n]+)',
            raw_body,
            re.DOTALL
        )

    if opt_match:
        stem_raw = raw_body[:opt_match.start()].strip()
        # Clean Hindi/Indic translation lines from stem
        clean_stem_lines = []
        for line in stem_raw.split('\n'):
            line_str = line.strip()
            # If line is heavily non-ASCII (legacy font) or Devanagari/Assamese
            non_ascii_count = sum(1 for c in line_str if ord(c) > 127)
            if non_ascii_count > len(line_str) * 0.2:
                continue
            clean_stem_lines.append(line_str)
            
        clean_stem = " ".join(clean_stem_lines).strip()
        # Remove repeated question number from front if present (e.g., "1. ")
        clean_stem = re.sub(r'^(?:Question\s*|Q\.?\s*)?\d+[\.\:\)]\s*', '', clean_stem).strip()

        # Clean 4 options
        options = []
        for idx in range(1, 5):
            opt_text = opt_match.group(idx).strip()
            # Strip non-ASCII font noise and clean spacing
            opt_text = re.sub(r'[^\x20-\x7E]+', ' ', opt_text)
            opt_text = re.sub(r'\s+', ' ', opt_text).strip()
            if not opt_text:
                opt_text = f"Option {idx}"
            options.append(f"{chr(64 + idx)}) {opt_text}")

        return clean_stem, options

    # Fallback if options structure isn't recognized
    first_line = raw_body.strip().split('\n')[0]
    first_line = re.sub(r'^(?:Question\s*|Q\.?\s*)?\d+[\.\:\)]\s*', '', first_line).strip()
    return first_line, ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"]

def rule_based_fallback_extractor(text: str) -> List[dict]:
    """Accurately parses numbered questions from exam papers."""
    questions = []
    
    # Split questions by number anchors: "1.", "2.", "3.", etc. at start of line
    pattern = r'(?:^|\n)\s*(?:(?:Question\s*|Q\.?\s*)?(\d{1,3})[\.\:\)]\s+)([\s\S]*?)(?=(?:\n\s*(?:Question\s*|Q\.?\s*)?\d{1,3}[\.\:\)]\s+)|\Z)'
    matches = re.finditer(pattern, text, re.MULTILINE)
    
    seen_numbers = set()
    q_counter = 1
    
    for match in matches:
        q_num = int(match.group(1))
        # Ignore out-of-sequence repeats
        if q_num in seen_numbers and q_num < 150:
            continue
            
        q_body = match.group(2).strip()
        stem, options = parse_english_exam_question(q_body)
        
        # Only keep valid questions
        if len(stem) >= 6 and not is_boilerplate_header(stem):
            seen_numbers.add(q_num)
            questions.append({
                "id": f"q_{q_counter}",
                "questionNumber": q_counter,
                "text": stem,
                "options": options,
                "correctAnswer": 0,
                "explanation": "Extracted from exam paper.",
                "marks": 1 if q_num <= 150 else 4
            })
            q_counter += 1

    return questions

def llm_structured_extractor(text: str, hf_token: Optional[str] = None) -> List[dict]:
    """Fallback LLM extractor if rule-based returns too few questions."""
    token = hf_token or os.environ.get("HF_TOKEN")
    if token:
        try:
            client = InferenceClient("meta-llama/Llama-3.1-8B-Instruct", token=token)
            sample_chunk = text[:10000]
            prompt = f"""Extract all multiple choice questions with 4 options from this test booklet text.
Return ONLY a valid JSON list of objects with keys: "questionNumber", "text", "options" (4 strings like "A) ..."), "correctAnswer" (0-3), "explanation", "marks".
Text:
{sample_chunk}
"""
            response = client.chat_completion(
                messages=[
                    {"role": "system", "content": "You are a clean exam paper parser. Return pure JSON array only."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=3500,
                temperature=0.1
            )
            raw = response.choices[0].message.content.strip()
            raw = re.sub(r'^```json\s*', '', raw, flags=re.IGNORECASE)
            raw = re.sub(r'^```\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
            
            data = json.loads(raw)
            if isinstance(data, list) and len(data) >= 3:
                for idx, q in enumerate(data):
                    q["id"] = f"q_{idx + 1}"
                    q["questionNumber"] = idx + 1
                    if "marks" not in q:
                        q["marks"] = 1
                return data
        except Exception as e:
            print(f"LLM extraction error: {e}")

    return rule_based_fallback_extractor(text)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "PDF Mock Test Extractor",
        "docs": "/docs",
        "version": "2.0.0"
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
        raise HTTPException(
            status_code=400, 
            detail="Could not extract text from uploaded PDFs. Ensure they are not scanned image-only PDFs without an embedded text layer."
        )

    # Use the high-accuracy parser
    questions_data = rule_based_fallback_extractor(full_corpus)
    
    # If fewer than 2 questions extracted, try LLM fallback
    if len(questions_data) < 2 and (hf_token or os.environ.get("HF_TOKEN")):
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
