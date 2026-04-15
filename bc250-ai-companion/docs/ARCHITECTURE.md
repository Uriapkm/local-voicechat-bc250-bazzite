# Arquitectura del Sistema BC-250 AI Companion

## Visión General
El sistema está diseñado como una arquitectura cliente-servidor local, donde el backend gestiona la lógica de IA y memoria, y el frontend proporciona una interfaz web minimalista accesible desde cualquier navegador.

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Navegador)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Chat UI   │  │ Control Voz  │  │ Gestor Modelos   │   │
│  │ (HTML/CSS/  │  │ (Web Audio   │  │ & Memoria        │   │
│  │    JS PWA)  │  │  API + STT)  │  │                  │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND (FastAPI + Python)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ API Router  │  │ Ollama       │  │ Memory Core      │   │
│  │             │  │ Manager      │  │ (Vector DB)      │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ STT Engine  │  │ TTS Engine   │  │ Web Search       │   │
│  │ (Whisper)   │  │ (Piper)      │  │ (DuckDuckGo)     │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Local API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CAPAS DE INFRAESTRUCTURA                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Ollama    │  │ Vector DB    │  │ File System      │   │
│  │  (Gemma 4)  │  │ (ChromaDB)   │  │ (Persistencia)   │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
│  Hardware: AMD BC-250 (GPU RDNA 1.5 + 16GB GDDR6 UMA)       │
│  SO: Bazzite OS (Fedora Atomic + Distrobox)                 │
└─────────────────────────────────────────────────────────────┘
```

## Componentes Principales

### 1. Backend (`backend/`)

#### `main.py` - Punto de Entrada
- Servidor FastAPI que expone endpoints REST y WebSocket
- Manejo de CORS para acceso desde el navegador
- Configuración de rutas y middlewares

#### `config.py` - Configuración Centralizada
- Variables de entorno y constantes
- Rutas de datos, puertos, configuración de modelos
- Validación de configuración al inicio

#### `ollama_manager.py` - Gestor de Modelos
- Verificación de instalación de Ollama
- Descarga y gestión de modelos (`gemma4:e4b` por defecto)
- Cambio dinámico entre modelos
- Monitoreo de estado y recursos

#### `memory_core.py` - Sistema de Memoria
- Base de datos vectorial (ChromaDB o similar)
- Almacenamiento de interacciones y preferencias
- Resúmenes automáticos de conversaciones largas
- Funcionalidad de migrar memoria entre modelos
- Recuperación contextual basada en similitud semántica

#### `stt_engine.py` - Speech-to-Text
- Integración con Whisper (local)
- Procesamiento de audio desde el frontend
- Detección de fin de frase para envío automático

#### `tts_engine.py` - Text-to-Speech
- Motor Piper TTS (ligero y local)
- Voces en español e inglés
- Streaming de audio para baja latencia
- Control de activación/desactivación desde frontend

#### `web_search.py` - Búsqueda Web
- Activación solo bajo comando explícito (`/web`)
- Integración con DuckDuckGo o SearXNG
- Formateo de resultados para el modelo
- Sin dependencias de API keys externas

### 2. Frontend (`frontend/`)

#### `index.html` - Estructura Principal
- Layout minimalista de una sola página
- Área de chat principal
- Controles de voz (micrófono y audio)
- Panel de configuración de modelos

#### `style.css` - Estilos
- Diseño responsive y moderno
- Temas claro/oscuro
- Indicadores visuales de estado (grabando, procesando, etc.)
- Animaciones sutiles para feedback

#### `app.js` - Lógica del Cliente
- Comunicación con backend (fetch + WebSocket)
- Gestión de Web Audio API para entrada/salida de voz
- Manejo del estado de la aplicación
- Almacenamiento local de preferencias
- Soporte PWA para instalación como app

### 3. Scripts (`scripts/`)

#### `install.sh` - Instalador Inteligente
- Verifica existencia de Ollama
- Comprueba modelos instalados
- Detecta hardware y configura GTT para VRAM
- Crea contenedor Distrobox si es necesario
- Instala dependencias del backend
- Configura servicio systemd

#### `update_models.sh` - Actualizador de Modelos
- Lista modelos disponibles
- Descarga nuevos modelos bajo demanda
- Migración automática de memoria

#### `backup_memory.sh` - Copias de Seguridad
- Exporta base de datos vectorial
- Permite restaurar memorias

### 4. Datos (`data/`)

#### `vector_db/`
- Archivos de ChromaDB con embeddings
- Metadatos de conversaciones
- Preferencias de usuario

#### `models_cache/`
- Caché de modelos descargados
- Configuraciones específicas por modelo

#### `logs/`
- Logs de aplicación
- Métricas de rendimiento
- Errores y debugging

### 5. Contenedor (`container/`)

#### `Containerfile`
- Definición del entorno aislado para Bazzite
- Basado en Fedora
- Incluye Python, pip, dependencias de audio
- Expone puertos necesarios

#### `requirements.txt`
- FastAPI
- Uvicorn
- ChromaDB
- OpenAI (para compatibilidad con Ollama)
- PyTorch (si es necesario para STT/TTS)
- Requests
- Websockets

## Flujo de Datos

### Conversación Normal
1. Usuario escribe o habla → Frontend captura input
2. Si es voz: STT convierte a texto
3. Frontend envía texto al backend vía POST
4. Backend consulta memoria vectorial para contexto relevante
5. Backend envía prompt + contexto a Ollama
6. Ollama genera respuesta (streaming)
7. Backend envía tokens al frontend vía WebSocket
8. Si audio activado: TTS convierte respuesta a audio
9. Frontend reproduce audio y muestra texto

### Búsqueda Web
1. Usuario escribe `/web [consulta]`
2. Backend detecta comando especial
3. Ejecuta búsqueda en DuckDuckGo
4. Formatea resultados como contexto
5. Envía a Ollama con instrucción de usar información web
6. Continúa flujo normal

### Cambio de Modelo
1. Usuario selecciona nuevo modelo en UI
2. Backend verifica si está instalado
3. Si no: descarga mediante Ollama
4. Carga memoria del modelo anterior
5. Ofrece opción de migrar memoria
6. Actualiza contexto activo

## Consideraciones de Rendimiento

### Optimizaciones para BC-250
- Uso de Vulkan backend en Ollama (mejor soporte que ROCm para RDNA 1.5)
- Modelos cuantizados Q4_K_M o Q5_K_M
- Ajuste de GTT size para maximizar VRAM disponible (12-14 GB)
- Batch processing mínimo para baja latencia

### Gestión de Memoria
- Límite de contexto activo (ej. 8K tokens)
- Resúmenes automáticos cada N interacciones
- Limpieza de embeddings antiguos no relevantes
- Compresión de historial manteniendo puntos clave

## Seguridad y Privacidad
- Todo el tráfico es local (localhost o red LAN)
- Sin telemetría ni conexiones externas no solicitadas
- Datos encriptados en reposo (opcional)
- Sin cuentas ni autenticación externa

## Escalabilidad Futura
- Soporte para múltiples usuarios (con autenticación local)
- Integración con domótica (Home Assistant)
- Plugins para herramientas personalizadas
- Federated learning para mejorar sin salir de local
