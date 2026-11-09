# Sistema automático de screenshots para PPTX

Este script detecta imágenes en `assets/screenshots/`, las recorta al tamaño del slide, y las inserta en los slides correspondientes.

## Cómo funciona

1. Escanea `assets/screenshots/` en busca de imágenes (.png, .jpg, .jpeg)
2. Mapea cada imagen al slide correspondiente por nombre
3. Recorta la imagen con "contain" (sin distorsionar) al marco del slide
4. Inserta la imagen en la posición correcta
5. Genera el PPTX final en `presentacion/g360-stock-reporter-con-imagenes.pptx`

## Nombres de archivos y sus slides

| Archivo | Slide | Posición |
|---------|-------|----------|
| `dashboard.png` | Slide 3 (Flujo de Datos) | Centro-derecha (5.5" x 4.5") |
| `alertas.png` | Slide 6 (Sistema de Alertas) | Centro-derecha (5.5" x 4.5") |
| `buscar.png` | Slide 5 (Funcionalidades) | Centro-derecha (5.5" x 4.5") |

## Capturas sugeridas

Ir a https://carloscus.github.io/g360-stock-reporter-lit/ y capturar:

1. **dashboard.png** - Pestaña "Estado" con KPIs visibles (total SKUs, cajas, estados)
2. **alertas.png** - Pestaña "Alertas" con badges rojo/amarillo  
3. **buscar.png** - Pestaña "Buscar" con resultado de búsqueda

Tamaño recomendado: 1280x800px o superior.

## Ejecutar

```bash
python scripts/auto-screenshots.py
```

Si no hay imágenes, genera placeholders con instrucciones.
