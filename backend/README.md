# How to Deploy Backend to Hugging Face Spaces (100% Free)

1. Go to [huggingface.co/new-space](https://huggingface.co/new-space)
2. Choose:
   - **Space Name**: e.g., `pdf-mock-test-api`
   - **Space SDK**: **Docker** or **Blank / Gradio / FastAPI**
3. Select **Docker** or **Static / Python** (Free: 2 vCPU · 16 GB RAM).
4. Upload:
   - `app.py`
   - `requirements.txt`
   - `Dockerfile` (if using Docker) or `README.md` with metadata.
5. In your Space's **Settings -> Variables and secrets**:
   - (Optional) Add secret `HF_TOKEN` with your free Hugging Face User Access Token (from huggingface.co/settings/tokens) so Llama 3 parses questions with maximum AI accuracy.
6. Your Space will be live with a public URL:
   `https://<YOUR-USERNAME>-<SPACE-NAME>.hf.space`

---

## Local Development (Optional)
To run this API on your machine:
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
API runs on `http://localhost:7860`.
