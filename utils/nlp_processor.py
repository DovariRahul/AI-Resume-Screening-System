"""
NLP Processor Module
Handles text preprocessing: cleaning, tokenization, stopword removal,
and lemmatization for resume and job description text.
"""

import re
import string
import nltk

# Download required NLTK data (run once)
try:
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    nltk.download('punkt_tab', quiet=True)

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)

try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('wordnet', quiet=True)

from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer


# Initialize NLP components
STOP_WORDS = set(stopwords.words('english'))
LEMMATIZER = WordNetLemmatizer()

# Technical terms that should NOT be removed even if they are stopwords
PRESERVE_TERMS = {
    'r', 'c', 'go', 'rust', 'dart', 'swift', 'ruby', 'julia',
    'no', 'not', 'nor', 'can', 'will', 'do', 'has', 'have',
}


def clean_text(text: str) -> str:
    """
    Clean raw text by removing unwanted characters and normalizing whitespace.
    
    Args:
        text: Raw text string
        
    Returns:
        Cleaned text string
    """
    # Convert to lowercase
    text = text.lower()
    
    # Remove URLs
    text = re.sub(r'http[s]?://\S+', '', text)
    text = re.sub(r'www\.\S+', '', text)
    
    # Remove email addresses
    text = re.sub(r'\S+@\S+', '', text)
    
    # Remove phone numbers
    text = re.sub(r'[\+]?[\d\s\-\(\)]{10,}', ' ', text)
    
    # Keep alphanumeric, spaces, and some special chars used in tech (++, #, .)
    text = re.sub(r'[^\w\s\+\#\.]', ' ', text)
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text


def tokenize_text(text: str) -> list:
    """
    Tokenize text into words.
    
    Args:
        text: Cleaned text string
        
    Returns:
        List of tokens
    """
    return word_tokenize(text)


def remove_stopwords(tokens: list) -> list:
    """
    Remove stopwords from token list while preserving technical terms.
    
    Args:
        tokens: List of word tokens
        
    Returns:
        Filtered list of tokens
    """
    return [
        token for token in tokens
        if token not in STOP_WORDS or token in PRESERVE_TERMS
    ]


def lemmatize_tokens(tokens: list) -> list:
    """
    Lemmatize tokens to their base form.
    
    Args:
        tokens: List of word tokens
        
    Returns:
        List of lemmatized tokens
    """
    return [LEMMATIZER.lemmatize(token) for token in tokens]


def process_text(text: str) -> str:
    """
    Full NLP pipeline: clean → tokenize → remove stopwords → lemmatize.
    
    Args:
        text: Raw text string
        
    Returns:
        Processed text as a single string
    """
    cleaned = clean_text(text)
    tokens = tokenize_text(cleaned)
    filtered = remove_stopwords(tokens)
    lemmatized = lemmatize_tokens(filtered)
    return " ".join(lemmatized)


def get_processed_tokens(text: str) -> list:
    """
    Full NLP pipeline returning tokens instead of joined string.
    
    Args:
        text: Raw text string
        
    Returns:
        List of processed tokens
    """
    cleaned = clean_text(text)
    tokens = tokenize_text(cleaned)
    filtered = remove_stopwords(tokens)
    lemmatized = lemmatize_tokens(filtered)
    return lemmatized
