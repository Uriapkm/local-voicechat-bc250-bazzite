# Roadmap del Proyecto BC-250 AI Companion

## Visión a Largo Plazo
Crear un compañero de IA personal completamente autónomo, privado y fácil de usar que funcione como un "electrodoméstico inteligente" en el AMD BC-250.

---

## Fase 1: Cimientos e Infraestructura (Semana 1-2)
**Estado:** 🔄 En progreso

### Objetivos
- [ ] Configurar entorno de desarrollo en Bazzite
- [ ] Verificar instalación de Ollama y aceleración por hardware
- [ ] Crear script de instalación automático (`install.sh`)
- [ ] Establecer estructura de directorios del proyecto
- [ ] Configurar contenedor Distrobox para aislamiento

### Entregables
- ✅ Estructura de directorios creada
- ✅ Documentación inicial (README, Architecture, Hardware Guide)
- [ ] Script `install.sh` funcional
- [ ] Verificación de Ollama + GPU Vulkan
- [ ] Contenedor base configurado

### Criterios de Aceptación
- El instalador detecta si Ollama está instalado
- El instalador verifica el modelo `gemma4:e4b`
- El sistema puede ejecutar inferencia básica desde terminal
- Documentación completa de hardware y configuración

---

## Fase 2: Backend y Lógica de Memoria (Semana 3-4)
**Estado:** ⏳ Pendiente

### Objetivos
- [ ] Implementar API FastAPI básica
- [ ] Integrar gestión de Ollama (descarga, cambio de modelos)
- [ ] Desarrollar sistema de memoria vectorial (ChromaDB)
- [ ] Implementar persistencia de conversaciones
- [ ] Crear funcionalidad de migración de memoria entre modelos

### Módulos a Desarrollar
1. **`backend/main.py`**: Servidor API con endpoints REST y WebSocket
2. **`backend/config.py`**: Configuración centralizada
3. **`backend/ollama_manager.py`**: Gestión de modelos Ollama
4. **`backend/memory_core.py`**: Sistema de memoria vectorial
5. **`backend/web_search.py`**: Búsqueda web bajo demanda

### Entregables
- API funcional con endpoints:
  - `POST /chat`: Enviar mensaje y recibir respuesta
  - `GET /models`: Listar modelos disponibles
  - `POST /models/load`: Cambiar modelo activo
  - `POST /memory/migrate`: Migrar memoria entre modelos
  - `GET /memory/stats`: Estadísticas de memoria
- Base de datos vectorial operativa
- Sistema de resúmenes automáticos de conversación

### Criterios de Aceptación
- La API responde en <500ms para consultas simples
- La memoria persiste después de reiniciar el servicio
- Se puede cambiar de modelo manteniendo la memoria
- Los resúmenes se generan automáticamente cada N interacciones

---

## Fase 3: Frontend y Multimodalidad (Semana 5-6)
**Estado:** ⏳ Pendiente

### Objetivos
- [ ] Diseñar interfaz web minimalista (HTML/CSS/JS)
- [ ] Implementar entrada de texto con streaming
- [ ] Integrar Web Audio API para entrada de voz (STT)
- [ ] Integrar salida de audio TTS (Piper)
- [ ] Añadir controles de audio (auto-play on/off, micrófono)
- [ ] Crear panel de gestión de modelos

### Módulos a Desarrollar
1. **`frontend/index.html`**: Estructura principal
2. **`frontend/style.css`**: Estilos y temas
3. **`frontend/app.js`**: Lógica del cliente
4. **`backend/stt_engine.py`**: Speech-to-Text con Whisper
5. **`backend/tts_engine.py`**: Text-to-Speech con Piper

### Características de la UI
- **Chat Principal**: Área de conversación con scrolling automático
- **Controles de Voz**:
  - Botón de micrófono (Push-to-Talk / Toggle)
  - Indicador visual de estado (grabando, procesando)
  - Interruptor de audio automático (ON/OFF)
- **Panel de Modelos**:
  - Lista de modelos instalados
  - Botón de descarga de nuevos modelos
  - Selector de modelo activo
  - Botón "Migrar Memoria"
- **Indicadores**:
  - Estado de conexión (online/offline)
  - Uso de recursos (VRAM, RAM)
  - Modelo activo y versión

### Entregables
- Interfaz web responsive accesible desde `http://localhost:8080`
- Entrada de voz funcional con transcripción en tiempo real
- Salida de audio TTS con control de activación
- Panel de gestión de modelos operativo
- Soporte PWA (instalable como app)

### Criterios de Aceptación
- La interfaz carga en <2 segundos
- El reconocimiento de voz tiene >90% de precisión en español
- El TTS suena natural con latencia <1 segundo
- Los controles de audio responden instantáneamente
- La UI es usable en móvil y desktop

