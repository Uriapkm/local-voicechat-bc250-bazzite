# BC-250 AI Companion

Asistente de IA personal optimizado para AMD BC-250 y handhelds. Funciona 100% local sin necesidad de instalar Python ni dependencias.

## ⚡ Inicio Rápido

Desde el directorio raíz del proyecto:

```bash
./run.sh
```

Luego abre tu navegador en: **http://localhost:8080**

## 🎯 Características

- ✅ Chat con streaming en tiempo real
- ✅ Memoria persistente por modelo
- ✅ Búsqueda web bajo demanda
- ✅ Voz a texto y texto a voz nativos con Gemma4:E4B
- ✅ Optimizado para BC-250 (GPU RDNA + 16GB GDDR6)
- ✅ Sin dependencias externas obligatorias

## 📁 Estructura

```
bc250-ai-companion/
├── run.sh              # Script único de inicio
├── backend/            # Servidor FastAPI
│   └── main.py        # Punto de entrada
├── frontend/          # Interfaz web
└── data/              # Datos persistentes
```

## 🔧 Configuración

Edita `config.ini` si necesitas personalizar:

```ini
[OLLAMA]
models = fredrezones55/Gemma-4-Uncensored-HauhauCS-Aggressive:e4b

[APP]
ports = 8080:8080
```

## 📚 Más Información

- `../README.md` - Guía principal de instalación
- `SETUP.md` - Configuración detallada
- `docs/HARDWARE_GUIDE.md` - Hardware BC-250

---

**Hecho para Bazzite OS y AMD BC-250**
