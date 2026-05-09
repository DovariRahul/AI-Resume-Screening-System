"""
Skill Extractor Module
Identifies technical and soft skills from resume text using
keyword matching against a comprehensive skills database.
"""

import re

# ========================================
# Comprehensive Skills Database
# ========================================

TECHNICAL_SKILLS = {
    # Programming Languages
    "python", "java", "javascript", "typescript", "c++", "c#", "c",
    "ruby", "go", "golang", "rust", "swift", "kotlin", "scala",
    "php", "perl", "r", "matlab", "dart", "lua", "haskell",
    "objective-c", "assembly", "shell", "bash", "powershell",
    "visual basic", "vb.net", "groovy", "elixir", "clojure",
    
    # Web Development
    "html", "css", "html5", "css3", "sass", "scss", "less",
    "bootstrap", "tailwind", "tailwindcss", "jquery", "ajax",
    "react", "reactjs", "react.js", "angular", "angularjs",
    "vue", "vuejs", "vue.js", "svelte", "next.js", "nextjs",
    "nuxt.js", "nuxtjs", "gatsby", "webpack", "vite", "babel",
    "redux", "mobx", "graphql", "rest", "restful", "api",
    "node.js", "nodejs", "express", "express.js", "fastify",
    "django", "flask", "fastapi", "spring", "spring boot",
    "asp.net", "laravel", "rails", "ruby on rails",
    
    # Data Science & ML
    "machine learning", "deep learning", "neural network",
    "neural networks", "artificial intelligence", "ai", "ml",
    "natural language processing", "nlp", "computer vision",
    "reinforcement learning", "transfer learning",
    "supervised learning", "unsupervised learning",
    "data science", "data analysis", "data analytics",
    "data engineering", "data mining", "data visualization",
    "big data", "data warehouse", "etl", "data pipeline",
    "feature engineering", "model training", "model deployment",
    "mlops", "automl",
    
    # ML/DL Frameworks & Libraries
    "tensorflow", "pytorch", "keras", "scikit-learn", "sklearn",
    "xgboost", "lightgbm", "catboost", "hugging face",
    "transformers", "opencv", "spacy", "nltk", "gensim",
    "sentence transformers", "langchain", "llamaindex",
    "pandas", "numpy", "scipy", "matplotlib", "seaborn",
    "plotly", "bokeh", "streamlit", "gradio", "dash",
    
    # Databases
    "sql", "mysql", "postgresql", "postgres", "sqlite",
    "oracle", "sql server", "mssql", "mariadb",
    "mongodb", "cassandra", "couchdb", "dynamodb",
    "redis", "memcached", "elasticsearch", "neo4j",
    "firebase", "supabase", "cockroachdb",
    
    # Cloud Platforms
    "aws", "amazon web services", "azure", "microsoft azure",
    "gcp", "google cloud", "google cloud platform",
    "heroku", "digitalocean", "vercel", "netlify",
    "cloudflare", "oracle cloud",
    
    # Cloud Services
    "ec2", "s3", "lambda", "rds", "sqs", "sns", "ecs",
    "eks", "fargate", "cloudformation", "cloudwatch",
    "api gateway", "cognito", "sagemaker", "bedrock",
    
    # DevOps & Tools
    "docker", "kubernetes", "k8s", "terraform", "ansible",
    "jenkins", "github actions", "gitlab ci", "circleci",
    "travis ci", "bamboo", "argocd",
    "ci/cd", "ci cd", "continuous integration",
    "continuous deployment", "continuous delivery",
    "nginx", "apache", "linux", "unix", "windows server",
    
    # Version Control
    "git", "github", "gitlab", "bitbucket", "svn",
    
    # Data Formats & Protocols
    "json", "xml", "yaml", "csv", "protobuf", "grpc",
    "websocket", "http", "https", "tcp", "udp", "mqtt",
    
    # Testing
    "unit testing", "integration testing", "e2e testing",
    "pytest", "junit", "selenium", "cypress", "jest",
    "mocha", "chai", "postman", "swagger",
    
    # Mobile Development
    "android", "ios", "react native", "flutter",
    "xamarin", "ionic", "swift ui", "swiftui",
    
    # Other Technologies
    "blockchain", "solidity", "web3", "ethereum",
    "microservices", "serverless", "soa",
    "message queue", "rabbitmq", "kafka", "apache kafka",
    "celery", "airflow", "apache airflow",
    "tableau", "power bi", "looker", "qlik",
    "jira", "confluence", "trello", "asana",
    "figma", "sketch", "adobe xd",
    "agile", "scrum", "kanban", "waterfall",
    "rag", "retrieval augmented generation",
    "vector database", "faiss", "pinecone", "chromadb",
    "weaviate", "milvus", "qdrant",
    "llm", "large language model", "gpt", "bert",
    "chatgpt", "openai", "gemini", "claude",
    "prompt engineering",
}

SOFT_SKILLS = {
    "communication", "leadership", "teamwork", "problem solving",
    "problem-solving", "critical thinking", "time management",
    "project management", "collaboration", "adaptability",
    "creativity", "analytical", "presentation", "negotiation",
    "mentoring", "coaching", "decision making", "strategic thinking",
    "attention to detail", "multitasking", "conflict resolution",
    "stakeholder management", "cross-functional",
}

ALL_SKILLS = TECHNICAL_SKILLS | SOFT_SKILLS


def extract_skills(text: str) -> dict:
    """
    Extract skills from resume text using keyword matching.
    
    Args:
        text: Resume text (raw or processed)
        
    Returns:
        Dictionary with 'technical' and 'soft' skill lists
    """
    text_lower = text.lower()
    
    found_technical = set()
    found_soft = set()
    
    # Check for each skill in the text
    for skill in TECHNICAL_SKILLS:
        # Use word boundary matching for short skills to avoid false positives
        if len(skill) <= 2:
            pattern = r'\b' + re.escape(skill) + r'\b'
            if re.search(pattern, text_lower):
                found_technical.add(skill.upper() if len(skill) <= 3 else skill.title())
        else:
            if skill in text_lower:
                found_technical.add(skill.title())
    
    for skill in SOFT_SKILLS:
        if skill in text_lower:
            found_soft.add(skill.title())
    
    return {
        "technical": sorted(list(found_technical)),
        "soft": sorted(list(found_soft)),
        "all": sorted(list(found_technical | found_soft))
    }


def extract_skills_from_jd(jd_text: str) -> dict:
    """
    Extract required skills from a job description.
    
    Args:
        jd_text: Job description text
        
    Returns:
        Dictionary with 'technical' and 'soft' skill lists
    """
    return extract_skills(jd_text)


def compare_skills(resume_skills: dict, jd_skills: dict) -> dict:
    """
    Compare resume skills against job description skills.
    
    Args:
        resume_skills: Skills extracted from resume
        jd_skills: Skills extracted from job description
        
    Returns:
        Dictionary with matched, missing, and extra skills
    """
    resume_set = set(s.lower() for s in resume_skills.get("all", []))
    jd_set = set(s.lower() for s in jd_skills.get("all", []))
    
    matched = resume_set & jd_set
    missing = jd_set - resume_set
    extra = resume_set - jd_set
    
    return {
        "matched": sorted([s.title() for s in matched]),
        "missing": sorted([s.title() for s in missing]),
        "extra": sorted([s.title() for s in extra]),
        "match_percentage": round(
            (len(matched) / len(jd_set) * 100) if jd_set else 0, 1
        )
    }
