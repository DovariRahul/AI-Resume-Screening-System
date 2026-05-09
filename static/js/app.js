/**
 * AI Resume Screener — Frontend Application
 * State is restored from the server on every page load so
 * refreshes and restarts never lose data.
 */

// ── State ──
let selectedFiles = [];
let processedCandidates = [];

// ── DOM Elements ──
const fileInput       = document.getElementById('fileInput');
const uploadZone      = document.getElementById('uploadZone');
const fileList        = document.getElementById('fileList');
const uploadBtn       = document.getElementById('uploadBtn');
const clearBtn        = document.getElementById('clearBtn');
const candidatesList  = document.getElementById('candidatesList');
const jdInput         = document.getElementById('jdInput');
const matchBtn        = document.getElementById('matchBtn');
const matchResults    = document.getElementById('matchResults');
const searchInput     = document.getElementById('searchInput');
const searchBtn       = document.getElementById('searchBtn');
const searchResults   = document.getElementById('searchResults');
const loadingOverlay  = document.getElementById('loadingOverlay');
const loadingText     = document.getElementById('loadingText');
const resumeCount     = document.getElementById('resumeCount');
const toastContainer  = document.getElementById('toastContainer');

// ── Tab Navigation ──
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
});

// ── Toast Notifications ──
function showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icons[type] || ''} ${message}`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ── Loading State ──
function showLoading(text = 'Processing...') {
    loadingText.textContent = text;
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// ── File Selection ──
fileInput.addEventListener('change', (e) => {
    addFiles(Array.from(e.target.files));
    fileInput.value = '';            // allow re-selecting same file
});

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    addFiles(Array.from(e.dataTransfer.files));
});

function addFiles(files) {
    files.forEach(f => {
        const ext = f.name.split('.').pop().toLowerCase();
        if (['pdf', 'docx', 'doc'].includes(ext)) {
            if (!selectedFiles.find(sf => sf.name === f.name)) {
                selectedFiles.push(f);
            }
        } else {
            showToast(`Skipped ${f.name} — unsupported format`, 'error');
        }
    });
    renderFileList();
}

function renderFileList() {
    uploadBtn.disabled = selectedFiles.length === 0;
    if (selectedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
    }
    fileList.innerHTML = selectedFiles.map((f, i) => `
        <div class="file-item">
            <div class="name">📄 ${f.name}</div>
            <div style="display:flex;align-items:center;gap:12px;">
                <span class="size">${(f.size / 1024).toFixed(1)} KB</span>
                <button class="remove-btn" onclick="removeFile(${i})">✕</button>
            </div>
        </div>
    `).join('');
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
}

// ── Upload & Process Resumes ──
uploadBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;
    showLoading('Extracting text & generating embeddings...');

    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('resumes', f));

    try {
        const res = await fetch('/api/upload_multiple', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
            processedCandidates = processedCandidates.concat(data.candidates);
            resumeCount.textContent = data.total_resumes;
            renderCandidates();
            updateMatchButton();
            showToast(`Processed ${data.processed} resume(s)`, 'success');
            selectedFiles = [];
            renderFileList();

            if (data.errors && data.errors.length > 0) {
                data.errors.forEach(err => showToast(err, 'error'));
            }
        } else {
            showToast(data.error || 'Upload failed', 'error');
        }
    } catch (err) {
        showToast('Network error: ' + err.message, 'error');
    }
    hideLoading();
});

// ── Render Processed Candidates ──
function renderCandidates() {
    if (processedCandidates.length === 0) {
        candidatesList.innerHTML = `
            <div class="empty-state">
                <div class="icon">📋</div>
                <h3>No resumes processed yet</h3>
                <p>Upload resumes to see extracted skills</p>
            </div>`;
        return;
    }

    candidatesList.innerHTML = processedCandidates.map(c => `
        <div class="file-item candidate-item" id="candidate-${c.id}">
            <div class="candidate-item-top">
                <strong>📄 ${c.filename}</strong>
                <div class="candidate-item-actions">
                    <span class="size">ID: ${c.id}</span>
                    <button class="delete-candidate-btn" onclick="deleteResume('${c.id}')" title="Delete this resume">🗑️</button>
                </div>
            </div>
            <div class="skills-row">
                ${(c.skills.technical || []).slice(0, 8).map(s => `<span class="skill-tag matched">${s}</span>`).join('')}
                ${(c.skills.technical || []).length > 8 ? `<span class="skill-tag extra">+${c.skills.technical.length - 8} more</span>` : ''}
            </div>
        </div>
    `).join('');

    // Keep AI detect dropdown in sync
    if (typeof populateAiSelect === 'function') populateAiSelect();
}

// ── Delete Individual Resume ──
async function deleteResume(candidateId) {
    if (!confirm('Delete this resume? This cannot be undone.')) return;

    const card = document.getElementById('candidate-' + candidateId);
    if (card) card.style.opacity = '0.4';

    try {
        const res = await fetch(`/api/delete_resume/${candidateId}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            processedCandidates = processedCandidates.filter(c => c.id !== candidateId);
            resumeCount.textContent = data.total_resumes;
            renderCandidates();
            updateMatchButton();
            showToast('Resume deleted', 'success');
        } else {
            if (card) card.style.opacity = '1';
            showToast(data.error || 'Delete failed', 'error');
        }
    } catch (err) {
        if (card) card.style.opacity = '1';
        showToast('Network error: ' + err.message, 'error');
    }
}

