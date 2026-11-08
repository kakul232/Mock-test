import os
import io
import json
import re
import uuid
import tempfile
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
from gradio_client import Client
from PIL import Image
import pytesseract


app = FastAPI(title="PDF Mock Test Question Extractor API", version="5.2.0")

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
    jobId: Optional[str] = None
    totalQuestions: int
    questions: List[Question]
    rawTextLength: int

class JobStatusResponse(BaseModel):
    jobId: str
    status: str # "queued", "processing", "completed", "failed"
    progress: int # 0 to 100
    currentStage: str
    totalQuestions: int
    questions: List[Question]
    error: Optional[str] = None

class SolveRequest(BaseModel):
    questions: List[Question]

class SolveResponse(BaseModel):
    success: bool
    solvedQuestions: List[Question]

# In-memory job tracker for real-time extraction progress
job_store: Dict[str, dict] = {}
# In-memory tracker for lab report jobs: lookup by job_id or filename
lab_report_store: Dict[str, dict] = {}

def clean_ocr_text(text: str) -> str:
    lines = text.split("\n")
    cleaned = []
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
        "part - i", "part - ii", "part - iii", "part - iv", "part - v"
    ]
    for line in lines:
        stripped = line.strip()
        if re.match(r'^(?:P-[I|V\d]+)?\s*(?:![\w\-]+!)?\s*\d+\s*[A-Z]?$', stripped):
            continue
        if any(k in stripped.lower() for k in skip_keywords):
            continue
        cleaned.append(line)
    return "\n".join(cleaned)

def clean_pure_english(text_block: str) -> str:
    """Removes all non-English translation lines and legacy font bleed."""
    lines = text_block.split('\n')
    english_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        non_ascii_chars = [c for c in stripped if ord(c) > 127]
        # Skip translation lines where non-ascii characters exceed 15%
        if len(non_ascii_chars) / max(len(stripped), 1) > 0.15:
            continue
        # Strip residual font noise
        clean_line = re.sub(r'[^\x20-\x7E]+', ' ', stripped).strip()
        clean_line = re.sub(r'\s+', ' ', clean_line)
        if clean_line:
            english_lines.append(clean_line)
    return "\n".join(english_lines)

def parse_pdf_bytes(pdf_bytes: bytes, job_id: Optional[str] = None) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    full_text = []
    total = len(reader.pages)
    start_p = 1 if total > 2 else 0
    end_p = total - 1 if total > 4 else total
    active_pages = list(range(start_p, end_p))
    num_active = len(active_pages)

    for idx, i in enumerate(active_pages):
        if job_id and job_id in job_store:
            pct = int(10 + (idx / max(num_active, 1)) * 65)
            job_store[job_id]["progress"] = pct
            job_store[job_id]["currentStage"] = f"Extracting page {i+1} of {total}..."

        t = reader.pages[i].extract_text() or ""
        cleaned = clean_ocr_text(t)
        # Filter language bleed
        pure_eng = clean_pure_english(cleaned)
        if pure_eng.strip():
            full_text.append(pure_eng)

    return "\n\n".join(full_text)

def parse_english_exam_question(raw_body: str) -> tuple[str, List[str]]:
    opt_match = re.search(
        r'(?:\n|\s)[\-\*]?\s*\(1\)\s+(.*?)(?:\n|\s)[\-\*]?\s*\(2\)\s+(.*?)(?:\n|\s)[\-\*]?\s*\(3\)\s+(.*?)(?:\n|\s)[\-\*]?\s*\(4\)\s+([^\n]+)',
        raw_body,
        re.DOTALL
    )
    if not opt_match:
        opt_match = re.search(
            r'\(1\)\s+(.*?)\s+\(2\)\s+(.*?)\s+\(3\)\s+(.*?)\s+\(4\)\s+([^\n\(\)]+)',
            raw_body
        )
    if not opt_match:
        opt_match = re.search(
            r'(?:\n|\s)[\-\*]?\s*\((?:A|a)\)\s+(.*?)(?:\n|\s)[\-\*]?\s*\((?:B|b)\)\s+(.*?)(?:\n|\s)[\-\*]?\s*\((?:C|c)\)\s+(.*?)(?:\n|\s)[\-\*]?\s*\((?:D|d)\)\s+([^\n]+)',
            raw_body,
            re.DOTALL
        )

    if opt_match:
        stem = raw_body[:opt_match.start()].strip()
        stem = re.sub(r'^(?:Question\s*|Q\.?\s*)?\d+[\.\:\)]\s*', '', stem).strip()
        options = []
        for idx in range(1, 5):
            opt_t = opt_match.group(idx).strip()
            opt_t = re.sub(r'^\s*[\-\*#]+\s*', '', opt_t).strip()
            if not opt_t:
                opt_t = f"Option {idx}"
            options.append(f"{chr(64 + idx)}) {opt_t}")

        return stem, options

    first_line = raw_body.strip().split('\n')[0]
    first_line = re.sub(r'^(?:Question\s*|Q\.?\s*)?\d+[\.\:\)]\s*', '', first_line).strip()
    return first_line, ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"]

