# BC-250 AI Companion

Asistente de IA personal con memoria persistente, soporte multimodal y búsqueda web bajo demanda.

## Requisitos Previos

1. **Ollama** instalado y ejecutándose en `http://localhost:11434`
   - Instalar desde: https://ollama.ai
   - Ejecutar: `ollama serve`

2. **Python 3.8+** instalado

3. **Modelos de IA** (opcionales pero recomendados):
   - Whisper.cpp para STT (voz a texto)
   - Piper TTS para TTS (texto a voz)

## Instalación

```bash
# Navegar al directorio del proyecto
cd bc250-ai-companion

# Crear entorno virtual (recomendado)
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
```

## Uso

### Iniciar el Servidor

```bash
cd backend
python main.py
```

El servidor se iniciará en `http://0.0.0.0:8080`

### Acceder a la Interfaz

Abre tu navegador en: `http://localhost:8080`

### Documentación API

La documentación Swagger está disponible en: `http://localhost:8080/docs`

## Configuración

Las variables de entorno se pueden configurar en `backend/config.py`:

- `BC250_HOST`: Host del servidor (default: 0.0.0.0)
- `BC250_PORT`: Puerto del servidor (default: 8080)
- `DEFAULT_MODEL`: Modelo Ollama por defecto (default: gemma4:e4b)
- `OLLAMA_BASE_URL`: URL de Ollama (default: http://localhost:11434)

## Características

- ✅ Chat con streaming en tiempo real vía WebSocket
- ✅ Memoria persistente por modelo
- ✅ Búsqueda web bajo demanda (/web o "busca en internet")
- ✅ Preferencias de usuario personalizables
- ✅ Soporte para múltiples modelos de Ollama
- ⚠️ STT (voz a texto) - requiere Whisper.cpp
- ⚠️ TTS (texto a voz) - requiere Piper TTS

## Estructura del Proyecto

```
bc250-ai-companion/
├── backend/
│   ├── main.py           # Servidor FastAPI principal
│   ├── config.py         # Configuración centralizada
│   ├── ollama_manager.py # Gestión de modelos Ollama
│   ├── memory_core.py    # Sistema de memoria vectorial
│   ├── stt_engine.py     # Motor de voz a texto
│   ├── tts_engine.py     # Motor de texto a voz
│   └── web_search.py     # Búsqueda web
├── frontend/
│   ├── index.html        # Interfaz principal
│   ├── app.js            # Lógica del cliente
│   └── style.css         # Estilos
├── data/                  # Datos persistentes (auto-creado)
│   ├── vector_db/        # Base de datos vectorial
│   ├── logs/             # Logs del servidor
│   ├── stt_models/       # Modelos STT
│   └── tts_models/       # Modelos TTS
└── requirements.txt      # Dependencias Python
```

## Notas

- Sin Ollama ejecutándose, las funciones de chat no estarán disponibles
- Sin Whisper.cpp, la entrada por voz estará deshabilitada
- Sin Piper TTS, la salida de audio estará deshabilitada
- ChromaDB es opcional; si no está instalado, usa almacenamiento básico