---

## Fase 4: Pulido y Automatización (Semana 7-8)
**Estado:** ⏳ Pendiente

### Objetivos
- [ ] Configurar servicio systemd para arranque automático
- [ ] Implementar sistema de logs y monitoreo
- [ ] Optimizar rendimiento para BC-250
- [ ] Pruebas exhaustivas de todos los componentes
- [ ] Documentación de usuario final

### Automatización
1. **Servicio Systemd**:
   - Archivo `bc250-ai-companion.service`
   - Arranque automático al inicio del sistema
   - Reinicio automático en caso de fallo
   - Logs integrados en journalctl

2. **Scripts de Mantenimiento**:
   - `update_models.sh`: Actualizar modelos periódicamente
   - `backup_memory.sh`: Copias de seguridad automáticas
   - `health_check.sh`: Verificación de estado del sistema

3. **Optimizaciones**:
   - Ajuste de parámetros de Vulkan para BC-250
   - Configuración de caché para reducir latencia
   - Límites de memoria para prevenir OOM
   - Compresión de embeddings antiguos

### Entregables
- Servicio systemd configurado y probado
- Scripts de mantenimiento operativos
- Documentación de usuario final (guía de uso)
- Sistema de logs completo
- Tests automatizados básicos

### Criterios de Aceptación
- El servicio arranca automáticamente tras reiniciar el sistema
- Los logs capturan errores y métricas clave
- El sistema funciona establemente por >24 horas continuas
- Un usuario no técnico puede instalar y usar el sistema en <15 minutos

---

## Fase 5: Características Avanzadas (Futuro)
**Estado:** 🔮 Planificación

### Posibles Mejoras
- [ ] **Visión por Computadora**: Análisis de imágenes subidas
- [ ] **Integración Domótica**: Control de Home Assistant
- [ ] **Múltiples Usuarios**: Perfiles con memorias separadas
- [ ] **Plugins Personalizados**: Herramientas extendidas
- [ ] **Aprendizaje Continuo**: Fine-tuning local basado en interacciones
- [ ] **Modo Offline Total**: Sin ninguna dependencia externa
- [ ] **Exportar/Importar Memoria**: Compartir personalizaciones
- [ ] **Dashboard de Métricas**: Gráficos de uso y rendimiento

### Integraciones Potenciales
- **Home Assistant**: Control de dispositivos IoT
- **Calendario Local**: Recordatorios y agenda
- **Gestor de Archivos**: Búsqueda en documentos locales
- **Notificaciones**: Alertas importantes por voz
- **APIs Locales**: Servicios adicionales en la red

---

## Métricas de Éxito

### Técnicas
- **Latencia**: <500ms para primera token, >40 tokens/s generación
- **Precisión STT**: >90% en español, >85% en inglés
- **Calidad TTS**: MOS >3.5 ( Mean Opinion Score)
- **Uso de Memoria**: <14GB VRAM total con modelo cargado
- **Estabilidad**: >99% uptime en operación continua

### Experiencia de Usuario
- **Tiempo de Instalación**: <15 minutos para usuario no técnico
- **Curva de Aprendizaje**: Primer uso exitoso en <5 minutos
- **Satisfacción**: Feedback positivo en usabilidad y privacidad
- **Adopción**: Uso diario consistente por parte del usuario

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| ROCm no compatible con BC-250 | Alta | Alto | Usar backend Vulkan ya probado |
| Modelos grandes exceden VRAM | Media | Medio | Cuantización Q4, límites de contexto |
| STT/TTS muy lentos en CPU | Media | Medio | Usar modelos ligeros, optimizar pipelines |
| Bazzite actualiza y rompe compatibilidad | Baja | Alto | Contenedores aislados, testing post-update |
| Memoria vectorial crece demasiado | Media | Bajo | Limpieza automática, resúmenes, límites |

---

## Próximos Pasos Inmediatos

1. **Esta semana**:
   - Completar script `install.sh` con verificaciones
   - Probar Ollama + Gemma 4:E4B en BC-250 real
   - Configurar contenedor Distrobox base

2. **Próxima semana**:
   - Implementar API FastAPI básica
   - Crear endpoint `/chat` funcional
   - Diseñar mockup de la interfaz web

3. **En 2 semanas**:
   - Tener prototipo funcional de chat texto-only
   - Sistema de memoria básico operativo
   - Primera iteración de la UI

---

## Cómo Contribuir

Este es un proyecto personal, pero las ideas y feedback son bienvenidos:
- Reportar bugs o sugerencias en issues
- Proponer mejoras de rendimiento
- Compartir configuraciones optimizadas
- Documentar casos de uso interesantes

---

**Última Actualización**: Abril 2026
**Versión del Roadmap**: 1.0
**Estado General**: Fase 1 en progreso
