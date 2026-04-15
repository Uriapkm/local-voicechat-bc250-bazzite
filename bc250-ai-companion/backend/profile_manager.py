"""
Gestor de Perfiles de Voz y Personalidad para BC-250 AI Companion
Permite importar/exportar configuraciones de voz y personalidad via USB
"""
import os
import json
import shutil
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
import hashlib


class ProfileManager:
    """Gestiona perfiles de voz y personalidad portables"""
    
    def __init__(self):
        self.profiles_dir = Path("/workspace/bc250-ai-companion/data/profiles")
        self.voices_dir = Path("/workspace/bc250-ai-companion/data/tts_models")
        self.personalities_dir = Path("/workspace/bc250-ai-companion/data/personalities")
        
        # Crear directorios
        self.profiles_dir.mkdir(parents=True, exist_ok=True)
        self.voices_dir.mkdir(parents=True, exist_ok=True)
        self.personalities_dir.mkdir(parents=True, exist_ok=True)
        
        # Extensiones soportadas
        self.VOICE_EXTENSIONS = ['.onnx', '.onnx.json', '.pt', '.bin']
        self.PROFILE_EXTENSION = '.voicepack'
        
    def create_voice_profile(self, name: str, description: str = "", 
                            voice_file: Optional[str] = None,
                            config_file: Optional[str] = None,
                            sample_audio: Optional[str] = None) -> Dict:
        """
        Crea un perfil de voz nuevo
        
        Args:
            name: Nombre identificador de la voz
            description: Descripción opcional
            voice_file: Ruta al archivo de modelo (.onnx, .pt, etc)
            config_file: Ruta al archivo de configuración (.json)
            sample_audio: Ruta a audio de ejemplo (.wav, .mp3)
        
        Returns:
            Diccionario con información del perfil creado
        """
        profile_id = hashlib.md5(f"{name}{datetime.now()}".encode()).hexdigest()[:8]
        profile_dir = self.profiles_dir / f"voice_{profile_id}"
        profile_dir.mkdir(parents=True, exist_ok=True)
        
        profile_data = {
            "id": profile_id,
            "name": name,
            "description": description,
            "type": "voice",
            "created_at": datetime.now().isoformat(),
            "engine": "auto",  # auto, melotts, piper, xtts
            "language": "es",
            "files": {}
        }
        
        # Copiar archivos de voz
        if voice_file and Path(voice_file).exists():
            dest_path = profile_dir / f"model{Path(voice_file).suffix}"
            shutil.copy2(voice_file, dest_path)
            profile_data["files"]["model"] = str(dest_path.name)
            
            # Detectar engine basado en extensión
            if Path(voice_file).suffix == '.pt':
                profile_data["engine"] = "melotts"
            elif Path(voice_file).suffix == '.onnx':
                profile_data["engine"] = "piper"
            elif Path(voice_file).suffix == '.bin':
                profile_data["engine"] = "xtts"
        
        # Copiar configuración
        if config_file and Path(config_file).exists():
            dest_path = profile_dir / f"config{Path(config_file).suffix}"
            shutil.copy2(config_file, dest_path)
            profile_data["files"]["config"] = str(dest_path.name)
        
        # Copiar audio de ejemplo
        if sample_audio and Path(sample_audio).exists():
            dest_path = profile_dir / f"sample{Path(sample_audio).suffix}"
            shutil.copy2(sample_audio, dest_path)
            profile_data["files"]["sample"] = str(dest_path.name)
        
        # Guardar metadata
        metadata_path = profile_dir / "profile.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(profile_data, f, indent=2, ensure_ascii=False)
        
        # Copiar también a directorio general de voces
        if voice_file and Path(voice_file).exists():
            dest_voice = self.voices_dir / f"{name}{Path(voice_file).suffix}"
            shutil.copy2(voice_file, dest_voice)
        
        return profile_data
    
    def create_personality_profile(self, name: str, system_prompt: str,
                                   description: str = "",
                                   traits: Optional[List[str]] = None,
                                   tone: str = "friendly",
                                   language: str = "es") -> Dict:
        """
        Crea un perfil de personalidad
        
        Args:
            name: Nombre de la personalidad
            system_prompt: Prompt de sistema que define el comportamiento
            description: Descripción opcional
            traits: Lista de rasgos de personalidad
            tone: Tono de comunicación (friendly, formal, casual, etc)
            language: Idioma principal
        
        Returns:
            Diccionario con información del perfil creado
        """
        profile_id = hashlib.md5(f"{name}{datetime.now()}".encode()).hexdigest()[:8]
        profile_dir = self.personalities_dir / f"personality_{profile_id}"
        profile_dir.mkdir(parents=True, exist_ok=True)
        
        profile_data = {
            "id": profile_id,
            "name": name,
            "description": description,
            "type": "personality",
            "created_at": datetime.now().isoformat(),
            "system_prompt": system_prompt,
            "traits": traits or [],
            "tone": tone,
            "language": language,
            "version": "1.0"
        }
        
        # Guardar metadata
        metadata_path = profile_dir / "profile.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(profile_data, f, indent=2, ensure_ascii=False)
        
        # Guardar prompt en archivo separado para fácil edición
        prompt_path = profile_dir / "system_prompt.txt"
        with open(prompt_path, 'w', encoding='utf-8') as f:
            f.write(system_prompt)
        
        return profile_data
    
    def export_profile(self, profile_id: str, output_path: str, 
                      profile_type: str = "voice") -> bool:
        """
        Exporta un perfil a un archivo portable (.voicepack)
        
        Args:
            profile_id: ID del perfil a exportar
            output_path: Ruta donde guardar el archivo .voicepack
            profile_type: Tipo de perfil (voice o personality)
        
        Returns:
            True si éxito, False si error
        """
        if profile_type == "voice":
            source_dir = self.profiles_dir / f"voice_{profile_id}"
        else:
            source_dir = self.personalities_dir / f"personality_{profile_id}"
        
        if not source_dir.exists():
            print(f"Perfil {profile_id} no encontrado")
            return False
        
        # Crear archivo ZIP con la estructura correcta
        try:
            import tempfile
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # Crear subdirectorio tipo (voice/ o personality/)
                type_dir = temp_path / profile_type
                type_dir.mkdir(parents=True, exist_ok=True)
                
                # Copiar archivos al subdirectorio
                for file_path in source_dir.rglob('*'):
                    if file_path.is_file():
                        dest_file = type_dir / file_path.name
                        shutil.copy2(file_path, dest_file)
                
                # Crear ZIP desde el subdirectorio
                with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for file_path in type_dir.rglob('*'):
                        if file_path.is_file():
                            arcname = file_path.relative_to(temp_path)
                            zipf.write(file_path, arcname)
            
            print(f"Perfil exportado a: {output_path}")
            return True
        except Exception as e:
            print(f"Error exportando perfil: {e}")
            return False
    
    def import_profile(self, profile_path: str) -> Dict:
        """
        Importa un perfil desde un archivo .voicepack
        
        Args:
            profile_path: Ruta al archivo .voicepack
        
        Returns:
            Diccionario con información del perfil importado
        """
        profile_path = Path(profile_path)
        
        if not profile_path.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {profile_path}")
        
        if profile_path.suffix != self.PROFILE_EXTENSION:
            raise ValueError(f"Extensión inválida. Se espera {self.PROFILE_EXTENSION}")
        
        # Extraer ZIP temporalmente
        import tempfile
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            try:
                with zipfile.ZipFile(profile_path, 'r') as zipf:
                    zipf.extractall(temp_path)
                
                # Buscar archivo profile.json
                profile_json = None
                for file_path in temp_path.rglob("profile.json"):
                    profile_json = file_path
                    break
                
                if not profile_json:
                    raise ValueError("No se encontró profile.json en el paquete")
                
                # Leer metadata
                with open(profile_json, 'r', encoding='utf-8') as f:
                    profile_data = json.load(f)
                
                profile_type = profile_data.get("type", "voice")
                profile_id = profile_data.get("id")
                
                if not profile_id:
                    raise ValueError("Perfil sin ID válido")
                
                # Determinar directorio de destino
                if profile_type == "voice":
                    dest_dir = self.profiles_dir / f"voice_{profile_id}"
                else:
                    dest_dir = self.personalities_dir / f"personality_{profile_id}"
                
                # Verificar si ya existe
                if dest_dir.exists():
                    print(f"Perfil {profile_id} ya existe, actualizando...")
                    shutil.rmtree(dest_dir)
                
                # Copiar archivos - buscar el directorio correcto dentro del ZIP
                source_dir = None
                for dir_type in ["voice", "personality"]:
                    test_dir = temp_path / dir_type
                    if test_dir.exists():
                        source_dir = test_dir
                        break
                
                if not source_dir:
                    # Si no hay subdirectorio, usar la raíz temporal
                    source_dir = temp_path
                
                shutil.copytree(source_dir, dest_dir, dirs_exist_ok=True)
                
                # Si es voz, copiar modelo al directorio de TTS
                if profile_type == "voice":
                    model_file = profile_data.get("files", {}).get("model")
                    if model_file:
                        src_model = dest_dir / model_file
                        if src_model.exists():
                            dest_model = self.voices_dir / model_file
                            shutil.copy2(src_model, dest_model)
                
                print(f"Perfil importado exitosamente: {profile_data.get('name')}")
                return profile_data
                
            except Exception as e:
                print(f"Error importando perfil: {e}")
                raise
    
    def list_profiles(self, profile_type: Optional[str] = None) -> List[Dict]:
        """
        Lista todos los perfiles disponibles
        
        Args:
            profile_type: Filtrar por tipo (voice, personality, o None para todos)
        
        Returns:
            Lista de diccionarios con información de perfiles
        """
        profiles = []
        
        # Perfiles de voz
        if profile_type is None or profile_type == "voice":
            for profile_dir in self.profiles_dir.glob("voice_*"):
                profile_json = profile_dir / "profile.json"
                if profile_json.exists():
                    with open(profile_json, 'r', encoding='utf-8') as f:
                        profiles.append(json.load(f))
        
        # Perfiles de personalidad
        if profile_type is None or profile_type == "personality":
            for profile_dir in self.personalities_dir.glob("personality_*"):
                profile_json = profile_dir / "profile.json"
                if profile_json.exists():
                    with open(profile_json, 'r', encoding='utf-8') as f:
                        profiles.append(json.load(f))
        
        return profiles
    
    def get_profile(self, profile_id: str, profile_type: str) -> Optional[Dict]:
        """Obtiene información detallada de un perfil"""
        if profile_type == "voice":
            source_dir = self.profiles_dir / f"voice_{profile_id}"
        else:
            source_dir = self.personalities_dir / f"personality_{profile_id}"
        
        profile_json = source_dir / "profile.json"
        if profile_json.exists():
            with open(profile_json, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
    
    def delete_profile(self, profile_id: str, profile_type: str) -> bool:
        """Elimina un perfil"""
        if profile_type == "voice":
            source_dir = self.profiles_dir / f"voice_{profile_id}"
            # También eliminar del directorio de voces
            profile_data = self.get_profile(profile_id, profile_type)
            if profile_data:
                model_file = profile_data.get("files", {}).get("model")
                if model_file:
                    voice_file = self.voices_dir / model_file
                    if voice_file.exists():
                        voice_file.unlink()
        else:
            source_dir = self.personalities_dir / f"personality_{profile_id}"
        
        if source_dir.exists():
            shutil.rmtree(source_dir)
            return True
        return False
    
    def apply_personality(self, profile_id: str) -> Optional[Dict]:
        """
        Aplica una personalidad al sistema
        
        Args:
            profile_id: ID del perfil de personalidad
        
        Returns:
            Configuración de personalidad aplicada o None si error
        """
        profile = self.get_profile(profile_id, "personality")
        if not profile:
            return None
        
        # Retornar configuración lista para usar en Ollama
        return {
            "system_prompt": profile.get("system_prompt", ""),
            "tone": profile.get("tone", "friendly"),
            "language": profile.get("language", "es"),
            "traits": profile.get("traits", [])
        }
    
    def scan_usb_for_profiles(self, usb_path: str) -> List[str]:
        """
        Escanea una ruta USB en busca de archivos .voicepack
        
        Args:
            usb_path: Ruta del dispositivo USB
        
        Returns:
            Lista de rutas a archivos .voicepack encontrados
        """
        usb_path = Path(usb_path)
        if not usb_path.exists():
            return []
        
        voicepacks = []
        for file_path in usb_path.rglob(f"*{self.PROFILE_EXTENSION}"):
            voicepacks.append(str(file_path))
        
        return voicepacks
