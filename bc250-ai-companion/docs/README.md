# BC-250 AI Companion

Un compañero de IA personal, privado y autónomo diseñado para ejecutarse en hardware AMD BC-250 con Bazzite OS.

## Visión
Crear un "electrodoméstico de IA" que funcione 100% en local, con memoria persistente tipo humana, capacidades multimodales (texto, voz, visión) y una interfaz tan simple como encender una radio.

## Características Principales

### 🧠 Inteligencia Local
- **Modelo Base**: Gemma 4:E4B (4.5B parámetros, multimodal nativo)
- **Motor**: Ollama con aceleración por hardware (GPU RDNA 1.5 del BC-250)
- **Memoria Unificada**: Aprovecha los 16GB GDDR6 con 256 GB/s de ancho de banda
- **Offline First**: Funciona sin internet por defecto

### 💾 Memoria Persistente "Humana"
- Única conversación infinita con contexto continuo
- Base de datos vectorial para recordar preferencias e interacciones
- Migración de memoria entre modelos (actualizaciones sin perder personalidad)

### 🎤 Interacción Multimodal
- **Entrada**: Texto + Voz (Push-to-Talk configurable)
- **Salida**: Texto en streaming + Audio TTS local (con interruptor auto-play)
- **Visión**: Análisis de imágenes y documentos (OCR nativo)

### 🔍 Conectividad Híbrida
- Búsqueda web bajo demanda explícita (comandos tipo `/web`)
- Totalmente offline cuando no hay conexión

### 🚀 Instalación Simplificada
- Script automático que verifica Ollama, modelos y dependencias
- Entorno aislado con Distrobox/contenedores para Bazzite
- Configuración mínima requerida

## Estructura del Proyecto

```
bc250-ai-companion/
├── docs/              # Documentación técnica
├── scripts/           # Scripts de instalación y mantenimiento
├── backend/           # API Python/FastAPI
├── frontend/          # Interfaz web PWA
├── data/              # Datos persistentes (memoria, caché)
└── container/         # Configuración de contenedores
```

## Requisitos de Hardware
- AMD BC-250 (APU Cyan Skillfish)
- 16GB RAM unificada GDDR6
- Bazzite OS (Fedora Atomic)
- Ollama instalado

## Inicio Rápido

```bash
# Clonar el repositorio
git clone <url-del-repositorio>
cd bc250-ai-companion

# Ejecutar instalador
./scripts/install.sh

# Iniciar el servicio
sudo systemctl start bc250-ai-companion

# Acceder desde navegador
http://localhost:8080
```

## Estado del Proyecto
🚧 En desarrollo activo

## Licencia
Apache 2.0
