#!/bin/bash
# BC-250 AI Companion - Script de Instalación Inteligente
# Verifica dependencias, configura el entorno e instala el proyecto

set -e  # Salir en caso de error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables globales
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OLLAMA_REQUIRED=true
DEFAULT_MODEL="gemma4:e4b"
CONTAINER_NAME="bc250-ai-companion"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     BC-250 AI Companion - Instalador Automático        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Función para imprimir mensajes
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Función para verificar si un comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Paso 1: Verificar sistema operativo
print_info "Paso 1/8: Verificando sistema operativo..."
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$NAME" == *"Bazzite"* ]] || [[ "$NAME" == *"Fedora"* ]]; then
        print_success "Sistema operativo compatible detectado: $NAME"
    else
        print_warning "Sistema operativo no verificado: $NAME"
        print_info "El proyecto está optimizado para Bazzite OS, pero puede funcionar en otras distribuciones Fedora-based"
        read -p "¿Continuar de todos modos? (y/n): " continue_install
        if [[ ! "$continue_install" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    print_error "No se pudo detectar el sistema operativo"
    exit 1
fi

# Paso 2: Verificar Ollama
print_info "Paso 2/8: Verificando instalación de Ollama..."
if command_exists ollama; then
    OLLAMA_VERSION=$(ollama --version)
    print_success "Ollama instalado: $OLLAMA_VERSION"
    
    # Verificar si el servicio está corriendo
    if systemctl is-active --quiet ollama 2>/dev/null || pgrep -x "ollama" >/dev/null 2>&1; then
        print_success "Servicio de Ollama está corriendo"
    else
        print_warning "Servicio de Ollama no está corriendo"
        print_info "Intentando iniciar el servicio..."
        if command_exists systemctl; then
            sudo systemctl start ollama 2>/dev/null || print_warning "No se pudo iniciar el servicio automáticamente"
        fi
    fi
else
    print_error "Ollama no está instalado"
    print_info "Instalando Ollama..."
    
    # Intentar instalar Ollama
    curl -fsSL https://ollama.ai/install.sh | sh
    
    if command_exists ollama; then
        print_success "Ollama instalado correctamente"
        print_info "Iniciando servicio de Ollama..."
        sudo systemctl start ollama
        sudo systemctl enable ollama
        print_success "Servicio de Ollama configurado"
    else
        print_error "No se pudo instalar Ollama automáticamente"
        print_info "Por favor, instala Ollama manualmente visitando: https://ollama.ai"
        exit 1
    fi
fi

# Paso 3: Verificar modelos instalados
print_info "Paso 3/8: Verificando modelos instalados..."
INSTALLED_MODELS=$(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}')

if echo "$INSTALLED_MODELS" | grep -q "^${DEFAULT_MODEL}$"; then
    print_success "Modelo base '$DEFAULT_MODEL' ya está instalado"
else
    print_warning "Modelo base '$DEFAULT_MODEL' no está instalado"
    echo ""
    echo "Modelos disponibles instalados:"
    if [ -z "$INSTALLED_MODELS" ]; then
        echo "  (ninguno)"
    else
        echo "$INSTALLED_MODELS" | sed 's/^/  /'
    fi
    echo ""
    read -p "¿Quieres descargar '$DEFAULT_MODEL' ahora? (recomendado) (y/n): " download_model
    
    if [[ "$download_model" =~ ^[Yy]$ ]]; then
        print_info "Descargando modelo '$DEFAULT_MODEL'... (esto puede tardar varios minutos)"
        ollama pull $DEFAULT_MODEL
        print_success "Modelo '$DEFAULT_MODEL' descargado correctamente"
    else
        print_warning "Continuando sin el modelo base. Deberás descargar uno manualmente después."
    fi
fi

# Paso 4: Verificar hardware y configuración de VRAM
print_info "Paso 4/8: Verificando configuración de hardware..."
if [ -d /sys/kernel/debug/dri ]; then
    print_success "Drivers de GPU detectados"
    
    # Verificar memoria disponible (si es posible)
    if command_exists glxinfo; then
        VRAM_INFO=$(glxinfo | grep "Video memory" 2>/dev/null || true)
        if [ -n "$VRAM_INFO" ]; then
            print_info "Memoria de video detectada: $VRAM_INFO"
        fi
    else
        print_warning "Herramienta glxinfo no disponible. Saltando verificación detallada de VRAM."
    fi
else
    print_warning "No se pudo acceder a información de la GPU"
fi

# Paso 5: Configurar contenedor Distrobox (recomendado para Bazzite)
print_info "Paso 5/8: Configurando entorno aislado..."
USE_CONTAINER=false

if command_exists distrobox; then
    print_success "Distrobox está instalado"
    
    if distrobox list 2>/dev/null | grep -q "$CONTAINER_NAME"; then
        print_success "Contenedor '$CONTAINER_NAME' ya existe"
        USE_CONTAINER=true
    else
        echo ""
        print_info "Se recomienda usar un contenedor Distrobox para mantener el sistema base limpio"
        read -p "¿Crear contenedor Distrobox? (recomendado para Bazzite) (y/n): " create_container
        
        if [[ "$create_container" =~ ^[Yy]$ ]]; then
            print_info "Creando contenedor Distrobox basado en Fedora..."
            distrobox create --name $CONTAINER_NAME --image fedora:latest --yes
            
            if [ $? -eq 0 ]; then
                print_success "Contenedor creado exitosamente"
                USE_CONTAINER=true
                
                # Instalar dependencias dentro del contenedor
                print_info "Instalando dependencias en el contenedor..."
                distrobox enter $CONTAINER_NAME -- \
                    bash -c "sudo dnf install -y python3 python3-pip python3-devel gcc make"
                
                print_success "Dependencias instaladas en el contenedor"
            else
                print_error "No se pudo crear el contenedor"
                print_info "Continuando sin contenedor..."
            fi
        fi
    fi
else
    print_warning "Distrobox no está instalado"
    print_info "En Bazzite, puedes instalarlo con: rpm-ostree install distrobox"
    print_info "Continuando sin contenedor..."
fi

# Paso 6: Instalar dependencias de Python
print_info "Paso 6/8: Instalando dependencias de Python..."

# Crear archivo requirements.txt si no existe
REQUIREMENTS_FILE="$PROJECT_DIR/container/requirements.txt"
if [ ! -f "$REQUIREMENTS_FILE" ]; then
    print_info "Creando archivo de requisitos..."
    cat > "$REQUIREMENTS_FILE" << EOF
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
websockets>=12.0
httpx>=0.26.0
chromadb>=0.4.22
openai>=1.10.0
pydantic>=2.5.0
python-multipart>=0.0.6
EOF
    print_success "Archivo requirements.txt creado"
fi

# Instalar dependencias
if [ "$USE_CONTAINER" = true ]; then
    print_info "Instalando dependencias en el contenedor..."
    distrobox enter $CONTAINER_NAME -- \
        bash -c "pip3 install --user -r $REQUIREMENTS_FILE"
    print_success "Dependencias instaladas en el contenedor"
else
    print_info "Instalando dependencias localmente..."
    if command_exists pip3; then
        pip3 install -r "$REQUIREMENTS_FILE" --user
        print_success "Dependencias instaladas localmente"
    else
        print_error "pip3 no está disponible"
        print_info "Por favor, instala Python 3 y pip antes de continuar"
        exit 1
    fi
fi

# Paso 7: Configurar directorios de datos
print_info "Paso 7/8: Configurando directorios de datos..."
DATA_DIRS=(
    "$PROJECT_DIR/data/vector_db"
    "$PROJECT_DIR/data/models_cache"
    "$PROJECT_DIR/data/logs"
)

for dir in "${DATA_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        print_info "Directorio creado: $dir"
    fi
done
print_success "Directorios de datos configurados"

# Paso 8: Crear script de inicio rápido
print_info "Paso 8/8: Creando scripts de utilidad..."

# Crear script de inicio
START_SCRIPT="$PROJECT_DIR/scripts/start.sh"
cat > "$START_SCRIPT" << 'EOF'
#!/bin/bash
# Script de inicio rápido para BC-250 AI Companion

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Verificar si usar contenedor
if command_exists distrobox && distrobox list 2>/dev/null | grep -q "bc250-ai-companion"; then
    echo "Iniciando en contenedor Distrobox..."
    distrobox enter bc250-ai-companion -- \
        bash -c "cd $PROJECT_DIR && python3 backend/main.py"
else
    echo "Iniciando localmente..."
    python3 backend/main.py
fi
EOF

chmod +x "$START_SCRIPT"
print_success "Script de inicio creado: $START_SCRIPT"

# Crear script de backup
BACKUP_SCRIPT="$PROJECT_DIR/scripts/backup_memory.sh"
cat > "$BACKUP_SCRIPT" << 'EOF'
#!/bin/bash
# Script de backup de memoria

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$HOME/bc250-backups/$(date +%Y%m%d_%H%M%S)"

echo "Creando backup de memoria en: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Copiar base de datos vectorial
if [ -d "$PROJECT_DIR/data/vector_db" ]; then
    cp -r "$PROJECT_DIR/data/vector_db" "$BACKUP_DIR/"
    echo "✓ Base de datos vectorial respaldada"
fi

# Copiar configuraciones
if [ -f "$PROJECT_DIR/backend/config.py" ]; then
    cp "$PROJECT_DIR/backend/config.py" "$BACKUP_DIR/"
    echo "✓ Configuración respaldada"
fi

echo "Backup completado exitosamente"
echo "Para restaurar: cp -r $BACKUP_DIR/* $PROJECT_DIR/data/"
EOF

chmod +x "$BACKUP_SCRIPT"
print_success "Script de backup creado: $BACKUP_SCRIPT"

# Resumen final
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ¡Instalación Completada Exitosamente!        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Resumen:${NC}"
echo "  • Ollama: $(command -v ollama >/dev/null 2>&1 && echo 'Instalado ✓' || echo 'No instalado ✗')"
echo "  • Modelo base: $(ollama list 2>/dev/null | grep -q "$DEFAULT_MODEL" && echo '$DEFAULT_MODEL instalado ✓' || echo 'No instalado')"
echo "  • Contenedor: $( [ "$USE_CONTAINER" = true ] && echo 'Configurado ✓' || echo 'No usado')"
echo "  • Directorios: Configurados ✓"
echo ""
echo -e "${BLUE}Próximos pasos:${NC}"
echo "  1. Revisa la documentación en: $PROJECT_DIR/docs/"
echo "  2. Para iniciar el servidor: $START_SCRIPT"
echo "  3. Accede desde tu navegador: http://localhost:8080"
echo ""
if [ ! -f "$PROJECT_DIR/backend/main.py" ]; then
    echo -e "${YELLOW}Nota:${NC} El backend aún no ha sido implementado. Completa el desarrollo siguiendo el ROADMAP.md"
fi
echo ""
print_success "¡Gracias por usar BC-250 AI Companion!"
