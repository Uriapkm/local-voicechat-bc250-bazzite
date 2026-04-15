"""
BC-250 AI Companion - Servidor Principal
Servidor FastAPI que gestiona la API REST y WebSocket para el chatbot de IA
"""
import asyncio
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from config import (
    HOST, PORT, DEFAULT_MODEL, OLLAMA_BASE_URL,
    VECTOR_DB_PATH, LOG_DIR, LOG_LEVEL, validate_config
)

# Importar módulos del sistema
from ollama_manager import OllamaManager
from memory_core import MemoryCore
from tts_engine import TTSEngine
from stt_engine import STTEngine
from web_search import WebSearch

# Configurar logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / 'server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Validar configuración al inicio
validate_config()

# Inicializar FastAPI
app = FastAPI(
    title="BC-250 AI Companion",
    description="API para chatbot de IA personal con memoria persistente",
    version="1.0.0"
)

# Configurar CORS para acceso desde navegador
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, restringir a dominios específicos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos Pydantic para validación de datos
class ChatRequest(BaseModel):
    message: str
    model: Optional[str] = None
    use_web: bool = False
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    model: str
    tokens_used: int
    conversation_id: str
    timestamp: datetime

class ModelInfo(BaseModel):
    name: str
    size: str
    installed: bool

class MemoryMigrationRequest(BaseModel):
    source_model: str
    target_model: str

# Variables globales (en producción, usar base de datos real)
active_connections: Dict[int, WebSocket] = {}
conversation_history: Dict[str, List[dict]] = {}

# Inicializar gestores
ollama_manager = OllamaManager()
tts_engine = TTSEngine()
stt_engine = STTEngine()
web_search = WebSearch()

# Memoria por modelo (se crea bajo demanda)
memory_instances: Dict[str, MemoryCore] = {}


def get_memory_for_model(model_name: str) -> MemoryCore:
    """Obtiene o crea instancia de memoria para un modelo"""
    if model_name not in memory_instances:
        memory_instances[model_name] = MemoryCore(model_name)
    return memory_instances[model_name]

# Rutas de la API

@app.get("/")
async def root():
    """Página principal - sirve el frontend"""
    return FileResponse('../frontend/index.html')

@app.get("/health")
async def health_check():
    """Endpoint de verificación de salud"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(),
        "version": "1.0.0"
    }

@app.get("/api/models")
async def get_models():
    """Obtener lista de modelos disponibles"""
    logger.info("Obteniendo lista de modelos")
    
    # Verificar Ollama y obtener modelos reales
    if not ollama_manager.check_ollama_installed():
        raise HTTPException(status_code=503, detail="Ollama no está disponible")
    
    models = ollama_manager.get_installed_models()
    
    return {
        "models": [
            {
                "name": model.get("name"),
                "size": f"{model.get('size', 0) / (1024**3):.1f} GB",
                "installed": True,
                "is_default": model.get("name") == DEFAULT_MODEL
            }
            for model in models
        ],
        "default_model": DEFAULT_MODEL,
        "ollama_available": True
    }

@app.post("/api/models/load")
async def load_model(model_name: str):
    """Cambiar modelo activo"""
    logger.info(f"Cambiando a modelo: {model_name}")
    
    # Verificar si el modelo está instalado
    if not ollama_manager.is_model_installed(model_name):
        raise HTTPException(status_code=404, detail=f"Modelo {model_name} no encontrado")
    
    return {
        "success": True,
        "message": f"Modelo {model_name} cargado",
        "model": model_name
    }


@app.post("/api/models/pull")
async def pull_model(model_name: str):
    """Descargar un modelo desde Ollama"""
    logger.info(f"Descargando modelo: {model_name}")
    
    if not ollama_manager.check_ollama_installed():
        raise HTTPException(status_code=503, detail="Ollama no está disponible")
    
    success = ollama_manager.pull_model(model_name)
    
    if success:
        return {"success": True, "message": f"Modelo {model_name} descargado"}
    else:
        raise HTTPException(status_code=500, detail=f"Error descargando {model_name}")

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Endpoint principal de chat"""
    logger.info(f"Mensaje recibido: {request.message[:50]}...")
    
    # Determinar modelo a usar
    model = request.model or DEFAULT_MODEL
    
    # Verificar Ollama disponible
    if not ollama_manager.check_ollama_installed():
        raise HTTPException(status_code=503, detail="Ollama no está disponible")
    
    # Obtener memoria para este modelo
    memory = get_memory_for_model(model)
    
    # Detectar si el usuario pide búsqueda web explícitamente
    use_web = request.use_web or "/web" in request.message.lower() or "busca en internet" in request.message.lower()
    
    # Si se pide búsqueda web y hay internet, realizar búsqueda
    web_context = ""
    if use_web and web_search.is_available():
        search_query = request.message.replace("/web", "").strip()
        web_context = web_search.search_and_format(search_query)
        logger.info(f"Búsqueda web realizada: {search_query}")
    
    # Obtener contexto relevante de la memoria
    relevant_context = memory.get_relevant_context(request.message, n_results=3)
    
    # Construir mensajes para Ollama
    messages = []
    
    # Añadir contexto web si existe
    if web_context:
        messages.append({
            "role": "system",
            "content": f"Contexto de internet (bajo demanda):\n{web_context}"
        })
    
    # Añadir contexto de memoria si existe
    if relevant_context:
        context_text = "\n".join(relevant_context)
        messages.append({
            "role": "system",
            "content": f"Memoria relevante de conversaciones anteriores:\n{context_text}"
        })
    
    # Añadir preferencias del usuario
    prefs = memory.preferences
    system_instruction = f"Eres un asistente útil. Idioma: {prefs.get('language', 'es')}. Tono: {prefs.get('tone', 'friendly')}."
    if prefs.get("custom_instructions"):
        system_instruction += f" Preferencias: {prefs['custom_instructions'][-1]['text']}"
    
    messages.append({"role": "user", "content": request.message})
    
    # Generar respuesta con Ollama
    try:
        response = ollama_manager.generate_response(
            model=model,
            prompt=request.message,
            messages=messages,
            stream=False
        )
        
        if response.status_code == 200:
            response_data = response.json()
            assistant_message = response_data.get("message", {}).get("content", "")
            
            # Guardar interacción en memoria
            memory.add_interaction(request.message, assistant_message)
            
            return ChatResponse(
                response=assistant_message,
                model=model,
                tokens_used=len(request.message.split()) + len(assistant_message.split()),
                conversation_id=request.conversation_id or "default",
                timestamp=datetime.now()
            )
        else:
            raise HTTPException(status_code=500, detail="Error en generación de respuesta")
    
    except Exception as e:
        logger.error(f"Error en chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/chat/{client_id}")
