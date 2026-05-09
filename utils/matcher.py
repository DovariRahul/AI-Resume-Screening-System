"""
Matcher Module
Handles semantic matching between resumes and job descriptions
using Sentence Transformers embeddings and cosine similarity.
"""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer

_model = None

def get_model():
    global _model
    if _model is None:
        print("[INFO] Loading Sentence Transformer model...")
        _model = SentenceTransformer('all-MiniLM-L6-v2')
        print("[INFO] Model loaded.")
    return _model

def tfidf_similarity(resume_text, jd_text):
    vectorizer = TfidfVectorizer()
    matrix = vectorizer.fit_transform([resume_text, jd_text])
    return float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])

def generate_embedding(text):
    return get_model().encode(text, convert_to_numpy=True)

def generate_embeddings_batch(texts):
    return get_model().encode(texts, convert_to_numpy=True, show_progress_bar=False)

def semantic_similarity(resume_text, jd_text):
    r = generate_embedding(resume_text).reshape(1, -1)
    j = generate_embedding(jd_text).reshape(1, -1)
    return float(cosine_similarity(r, j)[0][0])

def compute_match_score(resume_text, jd_text, skill_match_pct=0.0):
    sem = semantic_similarity(resume_text, jd_text)
    tfidf = tfidf_similarity(resume_text, jd_text)
    skill = skill_match_pct / 100.0
    combined = (0.50 * sem) + (0.20 * tfidf) + (0.30 * skill)
    return {
        "semantic_score": round(sem * 100, 1),
        "tfidf_score": round(tfidf * 100, 1),
        "skill_match_score": round(skill_match_pct, 1),
        "overall_score": round(combined * 100, 1),
    }

def rank_candidates(candidates):
    s = sorted(candidates, key=lambda x: x.get("scores", {}).get("overall_score", 0), reverse=True)
    for i, c in enumerate(s):
        c["rank"] = i + 1
    return s
