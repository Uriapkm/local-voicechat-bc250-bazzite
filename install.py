#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
INSTALADOR DEL SISTEMA AI EN DISTROBOX (BAZZITE)
================================================
Este script configura automáticamente un entorno virtual dentro de distrobox,
instala ollama, descarga modelos y prepara todo para ejecutar tu aplicación.

Uso:
    1. Edita config.ini con tus preferencias
    2. Ejecuta: python install.py
    3. Espera a que termine la instalación
    4. Usa start.py para iniciar el sistema
"""

import configparser
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
    RESET = '\033[0m'
    NEGRITA = '\033[1m'


def log(mensaje, nivel="INFO"):
    """Imprime mensajes formateados"""
    colores = {
        "INFO": Colores.AZUL,
        "OK": Colores.VERDE,
        "ERROR": Colores.ROJO,
        "WARN": Colores.AMARILLO
    }
    color = colores.get(nivel, Colores.RESET)
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"{color}[{timestamp}] [{nivel}]{Colores.RESET} {mensaje}")


def ejecutar_comando(comando, descripcion="", mostrar_salida=False):
    """Ejecuta un comando y maneja errores"""
    if descripcion:
        log(f"Ejecutando: {descripcion}", "INFO")
    
    try:
        resultado = subprocess.run(
            comando,
            shell=True,
            capture_output=not mostrar_salida,
            text=True,
            timeout=600  # 10 minutos timeout máximo
        )
        
        if resultado.returncode != 0:
            if resultado.stderr:
                log(f"Error: {resultado.stderr.strip()}", "ERROR")
            return False, resultado.stderr
        
        if mostrar_salida and resultado.stdout:
            print(resultado.stdout)
            
        return True, resultado.stdout
        
    except subprocess.TimeoutExpired:
        log("Timeout en la ejecución del comando", "ERROR")
        return False, "Timeout"
    except Exception as e:
        log(f"Excepción: {str(e)}", "ERROR")
        return False, str(e)


def verificar_dependencias():
    """Verifica que distrobox y docker/podman estén instalados"""
    log("Verificando dependencias del sistema...", "INFO")
    
    # Verificar distrobox
    exito, _ = ejecutar_comando("which distrobox", "Verificando distrobox")
    if not exito:
        log("❌ distrobox no está instalado. Instálalo primero:", "ERROR")
        log("  En Bazzite: distrobox upgrade --force o usa el gestor de paquetes", "WARN")
        return False
    
    # Verificar motor de contenedores (docker o podman)
    exito, _ = ejecutar_comando("which docker || which podman", "Verificando Docker/Podman")
    if not exito:
        log("❌ No se encontró Docker ni Podman", "ERROR")
        return False
    
    log("✅ Dependencias verificadas correctamente", "OK")
    return True


def cargar_configuracion(ruta_config="config.ini"):
    """Carga y valida el archivo de configuración"""
    if not Path(ruta_config).exists():
        log(f"❌ No se encontró {ruta_config}", "ERROR")
        return None
    
    config = configparser.ConfigParser()
    config.read(ruta_config)
    
    # Validar secciones requeridas
    secciones_requeridas = ['general', 'ollama', 'rutas', 'app']
    for seccion in secciones_requeridas:
        if seccion not in config:
            log(f"❌ Falta sección [{seccion}] en config.ini", "ERROR")
            return None
    
    # Expandir variables de entorno en host_app_dir
    host_dir = config['rutas']['host_app_dir']
    if '${HOME}' in host_dir or '$HOME' in host_dir:
        host_dir = os.path.expandvars(host_dir)
    config['rutas']['host_app_dir_expanded'] = host_dir
    
    log("✅ Configuración cargada correctamente", "OK")
    return config


def crear_contenedor_distrobox(config):
    """Crea o verifica el contenedor distrobox"""
    container_name = config['general']['container_name']
    base_image = config['general']['base_image']
    host_dir = config['rutas']['host_app_dir_expanded']
    
    log(f"Verificando contenedor '{container_name}'...", "INFO")
    
    # Verificar si ya existe
    exito, salida = ejecutar_comando(
        f"distrobox list | grep -w {container_name}",
        "Buscando contenedor existente"
    )
    
    if exito and container_name in salida:
        log(f"⚠️  El contenedor '{container_name}' ya existe", "WARN")
        respuesta = input("¿Quieres eliminarlo y crear uno nuevo? (s/n): ").lower()
        if respuesta == 's':
            log(f"Eliminando contenedor '{container_name}'...", "INFO")
            ejecutar_comando(f"distrobox rm -f {container_name}", "Eliminando contenedor")
        else:
            log("Usando contenedor existente", "INFO")
            return True
    
    # Crear contenedor con volumen montado
    log(f"Creando contenedor '{container_name}' con imagen {base_image}...", "INFO")
    comando = (
        f"distrobox create -n {container_name} "
        f"-i {base_image} "
        f"--home $HOME/{container_name}-home "
        f"--volume {host_dir}:{host_dir} "
        f"--additional-flags '--security-opt label=disable'"
    )
    
    exito, _ = ejecutar_comando(comando, "Creando contenedor distrobox", mostrar_salida=True)
    if not exito:
        log("❌ Error al crear el contenedor", "ERROR")
        return False
    
    log(f"✅ Contenedor '{container_name}' creado exitosamente", "OK")
    return True


def instalar_en_contenedor(config):
    """Instala Python, venv, ollama y dependencias dentro del contenedor"""
    container_name = config['general']['container_name']
    venv_path = config['general']['venv_path']
    host_dir = config['rutas']['host_app_dir_expanded']
    modelos = config['ollama']['models'].replace(' ', '').split(',')
    
    log("Iniciando instalación dentro del contenedor...", "INFO")
    
    # 1. Actualizar e instalar Python y pip
    log("Actualizando paquetes e instalando Python...", "INFO")
    comandos_instalacion = [
        # Intentar con dnf (Fedora/RHEL)
        f"distrobox enter {container_name} -- sudo dnf update -y",
        f"distrobox enter {container_name} -- sudo dnf install -y python3 python3-pip python3-venv git curl wget",
    ]
    
    # Probar instalación, si falla intentar con apt (Ubuntu/Debian)
    instalacion_ok = False
    for comando in comandos_instalacion:
        exito, _ = ejecutar_comando(comando, "Instalando dependencias básicas", mostrar_salida=False)
        if exito:
            instalacion_ok = True
            break
    
    if not instalacion_ok:
        # Intentar con apt
        log("Intentando con gestor de paquetes apt...", "WARN")
        comandos_apt = [
            f"distrobox enter {container_name} -- sudo apt update -y",
            f"distrobox enter {container_name} -- sudo apt install -y python3 python3-pip python3-venv git curl wget",
        ]
        for comando in comandos_apt:
            exito, _ = ejecutar_comando(comando, "Instalando con apt")
            if exito:
                instalacion_ok = True
                break
    
    if not instalacion_ok:
        log("❌ No se pudo instalar Python en el contenedor", "ERROR")
        return False
    
    log("✅ Python y dependencias instalados", "OK")
    
    # 2. Crear entorno virtual
    log(f"Creando entorno virtual en {venv_path}...", "INFO")
    exito, _ = ejecutar_comando(
        f"distrobox enter {container_name} -- python3 -m venv {venv_path}",
        "Creando entorno virtual"
    )
    if not exito:
        log("❌ Error al crear el entorno virtual", "ERROR")
        return False
    
    log("✅ Entorno virtual creado", "OK")
    
    # 3. Instalar Ollama dentro del contenedor
    log("Instalando Ollama...", "INFO")
    
    # Verificar si ollama ya está instalado
    exito, salida = ejecutar_comando(
        f"distrobox enter {container_name} -- which ollama",
        "Verificando si Ollama ya está instalado"
    )
    
    if exito and "ollama" in salida:
        log("⚠️  Ollama ya está instalado en el contenedor", "WARN")
    else:
        # Instalar ollama
        exito, _ = ejecutar_comando(
            f"distrobox enter {container_name} -- curl -fsSL https://ollama.com/install.sh | sh",
            "Descargando e instalando Ollama",
            mostrar_salida=True
        )
        if not exito:
            log("⚠️  Error instalando Ollama, pero continuamos...", "WARN")
    
    log("✅ Ollama instalado/configurado", "OK")
    
    # 4. Descargar modelos
    if modelos and modelos[0]:  # Si hay modelos especificados
        log("Descargando modelos de Ollama...", "INFO")
        for modelo in modelos:
            if modelo:  # Evitar strings vacíos
                log(f"  → Descargando modelo: {modelo}", "INFO")
                exito, _ = ejecutar_comando(
                    f"distrobox enter {container_name} -- ollama pull {modelo}",
                    f"Descargando {modelo}",
                    mostrar_salida=False
                )
                if exito:
                    log(f"    ✅ {modelo} descargado", "OK")
                else:
                    log(f"    ⚠️  Error descargando {modelo}", "WARN")
    
    # 5. Instalar requirements.txt si existe
    requirements_path = f"{host_dir}/requirements.txt"
    if Path(requirements_path).exists():
        log("Instalando dependencias de Python desde requirements.txt...", "INFO")
        exito, _ = ejecutar_comando(
            f"distrobox enter {container_name} -- {venv_path}/bin/pip install -r {requirements_path}",
            "Instalando requirements.txt",
            mostrar_salida=False
        )
        if exito:
            log("✅ Dependencias de Python instaladas", "OK")
        else:
            log("⚠️  Error instalando requirements.txt", "WARN")
    else:
        log("No se encontró requirements.txt, saltando instalación de paquetes Python", "INFO")
    
    # 6. Guardar configuración para el script de inicio
    guardar_configuracion_runtime(config)
    
    return True


def guardar_configuracion_runtime(config):
    """Guarda configuración en un archivo para el script de inicio"""
    container_name = config['general']['container_name']
    venv_path = config['general']['venv_path']
    startup_command = config['app']['startup_command']
    app_port = config['rutas']['app_port']
    
    config_runtime = f"""# Generado automáticamente por install.py
