from pptx import Presentation
from pptx.util import Pt, Emu

prs = Presentation('StockPulse_Manual_Tecnico.pptx')
for i, slide in enumerate(prs.slides):
    print(f'=== Slide {i+1} ===')
    for shape in slide.shapes:
        if shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                text = para.text.strip()
                if text:
                    font_size = None
                    for run in para.runs:
                        if run.font.size:
                            font_size = run.font.size.pt
                            break
                    size_str = f'{int(font_size):2d}pt' if font_size else '  - '
                    safe_text = text[:45].encode('ascii', 'replace').decode()
                    print(f'  {size_str} | {safe_text}')
print('Done')
