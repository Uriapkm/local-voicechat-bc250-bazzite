#!/usr/bin/env python3
"""
Aplicación de ejemplo para el sistema AI en Bazzite/Distrobox
Edita este archivo o crea tu propio main.py
"""

def main():
    print("=" * 50)
    print("🚀 Sistema AI iniciado correctamente!")
    print("=" * 50)
    print()
    print("✅ El entorno virtual está activo")
    print("✅ Python está funcionando en el contenedor Distrobox")
    print()
    print("Ahora puedes:")
    print("  1. Editar app.py con tu código")
    print("  2. Añadir librerías a requirements.txt")
    print("  3. Ejecutar: ./install-libs.sh")
    print("  4. Reiniciar con: ./start.sh")
    print()
    print("Para probar Ollama (si está instalado):")
    print("  distrobox enter <nombre-contenedor>")
    print("  ollama run llama3.2 'Hola, ¿cómo estás?'")
    print("=" * 50)

if __name__ == "__main__":
    main()
