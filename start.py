#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
INICIADOR DEL SISTEMA AI EN DISTROBOX (BAZZITE)
================================================
Este script inicia tu aplicación dentro del entorno virtual en distrobox.

Uso:
    python start.py

El script leerá la configuración generada por install.py y ejecutará
tu aplicación en el entorno adecuado.
"""

import subprocess
import sys
import os
from pathlib import Path
from datetime import datetime


class Colores:
    """Colores para terminal"""
    VERDE = '\033[92m'
    ROJO = '\033[91m'
    AMARILLO = '\033[93m'
    AZUL = '\033[94m'
    MAGENTA = '\033[95m'
    RESET = '\033[0m'
    NEGRITA = '\033[1m'


def log(mensaje, nivel="INFO"):
    """Imprime mensajes formateados"""
    colores = {
        "INFO": Colores.AZUL,
        "OK": Colores.VERDE,
        "ERROR": Colores.ROJO,
        "WARN": Colores.AMARILLO,
        "START": Colores.MAGENTA
    }
    color = colores.get(nivel, Colores.RESET)
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"{color}[{timestamp}] [{nivel}]{Colores.RESET} {mensaje}")


def cargar_config_runtime():
    """Carga la configuración runtime generada por install.py"""
    config_file = Path(".config_runtime")
    
    if not config_file.exists():
        log("❌ No se encontró .config_runtime", "ERROR")
        log("   Ejecuta primero: python install.py", "WARN")
        return None
    
    config = {}
    try:
        with open(config_file, 'r') as f:
            for linea in f:
                linea = linea.strip()
                if linea and not linea.startswith('#') and '=' in linea:
                    clave, valor = linea.split('=', 1)
                    config[clave.strip()] = valor.strip().strip('"')
        
        # Validar campos requeridos
        campos_requeridos = ['CONTAINER_NAME', 'VENV_PATH', 'STARTUP_COMMAND']
        for campo in campos_requeridos:
            if campo not in config:
                log(f"❌ Falta campo {campo} en .config_runtime", "ERROR")
                return None
        
        return config
        
    except Exception as e:
        log(f"Error leyendo configuración: {str(e)}", "ERROR")
        return None


def verificar_contenedor(container_name):
    """Verifica que el contenedor exista y esté corriendo"""
    log(f"Verificando contenedor '{container_name}'...", "INFO")
    
    # Verificar si existe
    exito, salida = subprocess.run(
        f"distrobox list | grep -w {container_name}",
        shell=True,
        capture_output=True,
        text=True
    ).returncode == 0, ""
    
    if not exito:
        log(f"❌ El contenedor '{container_name}' no existe", "ERROR")
        log("   Ejecuta primero: python install.py", "WARN")
        return False
    
    log(f"✅ Contenedor '{container_name}' encontrado", "OK")
    return True


def verificar_ollama(container_name):
    """Verifica que ollama esté disponible en el contenedor"""
    log("Verificando Ollama...", "INFO")
    
    exito = subprocess.run(
        f"distrobox enter {container_name} -- which ollama",
        shell=True,
        capture_output=True
    ).returncode == 0
    
    if not exito:
        log("⚠️  Ollama no está instalado en el contenedor", "WARN")
        log("   Puedes instalarlo manualmente o re-ejecutar install.py", "WARN")
        return False
    
    log("✅ Ollama disponible", "OK")
    return True


def iniciar_ollama_server(container_name):
    """Inicia el servidor de Ollama en background si no está corriendo"""
    log("Verificando servidor Ollama...", "INFO")
    
    # Verificar si ya está corriendo
    exito = subprocess.run(
        f"distrobox enter {container_name} -- pgrep -x ollama",
        shell=True,
        capture_output=True
    ).returncode == 0
    
    if exito:
        log("Servidor Ollama ya está corriendo", "OK")
        return True
    
    # Iniciar servidor
    log("Iniciando servidor Ollama en background...", "INFO")
    subprocess.Popen(
        f"distrobox enter {container_name} -- ollama serve > /dev/null 2>&1 &",
        shell=True
    )
    
    # Esperar un momento para que arranque
    import time
    time.sleep(3)
    
    log("✅ Servidor Ollama iniciado", "OK")
    return True


def ejecutar_aplicacion(container_name, venv_path, startup_command):
    """Ejecuta la aplicación en el contenedor"""
    log(f"Iniciando aplicación: {startup_command}", "START")
    print(Colores.NEGRITA + "\n" + "="*60)
    print(" INICIANDO APLICACIÓN")
    print("="*60 + Colores.RESET + "\n")
    
    # Comando completo para entrar al contenedor, activar venv y ejecutar
    comando_completo = (
        f"distrobox enter {container_name} -- "
        f"bash -c 'source {venv_path}/bin/activate && {startup_command}'"
    )
    
    try:
        # Ejecutar mostrando la salida en tiempo real
        proceso = subprocess.run(
            comando_completo,
            shell=True,
            env=os.environ.copy()
        )
        
        if proceso.returncode == 0:
            log("Aplicación finalizada correctamente", "OK")
        else:
            log(f"Aplicación finalizó con código {proceso.returncode}", "WARN")
            
    except KeyboardInterrupt:
        print("\n")
        log("Aplicación detenida por el usuario", "WARN")
    except Exception as e:
        log(f"Error ejecutando aplicación: {str(e)}", "ERROR")
        return False
    
    return True


def main():
    """Función principal"""
    print(Colores.NEGRITA + "\n" + "="*60)
    print(" INICIADOR DE SISTEMA AI EN DISTROBOX (BAZZITE)")
    print("="*60 + Colores.RESET + "\n")
    
    # 1. Cargar configuración
    config = cargar_config_runtime()
    if not config:
        sys.exit(1)
    
    container_name = config['CONTAINER_NAME']
    venv_path = config['VENV_PATH']
    startup_command = config['STARTUP_COMMAND']
    
    # 2. Verificar contenedor
    if not verificar_contenedor(container_name):
        sys.exit(1)
    
    # 3. Verificar ollama (opcional)
    verificar_ollama(container_name)
    
    # 4. Iniciar servidor ollama si es necesario
    iniciar_ollama_server(container_name)
    
    # 5. Ejecutar aplicación
    if not ejecutar_aplicacion(container_name, venv_path, startup_command):
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n" + Colores.AMARILLO + "⚠️  Sistema detenido por el usuario" + Colores.RESET)
        sys.exit(0)
    except Exception as e:
        log(f"Error fatal: {str(e)}", "ERROR")
        sys.exit(1)