// ── Keep match button in sync ──
function updateMatchButton() {
    matchBtn.disabled = processedCandidates.length === 0 || jdInput.value.trim().length < 20;
}

// ── Match & Rank ──
matchBtn.addEventListener('click', async () => {
    const jd = jdInput.value.trim();
    if (!jd) {
        showToast('Enter a job description first', 'error');
        return;
    }
    if (jd.length < 20) {
        showToast('Job description is too short', 'error');
        return;
    }

    showLoading('Analyzing candidates with AI...');

    try {
        const res = await fetch('/api/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_description: jd })
        });
        const data = await res.json();

        if (data.success) {
            renderMatchResults(data);
            showToast(`Ranked ${data.total_matched} candidate(s)`, 'success');
        } else {
            showToast(data.error || 'Matching failed', 'error');
        }
    } catch (err) {
        showToast('Network error: ' + err.message, 'error');
    }
    hideLoading();
});

function renderMatchResults(data) {
    if (!data.candidates || data.candidates.length === 0) {
        matchResults.innerHTML = `
            <div class="empty-state">
                <div class="icon">📊</div>
                <h3>No matches found</h3>
                <p>Upload resumes first, then try matching</p>
            </div>`;
        return;
    }

    // JD Skills Preview
    const jdSkills = data.job_description_skills;
    const jdPreview = document.getElementById('jdSkillsPreview');
    jdPreview.innerHTML = `
        <div class="jd-skills-preview">
            <h4>📌 Detected JD Skills</h4>
            <div class="skills-row">
                ${(jdSkills.all || []).map(s => `<span class="skill-tag extra">${s}</span>`).join('')}
            </div>
        </div>`;

    // Summary Stats
    const topScore = data.candidates[0].scores.overall_score;
    const avgScore = (data.candidates.reduce((a, c) => a + c.scores.overall_score, 0) / data.candidates.length).toFixed(1);

    let html = `
        <div class="summary-stats">
            <div class="summary-stat">
                <div class="value">${data.total_matched}</div>
                <div class="label">Candidates Analyzed</div>
            </div>
            <div class="summary-stat">
                <div class="value">${topScore}%</div>
                <div class="label">Top Match Score</div>
            </div>
            <div class="summary-stat">
                <div class="value">${avgScore}%</div>
                <div class="label">Average Score</div>
            </div>
            <div class="summary-stat">
                <div class="value">${jdSkills.all ? jdSkills.all.length : 0}</div>
                <div class="label">JD Skills Detected</div>
            </div>
        </div>
        <div class="results-grid">`;

    data.candidates.forEach(c => {
        const s = c.scores;
        const sc = c.skill_comparison;
        const rankClass = c.rank === 1 ? 'rank-1' : c.rank === 2 ? 'rank-2' : c.rank === 3 ? 'rank-3' : 'rank-default';
        const topClass = c.rank <= 3 ? 'top-match' : '';
        const strokeColor = s.overall_score >= 80 ? '#10b981' : s.overall_score >= 60 ? '#f59e0b' : '#ef4444';
        const circumference = 2 * Math.PI * 28;
        const offset = circumference - (s.overall_score / 100) * circumference;

        html += `
        <div class="candidate-card ${topClass}">
            <div class="candidate-top">
                <div class="candidate-info">
                    <div class="rank-badge ${rankClass}">#${c.rank}</div>
                    <div>
                        <div class="candidate-name">${c.filename}</div>
                        <div class="candidate-file">ID: ${c.id}</div>
                    </div>
                </div>
                <div class="score-circle">
                    <svg viewBox="0 0 64 64">
                        <circle class="bg-ring" cx="32" cy="32" r="28"/>
                        <circle class="progress-ring" cx="32" cy="32" r="28"
                            stroke="${strokeColor}"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="${offset}"/>
                    </svg>
                    <div class="score-value" style="color:${strokeColor}">${s.overall_score}%</div>
                </div>
            </div>
            <div class="score-bars">
                <div class="score-bar-item">
                    <div class="score-bar-label"><span>Semantic</span><span>${s.semantic_score}%</span></div>
                    <div class="score-bar"><div class="score-bar-fill semantic" style="width:${s.semantic_score}%"></div></div>
                </div>
                <div class="score-bar-item">
                    <div class="score-bar-label"><span>TF-IDF</span><span>${s.tfidf_score}%</span></div>
                    <div class="score-bar"><div class="score-bar-fill tfidf" style="width:${s.tfidf_score}%"></div></div>
                </div>
                <div class="score-bar-item">
                    <div class="score-bar-label"><span>Skill Match</span><span>${s.skill_match_score}%</span></div>
                    <div class="score-bar"><div class="score-bar-fill skill" style="width:${s.skill_match_score}%"></div></div>
                </div>
                <div class="score-bar-item">
                    <div class="score-bar-label"><span>FAISS Score</span><span>${s.faiss_score}%</span></div>
                    <div class="score-bar"><div class="score-bar-fill faiss" style="width:${s.faiss_score}%"></div></div>
                </div>
            </div>
            <div class="skills-section">
                ${sc.matched.length > 0 ? `
                    <div class="skills-label">✅ Matched Skills (${sc.matched.length})</div>
                    <div class="skills-row">${sc.matched.map(s => `<span class="skill-tag matched">✔ ${s}</span>`).join('')}</div>
                ` : ''}
                ${sc.missing.length > 0 ? `
                    <div class="skills-label">❌ Missing Skills (${sc.missing.length})</div>
                    <div class="skills-row">${sc.missing.map(s => `<span class="skill-tag missing">✘ ${s}</span>`).join('')}</div>
                ` : ''}
                ${sc.extra.length > 0 ? `
                    <div class="skills-label">➕ Additional Skills (${sc.extra.length})</div>
                    <div class="skills-row">${sc.extra.slice(0, 10).map(s => `<span class="skill-tag extra">${s}</span>`).join('')}
                    ${sc.extra.length > 10 ? `<span class="skill-tag extra">+${sc.extra.length - 10} more</span>` : ''}</div>
                ` : ''}
            </div>
            <div style="margin-top:16px; border-top:1px solid rgba(255,255,255,0.1); padding-top:16px;">
                <button class="btn btn-primary" onclick="evaluateAts('${c.id}')" id="btn-ats-${c.id}" style="width:100%; padding:10px;">📊 Calculate Deterministic ATS Score</button>
                <div id="ats-result-${c.id}" style="margin-top:16px;"></div>
            </div>
        </div>`;
    });

    html += '</div>';
    matchResults.innerHTML = html;
}

