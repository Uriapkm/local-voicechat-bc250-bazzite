#!/bin/bash
# ==========================================
# SCRIPT ÚNICO DE INICIO RÁPIDO (BAZZITE/HANDHELDS)
# ==========================================
# Este script NO requiere Python instalado en el host.
# Funciona como instalador y lanzador en uno solo.
# Optimizado para BC250 y dispositivos handheld.
# ==========================================

set -e  # Salir en caso de error crítico

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Modelo base por defecto (optimizado para handhelds)
DEFAULT_MODEL="fredrezones55/Gemma-4-Uncensored-HauhauCS-Aggressive:e4b"

# Función para imprimir mensajes
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# Función para manejar errores
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo ""
        log_error "Operación falló con código $exit_code"
        log_info "Para reintentar: ./run.sh"
        log_info "Para usar otro modelo: ./run.sh --model nombre-del-modelo"
        log_info "Para ayuda: ./run.sh --help"
    fi
    exit $exit_code
}

trap cleanup EXIT

# Mostrar ayuda
show_help() {
    cat << EOF
${CYAN}Uso:${NC} ./run.sh [OPCIONES]

${CYAN}Opciones:${NC}
  --model NOMBRE       Especificar modelo de Ollama a usar
  --interactive, -i    Modo interactivo para seleccionar modelo
  --reinstall          Reinstalar desde cero (elimina contenedor existente)
  --no-ollama          No instalar/usar Ollama
  --help, -h           Mostrar esta ayuda

${CYAN}Ejemplos:${NC}
  ./run.sh                           # Usa el modelo base por defecto
  ./run.sh --model llama3.2          # Usa un modelo específico
  ./run.sh -i                        # Modo interactivo para elegir modelo
  ./run.sh --reinstall               # Reinstala todo desde cero

${CYAN}Modelo base por defecto:${NC} $DEFAULT_MODEL

${CYAN}Notas:${NC}
  - No requiere Python instalado en el host
  - Optimizado para BC250 y handhelds
  - Todo se instala en el contenedor Distrobox
EOF
}

# Modo interactivo para seleccionar modelo
interactive_model_selection() {
    echo ""
    log_step "Selección de modelo de IA"
    echo "================================"
    echo ""
    echo "Selecciona una opción:"
    echo "  1) Usar modelo base recomendado ($DEFAULT_MODEL)"
    echo "  2) Usar modelo popular (llama3.2)"
    echo "  3) Usar modelo ligero (phi3:mini)"
    echo "  4) Especificar modelo personalizado"
    echo "  5) Sin Ollama (solo aplicación)"
    echo ""
    
    while true; do
        read -p "Opción [1-5]: " choice
        case $choice in
            1)
                SELECTED_MODEL="$DEFAULT_MODEL"
                INSTALL_OLLAMA="true"
                log_info "Usando modelo base: $SELECTED_MODEL"
                break
                ;;
            2)
                SELECTED_MODEL="llama3.2"
                INSTALL_OLLAMA="true"
                log_info "Usando modelo popular: $SELECTED_MODEL"
                break
                ;;
            3)
                SELECTED_MODEL="phi3:mini"
                INSTALL_OLLAMA="true"
                log_info "Usando modelo ligero: $SELECTED_MODEL (ideal para handhelds)"
                break
                ;;
            4)
                read -p "Nombre del modelo: " custom_model
                if [ -n "$custom_model" ]; then
                    SELECTED_MODEL="$custom_model"
                    INSTALL_OLLAMA="true"
                    log_info "Usando modelo personalizado: $SELECTED_MODEL"
                else
                    log_warn "Nombre vacío, usando modelo base"
                    SELECTED_MODEL="$DEFAULT_MODEL"
                    INSTALL_OLLAMA="true"
                fi
                break
                ;;
            5)
                SELECTED_MODEL=""
                INSTALL_OLLAMA="false"
                log_info "Ollama deshabilitado"
                break
                ;;
            *)
                log_warn "Opción inválida. Elige 1-5"
                ;;
        esac
    done
}

