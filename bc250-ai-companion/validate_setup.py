#!/usr/bin/env python3
"""
BC-250 AI Companion - Validador de setup
Verifica que todo está configurado correctamente antes de ejecutar
"""

import sys
import os
from pathlib import Path

def check_python_version():
    """Verifica versión de Python"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 9):
        print(f"❌ Python 3.9+ requerido, tienes {version.major}.{version.minor}")
        return False
    print(f"✅ Python {version.major}.{version.minor} OK")
    return True

def check_directories():
    """Verifica/crea directorios necesarios"""
    base_dir = Path(__file__).parent.parent
    dirs_needed = [
        "data/vector_db",
        "data/tts_models",
        "data/stt_models",
        "data/profiles",
        "data/personalities",
        "data/logs",
        "frontend",
        "backend"
    ]
    
    for dir_path in dirs_needed:
        full_path = base_dir / dir_path
        if not full_path.exists():
            try:
                full_path.mkdir(parents=True, exist_ok=True)
                print(f"✅ Directorio creado: {dir_path}")
            except Exception as e:
                print(f"❌ Error creando {dir_path}: {e}")
                return False
        else:
            print(f"✅ Directorio existe: {dir_path}")
    
    return True

def check_dependencies():
    """Verifica dependencias Python"""
    required_packages = [
        "fastapi",
        "uvicorn",
        "requests",
        "pydantic",
        "beautifulsoup4",
        "chromadb",
        "python-multipart"
    ]
    
    import importlib
    
    for package in required_packages:
        try:
            importlib.import_module(package.replace("-", "_"))
            print(f"✅ {package} instalado")
        except ImportError:
            print(f"❌ {package} NO instalado - ejecuta: pip install {package}")
            return False
    
    return True

def check_files():
    """Verifica archivos críticos"""
    base_dir = Path(__file__).parent.parent
    files_needed = [
        "backend/main.py",
        "backend/config.py",
        "backend/memory_core.py",
        "backend/ollama_manager.py",
        "frontend/index.html",
        "frontend/app.js",
        "frontend/style.css"
    ]
    
    for file_path in files_needed:
        full_path = base_dir / file_path
        if full_path.exists():
            print(f"✅ Archivo encontrado: {file_path}")
        else:
            print(f"❌ Archivo FALTANTE: {file_path}")
            return False
    
    return True

def main():
    print("=" * 50)
    print("BC-250 AI Companion - Validador de Setup")
    print("=" * 50)
    print()
    
    checks = [
        ("Python Version", check_python_version),
        ("Directorios", check_directories),
        ("Archivos", check_files),
        ("Dependencias Python", check_dependencies),
    ]
    
    passed = 0
    failed = 0
    
    for name, check_func in checks:
        print(f"\n📋 Verificando: {name}")
        print("-" * 40)
        try:
            if check_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ Error: {e}")
            failed += 1
    
    print(f"\n{'=' * 50}")
    print(f"Resultado: {passed} OK, {failed} FALLOS")
    print(f"{'=' * 50}\n")
    
    if failed == 0:
        print("✅ TODO OK - Puedes ejecutar: python3 backend/main.py")
        return 0
    else:
        print("❌ Hay errores que corregir")
        return 1

if __name__ == "__main__":
    sys.exit(main())
