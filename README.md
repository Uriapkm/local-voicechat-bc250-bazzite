# BC-250 AI Companion

Asistente de IA personal con memoria persistente, optimizado para AMD BC-250 y handhelds. Funciona 100% local en Bazzite OS sin necesidad de instalar Python ni dependencias en el host.

## ⚡ Inicio Rápido (1 comando)

```bash
./run.sh
```

Eso es todo. El script:
- ✅ Detecta tu hardware (RAM, GPU AMD)
- ✅ Crea el entorno aislado con Distrobox
- ✅ Descarga el modelo base: `fredrezones55/Gemma-4-Uncensored-HauhauCS-Aggressive:e4b`
- ✅ Configura automáticamente según tus recursos
- ✅ Inicia la aplicación

### Opciones útiles

```bash
./run.sh -i                    # Modo interactivo (elegir modelo)
./run.sh --model llama3.2      # Modelo específico
./run.sh --reinstall           # Reinstalar desde cero
./run.sh --no-ollama           # Solo app, sin Ollama
./run.sh --help                # Ver ayuda completa
```

## 🎯 Modelos Disponibles

El modo interactivo (`./run.sh -i`) te permite elegir:

| Perfil | Modelo | Uso | RAM Mínima |
|--------|--------|-----|------------|
| **Base (recomendado)** | `fredrezones55/Gemma-4-Uncensored-HauhauCS-Aggressive:e4b` | BC-250/handhelds | 8GB |
| Popular | `llama3.2` | Uso general | 6GB |
| Ligero | `phi3:mini` | Dispositivos limitados | 4GB |
| Personalizado | Tú eliges | Tu preferencia | Variable |

## 📁 Estructura del Proyecto

```
bc250-ai-companion/
├── run.sh              # Script único de instalación e inicio
├── backend/            # Servidor FastAPI
│   ├── main.py        # Punto de entrada
│   └── ...            # Módulos de IA
├── frontend/          # Interfaz web
│   ├── index.html
│   └── app.js
└── data/              # Datos persistentes (auto-generado)
```

## 🌐 Acceso

Una vez iniciado:
- **Interfaz Web**: http://localhost:8080
- **API Docs**: http://localhost:8080/docs

## 🔧 Configuración Avanzada

Si necesitas personalizar algo, edita `config.ini`:

```ini
[OLLAMA]
models = fredrezones55/Gemma-4-Uncensored-HauhauCS-Aggressive:e4b

[APP]
ports = 8080:8080
```

## 🐛 Solución de Problemas

### "distrobox no encontrado"
```bash
# En Bazzite ya viene instalado. Si no:
sudo dnf install distrobox
```

### "Puerto 8080 ocupado"
```bash
# Cambia el puerto en config.ini o mata el proceso:
lsof -ti:8080 | xargs kill -9
```

### "Modelo no descarga"
```bash
# Reintentar con:
./run.sh --reinstall
```

### Reinstalar completamente
```bash
./run.sh --reinstall
```

## 📝 Notas Importantes

1. **No requiere Python en el host**: Todo se ejecuta en contenedor
2. **Persistente**: Tus datos y configuraciones se mantienen
3. **Optimizado para BC-250**: Usa GPU RDNA y memoria GDDR6 (256GB/s)
4. **Hardware mínimo**: 4GB RAM (modelo ligero), 8GB+ recomendado

## 📚 Documentación Adicional

- `SETUP.md` - Guía detallada de configuración
- `docs/HARDWARE_GUIDE.md` - Información sobre AMD BC-250

---

**Hecho para Bazzite OS y AMD BC-250** - Funciona en cualquier distro con Distrobox