# Parsear argumentos
INTERACTIVE_MODE=false
REINSTALL=false
CUSTOM_MODEL=""
NO_OLLAMA=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --model)
            CUSTOM_MODEL="$2"
            shift 2
            ;;
        --interactive|-i)
            INTERACTIVE_MODE=true
            shift
            ;;
        --reinstall)
            REINSTALL=true
            shift
            ;;
        --no-ollama)
            NO_OLLAMA=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            log_error "Opción desconocida: $1"
            show_help
            exit 1
            ;;
    esac
done

# Determinar configuración final
if [ "$NO_OLLAMA" = "true" ]; then
    SELECTED_MODEL=""
    INSTALL_OLLAMA="false"
elif [ -n "$CUSTOM_MODEL" ]; then
    SELECTED_MODEL="$CUSTOM_MODEL"
    INSTALL_OLLAMA="true"
elif [ "$INTERACTIVE_MODE" = "true" ]; then
    interactive_model_selection
else
    # Modo automático: usar valores por defecto
    SELECTED_MODEL="$DEFAULT_MODEL"
    INSTALL_OLLAMA="true"
fi

# Verificar que config.ini existe o crearlo
CONFIG_FILE="${CONFIG_FILE:-config.ini}"
if [ ! -f "$CONFIG_FILE" ]; then
    log_info "Generando $CONFIG_FILE con configuración óptima..."
    cat > "$CONFIG_FILE" << EOF
# ==========================================
# CONFIGURACIÓN DEL SISTEMA AI (BAZZITE/DISTROBOX)
# ==========================================
# Generado automáticamente por run.sh
# Edita este archivo para personalizar

[CONTAINER]
# Nombre del contenedor Distrobox
name = ai-assistant-box
# Imagen base (fedora funciona bien en BC250/handhelds)
image = docker.io/library/fedora:latest
# Ruta donde se montará el proyecto dentro del contenedor
mount_path = /home/user/ai-project

[PYTHON]
# Versión de Python a instalar en el contenedor
version = 3.11
# Ruta del entorno virtual dentro del contenedor
venv_path = /home/user/ai-project/venv

[OLLAMA]
# Instalar Ollama automáticamente? (true/false)
install_ollama = $INSTALL_OLLAMA
# Modelos a descargar automáticamente
models = $SELECTED_MODEL

[APP]
# Comando para iniciar tu aplicación Python
start_command = python app.py
# Puerto(s) a exponer si tu app es web
ports = 
EOF
    log_success "$CONFIG_FILE generado"
else
    # Actualizar config.ini con el modelo seleccionado
    log_info "Actualizando configuración con modelo: $SELECTED_MODEL"
    
    # Crear backup
    cp "$CONFIG_FILE" "${CONFIG_FILE}.bak"
    
    # Actualizar install_ollama
    if [ "$INSTALL_OLLAMA" = "true" ]; then
        sed -i "s/^install_ollama = .*/install_ollama = true/" "$CONFIG_FILE"
    else
        sed -i "s/^install_ollama = .*/install_ollama = false/" "$CONFIG_FILE"
    fi
    
    # Actualizar models si hay un modelo seleccionado
    if [ -n "$SELECTED_MODEL" ]; then
        # Usar | como delimitador para evitar problemas con / en nombres de modelo
        sed -i "s|^models = .*|models = $SELECTED_MODEL|" "$CONFIG_FILE"
    fi
    
    log_success "Configuración actualizada"
fi

