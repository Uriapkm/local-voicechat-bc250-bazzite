"""
Motor de Voz a Texto (STT) para BC-250 AI Companion
Soporte offline con Whisper.cpp o similar
"""
import os
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Optional


class STTEngine:
    def __init__(self):
        self.whisper_path = None
        self.model_path = None
        self.data_dir = Path("/workspace/bc250-ai-companion/data/stt_models")
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # Detectar Whisper
        self._detect_whisper()
    
    def _detect_whisper(self):
        """Detecta si whisper.cpp está instalado"""
        # Buscar whisper-cli o whisper-main
        whisper_exec = shutil.which("whisper-cli") or shutil.which("whisper-main")
        
        if whisper_exec:
            self.whisper_path = whisper_exec
            print(f"Whisper detectado en: {self.whisper_path}")
        else:
            # Intentar encontrar instalación local
            local_whisper = Path("/usr/local/bin/whisper-cli")
            if local_whisper.exists():
                self.whisper_path = str(local_whisper)
                print(f"Whisper detectado en: {self.whisper_path}")
            else:
                print("Whisper no encontrado. La entrada por voz estará deshabilitada.")
    
    def list_available_models(self) -> list:
        """Lista modelos STT disponibles"""
        models = []
        if self.data_dir.exists():
            for model_file in self.data_dir.glob("*.bin"):
                model_name = model_file.stem.replace("ggml-", "").replace(".bin", "")
                models.append(model_name)
        return models
    
    def download_model(self, model_size: str = "small") -> bool:
        """Descarga un modelo Whisper (implementación básica)"""
        # En producción, descargaría desde HuggingFace
        # Modelos: tiny, base, small, medium, large
        print(f"Descargando modelo Whisper: {model_size}")
        # Aquí iría la lógica de descarga real
        return True
    
    def transcribe(self, audio_file: str, language: str = "es") -> Optional[str]:
        """
        Transcribe audio a texto
        Returns: texto transcrito o None si falla
        """
        if not self.whisper_path:
            print("Whisper no disponible")
            return None
        
        if not os.path.exists(audio_file):
            print(f"Archivo de audio no encontrado: {audio_file}")
            return None
        
        # Determinar modelo a usar
        models = self.list_available_models()
        if not models:
            print("No hay modelos STT disponibles")
            return None
        
        model_name = models[0]  # Usar primer modelo disponible
        model_path = self.data_dir / f"ggml-{model_name}.bin"
        
        if not model_path.exists():
            print(f"Modelo no encontrado: {model_path}")
            return None
        
        try:
            # Ejecutar Whisper
            cmd = [
                self.whisper_path,
                "-m", str(model_path),
                "-f", audio_file,
                "-l", language,
                "--output-txt"
            ]
            
            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120  # 2 minutos máximo
            )
            
            # Leer archivo de salida
            output_txt = audio_file.rsplit('.', 1)[0] + ".txt"
            
            if os.path.exists(output_txt):
                with open(output_txt, 'r', encoding='utf-8') as f:
                    transcription = f.read().strip()
                
                # Limpiar archivo temporal
                os.remove(output_txt)
                
                return transcription
            else:
                # Si no hay archivo, intentar leer stdout
                if process.stdout.strip():
                    return process.stdout.strip()
                print(f"Error en STT: {process.stderr}")
                return None
                
        except subprocess.TimeoutExpired:
            print("Timeout en transcripción")
            return None
        except Exception as e:
            print(f"Excepción en STT: {e}")
            return None
    
    def transcribe_bytes(self, audio_bytes: bytes, language: str = "es") -> Optional[str]:
        """Transcribe audio desde bytes"""
        # Crear archivo temporal
        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp_file.write(audio_bytes)
        temp_file.close()
        
        try:
            result = self.transcribe(temp_file.name, language)
            return result
        finally:
            # Limpiar
            if os.path.exists(temp_file.name):
                os.remove(temp_file.name)
    
    def is_available(self) -> bool:
        """Verifica si el STT está disponible"""
        return self.whisper_path is not None and len(self.list_available_models()) > 0
