#!/bin/bash
# ==========================================
# INSTALADOR DEL SISTEMA AI (BAZZITE/DISTROBOX)
# ==========================================
# Este script NO requiere Python instalado en el host.
# Todo se instala dentro del contenedor Distrobox.
# ==========================================

set -e  # Salir en caso de error crítico

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuración de reintentos para health check
OLLAMA_MAX_RETRIES=30
OLLAMA_RETRY_DELAY=2

# Función para imprimir mensajes
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

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

# Detectar backend de contenedores (podman o docker)
# Prioriza podman en Bazzite, pero funciona con ambos
detect_container_backend() {
    if command -v podman &> /dev/null; then
        CONTAINER_BACKEND="podman"
        log_success "Backend detectado: podman"
    elif command -v docker &> /dev/null; then
        CONTAINER_BACKEND="docker"
        log_success "Backend detectado: docker"
    else
        log_error "Ni docker ni podman están disponibles"
        log_info "En Bazzite asegúrate de tener Docker o Podman configurado"
        exit 1
    fi
}

# Health check para esperar que Ollama esté listo
wait_for_ollama() {
    local container_name="$1"
    local max_retries="${2:-$OLLAMA_MAX_RETRIES}"
    local retry_delay="${3:-$OLLAMA_RETRY_DELAY}"
    local retry_count=0
    
    log_info "Esperando a que Ollama esté disponible..."
    
    while [ $retry_count -lt $max_retries ]; do
        # Intentar conectar con Ollama dentro del contenedor
        if distrobox enter "$container_name" -- curl -s http://localhost:11434/api/tags &> /dev/null; then
            log_success "Ollama está listo"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        log_info "Intento $retry_count/$max_retries... esperando ${retry_delay}s"
        sleep "$retry_delay"
    done
    
    log_error "Ollama no respondió después de $((max_retries * retry_delay)) segundos"
    return 1
}

# Función para limpiar contenedor existente de forma completa
cleanup_container() {
    local container_name="$1"
    
    log_warn "Limpiando contenedor existente: $container_name"
    
    # Detener y eliminar contenedor si existe
    if distrobox list --quiet | grep -q "^$container_name "; then
        distrobox rm -f "$container_name" 2>/dev/null || true
        log_success "Contenedor eliminado"
    else
        log_info "No había contenedor existente para eliminar"
    fi
    
    # También intentar limpiar con el backend directo por si queda algo
    if [ "$CONTAINER_BACKEND" = "podman" ]; then
        podman rm -f "$container_name" 2>/dev/null || true
        podman volume rm "${container_name}-vol" 2>/dev/null || true
    else
        docker rm -f "$container_name" 2>/dev/null || true
        docker volume rm "${container_name}-vol" 2>/dev/null || true
    fi
}

# Verificar que config.ini existe (usando ruta relativa al script)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.ini"
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

APP_START_CMD=$(get_config "APP" "start_command" "cd backend && python3 main.py")
APP_PORTS=$(get_config "APP" "ports" "8080:8080")

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

# Detectar backend de contenedores (podman/docker)
log_step "Detectando backend de contenedores..."
detect_container_backend

# Verificar dependencias del host
log_info "Verificando dependencias del sistema..."

if ! command -v distrobox &> /dev/null; then
    log_error "distrobox no está instalado"
    log_info "En Bazzite, asegúrate de tener distrobox disponible:"
    log_info "  flatpak install flathub com.docker.docker  # Si usas Docker Desktop"
    log_info "  O usa el gestor de paquetes de tu distro"
    exit 1
fi
log_success "distrobox encontrado"

# El backend ya fue detectado arriba, solo confirmamos
log_success "Backend ($CONTAINER_BACKEND) disponible"

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
    
    # Verificar si el contenedor está en estado saludable
    if ! distrobox enter "$CONTAINER_NAME" -- echo "test" &> /dev/null; then
        log_warn "El contenedor existe pero no responde correctamente"
        log_info "Eliminando y recreando..."
        cleanup_container "$CONTAINER_NAME"
    else
        read -p "¿Quieres eliminarlo y crear uno nuevo? (y/N): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            log_info "Eliminando contenedor existente..."
            cleanup_container "$CONTAINER_NAME"
        else
            log_info "Usando contenedor existente"
        fi
    fi
fi

