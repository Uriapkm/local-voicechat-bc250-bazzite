# Sistema AI para Bazzite (Distrobox)

Sistema de instalación y ejecución simplificado para aplicaciones AI en Bazzite OS usando Distrobox. Todo se ejecuta en un entorno aislado dentro de un contenedor, ideal para sistemas inmutables como Bazzite.

## 📁 Archivos principales

| Archivo | Descripción |
|---------|-------------|
| `config.ini` | **Configuración** - Edita esto primero con tus datos |
| `install.sh` | **Instalador** - Ejecútalo UNA VEZ para preparar todo |
| `start.sh` | **Iniciador** - Ejecútalo CADA VEZ que quieras usar la app |
| `install-libs.sh` | **Librerías** - Instala dependencias Python adicionales |
| `requirements.txt` | **Dependencias** - Lista de librerías Python a instalar |

## 🚀 Instalación rápida

### Método recomendado: Script único (automático)

**Para primera vez o reinstalación:**

```bash
./run.sh
```

Este script:
- ✅ Detecta y verifica dependencias automáticamente
- ✅ Crea el contenedor Distrobox optimizado para BC250/handhelds
- ✅ Instala Python, Ollama y dependencias
- ✅ Descarga el modelo base recomendado (`fredrezones55/Gemma-4-Uncensored-HauhauCS-Aggressive:e4b`)
- ✅ Genera configuración óptima según tu hardware
- ✅ Inicia la aplicación automáticamente

**Opciones útiles:**

```bash
./run.sh --help              # Ver todas las opciones
./run.sh -i                  # Modo interactivo para elegir modelo
./run.sh --model llama3.2    # Usar un modelo específico
./run.sh --reinstall         # Reinstalar desde cero
./run.sh --no-ollama         # Sin Ollama (solo app)
```

### Método tradicional: Configuración manual

Si prefieres control total sobre la configuración:

#### 1. Editar configuración

Abre `config.ini` y ajusta los valores:

```ini
[CONTAINER]
name = mi-ai-box                    # Nombre del contenedor
image = docker.io/library/fedora:latest  # Imagen base

[PYTHON]
version = 3.11                      # Versión de Python
venv_path = /home/user/ai-project/venv

[OLLAMA]
install_ollama = true               # ¿Instalar Ollama?
models = llama3.2 mistral           # Modelos a descargar

[APP]
start_command = python main.py      # Comando para iniciar tu app
ports = 8501:8501                   # Puertos (si es web)
```

#### 2. Ejecutar instalación (solo una vez)

```bash
./install.sh
```

Este script:
- ✅ Verifica dependencias (distrobox, docker/podman)
- ✅ Crea el contenedor Distrobox
- ✅ Instala Python y pip dentro del contenedor
- ✅ Crea el entorno virtual
- ✅ Instala las dependencias de `requirements.txt` si existe
- ✅ Instala Ollama (si está habilitado)
- ✅ Descarga los modelos especificados
- ✅ Genera `start.sh` automáticamente

#### 3. Instalar librerías Python (opcional)

Edita `requirements.txt` con tus dependencias:

```txt
requests
openai
langchain
streamlit
```

Luego instala:

```bash
./install-libs.sh
```

#### 4. Iniciar la aplicación

Cada vez que quieras usar tu sistema:

```bash
./start.sh
```

O usa el script unificado:

```bash
./run.sh
```

## 📋 Comandos útiles

### Script unificado (recomendado)

```bash
./run.sh                    # Instalación + inicio automático
./run.sh -i                 # Modo interactivo para elegir modelo
./run.sh --model llama3.2   # Usar modelo específico
./run.sh --reinstall        # Reinstalar desde cero
./run.sh --help             # Ver todas las opciones
```

### Entrar manualmente al contenedor

```bash
distrobox enter mi-ai-box
```

### Activar el entorno virtual manualmente

```bash
# Dentro del contenedor
source /home/user/ai-project/venv/bin/activate
```

### Ver estado del contenedor

```bash
distrobox list
```

### Eliminar y reinstalar

```bash
distrobox rm -f mi-ai-box
./install.sh
```

## ⚙️ Configuración detallada

### Sección [CONTAINER]

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `name` | Nombre del contenedor | `mi-ai-box` |
| `image` | Imagen Docker base | `fedora:latest`, `ubuntu:22.04` |
| `mount_path` | Ruta de montaje interno | `/home/user/ai-project` |

### Sección [PYTHON]

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `version` | Versión de Python | `3.11`, `3.12` |
| `venv_path` | Ruta del venv | `/home/user/ai-project/venv` |

### Sección [OLLAMA]

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `install_ollama` | Instalar Ollama | `true` o `false` |
| `models` | Modelos a descargar | `llama3.2 mistral codellama` |

### Sección [APP]

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `start_command` | Comando de inicio | `python main.py`, `streamlit run app.py` |
| `ports` | Mapeo de puertos | `8501:8501 8080:8080` |

## 🔧 Solución de problemas

### Error: "distrobox no encontrado"

En Bazzite, asegúrate de tener distrobox instalado:

```bash
# Usando flatpak (recomendado en Bazzite)
flatpak install flathub com.docker.docker

# O usa el gestor de paquetes de tu distro
```

### Error: "No se pudo descargar el modelo"

Verifica tu conexión a internet y que Ollama esté corriendo:

```bash
distrobox enter mi-ai-box
ollama serve &
ollama pull llama3.2
```

### Error: "Python no encontrado"

Intenta cambiar la imagen base en `config.ini` a una con mejor soporte:

```ini
image = docker.io/library/ubuntu:22.04
```

### El contenedor no inicia

Revisa los logs:

```bash
distrobox enter mi-ai-box -- bash -c "tail -n 50 /var/log/*"
```

## 📝 Notas importantes

1. **Bazzite es inmutable**: Todo se instala en el contenedor, no en el host
2. **No necesitas Python en el host**: Todo se instala dentro del contenedor
3. **Persistencia**: Tus datos en la carpeta del proyecto se mantienen
4. **Aislamiento**: El entorno virtual está completamente aislado del host
5. **Recursos**: Asegúrate de tener espacio suficiente para los modelos de IA
6. **BC250/Handhelds**: El modelo base está optimizado para estos dispositivos

## 🎯 Flujo de trabajo recomendado

### Para la mayoría de usuarios (recomendado):

1. Ejecutar `./run.sh` (instalación + inicio automático)
2. Usar `./run.sh` cada vez que quieras iniciar la aplicación
3. Cambiar modelo con `./run.sh --model nombre-modelo` si es necesario

### Para usuarios avanzados:

1. Configurar `config.ini` según tu proyecto
2. (Opcional) Editar `requirements.txt` con tus dependencias
3. Ejecutar `./install.sh` (una sola vez)
4. Si añadiste nuevas dependencias después de la instalación, ejecuta `./install-libs.sh`
5. Desarrollar tu aplicación en la carpeta del proyecto
6. Usar `./start.sh` o `./run.sh` cada vez que quieras ejecutar la app

---

**Hecho para Bazzite OS** - Funciona en cualquier distro con Distrobox
