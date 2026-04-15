#!/bin/bash

# BC-250 AI Companion - Script de inicio
# Verifica requisitos y inicia el servidor

set -e

echo "🚀 BC-250 AI Companion - Iniciando..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar Python
echo "📋 Verificando Python..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 no encontrado${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "${GREEN}✅ Python $PYTHON_VERSION encontrado${NC}"

# Verificar dependencias
echo "📦 Instalando dependencias Python..."
python3 -m pip install -r requirements.txt --quiet || {
    echo -e "${RED}❌ Error al instalar dependencias${NC}"
    exit 1
}
echo -e "${GREEN}✅ Dependencias instaladas${NC}"

# Verificar Ollama
echo "🤖 Verificando Ollama..."
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}⚠️  Ollama no encontrado localmente${NC}"
    echo "   Intenta acceder a: http://localhost:11434"
    echo "   Instalar Ollama: https://ollama.ai"
fi

# Crear directorios necesarios
echo "📁 Creando directorios de datos..."
mkdir -p data/vector_db data/tts_models data/stt_models data/profiles data/personalities data/logs
echo -e "${GREEN}✅ Directorios creados${NC}"

# Iniciar servidor
echo "🌐 Iniciando servidor en 0.0.0.0:8080..."
echo -e "${GREEN}URL: http://localhost:8080${NC}"
echo -e "${GREEN}API Docs: http://localhost:8080/docs${NC}"

cd backend
python3 main.py
