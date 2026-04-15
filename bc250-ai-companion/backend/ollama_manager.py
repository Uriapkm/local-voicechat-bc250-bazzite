"""
Gestor de Ollama para BC-250 AI Companion
Maneja la instalación, ejecución y cambio de modelos
"""
import subprocess
import json
import requests
from typing import List, Dict, Optional
from config import OLLAMA_HOST, DEFAULT_MODEL


class OllamaManager:
    def __init__(self):
        self.host = OLLAMA_HOST
        self.base_url = f"http://{self.host}"
    
    def check_ollama_installed(self) -> bool:
        """Verifica si Ollama está instalado y corriendo"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def get_installed_models(self) -> List[Dict]:
        """Obtiene lista de modelos instalados"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get("models", [])
        except requests.exceptions.RequestException:
            pass
        return []
    
    def is_model_installed(self, model_name: str) -> bool:
        """Verifica si un modelo específico está instalado"""
        models = self.get_installed_models()
        for model in models:
            if model_name in model.get("name", ""):
                return True
        return False
    
    def pull_model(self, model_name: str, callback=None) -> bool:
        """Descarga un modelo desde Ollama"""
        try:
            response = requests.post(
                f"{self.base_url}/api/pull",
                json={"name": model_name},
                stream=True
            )
            
            for line in response.iter_lines():
                if line:
                    status = json.loads(line.decode('utf-8'))
                    if callback:
                        callback(status)
            
            return True
        except Exception as e:
            print(f"Error pulling model: {e}")
            return False
    
    def delete_model(self, model_name: str) -> bool:
        """Elimina un modelo"""
        try:
            response = requests.delete(
                f"{self.base_url}/api/delete",
                json={"name": model_name}
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Error deleting model: {e}")
            return False
    
    def generate_response(self, model: str, prompt: str, messages: list, 
                         images: list = None, audio: bytes = None,
                         stream: bool = True) -> requests.Response:
        """Genera una respuesta del modelo"""
        payload = {
            "model": model,
            "messages": messages,
            "stream": stream
        }
        
        if images:
            payload["images"] = images
        
        # Nota: El audio se procesa antes de llegar aquí por el STT engine
        # Gemma4 puede manejar audio nativamente pero requiere formato específico
        
        response = requests.post(
            f"{self.base_url}/api/chat",
            json=payload,
            stream=stream
        )
        
        return response
    
    def get_model_info(self, model_name: str) -> Optional[Dict]:
        """Obtiene información detallada de un modelo"""
        try:
            response = requests.post(
                f"{self.base_url}/api/show",
                json={"name": model_name}
            )
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"Error getting model info: {e}")
        return None
    
    def check_hardware_acceleration(self) -> Dict:
        """Verifica el estado de aceleración por hardware"""
        try:
            response = requests.get(f"{self.base_url}/api/ps", timeout=5)
            if response.status_code == 200:
                return response.json()
        except:
            pass
        return {"status": "unknown"}
