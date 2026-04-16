# Guía de Configuración - BC-250 AI Companion

## Método Recomendado: Script Único

Para la mayoría de usuarios, solo necesitas:

```bash
./run.sh
```

Este método:
- No requiere Python instalado
- Configura todo automáticamente
- Detecta tu hardware
- Descarga el modelo óptimo

Ver `../README.md` para detalles.

---

## Método Avanzado: Configuración Manual

Solo si necesitas control total sobre la configuración.

### Requisitos

- Python 3.9+
- Ollama instalado y corriendo
- 4GB+ RAM (8GB+ recomendado)

### Instalación

```bash
# 1. Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Validar setup
python3 validate_setup.py

# 4. Iniciar servidor
python3 backend/main.py
```

### Acceder

- **Web**: http://localhost:8080
- **API**: http://localhost:8080/docs

### Variables de Entorno (opcional)

Crea un `.env`:

```bash
BC250_HOST=0.0.0.0
BC250_PORT=8080
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_MODEL=fredrezones55/Gemma-4-Uncensored-HauhauCS-Aggressive:e4b
```

---

## Troubleshooting

### "Puerto 8080 ocupado"
```bash
lsof -ti:8080 | xargs kill -9
```

### "Modelo no disponible"
```bash
ollama pull fredrezones55/Gemma-4-Uncensored-HauhauCS-Aggressive:e4b
```

### "Memoria insuficiente"
Usa un modelo más pequeño:
```bash
DEFAULT_MODEL=phi3:mini
```

---

## Performance en BC-250

- **GPU**: 24 CUs RDNA 1.5
- **RAM**: 16GB GDDR6 @ 256GB/s
- **Tokens/seg**: 60-70 (Gemma4:E4B)

---

**Nota**: El método con `run.sh` es recomendado para evitar configuración manual.
