"""
Configuración centralizada para BC-250 AI Companion
"""
import os
from pathlib import Path
from dotenv import load_dotenv  # Cargar desde .env

# Cargar variables de entorno desde .env (si existe)
env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    load_dotenv(env_file)

# Directorio base del proyecto
BASE_DIR = Path(__file__).parent.parent

# Configuración del servidor
HOST = os.getenv("BC250_HOST", "0.0.0.0")
PORT = int(os.getenv("BC250_PORT", "8080"))

# Configuración de Ollama
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gemma4:e4b")
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "120"))

# Configuración de memoria vectorial
VECTOR_DB_PATH = BASE_DIR / "data" / "vector_db"
MEMORY_COLLECTION_NAME = "bc250_memory"
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# Configuración de contexto
MAX_CONTEXT_TOKENS = int(os.getenv("MAX_CONTEXT_TOKENS", "8192"))
MEMORY_SUMMARY_INTERVAL = int(os.getenv("MEMORY_SUMMARY_INTERVAL", "10"))  # Resumir cada N interacciones

# Configuración de TTS/STT
TTS_ENABLED = os.getenv("TTS_ENABLED", "true").lower() == "true"
STT_ENABLED = os.getenv("STT_ENABLED", "true").lower() == "true"
TTS_VOICE = os.getenv("TTS_VOICE", "es_ES-davefx-medium")  # Voz en español por defecto

# Configuración de búsqueda web
WEB_SEARCH_ENABLED = os.getenv("WEB_SEARCH_ENABLED", "true").lower() == "true"
WEB_SEARCH_ENGINE = os.getenv("WEB_SEARCH_ENGINE", "duckduckgo")

# CORS - IMPORTANTE: Cambiar en producción
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else ["*"]
# En producción, usar: CORS_ORIGINS = ["https://tudominio.com", "https://app.tudominio.com"]

# Logs
LOG_DIR = BASE_DIR / "data" / "logs"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Crear directorios si no existen
LOG_DIR.mkdir(parents=True, exist_ok=True)
VECTOR_DB_PATH.mkdir(parents=True, exist_ok=True)

# Validaciones
def validate_config():
    """Valida la configuración al inicio"""
    errors = []
    
    if not VECTOR_DB_PATH.exists():
        errors.append(f"Directorio de base de datos vectorial no existe: {VECTOR_DB_PATH}")
    
    if not LOG_DIR.exists():
        errors.append(f"Directorio de logs no existe: {LOG_DIR}")
    
    # Advertencia sobre CORS en producción
    if "*" in CORS_ORIGINS:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning("⚠️  CORS está permitido para todos los orígenes (*). Cambiar en producción.")
    
    if errors:
        raise ValueError("Errores de configuración:\n" + "\n".join(errors))
    
    return True

