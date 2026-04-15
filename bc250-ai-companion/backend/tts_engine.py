"""
Motor de Texto a Voz (TTS) para BC-250 AI Companion
Soporte multi-engine: MeloTTS, Piper TTS, Coqui XTTS
Optimizado para AMD BC-250 con memoria unificada GDDR6
"""
import os
import subprocess
import wave
import tempfile
from pathlib import Path
from typing import Optional, Generator, Dict, List
import shutil
import json


class TTSEngine:
    def __init__(self):
        self.piper_path = None
        self.melotts_available = False
        self.xtts_available = False
        self.voice_model = None
        self.current_engine = "auto"  # auto, piper, melotts, xtts
        # Usar rutas relativas - compatible con cualquier directorio
        self.base_dir = Path(__file__).parent.parent
        self.data_dir = self.base_dir / "data" / "tts_models"
        self.profiles_dir = self.base_dir / "data" / "profiles"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.profiles_dir.mkdir(parents=True, exist_ok=True)
        
        # Detectar engines disponibles
        self._detect_engines()
    
    def _detect_engines(self):
        """Detecta engines TTS disponibles en el sistema"""
        # Detectar Piper TTS
        piper_exec = shutil.which("piper")
        if piper_exec:
            self.piper_path = piper_exec
            print(f"Piper detectado en: {self.piper_path}")
        else:
            print("Piper TTS no encontrado")
        
        # Detectar MeloTTS
        try:
            import melo.api
            self.melotts_available = True
            print("MeloTTS detectado")
        except ImportError:
            print("MeloTTS no disponible (pip install melo-tts)")
        
        # Detectar Coqui XTTS
        try:
            from TTS.api import TTS
            self.xtts_available = True
            print("Coqui XTTS detectado")
        except ImportError:
            print("Coqui XTTS no disponible (pip install TTS)")
        
        # Seleccionar engine por defecto (prioridad: MeloTTS > XTTS > Piper)
        if self.melotts_available:
            self.current_engine = "melotts"
        elif self.xtts_available:
            self.current_engine = "xtts"
        elif self.piper_path:
            self.current_engine = "piper"
        else:
            print("Ningún engine TTS disponible. El audio estará deshabilitado.")
    
    def list_available_voices(self) -> List[Dict]:
        """Lista todas las voces disponibles con información detallada"""
        voices = []
        
        # Voces desde perfiles importados
        if self.profiles_dir.exists():
            for profile_dir in self.profiles_dir.glob("voice_*"):
                profile_json = profile_dir / "profile.json"
                if profile_json.exists():
                    with open(profile_json, 'r', encoding='utf-8') as f:
                        profile_data = json.load(f)
                        voices.append({
                            "id": profile_data.get("id"),
                            "name": profile_data.get("name"),
                            "description": profile_data.get("description", ""),
                            "engine": profile_data.get("engine", "auto"),
                            "language": profile_data.get("language", "es"),
                            "source": "imported"
                        })
        
        # Voces nativas de Piper (archivos .onnx directos)
        if self.data_dir.exists():
            for model_file in self.data_dir.glob("*.onnx"):
                voice_name = model_file.stem.replace(".quantized", "")
                # Verificar si ya está en perfiles importados
                if not any(v["name"] == voice_name for v in voices):
                    voices.append({
                        "id": voice_name,
                        "name": voice_name,
                        "description": "Voz Piper nativa",
                        "engine": "piper",
                        "language": voice_name.split("_")[0] if "_" in voice_name else "es",
                        "source": "native"
                    })
        
        return voices
    
    def load_voice_profile(self, voice_id: str) -> bool:
        """Carga una voz desde un perfil importado"""
        profile_path = self.profiles_dir / f"voice_{voice_id}"
        if not profile_path.exists():
            print(f"Perfil de voz no encontrado: {voice_id}")
            return False
        
        profile_json = profile_path / "profile.json"
        if profile_json.exists():
            with open(profile_json, 'r', encoding='utf-8') as f:
                profile_data = json.load(f)
                self.voice_model = profile_data
                self.current_engine = profile_data.get("engine", "auto")
                print(f"Voz cargada: {profile_data.get('name')} (engine: {self.current_engine})")
                return True
        
        return False
    
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
        return self.piper_path is not None or self.melotts_available or self.xtts_available
    
    def get_engine_info(self) -> Dict:
        """Retorna información sobre los engines disponibles"""
        return {
            "current_engine": self.current_engine,
            "piper": self.piper_path is not None,
            "melotts": self.melotts_available,
            "xtts": self.xtts_available,
            "voices_count": len(self.list_available_voices())
        }