# Leer configuración actualizada
get_config() {
    local section="$1"
    local key="$2"
    local default="$3"
    local value
    
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

# Leer valores
CONTAINER_NAME=$(get_config "CONTAINER" "name" "ai-assistant-box")
CONTAINER_IMAGE=$(get_config "CONTAINER" "image" "docker.io/library/fedora:latest")
MOUNT_PATH=$(get_config "CONTAINER" "mount_path" "/home/user/ai-project")
PYTHON_VERSION=$(get_config "PYTHON" "version" "3.11")
VENV_PATH=$(get_config "PYTHON" "venv_path" "/home/user/ai-project/venv")
INSTALL_OLLAMA=$(get_config "OLLAMA" "install_ollama" "true")
OLLAMA_MODELS=$(get_config "OLLAMA" "models" "$DEFAULT_MODEL")
APP_START_CMD=$(get_config "APP" "start_command" "python app.py")
APP_PORTS=$(get_config "APP" "ports" "")

echo ""
echo "=========================================="
log_step "Configuración detectada"
echo "=========================================="
echo "Contenedor: $CONTAINER_NAME ($CONTAINER_IMAGE)"
echo "Python: $PYTHON_VERSION"
echo "Ollama: $INSTALL_OLLAMA"
if [ "$INSTALL_OLLAMA" = "true" ] && [ -n "$OLLAMA_MODELS" ]; then
    echo "Modelo(s): $OLLAMA_MODELS"
fi
echo "App: $APP_START_CMD"
[ -n "$APP_PORTS" ] && echo "Puertos: $APP_PORTS"
echo "=========================================="
echo ""

# Verificar dependencias del host
log_step "Verificando dependencias del sistema..."

if ! command -v distrobox &> /dev/null; then
    log_error "distrobox no está instalado"
    echo ""
    log_info "En Bazzite, instala distrobox con:"
    echo "  sudo dnf install distrobox"
    echo ""
    log_info "O usa Docker/Podman directamente"
    exit 1
fi
log_success "distrobox encontrado"

if ! command -v docker &> /dev/null && ! command -v podman &> /dev/null; then
    log_error "Ni docker ni podman están disponibles"
    echo ""
    log_info "En Bazzite asegúrate de tener Docker o Podman configurado"
    exit 1
fi
log_success "Backend de contenedores encontrado"

# Manejar reinstalación
if [ "$REINSTALL" = "true" ]; then
    log_warn "Modo reinstalación: eliminando contenedor existente..."
    if distrobox list --quiet | grep -q "^$CONTAINER_NAME "; then
        distrobox rm -f "$CONTAINER_NAME" || true
        log_success "Contenedor eliminado"
    else
        log_info "No había contenedor existente"
    fi
fi

# Construir opciones de puertos
PORT_OPTIONS=""
if [ -n "$APP_PORTS" ]; then
    for port_mapping in $APP_PORTS; do
        PORT_OPTIONS="$PORT_OPTIONS --port $port_mapping"
    done
fi

# Verificar/crear contenedor
CONTAINER_EXISTS=false
if distrobox list --quiet | grep -q "^$CONTAINER_NAME "; then
    CONTAINER_EXISTS=true
    log_info "Contenedor '$CONTAINER_NAME' ya existe"
fi

if [ "$CONTAINER_EXISTS" = "false" ]; then
    log_step "Creando contenedor Distrobox..."
    
    distrobox create \
        --name "$CONTAINER_NAME" \
        --image "$CONTAINER_IMAGE" \
        --yes \
        $PORT_OPTIONS \
        --additional-flags "--volume $PWD:$MOUNT_PATH"
    
    log_success "Contenedor creado"
    
    # Función para ejecutar comandos dentro del contenedor
    run_in_container() {
        distrobox enter "$CONTAINER_NAME" -- "$@"
    }
    
    # Detectar gestor de paquetes
    log_info "Detectando gestor de paquetes..."
    if [[ "$CONTAINER_IMAGE" == *"fedora"* ]] || [[ "$CONTAINER_IMAGE" == *"alma"* ]] || [[ "$CONTAINER_IMAGE" == *"rocky"* ]]; then
        PKG_MANAGER="dnf install -y"
        PYTHON_PKG="python${PYTHON_VERSION} python${PYTHON_VERSION}-pip python${PYTHON_VERSION}-devel python${PYTHON_VERSION}-tkinter"
    elif [[ "$CONTAINER_IMAGE" == *"ubuntu"* ]] || [[ "$CONTAINER_IMAGE" == *"debian"* ]]; then
        PKG_MANAGER="apt-get install -y"
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
        PKG_MANAGER="dnf install -y"
        PYTHON_PKG="python${PYTHON_VERSION} python${PYTHON_VERSION}-pip python${PYTHON_VERSION}-devel"
    fi
    
    # Instalar Python
    log_step "Instalando Python $PYTHON_VERSION..."
    run_in_container bash -c "$PKG_MANAGER $PYTHON_PKG" || {
        log_error "Falló la instalación de Python"
        log_info "Intenta cambiar la imagen base en config.ini"
        exit 1
    }
    log_success "Python instalado"
    
    # Crear entorno virtual
    log_step "Creando entorno virtual..."
    run_in_container bash -c "python${PYTHON_VERSION} -m venv $VENV_PATH" || {
        log_error "Falló la creación del entorno virtual"
        exit 1
    }
    log_success "Entorno virtual creado"
    
    # Actualizar pip
    log_info "Actualizando pip..."
    run_in_container bash -c "source $VENV_PATH/bin/activate && pip install --upgrade pip" || {
        log_warn "No se pudo actualizar pip"
    }
    
    # Instalar requirements.txt
    if [ -f "requirements.txt" ]; then
        log_step "Instalando dependencias Python..."
        run_in_container bash -c "source $VENV_PATH/bin/activate && pip install -r ${MOUNT_PATH}/requirements.txt" || {
            log_warn "Algunas dependencias no se pudieron instalar"
        }
        log_success "Dependencias instaladas"
    fi
    
    # Instalar Ollama
    if [ "$INSTALL_OLLAMA" = "true" ]; then
        log_step "Instalando Ollama..."
        
        if run_in_container bash -c "command -v ollama &> /dev/null"; then
            log_info "Ollama ya está instalado"
        else
            run_in_container bash -c "curl -fsSL https://ollama.com/install.sh | sh" || {
                log_error "Falló la instalación de Ollama"
                exit 1
            }
            log_success "Ollama instalado"
        fi
        
        # Descargar modelos
        log_step "Descargando modelo: $OLLAMA_MODELS"
        for model in $OLLAMA_MODELS; do
            if [ -n "$model" ]; then
                log_info "Descargando: $model"
                run_in_container bash -c "ollama serve > /dev/null 2>&1 &" || true
                sleep 2
                run_in_container bash -c "ollama pull $model" || {
                    log_warn "No se pudo descargar $model"
                }
            fi
        done
        log_success "Modelos listos"
    fi
    
    # Generar start.sh
    log_step "Generando script de inicio..."
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

if ! distrobox list --quiet | grep -q "^$CONTAINER_NAME "; then
    log_error "El contenedor '$CONTAINER_NAME' no existe"
    log_info "Ejecuta: ./run.sh para instalar"
    exit 1
fi

log_success "Iniciando sistema AI..."

CMD="source $VENV_PATH/bin/activate && $START_CMD"

if [ "$INSTALL_OLLAMA" = "true" ]; then
    CMD="ollama serve > /dev/null 2>&1 & sleep 2 && $CMD"
fi

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
    echo "  • Para iniciar la aplicación: ./run.sh"
    echo "  • O usa directamente: ./start.sh"
    echo "  • Para cambiar modelo: ./run.sh --model nombre-modelo"
    echo "  • Para modo interactivo: ./run.sh -i"
    echo ""
    echo "Para entrar manualmente al contenedor:"
    echo "  distrobox enter $CONTAINER_NAME"
    echo "=========================================="
    echo ""
    
    # Iniciar automáticamente
    log_info "Iniciando aplicación automáticamente..."
    echo ""
else
    # El contenedor ya existe, solo iniciar
    log_success "El contenedor ya está listo"
    echo ""
    log_info "Iniciando aplicación..."
    echo ""
fi

# Iniciar la aplicación
CMD="source $VENV_PATH/bin/activate && $APP_START_CMD"

if [ "$INSTALL_OLLAMA" = "true" ]; then
    CMD="ollama serve > /dev/null 2>&1 & sleep 2 && $CMD"
fi

log_info "Ejecutando: $APP_START_CMD"
distrobox enter "$CONTAINER_NAME" -- bash -c "$CMD"
