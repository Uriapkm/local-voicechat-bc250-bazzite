# BC-250 AI Companion - Dockerfile optimizado
# Usa Python 3.11 slim para menor tamaño

FROM python:3.11-slim

# Metadatos
LABEL maintaining="BC-250 AI Community"
LABEL description="Compañero de IA Personal para AMD BC-250 / Bazzite"
LABEL version="1.0.0"

# Configurar variables de entorno
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    BC250_HOST=0.0.0.0 \
    BC250_PORT=8080

# Instalar dependencias del sistema (mínimas)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar requirements primero (para mejor caching)
COPY requirements.txt .
RUN pip install --upgrade pip setuptools && \
    pip install -r requirements.txt

# Copiar todo el código
COPY . .

# Crear directorios de datos
RUN mkdir -p data/vector_db data/tts_models data/stt_models \
    data/profiles data/personalities data/logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Exponer puerto
EXPOSE 8080

# Volúmenes para persistencia
VOLUME ["/app/data"]

# Comando de inicio
CMD ["python3", "backend/main.py"]