def rule_based_extractor(text: str) -> List[dict]:
    questions = []
    # Match question numbers: e.g. "1.", "1 .", "Q. 1", "Question 1:"
    pattern = r'(?:^|\n)\s*[\-\*#]?\s*(?:(?:Question\s*|Q\.?\s*)?(\d{1,3})\s*[\.\:\)]\s+)([\s\S]*?)(?=(?:\n\s*[\-\*#]?\s*(?:Question\s*|Q\.?\s*)?\d{1,3}\s*[\.\:\)]\s+)|\Z)'
    matches = re.finditer(pattern, text, re.MULTILINE)
    seen = set()
    q_counter = 1

    instruction_filters = [
        "omr answer sheet", "ball point pen", "admit card", "examination hall",
        "invigilator", "calculator is prohibited", "test booklet code"
    ]

    for m in matches:
        q_num = int(m.group(1))
        if q_num in seen and q_num < 150:
            continue
        body = m.group(2).strip()
        stem, options = parse_english_exam_question(body)
        
        if any(k in stem.lower() for k in instruction_filters):
            continue

        if len(stem) >= 6:
            seen.add(q_num)
            questions.append({
                "id": f"q_{q_counter}",
                "questionNumber": q_counter,
                "text": stem,
                "options": options,
                "correctAnswer": None,
                "explanation": "",
                "marks": 1 if q_num <= 150 else 4
            })
            q_counter += 1

    return questions

def process_extraction_job(job_id: str, files_bytes: List[tuple[str, bytes]]):
    try:
        job_store[job_id]["status"] = "processing"
        job_store[job_id]["progress"] = 10
        job_store[job_id]["currentStage"] = "Analyzing document structure..."

        combined_text = []
        for filename, content in files_bytes:
            extracted = parse_pdf_bytes(content, job_id)
            combined_text.append(f"=== File: {filename} ===\n" + extracted)

        job_store[job_id]["progress"] = 80
        job_store[job_id]["currentStage"] = "Parsing questions and removing language bleed..."

        full_corpus = "\n\n".join(combined_text)
        questions_data = rule_based_extractor(full_corpus)

        job_store[job_id]["progress"] = 100
        job_store[job_id]["status"] = "completed"
        job_store[job_id]["currentStage"] = f"Extraction complete: {len(questions_data)} questions ready."
        job_store[job_id]["totalQuestions"] = len(questions_data)
        job_store[job_id]["questions"] = [Question(**q) for q in questions_data]
        job_store[job_id]["rawTextLength"] = len(full_corpus)
    except Exception as e:
        job_store[job_id]["status"] = "failed"
        job_store[job_id]["error"] = str(e)
        job_store[job_id]["currentStage"] = f"Error: {e}"

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "PDF Mock Test Extractor (Zero Bleed & Realtime Progress)",
        "docs": "/docs",
        "version": "5.2.0"
    }

@app.get("/extraction-status/{job_id}", response_model=JobStatusResponse)
def get_extraction_status(job_id: str):
    if job_id not in job_store:
        raise HTTPException(status_code=404, detail="Job not found.")
    
    j = job_store[job_id]
    return JobStatusResponse(
        jobId=job_id,
        status=j["status"],
        progress=j["progress"],
        currentStage=j["currentStage"],
        totalQuestions=j.get("totalQuestions", 0),
        questions=j.get("questions", []),
        error=j.get("error")
    )