CONTAINER_NAME="{container_name}"
VENV_PATH="{venv_path}"
STARTUP_COMMAND="{startup_command}"
APP_PORT="{app_port}"
"""
    
    with open(".config_runtime", "w") as f:
        f.write(config_runtime)
    
    log("Configuración runtime guardada en .config_runtime", "OK")


def main():
    """Función principal"""
    print(Colores.NEGRITA + "\n" + "="*60)
    print(" INSTALADOR DE SISTEMA AI EN DISTROBOX (BAZZITE)")
    print("="*60 + Colores.RESET + "\n")
    
    # 1. Cargar configuración
    config = cargar_configuracion()
    if not config:
        sys.exit(1)
    
    # 2. Verificar dependencias
    if not verificar_dependencias():
        sys.exit(1)
    
    # 3. Crear contenedor
    if not crear_contenedor_distrobox(config):
        sys.exit(1)
    
    # 4. Instalar todo dentro del contenedor
    if not instalar_en_contenedor(config):
        sys.exit(1)
    
    print("\n" + Colores.VERDE + "="*60)
    print(" ✅ INSTALACIÓN COMPLETADA EXITOSAMENTE")
    print("="*60 + Colores.RESET)
    print(f"\nAhora puedes iniciar el sistema con:")
    print(f"  {Colores.AZUL}python start.py{Colores.RESET}")
    print(f"\nO entrar manualmente al contenedor con:")
    print(f"  {Colores.AZUL}distrobox enter {config['general']['container_name']}{Colores.RESET}\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n" + Colores.AMARILLO + "⚠️  Instalación interrumpida por el usuario" + Colores.RESET)
        sys.exit(1)
    except Exception as e:
        log(f"Error fatal: {str(e)}", "ERROR")
        sys.exit(1)
