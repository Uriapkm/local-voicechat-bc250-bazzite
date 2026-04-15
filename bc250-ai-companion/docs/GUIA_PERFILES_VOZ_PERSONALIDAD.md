# Guía de Creación e Importación de Voces y Personalidades

## BC-250 AI Companion - Sistema de Perfiles Portables

Esta guía explica cómo crear, exportar e importar voces y personalidades para tu asistente IA usando dispositivos USB.

---

## 📋 Índice

1. [Formato de Archivos](#formato-de-archivos)
2. [Crear Perfiles de Voz](#crear-perfiles-de-voz)
3. [Crear Perfiles de Personalidad](#crear-perfiles-de-personalidad)
4. [Exportar Perfiles a USB](#exportar-perfiles-a-usb)
5. [Importar Perfiles desde USB](#importar-perfiles-desde-usb)
6. [Ejemplos Prácticos](#ejemplos-prácticos)

---

## 📦 Formato de Archivos

### Extensión `.voicepack`
Los perfiles se empaquetan en archivos con extensión `.voicepack` (formato ZIP interno).

**Estructura interna:**
```
perfil_voz.voicepack
└── voice/
    ├── profile.json        # Metadata del perfil
    ├── model.onnx          # Modelo de voz (Piper)
    ├── model.onnx.json     # Configuración (opcional)
    └── sample.wav          # Audio de ejemplo (opcional)

perfil_personalidad.voicepack
└── personality/
    ├── profile.json        # Metadata del perfil
    └── system_prompt.txt   # Prompt de sistema
```

---

## 🎙️ Crear Perfiles de Voz

### Opción 1: Usando la API REST

```bash
# Crear perfil de voz desde archivo de modelo
curl -X POST "http://localhost:8080/api/profiles/create/voice" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria_ES",
    "description": "Voz femenina española natural",
    "voice_file": "/ruta/a/modelo.onnx"
  }'
```

### Opción 2: Manualmente

1. **Prepara los archivos:**
   - Modelo de voz (`.onnx` para Piper, `.pt` para MeloTTS, `.bin` para XTTS)
   - Configuración (`.json` si aplica)
   - Audio de ejemplo (`.wav`, opcional para cloning)

2. **Crea la estructura de directorios:**
```bash
mkdir -p voice_profile/maria
cp modelo.onnx voice_profile/maria/model.onnx
cp config.json voice_profile/maria/config.json
```

3. **Crea `profile.json`:**
```json
{
  "id": "maria001",
  "name": "Maria_ES",
  "description": "Voz femenina española natural",
  "type": "voice",
  "created_at": "2026-04-15T10:00:00",
  "engine": "piper",
  "language": "es",
  "files": {
    "model": "model.onnx",
    "config": "config.json",
    "sample": "sample.wav"
  }
}
```

4. **Empaqueta como .voicepack:**
```bash
cd voice_profile
zip -r maria.voicepack voice/
```

---

## 🧠 Crear Perfiles de Personalidad

### Opción 1: Usando la API REST

```bash
curl -X POST "http://localhost:8080/api/profiles/create/personality" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Asistente_Profesional",
    "system_prompt": "Eres un asistente profesional y eficiente. Responde de manera concisa y técnica.",
    "description": "Personalidad profesional para trabajo",
    "tone": "formal",
    "language": "es"
  }'
```

### Opción 2: Manualmente

1. **Crea la estructura:**
```bash
mkdir -p personality_profile/profesional
```

2. **Crea `profile.json`:**
```json
{
  "id": "prof001",
  "name": "Asistente_Profesional",
  "description": "Personalidad profesional para trabajo",
  "type": "personality",
  "created_at": "2026-04-15T10:00:00",
  "system_prompt": "Eres un asistente profesional y eficiente. Responde de manera concisa y técnica. Prioriza la precisión sobre la brevedad.",
  "traits": ["profesional", "técnico", "eficiente"],
  "tone": "formal",
  "language": "es",
  "version": "1.0"
}
```

3. **Crea `system_prompt.txt`:**
```
Eres un asistente profesional y eficiente. Responde de manera concisa y técnica. 
Prioriza la precisión sobre la brevedad. Usa terminología apropiada para el contexto.
```

4. **Empaqueta:**
```bash
cd personality_profile
zip -r profesional.voicepack personality/
```

---

## 💾 Exportar Perfiles a USB

### Desde la API

```bash
# Exportar perfil de voz
curl -X POST "http://localhost:8080/api/profiles/export" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "maria001",
    "profile_type": "voice",
    "output_path": "/media/USB/maria.voicepack"
  }'

# Exportar perfil de personalidad
curl -X POST "http://localhost:8080/api/profiles/export" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "prof001",
    "profile_type": "personality",
    "output_path": "/media/USB/profesional.voicepack"
  }'
```

### Copiar manualmente
```bash
# Montar USB
sudo mount /dev/sdb1 /media/usb

# Copiar archivos .voicepack
cp /workspace/bc250-ai-companion/data/profiles/voice_*/**/*.voicepack /media/usb/
cp /workspace/bc250-ai-companion/data/personalities/**/*.voicepack /media/usb/
```

---

## 📥 Importar Perfiles desde USB

### Método 1: Escaneo automático

```bash
# Escanear USB en busca de perfiles
curl "http://localhost:8080/api/profiles/scan-usb?usb_path=/media/usb"
```

### Método 2: Importación individual

```bash
# Importar desde ruta específica
curl -X POST "http://localhost:8080/api/profiles/import" \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/media/usb/maria.voicepack"
  }'
```

### Método 3: Script de importación masiva

```bash
#!/bin/bash
# import_from_usb.sh

USB_PATH="/media/usb"

for file in "$USB_PATH"/*.voicepack; do
  echo "Importando: $file"
  curl -X POST "http://localhost:8080/api/profiles/import" \
    -H "Content-Type: application/json" \
    -d "{\"file_path\": \"$file\"}"
done
```

---

## 🎯 Ejemplos Prácticos

### Ejemplo 1: Crear voz personalizada con MeloTTS

```python
# En computadora secundaria con audio grabado
from profile_manager import ProfileManager

pm = ProfileManager()

# Crear perfil con modelo entrenado
profile = pm.create_voice_profile(
    name="Mi_Voz_Personal",
    description="Clon de mi propia voz",
    voice_file="/ruta/modelo_entrenado.pt",
    sample_audio="/ruta/grabacion_ejemplo.wav"
)

# Exportar a USB
pm.export_profile(
    profile_id=profile["id"],
    output_path="/media/usb/mi_voz.voicepack",
    profile_type="voice"
)
```

### Ejemplo 2: Personalidad de personaje ficticio

```json
{
  "id": "sherlock001",
  "name": "Sherlock_Holmes",
  "description": "Detective consultor victoriano",
  "type": "personality",
  "system_prompt": "Eres Sherlock Holmes, detective consultor. Hablas con precisión lógica, observas detalles que otros pasan por alto, y tiendes a explicaciones deductivas. Usas un lenguaje formal pero directo.",
  "traits": ["lógico", "observador", "deductivo", "formal"],
  "tone": "analytical",
  "language": "es"
}
```

### Ejemplo 3: Flujo completo USB

```bash
# 1. En computadora principal (BC-250)
# Exportar perfiles existentes
curl -X POST http://localhost:8080/api/profiles/export \
  -d '{"profile_id":"abc123","profile_type":"voice","output_path":"/media/usb/backup.voicepack"}'

# 2. Llevar USB a computadora secundaria
# Entrenar nueva voz o crear personalidad

# 3. Regresar USB a BC-250
# Importar nuevos perfiles
curl -X POST http://localhost:8080/api/profiles/import \
  -d '{"file_path":"/media/usb/nueva_voz.voicepack"}'

# 4. Aplicar perfil
curl -X POST http://localhost:8080/api/profiles/voice/apply \
  -d '{"profile_id":"nueva_voz_id"}'
```

---

## 🔧 Comandos Útiles

### Listar perfiles disponibles
```bash
curl http://localhost:8080/api/profiles
curl http://localhost:8080/api/profiles?profile_type=voice
curl http://localhost:8080/api/profiles?profile_type=personality
```

### Ver detalles de un perfil
```bash
curl http://localhost:8080/api/profiles/{profile_id}?profile_type=voice
```

### Aplicar personalidad activa
```bash
curl -X POST http://localhost:8080/api/profiles/personality/apply \
  -d '{"profile_id":"prof001"}'
```

### Cambiar voz del TTS
```bash
curl -X POST http://localhost:8080/api/profiles/voice/apply \
  -d '{"profile_id":"maria001"}'
```

### Eliminar perfil
```bash
curl -X DELETE "http://localhost:8080/api/profiles/{profile_id}?profile_type=voice"
```

---

## 📊 Formatos de Modelo Soportados

| Engine | Extensión | Calidad | Uso CPU | Recomendado para |
|--------|-----------|---------|---------|------------------|
| **MeloTTS** | `.pt` | ⭐⭐⭐⭐⭐ | Medio | Voces realistas |
| **Coqui XTTS** | `.bin` | ⭐⭐⭐⭐⭐ | Alto | Cloning de voz |
| **Piper TTS** | `.onnx` | ⭐⭐⭐⭐ | Bajo | Dispositivos edge |

---

## ⚠️ Consideraciones Importantes

1. **Compatibilidad de Engines**: Asegúrate de que el engine usado para crear la voz esté instalado en el BC-250.

2. **Espacio en USB**: Los modelos de voz pueden ocupar 50MB-500MB cada uno.

3. **Permisos**: El usuario debe tener permisos de lectura/escritura en el USB.

4. **Backup**: Siempre haz backup de tus perfiles antes de eliminarlos.

5. **Nombres únicos**: Los IDs deben ser únicos para evitar conflictos.

---

## 🆘 Solución de Problemas

### Error: "Perfil no encontrado"
- Verifica que el archivo `.voicepack` no esté corrupto
- Asegúrate de que contenga `profile.json` en la raíz

### Error: "Engine no disponible"
- Instala el engine requerido: `pip install melo-tts` o `pip install TTS`

### Error: "USB no detectado"
- Verifica el punto de montaje: `ls /media/`
- Monta manualmente: `sudo mount /dev/sdb1 /media/usb`

---

## 📞 Soporte

Para más información, consulta la documentación del proyecto o revisa los logs en:
```
/workspace/bc250-ai-companion/data/logs/server.log
```
