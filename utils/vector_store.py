"""
Vector Store Module
FAISS-based vector database for scalable semantic search across resumes.
"""

import os
import json
import numpy as np
import faiss

VECTOR_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "vector_store")
INDEX_PATH = os.path.join(VECTOR_DIR, "faiss_index.bin")
META_PATH = os.path.join(VECTOR_DIR, "metadata.json")

os.makedirs(VECTOR_DIR, exist_ok=True)

_index = None
_metadata = []

def _get_dimension():
    return 384  # all-MiniLM-L6-v2 output dimension

def get_index():
    global _index, _metadata
    if _index is None:
        if os.path.exists(INDEX_PATH) and os.path.exists(META_PATH):
            _index = faiss.read_index(INDEX_PATH)
            with open(META_PATH, 'r') as f:
                _metadata = json.load(f)
        else:
            _index = faiss.IndexFlatIP(_get_dimension())  # Inner product (cosine on normalized)
            _metadata = []
    return _index, _metadata

def save_index():
    global _index, _metadata
    if _index is not None:
        faiss.write_index(_index, INDEX_PATH)
        with open(META_PATH, 'w') as f:
            json.dump(_metadata, f, indent=2)

def add_resume(embedding, candidate_info):
    global _metadata
    index, meta = get_index()
    emb = np.array([embedding]).astype('float32')
    faiss.normalize_L2(emb)
    index.add(emb)
    meta.append(candidate_info)
    _metadata = meta
    save_index()

def search_similar(query_embedding, top_k=10):
    index, meta = get_index()
    if index.ntotal == 0:
        return []
    q = np.array([query_embedding]).astype('float32')
    faiss.normalize_L2(q)
    k = min(top_k, index.ntotal)
    scores, indices = index.search(q, k)
    results = []
    for i, idx in enumerate(indices[0]):
        if idx < len(meta):
            results.append({
                "candidate": meta[idx],
                "faiss_score": round(float(scores[0][i]) * 100, 1)
            })
    return results

def remove_resume(candidate_id):
    """
    Remove a single resume from the FAISS index by candidate ID.
    FAISS IndexFlatIP doesn't support single-row deletion, so we
    rebuild the index from the remaining entries.
    """
    global _index, _metadata
    index, meta = get_index()

    # Find and remove the entry
    new_meta = [m for m in meta if m.get("id") != candidate_id]

    if len(new_meta) == len(meta):
        return False  # ID not found

    # Rebuild the index from scratch using stored embeddings
    # We need the embeddings from the candidates.json file, so
    # we just rebuild with empty index and let the caller re-add.
    # Instead, we extract the raw vectors from the current index.
    if index.ntotal > 0:
        # Get all vectors from old index
        all_vectors = faiss.rev_swig_ptr(
            index.get_xb(), index.ntotal * _get_dimension()
        )
        all_vectors = np.array(all_vectors, dtype='float32').reshape(index.ntotal, _get_dimension())

        # Find the position to remove
        remove_idx = None
        for i, m in enumerate(meta):
            if m.get("id") == candidate_id:
                remove_idx = i
                break

        if remove_idx is not None:
            # Remove that row and build new index
            keep_mask = np.ones(index.ntotal, dtype=bool)
            keep_mask[remove_idx] = False
            remaining_vectors = all_vectors[keep_mask]

            new_index = faiss.IndexFlatIP(_get_dimension())
            if len(remaining_vectors) > 0:
                new_index.add(remaining_vectors)

            _index = new_index
            _metadata = new_meta
            save_index()
            return True

    return False


def get_all_metadata():
    """Return all stored metadata entries."""
    _, meta = get_index()
    return list(meta)


def clear_index():
    global _index, _metadata
    _index = faiss.IndexFlatIP(_get_dimension())
    _metadata = []
    save_index()

def get_total_resumes():
    index, _ = get_index()
    return index.ntotal
