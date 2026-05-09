# 🧠 AI Resume Screening System

An AI-powered recruitment assistant that automates candidate screening using NLP, Sentence Transformers, and FAISS vector search.

## Features

- **📄 Resume Parsing** — Extract text from PDF & DOCX files
- **🔤 NLP Processing** — Tokenization, stopword removal, lemmatization
- **🎯 Skill Extraction** — Identify 200+ technical & soft skills
- **🧠 Semantic Matching** — Sentence Transformer embeddings (all-MiniLM-L6-v2)
- **📊 Multi-Score Ranking** — Semantic + TF-IDF + Skill Match composite score
- **⚡ FAISS Vector Search** — Scalable semantic search across thousands of resumes
- **🤖 AI Content Detection** — Estimate AI-generated content in resumes using Google Gemini
- **📊 ATS Evaluator** — Comprehensive resume scoring against JD across 4 critical criteria using Gemini
- **🌐 Premium Web UI** — Glassmorphism dark theme with animations

## Tech Stack

| Area | Technology |
|------|-----------|
| Backend | Flask |
| NLP | NLTK |
| Embeddings | Sentence Transformers |
| Vector DB | FAISS |
| PDF Parsing | PyPDF2, pdfplumber |
| DOCX Parsing | python-docx |
| Similarity | Cosine Similarity (scikit-learn) |
| Generative AI | Google Gemini |
| Frontend | HTML/CSS/JS |

## Setup

1. **Environment Variables**: Create a `.env` file in the root directory and add your Gemini API key (note: you must base64 encode it, or adapt `ai_detector.py` to read it directly):
```env
GEMINI_API_KEY="your_api_key_here"
```

2. **Installation & Running**:
```bash
# Install dependencies
pip install -r requirements.txt

# Download NLTK data (auto-downloads on first run)
# Download spaCy model (optional, for advanced NER)
# python -m spacy download en_core_web_sm

# Run the application
python app.py
```

Open http://localhost:5000 in your browser.

## How It Works

1. **Upload** — Drop PDF/DOCX resumes
2. **Extract** — Text extraction + NLP processing
3. **Embed** — Generate 384-dim vectors via Sentence Transformers
4. **Store** — Index embeddings in FAISS
5. **Match** — Compare against job description semantically
6. **Rank** — Weighted scoring: 50% semantic + 20% TF-IDF + 30% skill match

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload_resume` | POST | Upload single resume |
| `/api/upload_multiple` | POST | Upload multiple resumes |
| `/api/match` | POST | Match resumes against JD |
| `/api/semantic_search` | POST | Semantic search across resumes |
| `/api/detect_ai/<id>` | POST | Detect AI-generated content in a resume |
| `/api/evaluate_ats/<id>` | POST | Get ATS evaluation for a resume against a JD |
| `/api/clear` | POST | Clear all data |
| `/api/stats` | GET | System statistics |

## Project Structure

```
AI-Resume-Screener/
├── app.py                 # Flask application
├── requirements.txt       # Python dependencies
├── utils/
│   ├── parser.py          # PDF/DOCX text extraction
│   ├── nlp_processor.py   # Text preprocessing
│   ├── skill_extractor.py # Skill identification
│   ├── matcher.py         # Embedding & similarity
│   ├── vector_store.py    # FAISS vector database
│   ├── ai_detector.py     # Gemini AI content detection
│   └── ats_evaluator.py   # Gemini ATS Resume Evaluator
├── templates/
│   └── index.html         # Web UI
├── static/
│   ├── css/style.css      # Premium styles
│   └── js/app.js          # Frontend logic
├── resumes/               # Uploaded resumes
├── vector_store/          # FAISS index files
└── README.md
```
