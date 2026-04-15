# 🎙️ Procesamiento de Audio Nativo con Gemma4:E4B

## Cambios Implementados

El servidor ahora usa **Gemma4:E4B nativo** para procesar audio, eliminando la dependencia de Whisper.cpp como paso obligatorio.

### Flujo Anterior ❌
```
Audio (WebM) → Whisper.cpp (STT) → Texto → Gemma4
```

### Flujo Nuevo ✅
```
Audio (Base64) → Gemma4:E4B (directo) → Texto/Análisis
```

---

## Endpoints de Audio

### 1. Transcripción Nativa (Recomendado)
```bash
POST /api/audio/transcribe
Content-Type: multipart/form-data

Body:
  - audio_file: <archivo.webm|.wav|.mp3>
  - use_native: true (default)

Response:
{
  "success": true,
  "text": "transcripción aquí",
  "method": "gemma4_native",
  "audio_size": 45000
}
```

**Ventajas:**
- Sin dependencias externas (sin Whisper.cpp)
- Más rápido en BC-250
- Mejor comprensión del contexto

---

### 2. Chat Multimodal con Audio
```bash
POST /api/audio/chat
Content-Type: multipart/form-data

Body:
  - audio_file: <archivo.webm|.wav>
  - query: "¿Qué dice este audio?"
  - model: "gemma4:e4b" (opcional)

Response:
{
  "success": true,
  "response": "El audio contiene...",
  "method": "gemma4_audio_native",
  "audio_size": 45000,
  "query": "¿Qué dice este audio?"
}
```

**Casos de uso:**
- "Analiza esta conversación"
- "¿Quién habla en este audio?"
- "Extrae los números mencionados"

---

### 3. Transcripción Legacy (Whisper.cpp)
```bash
POST /api/audio/transcribe?use_native=false
Content-Type: multipart/form-data

Body:
  - audio_file: <archivo.wav>

Response:
{
  "success": true,
  "text": "transcripción",
  "method": "whisper_direct"
}
```

**Nota:** Solo si Whisper.cpp está instalado.

---

## Capacidades de Gemma4:E4B para Audio

### Formatos Soportados
- ✅ WAV
- ✅ WebM
- ✅ MP3
- ✅ OGG
- ✅ FLAC

### Tipos de Tareas
1. **Transcripción** - Convertir audio a texto
2. **Análisis** - Identificar hablantes, emociones
3. **Extracción** - Nombres, números, fechas
4. **Resumen** - Resumir contenido del audio
5. **Q&A** - Responder preguntas sobre el audio

### Tamaño Máximo
- 100 MB por solicitud
- Sin límite de duración teórico
- Timeout: 300 segundos (5 minutos)

---

## Implementación en el Frontend

El frontend (`app.js`) ya está actualizado:

```javascript
// Para transcribir audio
const formData = new FormData();
formData.append('audio_file', audioBlob, 'recording.webm');

const response = await fetch('/api/audio/transcribe', {
    method: 'POST',
    body: formData
});

const data = await response.json();
// data = { success: true, text: "...", method: "gemma4_native" }
```

---

## Fallback Inteligente

Si Gemma4 falla por algún motivo:

```
Intento 1: Gemma4 Audio Nativo
    ↓ Error o timeout
Intento 2: Whisper.cpp (si disponible)
    ↓ Error
Intento 3: Error al usuario
```

---

## Ventajas para tu BC-250

| Aspecto | Gemma4 Nativo | Whisper.cpp |
|---------|---------------|------------|
| **Dependencias** | 0 | 1 (binary/modelo) |
| **Latencia** | Baja | Media |
| **VRAM** | Usa GPU unificada | CPU-only |
| **Ancho banda** | 256 GB/s | N/A |
| **Precisión** | Muy alta | Alta |
| **Contexto** | Entiende contexto | Solo STT |

---

## Testing

```bash
# Verificar capacidades
curl http://localhost:8080/api/audio/capabilities

# Resultado esperado
{
  "gemma4_audio_native": {
    "supported": true,
    "description": "Gemma4:E4B procesa audio directamente..."
  }
}
```

---

## Notas Técnicas

### Audio en los Mensajes
El audio se envía como **base64** en el payload JSON:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "¿Qué dice?",
      "audio": "UklGRiYAAABXQVZFom1heC=="
    }
  ]
}
```

### Timeout Extendido
Se configuró timeout de 300 segundos para procesar audios largos.

### Manejo de Errores
- Si el audio está corrupto → Error clara
- Si timeout → Reintentar o mensaje de error
- Si modelo no disponible → Error 503

---

## Mejoras Futuras

- [ ] Soporte para múltiples archivos de audio
- [ ] Streaming de audio (en tiempo real)
- [ ] Análisis de sentimiento en audio
- [ ] Detección de lenguaje automática
- [ ] Caché de audios procesados