async def websocket_chat(websocket: WebSocket, client_id: int):
    """WebSocket para chat en tiempo real con streaming"""
    await websocket.accept()
    active_connections[client_id] = websocket
    logger.info(f"Cliente {client_id} conectado vía WebSocket")
    
    # Usar modelo por defecto y memoria
    model = DEFAULT_MODEL
    memory = get_memory_for_model(model)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            # Parsear mensaje JSON
            try:
                message_data = json.loads(data)
                message = message_data.get("message", "")
                use_web = message_data.get("use_web", False)
            except json.JSONDecodeError:
                message = data
                use_web = False
            
            if not message:
                continue
            
            # Detectar búsqueda web si se solicita
            web_context = ""
            if use_web and web_search.is_available():
                web_context = web_search.search_and_format(message)
                logger.info(f"Búsqueda web realizada: {message}")
            
            # Obtener contexto relevante de la memoria
            relevant_context = memory.get_relevant_context(message, n_results=3)
            
            # Construir mensajes para Ollama
            messages = []
            
            # Añadir contexto web si existe
            if web_context:
                messages.append({
                    "role": "system",
                    "content": f"Contexto de internet (bajo demanda):\n{web_context}"
                })
            
            # Añadir contexto de memoria si existe
            if relevant_context:
                context_text = "\n".join(relevant_context)
                messages.append({
                    "role": "system",
                    "content": f"Memoria relevante de conversaciones anteriores:\n{context_text}"
                })
            
            # Añadir preferencias del usuario
            prefs = memory.preferences
            system_instruction = f"Eres un asistente útil. Idioma: {prefs.get('language', 'es')}. Tono: {prefs.get('tone', 'friendly')}."
            if prefs.get("custom_instructions"):
                system_instruction += f" Preferencias: {prefs['custom_instructions'][-1]['text']}"
            
            messages.append({"role": "user", "content": message})
            
            # Enviar indicador de "escribiendo..."
            await websocket.send_json({
                "type": "status",
                "content": "thinking",
                "timestamp": datetime.now().isoformat()
            })
            
            # Generar respuesta con Ollama
            try:
                response = ollama_manager.generate_response(
                    model=model,
                    prompt=message,
                    messages=messages,
                    stream=True
                )
                
                full_response = ""
                if response.status_code == 200:
                    for line in response.iter_lines():
                        if line:
                            try:
                                chunk = json.loads(line.decode('utf-8'))
                                if "message" in chunk and "content" in chunk["message"]:
                                    content = chunk["message"]["content"]
                                    full_response += content
                                    
                                    # Enviar fragmento en tiempo real
                                    await websocket.send_json({
                                        "type": "chunk",
                                        "content": content,
                                        "timestamp": datetime.now().isoformat()
                                    })
                            except json.JSONDecodeError:
                                continue
                    
                    # Guardar interacción en memoria
                    memory.add_interaction(message, full_response)
                    
                    # Enviar finalización
                    await websocket.send_json({
                        "type": "complete",
                        "content": full_response,
                        "model": model,
                        "conversation_id": AppState.conversation_id if hasattr(AppState, 'conversation_id') else "default",
                        "timestamp": datetime.now().isoformat()
                    })
                else:
                    await websocket.send_json({
                        "type": "error",
                        "content": "Error en generación de respuesta",
                        "timestamp": datetime.now().isoformat()
                    })
            
            except Exception as e:
                logger.error(f"Error generando respuesta: {e}")
                await websocket.send_json({
                    "type": "error",
                    "content": str(e),
                    "timestamp": datetime.now().isoformat()
                })
    
    except WebSocketDisconnect:
        logger.info(f"Cliente {client_id} desconectado")
        del active_connections[client_id]
    except Exception as e:
        logger.error(f"Error en WebSocket: {e}")
        try:
            await websocket.close()
        except:
            pass
        if client_id in active_connections:
            del active_connections[client_id]


