# Guía de Hardware: AMD BC-250 (Cyan Skillfish)

## Descripción General
El AMD BC-250 es un APU derivado del silicio de PlayStation 5, adaptado originalmente para minería y ahora "rescatado" para IA y Linux. Es una pieza única en el mercado de segunda mano.

## Especificaciones Técnicas Detalladas

### 🧠 CPU (Procesador)
| Característica | Valor |
|----------------|-------|
| Arquitectura | Zen 2 (Ryzen 3000 series) |
| Núcleos/Hilos | 6 núcleos / 12 hilos |
| Frecuencia Base | 2.0 GHz |
| Frecuencia Boost | ~3.5 GHz |
| Instrucciones | Sin AVX avanzado (limitación menor para IA) |

**Notas:** La CPU es suficiente para gestionar el sistema operativo y coordinar peticiones de IA. La falta de instrucciones AVX avanzadas no afecta significativamente la inferencia cuando se usa la GPU.

### 🎮 GPU (Gráficos y Computación)
| Característica | Valor |
|----------------|-------|
| Nombre en Clave | Cyan Skillfish / GFX1013 |
| Arquitectura | Híbrida RDNA 1.5 (base RDNA 1 + RT cores RDNA 2) |
| Unidades de Cómputo (CU) | 24 CUs |
| Procesadores de Flujo | 1536 Shaders |
| Ray Tracing | Soporte nativo |
| Comparativa | Steam Deck tiene 8 CUs (este tiene 3x más) |

**Rendimiento en IA:**
- **Vulkan/llama.cpp**: 60-70 tokens/seg con modelos 7B-8B
- **Backend recomendado**: Vulkan (mejor soporte que ROCm para esta arquitectura)
- **Modelos óptimos**: Cuantizados Q4_K_M o Q5_K_M

### ⚡ Memoria Unificada (UMA) - El Punto Fuerte
| Característica | Valor |
|----------------|-------|
| Capacidad Total | 16 GB GDDR6 |
| Tipo | GDDR6 (no DDR4 convencional) |
| Bus de Memoria | 256-bit |
| Ancho de Banda | **256 GB/s** |
| Comparativa | DDR4 normal: ~50 GB/s (5x más lento) |
| VRAM por Defecto | 512 MB (configurable) |
| VRAM Máxima Disponible | 12-14 GB (con ajuste GTT) |

**Importancia para IA:**
El ancho de banda masivo (256 GB/s) es crítico para inferencia de LLMs porque:
- Acelera la carga de pesos del modelo
- Reduce latencia en generación de tokens
- Permite modelos más grandes en memoria

## Configuración para IA en Bazzite

### 1. Ajuste de VRAM (GTT Size)
Por defecto, el sistema reserva solo 512MB para VRAM. Para IA necesitas 12-14GB.

**Método: Parámetro del Kernel**

Editar `/etc/default/grub`:
```bash
sudo nano /etc/default/grub
```

Añadir al final de `GRUB_CMDLINE_LINUX`:
```
amdgpu.vramlimit=14336
```

O alternativamente:
```
amdgpu.gttsize=14336
```

Actualizar GRUB y reiniciar:
```bash
sudo grub2-mkconfig -o /boot/grub2/grub.cfg
sudo reboot
```

**Verificación:**
```bash
# Ver VRAM disponible
glxinfo | grep "Video memory"

# O con vulkaninfo
vulkaninfo | grep -i "memory"
```

### 2. Instalación de Drivers y Herramientas
Bazzite ya incluye drivers AMD modernos, pero verifica:

```bash
# Verificar instalación de Mesa/Vulkan
rpm-ostree status

# Instalar herramientas de diagnóstico (en contenedor distrobox)
distrobox enter
dnf install vulkan-tools mesa-demos
```

### 3. Configuración de Ollama para Vulkan
Ollama detecta automáticamente, pero puedes forzar backend:

```bash
# En el contenedor o entorno
export OLLAMA_NUM_GPU=1
export OLLAMA_MAX_VRAM=14000000000  # 14GB en bytes
```

Para Vulkan específicamente en llama.cpp:
```bash
# Compilar llama.cpp con soporte Vulkan
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make LLAMA_VULKAN=1
```

### 4. Monitoreo de Recursos
```bash
# Temperatura y uso de GPU
radeontop

# Uso de memoria
watch -n 1 'cat /sys/kernel/debug/dri/0/amdgpu_vram_mm'

# Rendimiento en tiempo real
gpustat -i 1000  # Si está disponible
```

## Modelos Recomendados para BC-250

