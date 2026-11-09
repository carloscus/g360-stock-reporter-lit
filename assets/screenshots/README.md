# Capturas para el manual PPTX

El script `scripts/auto-screenshots.py` detecta automáticamente las imágenes,
las recorta con encaje proporcional (contain) y las inserta en los slides.

## Sistema automático

```bash
# Ejecutar desde la raíz del proyecto
python scripts/auto-screenshots.py
```

El script:
1. Escanea `assets/screenshots/` en busca de imágenes (.png, .jpg, .jpeg)
2. Mapea cada imagen al slide correspondiente (case-insensitive)
3. Recorta la imagen para ajustar al marco sin distorsionar
4. Inserta la imagen o genera placeholder si no existe

## Slides con screenshots

| Slide | Título | Archivo(s) | Posición |
|-------|--------|------------|----------|
| 3 | Flujo de Datos | `dashboard.png` | Lado derecho (5.9"×5.8") |
| 5 | Funcionalidades | `buscar.png` | Lado derecho (5.9"×5.8") |
| 6 | Alertas | `Alertas.png` | Lado derecho (5.9"×5.8") |
| 9 | Reportes XLSX | `reporte1.png` + `reporte2.png` | Dos columnas (6"×5.8") |

## Cómo capturar

Ir a https://carloscus.github.io/g360-stock-reporter/ y capturar:

1. **dashboard.png**
   - Pestaña "Estado" (💓)
   - Mostrar KPIs: total SKUs, cajas, estados por categoría
   - Recomendado: 1280×800 o superior

2. **buscar.png**
   - Pestaña "Buscar" (🔍)
   - Mostrar resultado de búsqueda con SKUs
   - Ideal: con filtro activo y resultados visibles

3. **Alertas.png**
   - Pestaña "Alertas" (🚨)
   - Mostrar badges rojo/amarillo con contadores
   - Ideal: con alertas críticas visibles

4. **reporte1.png** - Formulario de descarga
   - Pestaña "Pulso" (📊)
   - Formulario con campos nombre, email, categoría
   - Botón "Generar Reporte" visible

5. **reporte2.png** - Reporte generado
   - Vista del XLSX descargado
   - Mostrar hojas: Resumen + líneas
   - Ideal: abierto en Excel o preview

## Flujo de trabajo

```
1. Capturar screenshots desde la app
2. Guardar en assets/screenshots/ con nombres exactos
3. Ejecutar: python scripts/auto-screenshots.py
4. Verificar: presentacion/g360-stock-reporter-con-imagenes.pptx
```

## Placeholders

Si una imagen no existe, el script genera un placeholder con:
- Icono 📷
- Nombre del archivo esperado
- Instrucciones para agregar la captura real

## Case sensitivity

Los nombres de archivo son case-insensitive. Puedes usar:
- `dashboard.png` o `Dashboard.png` ✓
- `Alertas.png` o `alertas.png` ✓
