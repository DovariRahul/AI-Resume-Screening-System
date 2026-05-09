"""
AI Resume Screening System — Flask Application
Main entry point for the web application.
All candidate data is persisted to disk so the app survives
page refreshes and server restarts.
"""

import os
import json
import uuid
from dotenv import load_dotenv

# Load .env file before anything else reads os.environ
load_dotenv()

from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from utils.parser import parse_resume
from utils.nlp_processor import process_text
from utils.skill_extractor import extract_skills, extract_skills_from_jd, compare_skills
from utils.matcher import (
    compute_match_score, rank_candidates,
    generate_embedding, generate_embeddings_batch
)
from utils.vector_store import add_resume, search_similar, clear_index, get_total_resumes, remove_resume
from utils.ai_detector import detect_ai_content

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Configuration
BASE_DIR = os.path.dirname(__file__)
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'resumes')
JD_FOLDER = os.path.join(BASE_DIR, 'job_descriptions')
DATA_DIR = os.path.join(BASE_DIR, 'data')
CANDIDATES_FILE = os.path.join(DATA_DIR, 'candidates.json')
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(JD_FOLDER, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
max_mb = int(os.environ.get('MAX_UPLOAD_SIZE_MB', '16'))
app.config['MAX_CONTENT_LENGTH'] = max_mb * 1024 * 1024


# ========================================
# Persistent candidate storage helpers
# ========================================

def _load_candidates() -> dict:
    """Load all candidate data from disk."""
    if os.path.exists(CANDIDATES_FILE):
        try:
            with open(CANDIDATES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def _save_candidates(data: dict):
    """Save all candidate data to disk."""
    with open(CANDIDATES_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _add_candidate(uid: str, candidate_record: dict):
    """Add a single candidate to the persistent store."""
    all_candidates = _load_candidates()
    all_candidates[uid] = candidate_record
    _save_candidates(all_candidates)


def _clear_candidates():
    """Remove all candidates from the persistent store."""
    _save_candidates({})


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ========================================
# Page Routes
# ========================================

@app.route('/')
def index():
    return render_template('index.html')


# ========================================
# API Routes
# ========================================

@app.route('/api/upload_resume', methods=['POST'])
def upload_resume():
    """Upload and process a single resume."""
    if 'resume' not in request.files:
        return jsonify({"error": "No resume file provided"}), 400

    file = request.files['resume']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type. Use PDF or DOCX."}), 400

    filename = secure_filename(file.filename)
    uid = str(uuid.uuid4())[:8]
    safe_name = f"{uid}_{filename}"
    file_path = os.path.join(UPLOAD_FOLDER, safe_name)
    file.save(file_path)

    try:
        raw_text = parse_resume(file_path)
        if not raw_text.strip():
            return jsonify({"error": "Could not extract text from resume."}), 400

        processed = process_text(raw_text)
        skills = extract_skills(raw_text)
        embedding = generate_embedding(raw_text)

        candidate_info = {
            "id": uid,
            "filename": filename,
            "skills": skills,
            "text_preview": raw_text[:500] + "..." if len(raw_text) > 500 else raw_text,
        }

        # Store in FAISS
        add_resume(embedding.tolist(), candidate_info)

        # Persist to disk
        _add_candidate(uid, {
            "info": candidate_info,
            "raw_text": raw_text,
            "processed_text": processed,
            "embedding": embedding.tolist(),
        })

        return jsonify({
            "success": True,
            "candidate": candidate_info,
            "total_resumes": get_total_resumes(),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/upload_multiple', methods=['POST'])
def upload_multiple():
    """Upload and process multiple resumes."""
    if 'resumes' not in request.files:
        return jsonify({"error": "No resume files provided"}), 400

    files = request.files.getlist('resumes')
    results = []
    errors = []

    for file in files:
        if file.filename == '' or not allowed_file(file.filename):
            errors.append(f"Skipped: {file.filename}")
            continue

        filename = secure_filename(file.filename)
        uid = str(uuid.uuid4())[:8]
        safe_name = f"{uid}_{filename}"
        file_path = os.path.join(UPLOAD_FOLDER, safe_name)
        file.save(file_path)

        try:
            raw_text = parse_resume(file_path)
            if not raw_text.strip():
                errors.append(f"No text extracted: {filename}")
                continue

            processed = process_text(raw_text)
            skills = extract_skills(raw_text)
            embedding = generate_embedding(raw_text)

            candidate_info = {
                "id": uid,
                "filename": filename,
                "skills": skills,
                "text_preview": raw_text[:500] + "...",
            }

            # Store in FAISS
            add_resume(embedding.tolist(), candidate_info)

            # Persist to disk
            _add_candidate(uid, {
                "info": candidate_info,
                "raw_text": raw_text,
                "processed_text": processed,
                "embedding": embedding.tolist(),
            })

            results.append(candidate_info)
        except Exception as e:
            errors.append(f"Error processing {filename}: {str(e)}")

    return jsonify({
        "success": True,
        "processed": len(results),
        "candidates": results,
        "errors": errors,
        "total_resumes": get_total_resumes(),
    })


@app.route('/api/candidates', methods=['GET'])
def get_candidates():
    """Return all previously processed candidates (survives refresh)."""
    all_candidates = _load_candidates()
    candidate_list = [rec["info"] for rec in all_candidates.values()]
    return jsonify({
        "success": True,
        "candidates": candidate_list,
        "total_resumes": get_total_resumes(),
    })


@app.route('/api/match', methods=['POST'])
def match_resumes():
    """Match all uploaded resumes against a job description."""
    data = request.get_json()
    if not data or 'job_description' not in data:
        return jsonify({"error": "Job description is required"}), 400

    jd_text = data['job_description']
    if len(jd_text.strip()) < 20:
        return jsonify({"error": "Job description is too short."}), 400

    jd_skills = extract_skills_from_jd(jd_text)
    jd_embedding = generate_embedding(jd_text)

    # Semantic search via FAISS
    faiss_results = search_similar(jd_embedding.tolist(), top_k=50)

    # Load persistent candidate data
    all_candidates = _load_candidates()

    candidates = []
    for result in faiss_results:
        cid = result["candidate"]["id"]
        if cid in all_candidates:
            raw = all_candidates[cid]["raw_text"]
            resume_skills = all_candidates[cid]["info"]["skills"]
            skill_comparison = compare_skills(resume_skills, jd_skills)
            scores = compute_match_score(raw, jd_text, skill_comparison["match_percentage"])
            scores["faiss_score"] = result["faiss_score"]

            candidates.append({
                "id": cid,
                "filename": result["candidate"]["filename"],
                "skills": resume_skills,
                "skill_comparison": skill_comparison,
                "scores": scores,
                "text_preview": result["candidate"].get("text_preview", ""),
            })

    ranked = rank_candidates(candidates)

    return jsonify({
        "success": True,
        "job_description_skills": jd_skills,
        "candidates": ranked,
        "total_matched": len(ranked),
    })


@app.route('/api/semantic_search', methods=['POST'])
def semantic_search():
    """Semantic search across stored resumes."""
    data = request.get_json()
    query = data.get('query', '')
    top_k = data.get('top_k', 10)

    if not query.strip():
        return jsonify({"error": "Search query is required"}), 400

    emb = generate_embedding(query)
    results = search_similar(emb.tolist(), top_k=top_k)

    return jsonify({"success": True, "results": results})


@app.route('/api/detect_ai/<candidate_id>', methods=['POST'])
def detect_ai(candidate_id):
    """Run AI content detection on a candidate's resume."""
    all_candidates = _load_candidates()

    if candidate_id not in all_candidates:
        return jsonify({"error": "Candidate not found."}), 404

    raw_text = all_candidates[candidate_id].get("raw_text", "")
    if not raw_text.strip():
        return jsonify({"error": "No resume text available."}), 400

    try:
        result = detect_ai_content(raw_text)
        return jsonify({
            "success": True,
            "candidate_id": candidate_id,
            "filename": all_candidates[candidate_id]["info"]["filename"],
            "detection": result,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/delete_resume/<candidate_id>', methods=['DELETE'])
def delete_resume(candidate_id):
    """Delete a single resume by its candidate ID."""
    all_candidates = _load_candidates()

    if candidate_id not in all_candidates:
        return jsonify({"error": "Candidate not found."}), 404

    # Remove the uploaded file from disk
    filename = all_candidates[candidate_id]["info"].get("filename", "")
    for f in os.listdir(UPLOAD_FOLDER):
        if f.endswith(filename) or candidate_id in f:
            fpath = os.path.join(UPLOAD_FOLDER, f)
            if os.path.isfile(fpath):
                try:
                    os.remove(fpath)
                except OSError:
                    pass

    # Remove from persistent JSON store
    del all_candidates[candidate_id]
    _save_candidates(all_candidates)

    # Remove from FAISS index
    remove_resume(candidate_id)

    return jsonify({
        "success": True,
        "message": f"Candidate {candidate_id} deleted.",
        "total_resumes": get_total_resumes(),
    })


@app.route('/api/clear', methods=['POST'])
def clear_all():
    """Clear all stored resumes and reset the vector index."""
    _clear_candidates()
    clear_index()

    # Also remove uploaded resume files
    for f in os.listdir(UPLOAD_FOLDER):
        fpath = os.path.join(UPLOAD_FOLDER, f)
        if os.path.isfile(fpath):
            try:
                os.remove(fpath)
            except OSError:
                pass

    return jsonify({"success": True, "message": "All data cleared."})


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get system statistics."""
    all_candidates = _load_candidates()
    return jsonify({
        "total_resumes": get_total_resumes(),
        "session_candidates": len(all_candidates),
    })


if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', '5000'))
    debug = os.environ.get('FLASK_DEBUG', 'true').lower() in ('true', '1', 'yes')
    print("=" * 60)
    print("  AI Resume Screening System")
    print(f"  http://localhost:{port}")
    print("=" * 60)
    app.run(debug=debug, port=port)
