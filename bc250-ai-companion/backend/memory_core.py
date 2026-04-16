"""
Sistema de Memoria Persistente para BC-250 AI Companion
Implementa memoria tipo "humana" con base de datos vectorial
Permite migrar memoria entre modelos
"""
import os
import json
import hashlib
import logging
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path

# Configurar logging
logger = logging.getLogger(__name__)

try:
    from chromadb.config import Settings
    import chromadb
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    logger.warning("ChromaDB no disponible, usando almacenamiento básico")


class MemoryCore:
    def __init__(self, model_name: str = "default"):
        self.model_name = model_name
        # Usar rutas relativas - compatible con cualquier directorio
        self.base_dir = Path(__file__).parent.parent
        self.data_dir = self.base_dir / "data" / "vector_db"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # Directorio específico por modelo
        self.model_dir = self.data_dir / model_name.replace(":", "_").replace("/", "_")
        self.model_dir.mkdir(parents=True, exist_ok=True)
        
        # Archivo de metadatos y preferencias
        self.metadata_file = self.model_dir / "metadata.json"
        self.preferences_file = self.model_dir / "preferences.json"
        self.summary_file = self.model_dir / "conversation_summary.json"
        
        # Inicializar base de datos vectorial si está disponible
        self.chroma_client = None
        self.collection = None
        
        if CHROMA_AVAILABLE:
            try:
                persist_dir = self.model_dir / "chroma"
                self.chroma_client = chromadb.Client(Settings(
                    persist_directory=str(persist_dir),
                    anonymized_telemetry=False
                ))
                self.collection = self.chroma_client.get_or_create_collection(
                    name="memory",
                    metadata={"hnsw:space": "cosine"}
                )
                logger.info(f"ChromaDB inicializado correctamente para {model_name}")
            except Exception as e:
                logger.error(f"Error inicializando ChromaDB: {e}. Usando almacenamiento básico.")
        
        # Cargar metadatos existentes (esto restaura el estado desde disco)
        self.metadata = self._load_metadata()
        self.preferences = self._load_preferences()
        self.summary = self._load_summary()
        
        logger.info(f"Memoria cargada para {model_name}: {self.metadata.get('total_interactions', 0)} interacciones")
    
    def _load_metadata(self) -> Dict:
        """Carga metadatos del modelo"""
        if self.metadata_file.exists():
            with open(self.metadata_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            "created_at": datetime.now().isoformat(),
            "last_updated": datetime.now().isoformat(),
            "total_interactions": 0,
            "model_name": self.model_name
        }
    
    def _save_metadata(self):
        """Guarda metadatos"""
        self.metadata["last_updated"] = datetime.now().isoformat()
        with open(self.metadata_file, 'w', encoding='utf-8') as f:
            json.dump(self.metadata, f, indent=2, ensure_ascii=False)
        logger.debug(f"Metadatos guardados para {self.model_name}")
    
    def _load_preferences(self) -> Dict:
        """Carga preferencias del usuario"""
        if self.preferences_file.exists():
            with open(self.preferences_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            "tone": "friendly",
            "detail_level": "balanced",
            "language": "es",
            "auto_audio": False,
            "custom_instructions": []
        }
    
    def _save_preferences(self):
        """Guarda preferencias"""
        with open(self.preferences_file, 'w', encoding='utf-8') as f:
            json.dump(self.preferences, f, indent=2, ensure_ascii=False)
        logger.debug(f"Preferencias guardadas para {self.model_name}")
    
    def _load_summary(self) -> Dict:
        """Carga resumen de conversación"""
        if self.summary_file.exists():
            with open(self.summary_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            "key_facts": [],
            "user_context": "",
            "ongoing_topics": []
        }
    
    def _save_summary(self):
        """Guarda resumen"""
        with open(self.summary_file, 'w', encoding='utf-8') as f:
            json.dump(self.summary, f, indent=2, ensure_ascii=False)
        logger.debug(f"Resumen guardado para {self.model_name}")
    
    def add_interaction(self, user_input: str, assistant_response: str, 
                       context: Optional[Dict] = None):
        """Añade una interacción a la memoria"""
        # Actualizar contador
        self.metadata["total_interactions"] += 1
        
        # Extraer información importante
        self._extract_key_information(user_input, assistant_response)
        
        # Guardar en base de datos vectorial si está disponible
        if self.collection:
            try:
                interaction_id = hashlib.md5(
                    f"{datetime.now().isoformat()}{user_input[:50]}".encode()
                ).hexdigest()
                
                self.collection.add(
                    ids=[interaction_id],
                    documents=[f"User: {user_input}\nAssistant: {assistant_response}"],
                    metadatas=[{
                        "timestamp": datetime.now().isoformat(),
                        "type": "interaction"
                    }]
                )
                logger.info(f"Interacción añadida a vector DB (ID: {interaction_id[:8]}...)")
            except Exception as e:
                logger.error(f"Error adding to vector DB: {e}")
        
        # Guardar cambios en disco inmediatamente
        self._save_metadata()
        self._save_summary()
        logger.info(f"Interacción guardada. Total: {self.metadata['total_interactions']}")
    
    def _extract_key_information(self, user_input: str, assistant_response: str):
        """Extrae información clave de la interacción"""
        # Heurística simple para detectar preferencias
        lower_input = user_input.lower()
        
        # Detectar preferencias de lenguaje
        if "prefiero" in lower_input or "me gusta" in lower_input or "mi color favorito" in lower_input:
            self.preferences["custom_instructions"].append({
                "text": user_input,
                "timestamp": datetime.now().isoformat()
            })
            self._save_preferences()
            logger.info(f"Preferencia detectada y guardada: {user_input[:50]}...")
        
        # Actualizar contexto del usuario (implementación simplificada)
        # En producción, usaría el LLM para extraer hechos importantes
        if len(self.summary["key_facts"]) < 50:  # Limitar hechos clave
            # Aquí iría lógica más sofisticada
            pass
    
    def get_relevant_context(self, query: str, n_results: int = 5) -> List[str]:
        """Obtiene contexto relevante para una consulta"""
        if not self.collection:
            logger.warning("ChromaDB no disponible, devolviendo contexto vacío")
            return []
        
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results
            )
            docs = results.get("documents", [[]])[0]
            logger.info(f"Contexto relevante encontrado: {len(docs)} documentos")
            return docs
        except Exception as e:
            logger.error(f"Error querying vector DB: {e}")
            return []
    
    def get_memory_summary(self) -> Dict:
        """Obtiene resumen de la memoria"""
        return {
            "metadata": self.metadata,
            "preferences": self.preferences,
            "summary": self.summary
        }
    
    def update_preferences(self, new_prefs: Dict):
        """Actualiza preferencias"""
        self.preferences.update(new_prefs)
        self._save_preferences()
        logger.info(f"Preferencias actualizadas para {self.model_name}")
    
    def export_memory(self) -> Dict:
        """Exporta toda la memoria para migración"""
        export_data = {
            "metadata": self.metadata,
            "preferences": self.preferences,
            "summary": self.summary,
            "exported_at": datetime.now().isoformat()
        }
        
        # Exportar documentos de la base vectorial
        if self.collection:
            try:
                all_docs = self.collection.get()
                export_data["vector_documents"] = all_docs
                logger.info(f"Memoria exportada: {len(all_docs.get('documents', []))} documentos")
            except Exception as e:
                logger.error(f"Error exportando documentos vectoriales: {e}")
        
        return export_data
    
    def import_memory(self, import_data: Dict):
        """Importa memoria desde otro modelo"""
        if "metadata" in import_data:
            self.metadata.update(import_data["metadata"])
            self.metadata["model_name"] = self.model_name  # Mantener nombre actual
            self._save_metadata()
        
        if "preferences" in import_data:
            self.preferences.update(import_data["preferences"])
            self._save_preferences()
        
        if "summary" in import_data:
            self.summary.update(import_data["summary"])
            self._save_summary()
        
        # Importar documentos vectoriales
        if "vector_documents" in import_data and self.collection:
            try:
                docs = import_data["vector_documents"]
                if docs and "documents" in docs:
                    self.collection.add(
                        ids=docs.get("ids", []),
                        documents=docs.get("documents", []),
                        metadatas=docs.get("metadatas", [])
                    )
                    logger.info(f"Memoria importada: {len(docs.get('documents', []))} documentos")
            except Exception as e:
                logger.error(f"Error importing vector documents: {e}")
    
    def copy_memory_from_model(self, source_model: str):
        """Copia memoria desde otro modelo"""
        logger.info(f"Copiando memoria desde {source_model} a {self.model_name}")
        source_memory = MemoryCore(source_model)
        export_data = source_memory.export_memory()
        self.import_memory(export_data)
        logger.info(f"Memoria copiada exitosamente")
    
    def clear_memory(self, keep_preferences: bool = False):
        """Limpia la memoria"""
        logger.warning(f"Limpieza de memoria para {self.model_name}")
        if not keep_preferences:
            self.preferences = {}
            self._save_preferences()
        
        self.summary = {"key_facts": [], "user_context": "", "ongoing_topics": []}
        self._save_summary()
        
        self.metadata["total_interactions"] = 0
        self._save_metadata()
        
        # Limpiar base vectorial
        if self.collection:
            try:
                self.collection.delete(where={})
                logger.info("Base vectorial limpiada")
            except Exception as e:
                logger.error(f"Error limpiando base vectorial: {e}")