# Crear el contenedor
if ! distrobox list --quiet | grep -q "^$CONTAINER_NAME "; then
    log_info "Creando contenedor Distrobox '$CONTAINER_NAME'..."
    
    # Obtener ruta base del script para usar rutas relativas dinámicas
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    
    # Crear directorios locales para volúmenes (evitar errores de permisos)
    LOCAL_DATA_DIR="$SCRIPT_DIR/data"
    LOCAL_MODELS_DIR="$SCRIPT_DIR/models"
    
    mkdir -p "$LOCAL_DATA_DIR" "$LOCAL_MODELS_DIR" || {
        log_error "No se pudieron crear los directorios locales para volúmenes"
        exit 1
    }
    log_success "Directorios locales creados: $LOCAL_DATA_DIR, $LOCAL_MODELS_DIR"
    
    # Convertir a ruta absoluta para el montaje
    PROJECT_ROOT="$SCRIPT_DIR"
    MOUNT_SOURCE="$PROJECT_ROOT"
    
    # Flags adicionales para mejor compatibilidad en sistemas inmutables como Bazzite
    ADDITIONAL_FLAGS="--volume $MOUNT_SOURCE:$MOUNT_PATH"
    
    # Añadir flags específicos para podman en Bazzite si es necesario
    if [ "$CONTAINER_BACKEND" = "podman" ]; then
        ADDITIONAL_FLAGS="$ADDITIONAL_FLAGS --userns=keep-id"
    fi
    
    distrobox create \
        --name "$CONTAINER_NAME" \
        --image "$CONTAINER_IMAGE" \
        --yes \
        $PORT_OPTIONS \
        --additional-flags "$ADDITIONAL_FLAGS"
    
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
    # Curl es esencial para health checks y descargas
    SYSTEM_TOOLS="curl wget"
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
    SYSTEM_TOOLS="curl wget"
elif [[ "$CONTAINER_IMAGE" == *"arch"* ]] || [[ "$CONTAINER_IMAGE" == *"manjaro"* ]]; then
    PKG_MANAGER="pacman -S --noconfirm"
    PYTHON_PKG="python${PYTHON_VERSION} python-pip python-virtualenv"
    SYSTEM_TOOLS="curl wget"
else
    # Por defecto intentar con dnf
    PKG_MANAGER="dnf install -y"
    PYTHON_PKG="python${PYTHON_VERSION} python${PYTHON_VERSION}-pip python${PYTHON_VERSION}-devel"
    SYSTEM_TOOLS="curl wget"
fi

# Instalar herramientas del sistema primero (curl es crítico para health checks)
log_step "Instalando herramientas del sistema (curl, wget)..."
run_in_container bash -c "$PKG_MANAGER $SYSTEM_TOOLS" || {
    log_warn "No se pudieron instalar herramientas del sistema, algunos checks podrían fallar"
}
log_success "Herramientas instaladas"

# Instalar paquetes Python
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

# Instalar requirements.txt si existe (usando ruta relativa al script)
REQUIREMENTS_FILE="${MOUNT_PATH}/requirements.txt"
if [ -f "$SCRIPT_DIR/requirements.txt" ]; then
    log_info "Instalando dependencias desde requirements.txt..."
    run_in_container bash -c "source $VENV_PATH/bin/activate && pip install -r $REQUIREMENTS_FILE" || {
        log_warn "No se pudieron instalar todas las dependencias"
    }
    log_success "Dependencias de Python instaladas"
else
    log_info "No se encontró requirements.txt en $SCRIPT_DIR, saltando instalación de paquetes Python"
fi

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
    
    # Iniciar Ollama serve y esperar a que esté listo con health check
    log_step "Iniciando servidor Ollama..."
    run_in_container bash -c "ollama serve > /dev/null 2>&1 &" || true
    
    # Health check inteligente: esperar a que Ollama responda antes de descargar
    if ! wait_for_ollama "$CONTAINER_NAME"; then
        log_error "No se pudo iniciar Ollama correctamente"
        exit 1
    fi
    
    # Descargar modelos con verificación
    log_step "Descargando modelo(s): $OLLAMA_MODELS"
    DOWNLOAD_FAILED=false
    for model in $OLLAMA_MODELS; do
        if [ -n "$model" ]; then
            log_info "Descargando: $model"
            
            # Verificar si el modelo ya existe antes de descargar
            if run_in_container bash -c "ollama list | grep -q '$model'"; then
                log_info "El modelo '$model' ya está disponible, saltando descarga"
            else
                run_in_container bash -c "ollama pull $model" || {
                    log_warn "No se pudo descargar $model"
                    DOWNLOAD_FAILED=true
                }
            fi
        fi
    done
    
    if [ "$DOWNLOAD_FAILED" = "true" ]; then
        log_warn "Algunos modelos no se pudieron descargar, pero puedes intentarlo manualmente después"
    fi
    
    # Validación post-instalación: verificar que Ollama funciona
    log_step "Validando instalación de Ollama..."
    if run_in_container bash -c "ollama list | grep -q ."; then
        log_success "Ollama instalado y validado correctamente"
    else
        log_warn "Ollama está instalado pero no hay modelos disponibles"
    fi
    
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
START_CMD=$(get_config "APP" "start_command" "cd backend && python3 main.py")
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

echo ""
echo "=========================================="
log_success "¡INSTALACIÓN COMPLETADA!"
echo "=========================================="
echo ""
echo "Próximos pasos:"
echo "  1. (Opcional) Edita requirements.txt y añade tus librerías"
echo "  2. Para instalar nuevas librerías, ejecuta:"
echo "     ./install-libs.sh"
echo "  3. Para iniciar tu aplicación:"
echo "     ./start.sh"
echo ""
echo "Para entrar manualmente al contenedor:"
echo "  distrobox enter $CONTAINER_NAME"
echo ""
echo "Dentro del contenedor, activa el venv con:"
echo "  source $VENV_PATH/bin/activate"
echo "=========================================="
