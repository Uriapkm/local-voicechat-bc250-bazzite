"""
Motor de Texto a Voz (TTS) para BC-250 AI Companion
Soporte offline con Piper TTS
"""
import os
import subprocess
import wave
import tempfile
from pathlib import Path
from typing import Optional, Generator
import shutil


class TTSEngine:
    def __init__(self):
        self.piper_path = None
        self.voice_model = None
        self.data_dir = Path("/workspace/bc250-ai-companion/data/tts_models")
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # Detectar Piper TTS
        self._detect_piper()
    
    def _detect_piper(self):
        """Detecta si Piper TTS está instalado"""
        # Buscar en PATH
        piper_exec = shutil.which("piper")
        if piper_exec:
            self.piper_path = piper_exec
            print(f"Piper detectado en: {self.piper_path}")
        else:
            print("Piper TTS no encontrado. El audio estará deshabilitado.")
    
    def list_available_voices(self) -> list:
        """Lista voces disponibles"""
        voices = []
        if self.data_dir.exists():
            for model_file in self.data_dir.glob("*.onnx"):
                voice_name = model_file.stem.replace(".quantized", "")
                voices.append(voice_name)
        return voices
    
    def download_voice(self, voice_id: str) -> bool:
        """Descarga un modelo de voz (implementación básica)"""
        # En producción, descargaría desde HuggingFace
        # Ejemplo: es_ES-dave-f-medium.onnx
        print(f"Descargando voz: {voice_id}")
        # Aquí iría la lógica de descarga real
        return True
    
    def synthesize(self, text: str, voice: Optional[str] = None, 
                   output_file: Optional[str] = None) -> Optional[str]:
        """
        Convierte texto a audio
        Returns: ruta al archivo WAV o None si falla
        """
        if not self.piper_path:
            print("Piper no disponible")
            return None
        
        if not voice:
            # Usar primera voz disponible o default
            voices = self.list_available_voices()
            voice = voices[0] if voices else "es_ES-dave-f-medium"
        
        model_path = self.data_dir / f"{voice}.onnx"
        config_path = self.data_dir / f"{voice}.onnx.json"
        
        if not model_path.exists():
            print(f"Modelo de voz no encontrado: {model_path}")
            return None
        
        # Crear archivo temporal si no se especifica
        if not output_file:
            temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            output_file = temp_file.name
            temp_file.close()
        
        try:
            # Ejecutar Piper
            cmd = [
                self.piper_path,
                "-m", str(model_path),
                "-f", output_file
            ]
            
            if config_path.exists():
                cmd.extend(["--config", str(config_path)])
            
            process = subprocess.run(
                cmd,
                input=text.encode('utf-8'),
                capture_output=True,
                timeout=60
            )
            
            if process.returncode == 0 and os.path.exists(output_file):
                return output_file
            else:
                print(f"Error en TTS: {process.stderr.decode()}")
                return None
                
        except Exception as e:
            print(f"Excepción en TTS: {e}")
            if os.path.exists(output_file):
                os.remove(output_file)
            return None
    
    def synthesize_streaming(self, text: str, voice: Optional[str] = None) -> Generator[bytes, None, None]:
        """
        Genera audio en streaming (para respuestas largas)
        Yields chunks de audio
        """
        # Implementación simplificada - en producción sería streaming real
        output_file = self.synthesize(text, voice)
        if output_file and os.path.exists(output_file):
            with open(output_file, 'rb') as f:
                while chunk := f.read(4096):
                    yield chunk
            os.remove(output_file)
    
    def is_available(self) -> bool:
        """Verifica si el TTS está disponible"""
        return self.piper_path is not None