// ── ATS Evaluator ──
window.evaluateAts = async function(candidateId) {
    const jd = jdInput.value.trim();
    if (!jd) {
        showToast('Job description is missing', 'error');
        return;
    }

    const btn = document.getElementById(`btn-ats-${candidateId}`);
    const resultDiv = document.getElementById(`ats-result-${candidateId}`);
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Evaluating...';
    }

    try {
        const res = await fetch(`/api/evaluate_ats/${candidateId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_description: jd })
        });
        const data = await res.json();

        if (data.success) {
            const ev = data.evaluation;
            const scoreColor = ev.total_ats_score >= 80 ? '#10b981' : ev.total_ats_score >= 60 ? '#f59e0b' : '#ef4444';
            
            let html = `
                <div class="glass-card" style="background:rgba(0,0,0,0.2); padding:16px; margin:0;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h3 style="margin:0; font-size:1.1rem; color:#fff;">Deterministic ATS Score</h3>
                        <div style="font-size:1.5rem; font-weight:700; color:${scoreColor}">${ev.total_ats_score}/100</div>
                    </div>
                    
                    <div class="score-bars" style="margin-bottom:16px;">
                        <div class="score-bar-item">
                            <div class="score-bar-label"><span>Keywords (25)</span><span>${ev.breakdown.keyword_presence}</span></div>
                            <div class="score-bar"><div class="score-bar-fill" style="width:${(ev.breakdown.keyword_presence/25)*100}%; background:#3b82f6;"></div></div>
                        </div>
                        <div class="score-bar-item">
                            <div class="score-bar-label"><span>Formatting (25)</span><span>${ev.breakdown.formatting}</span></div>
                            <div class="score-bar"><div class="score-bar-fill" style="width:${(ev.breakdown.formatting/25)*100}%; background:#8b5cf6;"></div></div>
                        </div>
                        <div class="score-bar-item">
                            <div class="score-bar-label"><span>Experience (25)</span><span>${ev.breakdown.experience}</span></div>
                            <div class="score-bar"><div class="score-bar-fill" style="width:${(ev.breakdown.experience/25)*100}%; background:#10b981;"></div></div>
                        </div>
                        <div class="score-bar-item">
                            <div class="score-bar-label"><span>Project Relevance (25)</span><span>${ev.breakdown.project_relevance}</span></div>
                            <div class="score-bar"><div class="score-bar-fill" style="width:${(ev.breakdown.project_relevance/25)*100}%; background:#f59e0b;"></div></div>
                        </div>
                    </div>
                    
                    ${ev.suggestions && ev.suggestions.length > 0 ? `
                        <div style="font-size:0.9rem; color:#cbd5e1; background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; border-left:3px solid #3b82f6;">
                            <strong>Suggestions:</strong><br>
                            ${ev.suggestions.join('<br>')}
                        </div>
                    ` : ''}
                </div>
            `;
            resultDiv.innerHTML = html;
            if (btn) btn.style.display = 'none';
        } else {
            resultDiv.innerHTML = `<div style="color:#ef4444; padding:10px;">Error: ${data.error}</div>`;
            showToast(data.error || 'Evaluation failed', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '📊 Calculate Deterministic ATS Score';
            }
        }
    } catch (err) {
        resultDiv.innerHTML = `<div style="color:#ef4444; padding:10px;">Network Error: ${err.message}</div>`;
        showToast('Network error: ' + err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '📊 Calculate Deterministic ATS Score';
        }
    }
};

// ── Semantic Search ──
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        showToast('Enter a search query', 'error');
        return;
    }

    showLoading('Searching with AI embeddings...');

    try {
        const res = await fetch('/api/semantic_search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, top_k: 10 })
        });
        const data = await res.json();

        if (data.success) {
            renderSearchResults(data.results);
            showToast(`Found ${data.results.length} result(s)`, 'success');
        } else {
            showToast(data.error || 'Search failed', 'error');
        }
    } catch (err) {
        showToast('Network error: ' + err.message, 'error');
    }
    hideLoading();
}

function renderSearchResults(results) {
    if (!results || results.length === 0) {
        searchResults.innerHTML = `
            <div class="empty-state">
                <div class="icon">🔎</div>
                <h3>No results found</h3>
                <p>Try a different query or upload more resumes</p>
            </div>`;
        return;
    }

    let html = '<div class="results-grid">';
    results.forEach((r, i) => {
        const c = r.candidate;
        html += `
        <div class="candidate-card">
            <div class="candidate-top">
                <div class="candidate-info">
                    <div class="rank-badge rank-default">#${i + 1}</div>
                    <div>
                        <div class="candidate-name">${c.filename}</div>
                        <div class="candidate-file">FAISS Score: ${r.faiss_score}%</div>
                    </div>
                </div>
            </div>
            ${c.skills ? `
            <div class="skills-section">
                <div class="skills-row">
                    ${(c.skills.technical || []).slice(0, 12).map(s => `<span class="skill-tag matched">${s}</span>`).join('')}
                </div>
            </div>` : ''}
        </div>`;
    });
    html += '</div>';
    searchResults.innerHTML = html;
}

// ── Clear All ──
clearBtn.addEventListener('click', async () => {
    if (!confirm('Clear all uploaded resumes and data?')) return;

    try {
        await fetch('/api/clear', { method: 'POST' });
        processedCandidates = [];
        selectedFiles = [];
        renderFileList();
        renderCandidates();
        resumeCount.textContent = '0';
        updateMatchButton();
        matchResults.innerHTML = `
            <div class="empty-state">
                <div class="icon">📊</div>
                <h3>No results yet</h3>
                <p>Upload resumes and enter a job description to see rankings</p>
            </div>`;
        document.getElementById('jdSkillsPreview').innerHTML = '';
        searchResults.innerHTML = `
            <div class="empty-state">
                <div class="icon">🔎</div>
                <h3>Enter a search query</h3>
                <p>AI will find semantically similar resumes using FAISS</p>
            </div>`;
        showToast('All data cleared', 'info');
    } catch (err) {
        showToast('Error clearing data', 'error');
    }
});

// ── AI Content Detection ──
const aiCandidateSelect = document.getElementById('aiCandidateSelect');
const aiDetectBtn = document.getElementById('aiDetectBtn');
const aiDetectResults = document.getElementById('aiDetectResults');

// ── ATS Score Evaluator Tab ──
const atsCandidateSelect = document.getElementById('atsCandidateSelect');
const atsJdInput = document.getElementById('atsJdInput');
const atsEvaluateBtn = document.getElementById('atsEvaluateBtn');
const atsEvaluateResults = document.getElementById('atsEvaluateResults');

function updateAtsTabButton() {
    if (atsEvaluateBtn) {
        atsEvaluateBtn.disabled = !atsCandidateSelect.value || !atsJdInput.value || atsJdInput.value.trim().length < 20;
    }
}

function populateAiSelect() {
    const current = aiCandidateSelect.value;
    aiCandidateSelect.innerHTML = '<option value="">— Select a candidate to analyze —</option>';
    
    let atsCurrent = null;
    if (atsCandidateSelect) {
        atsCurrent = atsCandidateSelect.value;
        atsCandidateSelect.innerHTML = '<option value="">— Select a candidate to analyze —</option>';
    }

    processedCandidates.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.filename} (${c.id})`;
        aiCandidateSelect.appendChild(opt);
        
        if (atsCandidateSelect) {
            const opt2 = document.createElement('option');
            opt2.value = c.id;
            opt2.textContent = `${c.filename} (${c.id})`;
            atsCandidateSelect.appendChild(opt2);
        }
    });
    
    if (current) aiCandidateSelect.value = current;
    aiDetectBtn.disabled = !aiCandidateSelect.value;
    
    if (atsCandidateSelect && atsCurrent) {
        atsCandidateSelect.value = atsCurrent;
    }
    updateAtsTabButton();
}