### Óptimos (Balance Rendimiento/Calidad)
| Modelo | Parámetros | VRAM (Q4) | Tokens/s | Uso |
|--------|------------|-----------|----------|-----|
| Gemma 4:E4B | 4.5B | ~3 GB | 60-70 | Multimodal, uso general |
| Llama 3.2 3B | 3B | ~2 GB | 70-80 | Texto rápido |
| Phi-3 Mini | 3.8B | ~2.5 GB | 65-75 | Razonamiento |
| Mistral 7B | 7B | ~5 GB | 50-60 | Calidad superior |

### Máximos (Límite de VRAM)
| Modelo | Parámetros | VRAM (Q4) | Tokens/s | Notas |
|--------|------------|-----------|----------|-------|
| Llama 3.1 8B | 8B | ~6 GB | 45-55 | Buen balance |
| Gemma 2 9B | 9B | ~7 GB | 40-50 | Alta calidad |
| Yi-34B (Q2) | 34B | ~12 GB | 15-20 | Solo cuantización extrema |

### Estrategia de Memoria
Con 16GB totales:
- **Sistema**: 2-3 GB
- **Modelo**: 3-7 GB (dependiendo del modelo)
- **Memoria Vectorial**: 1-2 GB
- **Contexto Activo**: 2-4 GB
- **Margen**: 1-2 GB

## Limitaciones y Consideraciones

### ✅ Ventajas
- Ancho de banda de memoria excepcional (256 GB/s)
- 24 CUs proporcionan buen paralelismo
- Memoria unificada evita cuellos de botella PCIe
- Bajo consumo energético comparado con GPU dedicada
- Soporte Linux excelente en Bazzite

### ⚠️ Limitaciones
- Sin ROCm oficial (usar Vulkan o llama.cpp)
- CPU sin AVX-512 (afecta operaciones CPU-only)
- VRAM compartida requiere ajuste manual
- No apto para entrenamiento, solo inferencia
- Single-board: sin expansión futura

### 🔧 Workarounds
1. **Sin ROCm**: Usar backend Vulkan en Ollama/llama.cpp
2. **VRAM limitada**: Ajustar parámetro de kernel `amdgpu.vramlimit`
3. **Instrucciones faltantes**: Confiar en GPU para cómputo pesado
4. **Refrigeración**: Asegurar flujo de aire adecuado (originalmente para minería)

## Benchmarks Esperados

### Inferencia de LLMs (llama.cpp + Vulkan)
```
Modelo: Gemma 4:E4B (Q4_K_M)
- Prompt Processing: ~150 tokens/s
- Generación: 60-70 tokens/s
- VRAM Usage: ~3 GB
- Contexto: Hasta 128K tokens (con swap a RAM)

Modelo: Llama 3.1 8B (Q4_K_M)
- Prompt Processing: ~100 tokens/s
- Generación: 45-55 tokens/s
- VRAM Usage: ~6 GB
- Contexto: Hasta 32K tokens cómodamente
```

### Multimodal (Imagen + Texto)
```
Resolución de entrada: 1024x1024
- Procesamiento inicial: ~2-3 segundos
- Inferencia combinada: 40-50 tokens/s
- VRAM adicional: +1-2 GB temporal
```

## Consejos de Optimización

1. **Cerrar aplicaciones innecesarias** para liberar RAM/VRAM
2. **Usar modelos cuantizados** (Q4_K_M es el sweet spot)
3. **Ajustar contexto máximo** según necesidad real
4. **Monitorear temperaturas** (objetivo: <80°C bajo carga)
5. **Considerar undervolt** si tienes experiencia (reduce calor/ruido)
6. **Priorizar Vulkan** sobre CPU para inferencia

## Recursos Adicionales

- [Documentación AMD GPU Open](https://gpuopen.com/)
- [llama.cpp GitHub](https://github.com/ggerganov/llama.cpp)
- [Ollama Documentation](https://ollama.ai/docs)
- [Bazzite OS Forums](https://universal-blue.discourse.group/c/bazzite/)
- [Cyan Skillfish Community (Reddit/ Discord)](https://reddit.com/r/bazzite)

## Solución de Problemas Comunes

### Problema: Ollama no detecta GPU
**Solución:**
```bash
# Verificar detección
ollama run --debug gemma4:e4b

# Forzar uso de GPU
export OLLAMA_NUM_GPU=1
```

### Problema: Out of Memory
**Solución:**
1. Reducir tamaño del modelo (usar Q3 o modelo más pequeño)
2. Disminuir contexto máximo
3. Aumentar `amdgpu.vramlimit` en kernel
4. Cerrar otras aplicaciones

### Problema: Baja velocidad (<20 tokens/s)
**Solución:**
1. Verificar que usa GPU y no CPU
2. Actualizar drivers Mesa/Vulkan
3. Probar backend Vulkan explícitamente
4. Reducir batch size

### Problema: Sistema inestable
**Solución:**
1. Verificar temperaturas
2. Revisar logs: `journalctl -xe`
3. Probar con menos VRAM asignada
4. Actualizar Bazzite: `rpm-ostree upgrade`
