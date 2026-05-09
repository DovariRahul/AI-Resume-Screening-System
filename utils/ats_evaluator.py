import re
from utils.skill_extractor import extract_skills, extract_skills_from_jd, compare_skills

def evaluate_ats_score(resume_text: str, jd_text: str) -> dict:
    if not resume_text or not jd_text:
        return _fallback_error("Missing resume or job description text.")
        
    resume_text_lower = resume_text.lower()
    
    # 1. Keyword Match Analysis
    jd_skills = extract_skills_from_jd(jd_text)
    resume_skills = extract_skills(resume_text)
    skill_comp = compare_skills(resume_skills, jd_skills)
    
    match_percentage = skill_comp["match_percentage"]
    keyword_score = min(25, int(match_percentage / 4)) if match_percentage > 0 else 0
    if len(jd_skills["all"]) == 0:
        keyword_score = 25  # Free points if no JD skills found
        
    # 2. Formatting Compatibility
    formatting_score = 25
    suggestions = []
    
    # Heuristics for tables/columns
    if resume_text.count("    ") > 20 or resume_text.count("\t") > 10:
        formatting_score -= 10
        suggestions.append("Detected possible multi-column layouts or tables. Use a single-column layout for better ATS parsing.")
        
    if re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', resume_text):
        formatting_score -= 5
        suggestions.append("Detected unreadable characters or graphics. Avoid using icons or graphics.")
        
    if len(resume_text.splitlines()) > 100 and (len(resume_text) / len(resume_text.splitlines())) < 20:
        formatting_score -= 5
        suggestions.append("Formatting may be fragmented. Ensure text isn't inside floating text boxes.")

    formatting_score = max(0, formatting_score)
    
    # 3. Resume Structure / Experience Validation
    experience_score = 0
    sections = {
        "Summary": r'\b(summary|profile|objective)\b',
        "Skills": r'\b(skills|technologies|core competencies)\b',
        "Experience": r'\b(experience|employment|work history|career)\b',
        "Education": r'\b(education|academic|qualifications)\b',
        "Projects": r'\b(projects|portfolio)\b',
        "Certifications": r'\b(certifications|licenses)\b'
    }
    
    found_sections = []
    missing_sections = []
    
    for section, pattern in sections.items():
        if re.search(pattern, resume_text_lower):
            found_sections.append(section)
            experience_score += 4
        else:
            missing_sections.append(section)
            
    # Give a bonus point if they have the core ones
    if "Experience" in found_sections and "Education" in found_sections:
        experience_score += 1
        
    if missing_sections:
        suggestions.append(f"Include standard headings. Missing: {', '.join(missing_sections)}.")
        
    experience_score = min(25, experience_score)
    
    # 4. Project Relevance & Readability
    project_score = 15
    if "Projects" in found_sections:
        project_score += 5
    
    if len(skill_comp["matched"]) > 0:
        project_score += 5
        
    if len(resume_text.split()) < 100:
        project_score -= 10
        suggestions.append("Resume is too short. Include measurable achievements and elaborate on your experience.")
        
    project_score = min(25, max(0, project_score))
    
    if len(skill_comp["missing"]) > 0:
        suggestions.append(f"Add missing keywords naturally: {', '.join(skill_comp['missing'][:5])}...")
        
    if len(skill_comp["matched"]) == 0 and len(jd_skills["all"]) > 0:
        suggestions.append("Your resume does not align with the core technical requirements of this JD.")

    total = keyword_score + formatting_score + experience_score + project_score
    
    return {
        "total_ats_score": total,
        "breakdown": {
            "keyword_presence": keyword_score,
            "formatting": formatting_score,
            "experience": experience_score,
            "project_relevance": project_score
        },
        "matched_keywords": skill_comp["matched"],
        "missing_keywords": skill_comp["missing"],
        "suggestions": suggestions
    }

def _fallback_error(msg: str) -> dict:
    return {
        "total_ats_score": 0,
        "breakdown": {"keyword_presence": 0, "formatting": 0, "experience": 0, "project_relevance": 0},
        "matched_keywords": [],
        "missing_keywords": [],
        "suggestions": [msg]
    }
