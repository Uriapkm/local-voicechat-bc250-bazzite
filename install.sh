#!/bin/bash
# ==========================================
# INSTALADOR DEL SISTEMA AI (BAZZITE/DISTROBOX)
# ==========================================
# Este script NO requiere Python instalado.
# Todo se instala dentro del contenedor Distrobox.
# ==========================================

set -e  # Salir en caso de error crítico

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Función para manejar errores y limpieza
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "La instalación falló con código $exit_code"
        log_error "Revisa los mensajes anteriores para más detalles"
        log_info "Puedes intentar ejecutar de nuevo: ./install.sh"
    fi
    exit $exit_code
}

trap cleanup EXIT

# Verificar que config.ini existe
CONFIG_FILE="${CONFIG_FILE:-config.ini}"
if [ ! -f "$CONFIG_FILE" ]; then
    log_error "No se encontró $CONFIG_FILE"
    log_info "Crea o edita el archivo de configuración antes de continuar"
    exit 1
fi

log_info "Leyendo configuración desde $CONFIG_FILE..."

# Función para leer valores del config (soporta comentarios y espacios)
get_config() {
    local section="$1"
    local key="$2"
    local default="$3"
    local value
    
    # Buscar en la sección correcta
    value=$(awk -v section="$section" -v key="$key" '
        BEGIN { in_section=0 }
        /^\[/ { 
            if ($0 ~ "\\[" section "\\]") { in_section=1 } 
            else { in_section=0 }
        }
        in_section && $0 ~ "^"key"[[:space:]]*=" {
            sub(/^[^=]*=[[:space:]]*/, "")
            print
            exit
        }
    ' "$CONFIG_FILE")
    
    if [ -z "$value" ]; then
        echo "$default"
    else
        echo "$value"
    fi
}

# Leer configuración
CONTAINER_NAME=$(get_config "CONTAINER" "name" "ai-assistant-box")
CONTAINER_IMAGE=$(get_config "CONTAINER" "image" "docker.io/library/fedora:latest")
MOUNT_PATH=$(get_config "CONTAINER" "mount_path" "/home/user/ai-project")

PYTHON_VERSION=$(get_config "PYTHON" "version" "3.11")
VENV_PATH=$(get_config "PYTHON" "venv_path" "/home/user/ai-project/venv")

INSTALL_OLLAMA=$(get_config "OLLAMA" "install_ollama" "true")
OLLAMA_MODELS=$(get_config "OLLAMA" "models" "llama3.2")

APP_START_CMD=$(get_config "APP" "start_command" "python main.py")
APP_PORTS=$(get_config "APP" "ports" "")

log_success "Configuración cargada correctamente"
echo ""
echo "=== Configuración detectada ==="
echo "Contenedor: $CONTAINER_NAME ($CONTAINER_IMAGE)"
echo "Python: $PYTHON_VERSION en $VENV_PATH"
echo "Ollama: $INSTALL_OLLAMA (modelos: $OLLAMA_MODELS)"
echo "App: $APP_START_CMD"
[ -n "$APP_PORTS" ] && echo "Puertos: $APP_PORTS"
echo "==============================="
echo ""

# Verificar dependencias del host
log_info "Verificando dependencias del sistema..."

if ! command -v distrobox &> /dev/null; then
    log_error "distrobox no está instalado"
    log_info "En Bazzite, instálalo con:"
    log_info "  distrobox upgrade --force  # Si es necesario"
    log_info "O verifica que flatpak com.docker.docker esté disponible"
    exit 1
fi
log_success "distrobox encontrado"

if ! command -v docker &> /dev/null && ! command -v podman &> /dev/null; then
    log_error "Ni docker ni podman están disponibles"
    log_info "En Bazzite asegúrate de tener Docker o Podman configurado"
    exit 1
fi
log_success "Backend de contenedores encontrado"

# Construir opciones de puertos
PORT_OPTIONS=""
if [ -n "$APP_PORTS" ]; then
    for port_mapping in $APP_PORTS; do
        PORT_OPTIONS="$PORT_OPTIONS --port $port_mapping"
    done
fi

# Crear contenedor Distrobox si no existe
log_info "Verificando contenedor '$CONTAINER_NAME'..."

if distrobox list --quiet | grep -q "^$CONTAINER_NAME "; then
    log_warn "El contenedor '$CONTAINER_NAME' ya existe"
    read -p "¿Quieres eliminarlo y crear uno nuevo? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        log_info "Eliminando contenedor existente..."
        distrobox rm -f "$CONTAINER_NAME" || true
    else
        log_info "Usando contenedor existente"
    fi
fi

# Crear el contenedor
if ! distrobox list --quiet | grep -q "^$CONTAINER_NAME "; then
    log_info "Creando contenedor Distrobox '$CONTAINER_NAME'..."
    
    distrobox create \
        --name "$CONTAINER_NAME" \
        --image "$CONTAINER_IMAGE" \
        --yes \
        $PORT_OPTIONS \
        --additional-flags "--volume $PWD:$MOUNT_PATH"
    
    log_success "Contenedor creado exitosamente"
else
    log_success "Contenedor ya está disponible"
fi

# Función para ejecutar comandos dentro del contenedor
run_in_container() {
    distrobox enter "$CONTAINER_NAME" -- "$@"
}

# Instalar Python y dependencias dentro del contenedor
log_info "Instalando Python $PYTHON_VERSION y herramientas en el contenedor..."

# Detectar gestor de paquetes según la imagen
if [[ "$CONTAINER_IMAGE" == *"fedora"* ]] || [[ "$CONTAINER_IMAGE" == *"alma"* ]] || [[ "$CONTAINER_IMAGE" == *"rocky"* ]]; then
    PKG_MANAGER="dnf install -y"
    PYTHON_PKG="python${PYTHON_VERSION} python${PYTHON_VERSION}-pip python${PYTHON_VERSION}-devel python${PYTHON_VERSION}-tkinter"
elif [[ "$CONTAINER_IMAGE" == *"ubuntu"* ]] || [[ "$CONTAINER_IMAGE" == *"debian"* ]]; then
    PKG_MANAGER="apt-get install -y"
    # En Debian/Ubuntu primero hay que actualizar y añadir repo si es necesario
    run_in_container bash -c "apt-get update -qq" || true
    if [ "$PYTHON_VERSION" == "3.11" ] || [ "$PYTHON_VERSION" == "3.12" ]; then
        run_in_container bash -c "apt-get install -y software-properties-common || apt-get install -y python3-launchpadlib" || true
        run_in_container bash -c "add-apt-repository -y ppa:deadsnakes/ppa || true" || true
        run_in_container bash -c "apt-get update -qq" || true
    fi
    PYTHON_PKG="python${PYTHON_VERSION} python${PYTHON_VERSION}-venv python${PYTHON_VERSION}-dev python${PYTHON_VERSION}-tk"
elif [[ "$CONTAINER_IMAGE" == *"arch"* ]] || [[ "$CONTAINER_IMAGE" == *"manjaro"* ]]; then
    PKG_MANAGER="pacman -S --noconfirm"
    PYTHON_PKG="python${PYTHON_VERSION} python-pip python-virtualenv"
else
    # Por defecto intentar con dnf
    PKG_MANAGER="dnf install -y"
    PYTHON_PKG="python${PYTHON_VERSION} python${PYTHON_VERSION}-pip python${PYTHON_VERSION}-devel"
fi

# Instalar paquetes
run_in_container bash -c "$PKG_MANAGER $PYTHON_PKG" || {
    log_error "Falló la instalación de Python"
    log_info "Intenta cambiar la imagen base en config.ini"
    exit 1
}

log_success "Python instalado correctamente"

# Crear entorno virtual
log_info "Creando entorno virtual en $VENV_PATH..."

run_in_container bash -c "python${PYTHON_VERSION} -m venv $VENV_PATH" || {
    log_error "Falló la creación del entorno virtual"
    exit 1
}

log_success "Entorno virtual creado"

# Actualizar pip en el venv
log_info "Actualizando pip en el entorno virtual..."
run_in_container bash -c "source $VENV_PATH/bin/activate && pip install --upgrade pip" || {
    log_warn "No se pudo actualizar pip, continuando..."
}

# Instalar Ollama si está habilitado
if [ "$INSTALL_OLLAMA" = "true" ]; then
    log_info "Instalando Ollama en el contenedor..."
    
    # Verificar si ya está instalado
    if run_in_container bash -c "command -v ollama &> /dev/null"; then
        log_warn "Ollama ya está instalado en el contenedor"
    else
        # Instalar Ollama
        run_in_container bash -c "curl -fsSL https://ollama.com/install.sh | sh" || {
            log_error "Falló la instalación de Ollama"
            exit 1
        }
        log_success "Ollama instalado"
    fi
    
    # Descargar modelos
    log_info "Descargando modelos: $OLLAMA_MODELS"
    for model in $OLLAMA_MODELS; do
        if [ -n "$model" ]; then
            log_info "Descargando modelo: $model"
            # Iniciar ollama serve en background y descargar
            run_in_container bash -c "ollama serve > /dev/null 2>&1 &" || true
            sleep 2
            run_in_container bash -c "ollama pull $model" || {
                log_warn "No se pudo descargar el modelo $model"
            }
        fi
    done
    log_success "Modelos de Ollama listos"
else
    log_info "Instalación de Ollama saltada (install_ollama = false)"
fi

# Crear archivo de inicio rápido
log_info "Generando script de inicio..."

cat > start.sh << 'STARTSCRIPT'
#!/bin/bash
# ==========================================
# INICIADOR DEL SISTEMA AI
# ==========================================

set -e

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
START_CMD=$(get_config "APP" "start_command" "python main.py")
INSTALL_OLLAMA=$(get_config "OLLAMA" "install_ollama" "true")

# Verificar contenedor
if ! distrobox list --quiet | grep -q "^$CONTAINER_NAME "; then
    log_error "El contenedor '$CONTAINER_NAME' no existe"
    log_info "Ejecuta primero: ./install.sh"
    exit 1
fi

log_success "Iniciando sistema AI en contenedor '$CONTAINER_NAME'..."

# Construir comando
CMD="source $VENV_PATH/bin/activate && $START_CMD"

# Si necesita Ollama, iniciarlo
if [ "$INSTALL_OLLAMA" = "true" ]; then
    CMD="ollama serve > /dev/null 2>&1 & sleep 2 && $CMD"
fi

# Ejecutar en el contenedor
log_info "Ejecutando: $START_CMD"
distrobox enter "$CONTAINER_NAME" -- bash -c "$CMD"
STARTSCRIPT

chmod +x start.sh
log_success "Script start.sh generado"

# Crear requirements.txt de ejemplo si no existe
if [ ! -f "requirements.txt" ]; then
    cat > requirements.txt << 'REQEOF'
# Librerías Python para tu proyecto AI
# Edita este archivo según necesites
# requests
# openai
# langchain
# etc.
REQEOF
    log_info "Archivo requirements.txt de ejemplo creado"
fi

echo ""
echo "=========================================="
log_success "¡INSTALACIÓN COMPLETADA!"
echo "=========================================="
echo ""
echo "Próximos pasos:"
echo "  1. (Opcional) Edita requirements.txt y añade tus librerías"
echo "  2. Instala librerías ejecutando:"
echo "     ./install-libs.sh  (si lo creas) o manualmente en el contenedor"
echo "  3. Para iniciar tu aplicación:"
echo "     ./start.sh"
echo ""
echo "Para entrar manualmente al contenedor:"
echo "  distrobox enter $CONTAINER_NAME"
echo ""
echo "Dentro del contenedor, activa el venv con:"
echo "  source $VENV_PATH/bin/activate"
echo "=========================================="
