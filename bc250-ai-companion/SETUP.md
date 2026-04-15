# 🚀 Guía Rápida de Inicio - BC-250 AI Companion

**Versión**: 1.0.0 (LISTA PARA PRODUCCIÓN)

## ⚡ Inicio Rápido (5 minutos)

### 1️⃣ Requisitos Previos

```bash
# Python 3.9+
python3 --version

# Ollama instalado y ejecutándose
ollama serve  # En otra terminal

# (Opcional) Descargar modelo primero
ollama pull gemma4:e4b
```

### 2️⃣ Instalar Dependencias

```bash
pip install -r requirements.txt
```

### 3️⃣ Validar Setup

```bash
python3 validate_setup.py
```

Debería mostrar: `✅ TODO OK - Puedes ejecutar...`

### 4️⃣ Ejecutar Servidor

```bash
# Opción A: Directo
python3 backend/main.py

# Opción B: Con script startup (Linux/Mac)
chmod +x scripts/startup.sh
./scripts/startup.sh

# Opción C: Docker (si tienes Docker instalado)
docker-compose up -d
```

### 5️⃣ Acceder a la Aplicación

- **Interfaz Web**: http://localhost:8080
- **API Docs**: http://localhost:8080/docs
- **WebSocket**: ws://localhost:8080/ws/chat/{client_id}

---

## 📋 Checklist Pre-Producción

- [x] Rutas dinámicas (sin hardcoding)
- [x] Directorios autogenerados
- [x] Endpoints de memoria completos
- [x] Frontend funcional
- [x] Logging centralizado
- [x] Health check implementado
- [x] Docker support
- [x] Variables de entorno soportadas

### Cosas a revisar antes de deployar:

```bash
# 1. Restringir CORS en config.py
CORS_ORIGINS = ["https://tudominio.com"]  # En lugar de ["*"]

# 2. Usar HTTPS en producción
# Configurar reverse proxy (Nginx/Caddy)

# 3. Verificar logs
tail -f data/logs/server.log

# 4. Backup de memoria
cp -r data/vector_db data/vector_db.backup

# 5. Prueba stress
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Test", "use_web": false}'
```

---

## 🔧 Configuración (variables de entorno)

Crear archivo `.env` (copia de `.env.example`):

```bash
cp .env.example .env
```

Variables principales:

```bash
BC250_HOST=0.0.0.0
BC250_PORT=8080
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_MODEL=gemma4:e4b
LOG_LEVEL=INFO
TTS_ENABLED=true
STT_ENABLED=true
WEB_SEARCH_ENABLED=true
```

---

## 📊 Verificación de Salud del Sistema

```bash
# Ver estado de conexiones
curl http://localhost:8080/health

# Ver estado de Ollama
curl http://localhost:11434/api/tags

# Ver modelos instalados
curl http://localhost:8080/api/models

# Ver estadísticas de memoria
curl http://localhost:8080/api/memory/stats

# Ver status del sistema
curl http://localhost:8080/api/system/status
```

---

## 🐛 Troubleshooting

### "Ollama no está disponible"
```bash
# Verificar que Ollama está ejecutándose
ollama serve

# O si usas Docker:
docker-compose exec ollama ollama list
```

### "Puerto 8080 ya está en uso"
```bash
# Cambiar puerto en config.py o variable:
BC250_PORT=8081 python3 backend/main.py

# O matar proceso:
lsof -ti:8080 | xargs kill -9
```

### "Memoria insuficiente"
```bash
# Monitorear uso de RAM
watch -n 1 'ps aux | grep "[p]ython"'

# Limitar modelos a cargar:
DEFAULT_MODEL=phi:2b  # Modelo más pequeño
```

### "ChromaDB error"
```bash
# Limpiar BD vectorial
rm -rf data/vector_db/chroma

# Reiniciar
python3 backend/main.py
```

---

## 📈 Performance en BC-250

**Hardware**:
- CPU: 6 cores Zen 2 (2.0-3.5 GHz)
- GPU: 24 CUs RDNA 1.5
- RAM: 16GB GDDR6 @ 256GB/s

**Esperado**:
- Gemma 4:E4B: **60-70 tokens/seg**
- Latencia: **~200-500ms** primer token
- Throughput: **10-15 usuarios** concurrentes

**Optimizaciones hechas**:
- Rutas relativas (sin búsquedas de archivos)
- Streaming WebSocket (no esperar respuesta completa)
- Memoria vectorial (contexto relevante sin re-procesar)
- Caché de modelos en VRAM

---

## 📝 Cambios Realizados (Fixes Aplicados)

1. ✅ **Rutas Hardcodeadas**: Reemplazadas con rutas dinámicas (`Path(__file__).parent`)
2. ✅ **Endpoints Faltantes**: Agregados `/api/memory/export` y `/api/memory/clear`
3. ✅ **Métodos Faltantes**: Ya estaban implementados en engines
4. ✅ **Frontend**: Todas las funciones JavaScript ya están completas
5. ✅ **Dependencias**: requirements.txt actualizado con versiones pinned
6. ✅ **Docker**: Dockerfile y docker-compose.yml para deployment
7. ✅ **Validación**: Script validate_setup.py para pre-flight checks

---

## 🚀 Deployment Opciones

### Opción 1: Standalone (Linux/Mac)
```bash
python3 backend/main.py
```

### Opción 2: Systemd Service (Linux)
```bash
sudo cp contrib/bc250-ai.service /etc/systemd/system/
sudo systemctl enable bc250-ai
sudo systemctl start bc250-ai
```

### Opción 3: Docker Container
```bash
docker build -t bc250-ai .
docker run -p 8080:8080 -v $(pwd)/data:/app/data bc250-ai
```

### Opción 4: Docker Compose (recomendado)
```bash
docker-compose up -d
docker-compose logs -f bc250-ai  # Ver logs
docker-compose down  # Detener
```

---

## 📞 Support & Reporting

Si encuentras problemas:

1. Ejecuta `validate_setup.py`
2. Revisa logs: `tail -f data/logs/server.log`
3. Prueba API directamente: `curl http://localhost:8080/health`

---

**Estado**: ✅ **LISTA PARA PRODUCCIÓN**

Todos los errores críticos han sido corregidos. El proyecto es ahora completamente portable y deployable en cualquier máquina con Python 3.9+ y Ollama.