@app.post("/api/memory/migrate")
async def migrate_memory(request: MemoryMigrationRequest):
    """Migrar memoria de un modelo a otro"""
    logger.info(f"Migrando memoria de {request.source_model} a {request.target_model}")
    
    try:
        # Obtener memorias de origen y destino
        source_memory = get_memory_for_model(request.source_model)
        target_memory = get_memory_for_model(request.target_model)
        
        # Exportar memoria del origen
        export_data = source_memory.export_memory()
        
        # Importar en el destino
        target_memory.import_memory(export_data)
        
        return {
            "success": True,
            "message": "Memoria migrada exitosamente",
            "source": request.source_model,
            "target": request.target_model
        }
    except Exception as e:
        logger.error(f"Error en migración de memoria: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/audio/transcribe")
async def transcribe_audio():
    """Endpoint para transcripción de audio (STT)"""
    # Este endpoint recibiría audio via multipart/form-data
    # Implementación pendiente en frontend
    if not stt_engine.is_available():
        raise HTTPException(status_code=503, detail="STT no disponible")
    
    return {"status": "ready", "message": "Envíe audio para transcribir"}


@app.post("/api/audio/synthesize")
async def synthesize_audio(text: str, voice: Optional[str] = None):
    """Endpoint para síntesis de voz (TTS)"""
    if not tts_engine.is_available():
        raise HTTPException(status_code=503, detail="TTS no disponible")
    
    audio_file = tts_engine.synthesize(text, voice)
    
    if audio_file:
        from fastapi.responses import FileResponse
        return FileResponse(audio_file, media_type="audio/wav")
    else:
        raise HTTPException(status_code=500, detail="Error generando audio")


@app.get("/api/system/status")
async def system_status():
    """Obtener estado del sistema"""
    return {
        "ollama": ollama_manager.check_ollama_installed(),
        "tts": tts_engine.is_available(),
        "stt": stt_engine.is_available(),
        "internet": web_search.is_available(),
        "models_count": len(ollama_manager.get_installed_models()) if ollama_manager.check_ollama_installed() else 0
    }

@app.get("/api/memory/stats")
async def get_memory_stats():
    """Obtener estadísticas de la memoria"""
    stats = {
        "total_models": len(memory_instances),
        "models": {}
    }
    
    for model_name, memory in memory_instances.items():
        mem_summary = memory.get_memory_summary()
        stats["models"][model_name] = {
            "interactions": mem_summary["metadata"]["total_interactions"],
            "preferences": mem_summary["preferences"],
            "created_at": mem_summary["metadata"]["created_at"]
        }
    
    return stats

# Montar frontend estático
try:
    app.mount("/static", StaticFiles(directory="../frontend"), name="static")
except Exception as e:
    logger.warning(f"No se pudo montar directorio estático: {e}")

# Punto de entrada principal
if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Iniciando servidor en {HOST}:{PORT}")
    logger.info(f"Documentación disponible en http://{HOST}:{PORT}/docs")
    
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=True,  # Solo en desarrollo
        log_level=LOG_LEVEL.lower()
    )
