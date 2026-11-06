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

app = FastAPI(title="PDF Mock Test Question Extractor API", version="1.1.0")

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

def is_instruction_or_header(line: str) -> bool:
    """Detect boilerplate instruction or footer lines."""
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

def clean_page_text(text: str) -> str:
    """Filter out booklet headers, footers and page margins."""
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        # Skip pure page indicators like "P-I !JSS-24-I! 2 A" or "13 A"
        if re.match(r'^(?:P-[I|V\d]+)?\s*(?:![\w\-]+!)?\s*\d+\s*[A-Z]?$', stripped):
            continue
        if is_instruction_or_header(stripped):
            continue
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines)

def parse_pdf_bytes(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    full_text = []
    total_pages = len(reader.pages)
    
    # In booklets, page 1 is cover instructions, last pages are back cover instructions
    start_page = 1 if total_pages > 2 else 0
    end_page = total_pages - 1 if total_pages > 4 else total_pages
    
    for idx in range(start_page, end_page):
        page = reader.pages[idx]
        text = page.extract_text() or ""
        cleaned = clean_page_text(text)
        if cleaned.strip():
            full_text.append(f"--- Page {idx + 1} ---\n{cleaned}")
            
    return "\n\n".join(full_text)

def parse_options_from_block(body: str) -> tuple[str, List[str]]:
    """
    Extracts options in formats:
    - (1), (2), (3), (4)
    - (A), (B), (C), (D) or (a), (b), (c), (d)
    - 1), 2), 3), 4)
    - A), B), C), D)
    Also strips trailing non-English / duplicate translations.
    """
    # Pattern to match options
    # Matches (1), (2), (3), (4) OR (A), (B), (C), (D) OR 1), 2), 3), 4) OR A), B), C), D)
    opt_delim = r'(?:\((?:[1-4]|[A-Da-d])\)|(?:\b[1-4]|[A-Da-d])[\.\)])'
    
    parts = re.split(opt_delim, body)
    delims = re.findall(opt_delim, body)
    
    if len(delims) >= 4 and len(parts) >= 5:
        q_stem = parts[0].strip()
        
        # Take the first 4 options
        options = []
        for i in range(4):
            opt_text = parts[i + 1].strip()
            # Clean up newlines or extra text inside option
            opt_clean = re.sub(r'\s+', ' ', opt_text)
            # Remove any trailing non-latin / Devanagari block that leaked in
            opt_clean = re.split(r'[\u0900-\u097F\u0980-\u09FF]', opt_clean)[0].strip()
            if not opt_clean:
                opt_clean = f"Option {i + 1}"
            options.append(f"{chr(65 + i)}) {opt_clean}")
            
        # Clean question stem: retain English line if bilingual
        # CTET format puts English question first, followed by Hindi/Assamese text
        lines = [l.strip() for l in q_stem.split("\n") if l.strip()]
        eng_lines = []
        for l in lines:
            # If line is heavily Indic script, stop or skip
            indic_chars = len(re.findall(r'[\u0900-\u097F\u0980-\u09FF]', l))
            if indic_chars > len(l) * 0.35:
                break
            eng_lines.append(l)
            
        final_stem = " ".join(eng_lines).strip() or q_stem
        return final_stem, options

    # Fallback if no 4 options were clearly isolated
    clean_stem = body.strip().split("\n")[0]
    return clean_stem, ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"]

def rule_based_fallback_extractor(text: str) -> List[dict]:
    """Robust bilingual exam paper parser."""
    questions = []
    
    # Split by questions starting with "1.", "2.", "3.", etc. at line starts
    pattern = r'(?:^|\n)\s*(?:(?:Question\s*|Q\.?\s*)?(\d{1,3})[\.\:\)]\s+)([\s\S]*?)(?=(?:\n\s*(?:Question\s*|Q\.?\s*)?\d{1,3}[\.\:\)]\s+)|\Z)'
    matches = re.finditer(pattern, text, re.MULTILINE)
    
    seen_numbers = set()
    q_counter = 1
    
    for match in matches:
        q_num_raw = int(match.group(1))
        # Ignore out-of-order repeats (e.g. repeated page headers or duplicates)
        if q_num_raw in seen_numbers and q_num_raw < 150:
            continue
        
        q_body = match.group(2).strip()
        stem, options = parse_options_from_block(q_body)
        
        # Validate minimum text length to avoid catching stray numbered list items
        if len(stem) >= 8:
            seen_numbers.add(q_num_raw)
            questions.append({
                "id": f"q_{q_counter}",
                "questionNumber": q_counter,
                "text": stem,
                "options": options,
                "correctAnswer": 0,
                "explanation": "Extracted from exam paper.",
                "marks": 1 if q_num_raw <= 150 else 4
            })
            q_counter += 1

    return questions

def llm_structured_extractor(text: str, hf_token: Optional[str] = None) -> List[dict]:
    """Extract questions using LLM with chunking, or fall back to high-accuracy regex rule parser."""
    token = hf_token or os.environ.get("HF_TOKEN")
    
    # If LLM token is present, we try LLM extraction on manageable chunks (e.g., first 5-8 questions)
    if token:
        try:
            client = InferenceClient("meta-llama/Llama-3.1-8B-Instruct", token=token)
            sample_chunk = text[:9000]
            prompt = f"""You are an exam paper parser. Extract all objective questions from this text.
Return ONLY a valid JSON array of objects with keys: "questionNumber", "text", "options" (array of 4 strings "A) ...", "B) ...", "C) ...", "D) ..."), "correctAnswer" (0-3 or 0), "explanation", "marks".
Text:
{sample_chunk}
"""
            response = client.chat_completion(
                messages=[
                    {"role": "system", "content": "You are a specialized question extraction engine. Output JSON only."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=3000,
                temperature=0.1
            )
            raw_content = response.choices[0].message.content.strip()
            raw_content = re.sub(r'^```json\s*', '', raw_content, flags=re.IGNORECASE)
            raw_content = re.sub(r'^```\s*', '', raw_content)
            raw_content = re.sub(r'\s*```$', '', raw_content)
            
            data = json.loads(raw_content)
            if isinstance(data, list) and len(data) >= 3:
                for idx, q in enumerate(data):
                    q["id"] = f"q_{idx + 1}"
                    q["questionNumber"] = idx + 1
                    if "marks" not in q:
                        q["marks"] = 1
                return data
        except Exception as e:
            print(f"LLM extraction error: {e}, using enhanced rule-based extractor.")

    # High precision fallback parser for full document
    return rule_based_fallback_extractor(text)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "PDF Mock Test Extractor",
        "docs": "/docs",
        "version": "1.1.0"
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

    # Use the enhanced extractor
    questions_data = rule_based_fallback_extractor(full_corpus)
    
    # If rule-based extracted fewer than 2 questions, attempt LLM
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