@app.post("/start-extraction")
async def start_extraction(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...)
):
    if not files:
        raise HTTPException(status_code=400, detail="No PDF files uploaded.")

    job_id = str(uuid.uuid4())
    job_store[job_id] = {
        "status": "queued",
        "progress": 0,
        "currentStage": "Job queued for processing...",
        "totalQuestions": 0,
        "questions": [],
        "error": None
    }

    files_bytes = []
    for file in files:
        if file.filename.lower().endswith(".pdf"):
            content = await file.read()
            files_bytes.append((file.filename, content))

    background_tasks.add_task(process_extraction_job, job_id, files_bytes)
    return {"success": True, "jobId": job_id, "message": "Extraction started in background."}

@app.post("/extract-questions", response_model=ExtractionResponse)
async def extract_questions_sync(files: List[UploadFile] = File(...)):
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
    questions_data = rule_based_extractor(full_corpus)

    return ExtractionResponse(
        success=True,
        totalQuestions=len(questions_data),
        questions=[Question(**q) for q in questions_data],
        rawTextLength=len(full_corpus)
    )

@app.post("/solve-answers", response_model=SolveResponse)
async def solve_answers(payload: SolveRequest):
    if not payload.questions:
        return SolveResponse(success=True, solvedQuestions=[])

    client = Client("yuntian-deng/ChatGPT")
    solved = []
    for q in payload.questions:
        q_dict = q.model_dump()
        try:
            prompt = f"""Determine the single correct option for this multiple-choice question:
Question: {q_dict['text']}
Options:
{chr(10).join(q_dict['options'])}

Return ONLY valid JSON: {{"correctAnswer": 0, "explanation": "Brief reason"}} (0=A, 1=B, 2=C, 3=D)"""
            res = client.predict(inputs=prompt, top_p=1.0, temperature=0.1, chat_counter=0, chatbot=[], api_name="/predict")
            if res and len(res) > 0 and len(res[0]) > 0:
                raw = res[0][0][1].strip()
                raw = re.sub(r'^```json\s*', '', raw, flags=re.IGNORECASE)
                raw = re.sub(r'^```\s*', '', raw)
                raw = re.sub(r'\s*```$', '', raw)
                ans = json.loads(raw)
                if "correctAnswer" in ans and 0 <= ans["correctAnswer"] <= 3:
                    q_dict["correctAnswer"] = ans["correctAnswer"]
                    q_dict["explanation"] = ans.get("explanation", "")
        except Exception:
            pass
        solved.append(Question(**q_dict))

    return SolveResponse(success=True, solvedQuestions=solved)

