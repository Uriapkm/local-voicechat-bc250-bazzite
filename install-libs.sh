#!/bin/bash
# ==========================================
# INSTALADOR DE LIBRERÍAS PYTHON
# ==========================================
# Instala las librerías de requirements.txt en el venv del contenedor
# ==========================================

CONFIG_FILE="${CONFIG_FILE:-config.ini}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Leer configuración
get_config() {
    local section="$1"
    local key="$2"
    local default="$3"
    awk -v section="$section" -v key="$key" '
        BEGIN { in_section=0 }
        /^\[/ { if ($0 ~ "\\[" section "\\]") { in_section=1 } else { in_section=0 } }
        in_section && $0 ~ "^"key"[[:space:]]*=" { sub(/^[^=]*=[[:space:]]*/, ""); print; exit }
    ' "$CONFIG_FILE"
}

CONTAINER_NAME=$(get_config "CONTAINER" "name" "ai-assistant-box")
VENV_PATH=$(get_config "PYTHON" "venv_path" "/home/user/ai-project/venv")

# Verificar requirements.txt
if [ ! -f "requirements.txt" ]; then
    log_error "No se encontró requirements.txt"
    log_info "Crea el archivo con las librerías que necesitas instalar"
    exit 1
fi

# Verificar contenedor
if ! distrobox list --quiet | grep -q "^$CONTAINER_NAME "; then
    log_error "El contenedor '$CONTAINER_NAME' no existe"
    log_info "Ejecuta primero: ./install.sh"
    exit 1
fi

log_info "Instalando librerías en el contenedor '$CONTAINER_NAME'..."

# Instalar desde requirements.txt
distrobox enter "$CONTAINER_NAME" -- bash -c "source $VENV_PATH/bin/activate && pip install -r /home/user/ai-project/requirements.txt"

if [ $? -eq 0 ]; then
    log_success "Librerías instaladas correctamente"
else
    log_error "Falló la instalación de librerías"
    exit 1
fi
