"""
StockPulse CIPSA - Auto Screenshots para PPTX
Detecta imágenes en assets/screenshots/, las recorta y las inserta en los slides.
"""

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE
import os
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

# ==========================================
# CONFIGURACIÓN
# ==========================================
PROJECT_ROOT = Path(__file__).parent.parent
SCREENSHOTS_DIR = PROJECT_ROOT / 'assets' / 'screenshots'
OUTPUT_DIR = PROJECT_ROOT / 'presentacion'
TEMPLATE_FILE = OUTPUT_DIR / 'g360-stock-reporter-v8.pptx'
OUTPUT_FILE = OUTPUT_DIR / 'g360-stock-reporter-con-imagenes.pptx'

W, H = Inches(13.333), Inches(7.5)

C = {
    'primary': RGBColor(0x00, 0xD0, 0x84),
    'dark': RGBColor(0x0F, 0x17, 0x2A),
    'surface': RGBColor(0x1E, 0x29, 0x3B),
    'surface_light': RGBColor(0x2D, 0x37, 0x48),
    'text': RGBColor(0xF0, 0xF4, 0xF8),
    'text_secondary': RGBColor(0xBD, 0xC3, 0xCB),
    'muted': RGBColor(0x94, 0xA3, 0xB8),
    'accent': RGBColor(0x0E, 0x74, 0x90),
    'border': RGBColor(0x33, 0x41, 0x55),
}

# ==========================================
# MAPA DE SCREENSHOTS POR SLIDE
# ==========================================
SCREENSHOT_MAP = {
    3: {  # Slide 3: Flujo de Datos
        'file': 'dashboard.png',
        'frame': {'x': 6.8, 'y': 1.2, 'w': 5.9, 'h': 5.8},  # Right side
        'label': 'Dashboard - Vista de Estado con KPIs'
    },
    5: {  # Slide 5: Funcionalidades Principales
        'file': 'buscar.png',
        'frame': {'x': 6.8, 'y': 1.2, 'w': 5.9, 'h': 5.8},
        'label': 'Búsqueda Avanzada - Resultado de búsqueda'
    },
    6: {  # Slide 6: Sistema de Alertas
        'file': 'Alertas.png',
        'frame': {'x': 6.8, 'y': 1.2, 'w': 5.9, 'h': 5.8},
        'label': 'Alertas - Panel con badges de estado'
    },
    9: {  # Slide 9: Reportes XLSX (nuevo slide)
        'file': None,
        'frame': {'x': 0.6, 'y': 1.2, 'w': 12.1, 'h': 5.8},
        'label': 'Reportes XLSX - Formulario y descarga',
        'images': ['reporte1.png', 'reporte2.png']  # Two-column layout
    }
}

def set_bg(slide, color):
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, W, H)
    bg.fill.solid()
    bg.fill.fore_color.rgb = color
    bg.line.fill.background()
    spTree = slide.shapes._spTree
    sp = bg._element
    spTree.remove(sp)
    spTree.insert(2, sp)

def add_text(p, text, size_pt, bold=False, color=None, align=None):
    p.text = text
    for run in p.runs:
        run.font.size = Pt(size_pt)
        run.font.bold = bold
        if color:
            run.font.color.rgb = color
        run.font.name = 'Segoe UI'
    if align:
        p.alignment = align

def insert_screenshot(slide, frame_config, screenshot_file):
    """Inserta screenshot con recorte contain, o placeholder si no existe"""
    from pathlib import Path
    ruta = Path(SCREENSHOTS_DIR) / screenshot_file
    
    x = frame_config['x']
    y = frame_config['y']
    w = frame_config['w']
    h = frame_config['h']
    
    # Add frame background
    frame = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    frame.fill.solid()
    frame.fill.fore_color.rgb = C['surface']
    frame.line.color.rgb = C['border']
    frame.line.width = Pt(1)
    
    # Try to insert image
    if ruta.exists():
        try:
            from PIL import Image
            with Image.open(ruta) as img:
                iw, ih = img.size
                ir = iw / ih  # image ratio
                fr = w / h    # frame ratio
                
                # Calculate contain fit
                if ir > fr:
                    dw, dh = w, w / ir
                else:
                    dh, dw = h, h * ir
                
                dx = x + (w - dw) / 2
                dy = y + (h - dh) / 2
                
                # Insert image
                slide.shapes.add_picture(str(ruta), Inches(dx), Inches(dy), Inches(dw), Inches(dh))
                return True
        except ImportError:
            print("  [!] Pillow no instalado, usando placeholder")
        except Exception as e:
            print(f"  [!] Error insertando imagen: {e}")
    
    # Placeholder
    tf = frame.text_frame
    tf.word_wrap = True
    
    # Icon
    icon_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, 
                                      Inches(x + w/2 - 0.8), Inches(y + h/2 - 0.6), 
                                      Inches(1.6), Inches(1.0))
    icon_box.fill.solid()
    icon_box.fill.fore_color.rgb = C['surface_light']
    icon_box.line.color.rgb = C['border']
    icon_txt = icon_box.text_frame.paragraphs[0]
    add_text(icon_txt, "📷", 28, False, C['muted'])
    icon_txt.alignment = PP_ALIGN.CENTER
    
    # Label
    label_box = slide.shapes.add_textbox(Inches(x), Inches(y + h - 0.8), Inches(w), Inches(0.5))
    add_text(label_box.text_frame.paragraphs[0], screenshot_file, 11, False, C['muted'], PP_ALIGN.CENTER)
    
    return False