def extract_text_from_file_bytes(content: bytes, filename: str) -> str:
    """Extract raw text from PDF or Image."""
    lower_name = filename.lower()
    text = ""

    if lower_name.endswith(".pdf"):
        # 1. Try PyPDF text extraction
        try:
            reader = PdfReader(io.BytesIO(content))
            for page in reader.pages:
                text += (page.extract_text() or "") + "\n"
        except Exception as e:
            print(f"PyPDF extraction error: {e}")

        # 2. If PDF has minimal or no digital text, try OCR with pdf2image
        if len(text.strip()) < 50:
            try:
                from pdf2image import convert_from_bytes
                images = convert_from_bytes(content)
                for img in images:
                    page_ocr = pytesseract.image_to_string(img)
                    text += page_ocr + "\n"
            except Exception as e:
                print(f"PDF OCR extraction fallback error: {e}")

    elif any(lower_name.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"]):
        # Image OCR with Tesseract
        try:
            image = Image.open(io.BytesIO(content))
            text = pytesseract.image_to_string(image)
        except Exception as e:
            print(f"Image OCR error: {e}")
            raise HTTPException(status_code=500, detail=f"Image OCR processing failed: {str(e)}")
    else:
        # Fallback to UTF-8 text decode
        try:
            text = content.decode("utf-8", errors="ignore")
        except Exception:
            text = ""

    return text.strip()

def rule_based_lab_report_parser(raw_text: str) -> Dict[str, Any]:
    """Fallback rule-based regex parser for medical lab reports."""
    lines = raw_text.split("\n")
    report = {
        "patient_info": {},
        "laboratory_info": {},
        "test_results": [],
        "raw_summary": raw_text[:500]
    }
    
    # Common patient demographic patterns
    patient_patterns = {
        "name": r"(?:patient\s*name|pt\s*name|name)\s*[:\-]\s*([^\n\r,]+)",
        "age": r"(?:age|age\s*[\/\-]\s*sex)\s*[:\-]\s*(\d{1,3}\s*(?:yrs|years|y)?)",
        "gender": r"(?:gender|sex)\s*[:\-]\s*(Male|Female|M|F|Other)",
        "patient_id": r"(?:patient\s*id|pid|uhid|mrn|reg\s*no)\s*[:\-]\s*([A-Za-z0-9\-\_]+)",
        "referred_by": r"(?:referred\s*by|ref\s*dr|dr\.)\s*[:\-]\s*([^\n\r]+)",
        "date": r"(?:date|collection\s*date|reported\s*date)\s*[:\-]\s*([0-9\/\-\.]+)"
    }
    
    for key, pat in patient_patterns.items():
        m = re.search(pat, raw_text, re.IGNORECASE)
        if m:
            report["patient_info"][key] = m.group(1).strip()
            
    # Try parsing tabular test rows
    # e.g.: Hemoglobin 14.2 g/dL 12.0 - 16.0
    for line in lines:
        row_match = re.search(r"^\s*([A-Za-z0-9\s\(\)\-\/\.\+]+?)\s{2,}([0-9\.]+|Positive|Negative|Reactive|Non-Reactive)\s+([A-Za-z\/\%µ\^0-9\.\-]+)?\s*([0-9\.\-\<\>\s]+)?", line)
        if row_match:
            test_name = row_match.group(1).strip()
            result_val = row_match.group(2).strip()
            unit = row_match.group(3).strip() if row_match.group(3) else ""
            ref_range = row_match.group(4).strip() if row_match.group(4) else ""
            if len(test_name) > 2 and not any(k in test_name.lower() for k in ["page", "report", "date", "sample", "signature"]):
                report["test_results"].append({
                    "test_name": test_name,
                    "value": result_val,
                    "unit": unit,
                    "reference_range": ref_range
                })

    return report

def process_lab_report_job(job_id: str, content: bytes, filename: str, content_type: str):
    """Background task to extract and structure lab report."""
    try:
        lab_report_store[job_id]["status"] = "processing"
        lab_report_store[job_id]["progress"] = 25
        lab_report_store[job_id]["currentStage"] = "Extracting raw text from document/image..."

        raw_text = extract_text_from_file_bytes(content, filename)
        if not raw_text or len(raw_text.strip()) < 5:
            lab_report_store[job_id]["status"] = "failed"
            lab_report_store[job_id]["error"] = "Could not extract readable text from document. Ensure high resolution or non-empty document."
            return

        lab_report_store[job_id]["progress"] = 60
        lab_report_store[job_id]["currentStage"] = "Running AI medical data structuring..."

        structured_json = None
        try:
            client = Client("yuntian-deng/ChatGPT")
            prompt = f"""You are an expert medical lab report parser. Convert the following medical laboratory report text into a clean, comprehensive, structured JSON key-value format.

Extract and structure into keys:
- "patient_info": (e.g. name, age, gender, patient_id, contact, referred_by_doctor, sample_collection_date, report_date)
- "lab_info": (e.g. lab_name, address, accreditations, pathologist_name)
- "investigations": array of test panels / categories, each having:
  - "category_name": (e.g. Complete Blood Count, Liver Function Test, Lipid Profile)
  - "results": array of items:
    - "test_name": name of parameter
    - "value": observed value
    - "unit": unit of measurement
    - "reference_range": normal reference interval
    - "status": ("Normal", "High", "Low", "Abnormal", or null)
- "summary_impressions": any summary notes, clinical comments or diagnosis mentioned
- "metadata": {{"source_file": "{filename}", "total_parameters_detected": ...}}

Return ONLY valid JSON without markdown formatting or code fences:

Lab Report Raw Content:
{raw_text[:3500]}"""

            res = client.predict(inputs=prompt, top_p=1.0, temperature=0.1, chat_counter=0, chatbot=[], api_name="/predict")
            if res and len(res) > 0 and len(res[0]) > 0:
                raw_output = res[0][0][1].strip()
                raw_output = re.sub(r'^```json\s*', '', raw_output, flags=re.IGNORECASE)
                raw_output = re.sub(r'^```\s*', '', raw_output)
                raw_output = re.sub(r'\s*```$', '', raw_output)
                structured_json = json.loads(raw_output)
        except Exception as ai_err:
            print(f"AI JSON structuring fallback triggered: {ai_err}")

        if not structured_json:
            structured_json = rule_based_lab_report_parser(raw_text)

        lab_report_store[job_id]["status"] = "completed"
        lab_report_store[job_id]["progress"] = 100
        lab_report_store[job_id]["currentStage"] = "Report successfully structured."
        lab_report_store[job_id]["data"] = structured_json

        # Index by filename as well for convenient lookup
        lab_report_store[filename] = lab_report_store[job_id]

    except Exception as e:
        lab_report_store[job_id]["status"] = "failed"
        lab_report_store[job_id]["error"] = str(e)
        if filename in lab_report_store:
            lab_report_store[filename]["status"] = "failed"
            lab_report_store[filename]["error"] = str(e)

@app.post("/bhh/lab-report")
async def extract_lab_report(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    async_mode: Optional[bool] = Form(False)
):
    """
    Medical Lab Report Extraction API:
    Accepts: Image (PNG, JPG, JPEG, WEBP) or PDF file.
    Modes:
      - Default / Synchronous: returns structured JSON directly upon completion.
      - async_mode=true: returns jobId immediately for status polling via GET /bhh/lab-report/{id|file}/status
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    job_id = str(uuid.uuid4())
    initial_job_state = {
        "jobId": job_id,
        "filename": file.filename,
        "contentType": file.content_type,
        "status": "queued",
        "progress": 5,
        "currentStage": "Job queued for processing...",
        "data": None,
        "error": None
    }
    lab_report_store[job_id] = initial_job_state
    lab_report_store[file.filename] = initial_job_state

    # Asynchronous background mode
    if async_mode:
        background_tasks.add_task(process_lab_report_job, job_id, content, file.filename, file.content_type or "")
        return {
            "success": True,
            "jobId": job_id,
            "filename": file.filename,
            "status": "queued",
            "message": f"Processing started. Check progress at /bhh/lab-report/{job_id}/status"
        }

    # Synchronous mode: process inline and record to store
    process_lab_report_job(job_id, content, file.filename, file.content_type or "")
    res = lab_report_store.get(job_id)
    if res and res.get("status") == "failed":
        raise HTTPException(status_code=500, detail=res.get("error", "Lab report processing failed."))

    return {
        "success": True,
        "jobId": job_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "data": res.get("data") if res else None
    }

@app.get("/bhh/lab-report/{identifier:path}/status")
async def get_lab_report_status(identifier: str):
    """
    Check current status of a lab report extraction job by:
    - job_id (UUID)
    - filename (e.g. blood_test.pdf)
    """
    cleaned_id = identifier.strip().rstrip("/status").strip()
    
    # Try exact match first, then by filename
    job_info = lab_report_store.get(cleaned_id)
    if not job_info:
        for k, v in lab_report_store.items():
            if v.get("filename") == cleaned_id or v.get("jobId") == cleaned_id:
                job_info = v
                break

    if not job_info:
        raise HTTPException(
            status_code=404,
            detail=f"Lab report job or file '{cleaned_id}' not found. Please verify the ID or filename."
        )

    return {
        "success": True,
        "jobId": job_info.get("jobId"),
        "filename": job_info.get("filename"),
        "status": job_info.get("status"), # "queued" | "processing" | "completed" | "failed"
        "progress": job_info.get("progress", 0),
        "currentStage": job_info.get("currentStage", ""),
        "data": job_info.get("data"),
        "error": job_info.get("error")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=7860, reload=True)