aiCandidateSelect.addEventListener('change', () => {
    aiDetectBtn.disabled = !aiCandidateSelect.value;
});

aiDetectBtn.addEventListener('click', async () => {
    const cid = aiCandidateSelect.value;
    if (!cid) return;

    showLoading('Analyzing resume with Gemini AI...');

    try {
        const res = await fetch(`/api/detect_ai/${cid}`, { method: 'POST' });
        const contentType = res.headers.get('content-type') || '';

        if (!contentType.includes('application/json')) {
            const text = await res.text();
            showToast('Server error — check GEMINI_API_KEY is set', 'error');
            console.error('Non-JSON response:', text.slice(0, 500));
            hideLoading();
            return;
        }

        const data = await res.json();

        if (data.success) {
            renderAiDetectResults(data);
            showToast('AI detection complete', 'success');
        } else {
            showToast(data.error || 'Detection failed', 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
    hideLoading();
});

function renderAiDetectResults(data) {
    const d = data.detection;
    const score = d.ai_score;
    const scoreColor = score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#10b981';
    const verdictClass = score >= 70 ? 'verdict-high' : score >= 40 ? 'verdict-mid' : 'verdict-low';

    let html = `
    <div class="glass-card ai-result-card">
        <div class="ai-result-header">
            <div>
                <h3>📄 ${data.filename}</h3>
                <p class="ai-verdict ${verdictClass}">${d.verdict}</p>
            </div>
            <div class="ai-score-gauge">
                <svg viewBox="0 0 120 120" width="120" height="120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10"/>
                    <circle cx="60" cy="60" r="50" fill="none" stroke="${scoreColor}" stroke-width="10"
                        stroke-linecap="round" stroke-dasharray="${Math.PI * 100}"
                        stroke-dashoffset="${Math.PI * 100 - (score / 100) * Math.PI * 100}"
                        transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 1.2s ease"/>
                </svg>
                <div class="ai-score-text" style="color:${scoreColor}">
                    <span class="ai-score-num">${score}%</span>
                    <span class="ai-score-label">AI Score</span>
                </div>
            </div>
        </div>

        <div class="ai-summary">${d.summary}</div>
        <div class="ai-confidence">Confidence: <strong>${d.confidence}</strong></div>
    </div>`;

    // Indicators
    if (d.ai_indicators.length > 0 || d.human_indicators.length > 0) {
        html += '<div class="grid-2 mt-24">';

        if (d.ai_indicators.length > 0) {
            html += `<div class="glass-card">
                <div class="card-header"><div class="icon">🚩</div><div><h2>AI Indicators</h2><p>Patterns suggesting AI generation</p></div></div>
                <ul class="ai-indicator-list">${d.ai_indicators.map(i => `<li class="ai-flag">⚠️ ${i}</li>`).join('')}</ul>
            </div>`;
        }

        if (d.human_indicators.length > 0) {
            html += `<div class="glass-card">
                <div class="card-header"><div class="icon">✅</div><div><h2>Human Indicators</h2><p>Signs of authentic content</p></div></div>
                <ul class="ai-indicator-list">${d.human_indicators.map(i => `<li class="human-flag">✔ ${i}</li>`).join('')}</ul>
            </div>`;
        }

        html += '</div>';
    }

    // Section analysis
    if (d.section_analysis && d.section_analysis.length > 0) {
        html += `<div class="glass-card mt-24">
            <div class="card-header"><div class="icon">📋</div><div><h2>Section-by-Section Analysis</h2><p>AI likelihood per resume section</p></div></div>
            <div class="section-analysis-table">
                <div class="sa-header"><span>Section</span><span>AI Likelihood</span><span>Reason</span></div>
                ${d.section_analysis.map(s => {
                    const lc = s.ai_likelihood === 'high' ? 'sa-high' : s.ai_likelihood === 'medium' ? 'sa-mid' : 'sa-low';
                    return `<div class="sa-row">
                        <span class="sa-section">${s.section}</span>
                        <span class="sa-badge ${lc}">${s.ai_likelihood}</span>
                        <span class="sa-reason">${s.reason}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    aiDetectResults.innerHTML = html;
}

// ── Enable match button when JD has content ──
jdInput.addEventListener('input', updateMatchButton);

// ========================================
// BOOT: Restore state from server on load
// ========================================
(async () => {
    try {
        const res = await fetch('/api/candidates');
        const data = await res.json();

        if (data.success) {
            processedCandidates = data.candidates || [];
            resumeCount.textContent = data.total_resumes;
            renderCandidates();
            updateMatchButton();

            if (processedCandidates.length > 0) {
                showToast(`Restored ${processedCandidates.length} candidate(s)`, 'info');
            }
        }
    } catch (_) {
        // Server not reachable – first load is fine
    }
})();

// ── ATS Score Evaluator Tab Logic ──
if (atsCandidateSelect && atsJdInput && atsEvaluateBtn) {
    atsCandidateSelect.addEventListener('change', updateAtsTabButton);
    atsJdInput.addEventListener('input', updateAtsTabButton);

    atsEvaluateBtn.addEventListener('click', async () => {
        const cid = atsCandidateSelect.value;
        const jd = atsJdInput.value.trim();
        if (!cid || !jd) return;

        showLoading('Calculating deterministic ATS score...');

        try {
            const res = await fetch(`/api/evaluate_ats/${cid}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_description: jd })
            });
            const data = await res.json();

            if (data.success) {
                renderAtsTabResults(data);
                showToast('ATS evaluation complete', 'success');
            } else {
                showToast(data.error || 'Evaluation failed', 'error');
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
        hideLoading();
    });
}

function renderAtsTabResults(data) {
    const ev = data.evaluation;
    const scoreColor = ev.total_ats_score >= 80 ? '#10b981' : ev.total_ats_score >= 60 ? '#f59e0b' : '#ef4444';
    
    let html = `
        <div class="glass-card ai-result-card">
            <div class="ai-result-header">
                <div>
                    <h3>📄 ${data.filename}</h3>
                </div>
                <div class="ai-score-gauge">
                    <svg viewBox="0 0 120 120" width="120" height="120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10"/>
                        <circle cx="60" cy="60" r="50" fill="none" stroke="${scoreColor}" stroke-width="10"
                            stroke-linecap="round" stroke-dasharray="${Math.PI * 100}"
                            stroke-dashoffset="${Math.PI * 100 - (ev.total_ats_score / 100) * Math.PI * 100}"
                            transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 1.2s ease"/>
                    </svg>
                    <div class="ai-score-text" style="color:${scoreColor}">
                        <span class="ai-score-num">${ev.total_ats_score}%</span>
                        <span class="ai-score-label">ATS Score</span>
                    </div>
                </div>
            </div>
            
            <div class="score-bars" style="margin-top:24px; margin-bottom:24px;">
                <div class="score-bar-item">
                    <div class="score-bar-label"><span>Keywords (25)</span><span>${ev.breakdown.keyword_presence}</span></div>
                    <div class="score-bar"><div class="score-bar-fill" style="width:${(ev.breakdown.keyword_presence/25)*100}%; background:#3b82f6;"></div></div>
                </div>
                <div class="score-bar-item">
                    <div class="score-bar-label"><span>Formatting (25)</span><span>${ev.breakdown.formatting}</span></div>
                    <div class="score-bar"><div class="score-bar-fill" style="width:${(ev.breakdown.formatting/25)*100}%; background:#8b5cf6;"></div></div>
                </div>
                <div class="score-bar-item">
                    <div class="score-bar-label"><span>Experience & Structure (25)</span><span>${ev.breakdown.experience}</span></div>
                    <div class="score-bar"><div class="score-bar-fill" style="width:${(ev.breakdown.experience/25)*100}%; background:#10b981;"></div></div>
                </div>
                <div class="score-bar-item">
                    <div class="score-bar-label"><span>Project Relevance (25)</span><span>${ev.breakdown.project_relevance}</span></div>
                    <div class="score-bar"><div class="score-bar-fill" style="width:${(ev.breakdown.project_relevance/25)*100}%; background:#f59e0b;"></div></div>
                </div>
            </div>
            
            <div class="grid-2" style="margin-top:24px;">
                <div>
                    <div class="skills-label">✅ Matched Keywords (${ev.matched_keywords ? ev.matched_keywords.length : 0})</div>
                    <div class="skills-row">${(ev.matched_keywords || []).map(s => `<span class="skill-tag matched">✔ ${s}</span>`).join('')}</div>
                </div>
                <div>
                    <div class="skills-label">❌ Missing Keywords (${ev.missing_keywords ? ev.missing_keywords.length : 0})</div>
                    <div class="skills-row">${(ev.missing_keywords || []).map(s => `<span class="skill-tag missing">✘ ${s}</span>`).join('')}</div>
                </div>
            </div>
            
            ${ev.suggestions && ev.suggestions.length > 0 ? `
                <div style="font-size:1rem; color:#cbd5e1; background:rgba(255,255,255,0.05); padding:16px; border-radius:8px; border-left:4px solid #3b82f6; margin-top:24px;">
                    <strong style="display:block; margin-bottom:8px;">Suggestions:</strong>
                    <ul style="margin:0; padding-left:20px; line-height:1.5;">
                        ${ev.suggestions.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>`;
        
    atsEvaluateResults.innerHTML = html;
    
    const downloadBtn = document.getElementById('atsDownloadBtn');
    if (downloadBtn) {
        downloadBtn.style.display = 'block';
    }
}