def insert_two_images(slide, frame_config, image_files):
    """Inserta dos imágenes en layout de dos columnas"""
    from pathlib import Path
    
    x = frame_config['x']
    y = frame_config['y']
    w = frame_config['w']
    h = frame_config['h']
    
    # Split into two halves
    half_w = w / 2 - 0.15  # 0.15 for gap
    gap = 0.15
    
    inserted = []
    for i, file_name in enumerate(image_files):
        col_x = x + i * (half_w + gap)
        col_w = half_w
        
        # Frame for this column
        frame = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, 
                                       Inches(col_x), Inches(y), Inches(col_w), Inches(h))
        frame.fill.solid()
        frame.fill.fore_color.rgb = C['surface']
        frame.line.color.rgb = C['border']
        frame.line.width = Pt(1)
        
        # Try to insert image
        ruta = Path(SCREENSHOTS_DIR) / file_name
        if ruta.exists():
            try:
                from PIL import Image
                with Image.open(ruta) as img:
                    iw, ih = img.size
                    ir = iw / ih
                    fr = col_w / h
                    
                    if ir > fr:
                        dw, dh = col_w, col_w / ir
                    else:
                        dh, dw = h, h * ir
                    
                    dx = col_x + (col_w - dw) / 2
                    dy = y + (h - dh) / 2
                    
                    slide.shapes.add_picture(str(ruta), Inches(dx), Inches(dy), Inches(dw), Inches(dh))
                    inserted.append(file_name)
                    continue
            except Exception as e:
                print(f"    [!] Error con {file_name}: {e}")
        
        # Placeholder for this column
        icon_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, 
                                          Inches(col_x + col_w/2 - 0.5), Inches(y + h/2 - 0.4), 
                                          Inches(1.0), Inches(0.6))
        icon_box.fill.solid()
        icon_box.fill.fore_color.rgb = C['surface_light']
        icon_box.line.color.rgb = C['border']
        icon_txt = icon_box.text_frame.paragraphs[0]
        add_text(icon_txt, "📷", 20, False, C['muted'])
        icon_txt.alignment = PP_ALIGN.CENTER
        
        label_box = slide.shapes.add_textbox(Inches(col_x), Inches(y + h - 0.6), Inches(col_w), Inches(0.4))
        add_text(label_box.text_frame.paragraphs[0], file_name, 9, False, C['muted'], PP_ALIGN.CENTER)
    
    return inserted

def main():
    print("=" * 70)
    print("AUTO SCREENSHOTS - StockPulse CIPSA")
    print("=" * 70)
    
    # Check template exists
    if not TEMPLATE_FILE.exists():
        print(f"\n[ERROR] Template no encontrado: {TEMPLATE_FILE}")
        sys.exit(1)
    
    # Load template
    print(f"\n[CARGA] Template: {TEMPLATE_FILE.name}")
    prs = Presentation(str(TEMPLATE_FILE))
    
    # Scan for screenshots
    print(f"\n[SCAN] Buscando en: {SCREENSHOTS_DIR}")
    available = {}
    if SCREENSHOTS_DIR.exists():
        for f in SCREENSHOTS_DIR.iterdir():
            if f.suffix.lower() in ['.png', '.jpg', '.jpeg']:
                available[f.name] = f
                print(f"  ✓ {f.name} ({f.stat().st_size} bytes)")
    else:
        print("  (directorio no existe)")
    
    if not available:
        print("\n[INFO] No hay screenshots disponibles")
        print("       Generando PPTX con placeholders...")
    
    # Process each slide with screenshot mapping
    inserted = []
    missing = []
    
    for slide_num, config in SCREENSHOT_MAP.items():
        slide = prs.slides[slide_num - 1]
        file_name = config.get('file')
        image_files = config.get('images', [])
        label = config.get('label', '')
        
        print(f"\n[SLIDE {slide_num}] {label}")
        
        # Handle two-image layout
        if image_files:
            print(f"  Layout: 2 imágenes ({', '.join(image_files)})")
            success = insert_two_images(slide, config['frame'], image_files)
            inserted.extend(success)
            missing.extend([f for f in image_files if f not in success])
            continue
        
        # Handle single image
        if not file_name:
            print(f"  (sin imagen asignada)")
            continue
            
        print(f"  Archivo: {file_name}")
        
        # Check if file exists (case-insensitive)
        found_file = None
        for f in Path(SCREENSHOTS_DIR).iterdir():
            if f.name.lower() == file_name.lower():
                found_file = f.name
                break
        
        if found_file:
            success = insert_screenshot(slide, config['frame'], found_file)
            if success:
                inserted.append(found_file)
                print(f"  ✓ Insertado: {found_file}")
            else:
                missing.append(file_name)
                print(f"  ✗ Error al insertar")
        else:
            insert_screenshot(slide, config['frame'], file_name)
            missing.append(file_name)
            print(f"  ⚠ Placeholder (imagen no encontrada: {file_name})")
    
    # Save output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    prs.save(str(OUTPUT_FILE))
    
    print("\n" + "=" * 70)
    print("RESUMEN")
    print("=" * 70)
    print(f"Slides procesados: {len(SCREENSHOT_MAP)}")
    print(f"Imágenes insertadas: {len(inserted)}")
    if inserted:
        for img in inserted:
            print(f"  ✓ {img}")
    print(f"Placeholders creados: {len(missing)}")
    if missing:
        for img in missing:
            print(f"  ⚠ {img}")
    print(f"\n[GUARDADO] {OUTPUT_FILE}")
    
    if missing:
        print("\n[NOTA] Para agregar screenshots reales:")
        print(f"       1. Capturar imágenes de la app")
        print(f"       2. Guardar en: {SCREENSHOTS_DIR}")
        print(f"       3. Usar nombres exactos del mapa")
        print(f"       4. Ejecutar: python scripts/auto-screenshots.py")

if __name__ == "__main__":
    main()
