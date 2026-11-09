# ADVERSARIAL SLOP REVIEW — g360-stock-reporter.pptx

## Deck Metadata
- **File**: presentacion/g360-stock-reporter.pptx
- **Slides**: 10
- **Total words**: 83 (8.3 avg/slide)
- **Dimension**: 13.33 x 7.50 in (16:9)
- **Theme**: Dark green header, white cards on light background

---

## LAYER 1: PRESENTATION SLOP

### Finding 1.1 — LEFTOVER SCAFFOLDING [ABSOLUTE BAN]
**Where**: Slide 3, all text
**What**: Placeholder text never meant to ship
**The quote**: `[IMG]` / `CAPTURA DE PANTALLA` / `Captura del diagrama de arquitectura`
**The fix**: Replace with actual diagram showing flow: `appweb → API → Cache → Frontend`. If screenshot not ready, remove slide or use a textual process list.

---

### Finding 1.2 — THE TACKED-ON STRAPLINE [ABSOLUTE BAN]
**Where**: Slides 1, 10 (end text)
**What**: Short slogan floated below main content
**The quote**: 
- Slide 1: `CIPSA · Intelligence Division`
- Slide 10: `g360-stock-reporter-lit · GitHub`
**The fix**: Remove footer slogans. If branding needed, integrate into header consistently or drop entirely. A slide has its content; it does not need a motto.

---

### Finding 1.3 — ONE DEVICE, DECK-WIDE [REFLEX]
**Where**: Slides 2-9 (all content slides)
**What**: Identical card-grid structure repeated 8 times
**The pattern**: Each slide follows: header bar → numbered badge → title → card with bullet list
**The fix**: Vary the treatment. Use comparison layout for Slide 4 (categories), process timeline for Slide 8 (deployment), stat row for Slide 6 (alerts). Not every slide needs the same card grid.

---

### Finding 1.4 — LOW CONTENT DENSITY [REGISTER MISMATCH]
**Where**: Slides 1, 3, 10
**What**: Extremely sparse slides (16, 12, 16 words respectively)
**The fix**: 
- Slide 1: Add subtitle context — who is this for? What problem does it solve?
- Slide 3: Must contain real content (see 1.1)
- Slide 10: Add concrete next action — "Install: npm install -g g360-cli"

---

### Finding 1.5 — BULLET SOUP RISK [EDGE CASE]
**Where**: Slides 2, 4, 5, 6, 7, 8, 9
**What**: Multiple bullet points without clear parent structure
**The quote** (Slide 2):
```
▌ Frontend PWA
  • Lit 3 Web Components
  • Cache 3 capas...
▌ Backend API
  • FastAPI en Render
  • TTL cache...
```
**The fix**: Group bullets under clear parent headings. Each slide should answer one question.

---

## LAYER 2: PROSE SLOP

### Finding 2.1 — META-COMMENTARY [SLIGHT]
**Where**: Slide 3 (placeholder)
**What**: Text describing what should be there instead of being there
**The quote**: `CAPTURA DE PANTALLA` / `Captura del diagrama de arquitectura`
**The fix**: Either show the diagram or remove the slide.

---

### Finding 2.2 — EM DASH OVERUSE [STYLE]
**Where**: Multiple slides
**What**: Em dashes used as list separators
**The quote**: `StockPulse CIPSA — Manual Técnico`
**The fix**: Use colon or rephrase: `StockPulse CIPSA: Manual Técnico`

---

## LAYER 3: AI-VOICE TELLS

### Finding 3.1 — NO AI VOICE DETECTED [PASS]
The deck text is too sparse to exhibit Claudism patterns. No performative pushback, no reframe announcements, no faux insight. This is likely because the content is minimal rather than well-crafted.

---

## SCORECARD

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Directness** | 4/10 | Sparse content lacks punch; straplines dilute focus |
| **Rhythm** | 5/10 | Repetitive card structure creates metronomic feel |
| **Trust** | 3/10 | Placeholder slide undermines credibility |
| **Authenticity** | 6/10 | Generic template feel; no distinctive voice |
| **Density** | 2/10 | 8.3 words/slide is critically low |

**TOTAL: 20/50** — Needs significant revision

---

## CRITICAL ISSUES (Must Fix)

1. **Slide 3 is a placeholder** — Shows `[IMG] CAPTURA DE PANTALLA` instead of actual content. This is leftover scaffolding that never shipped.

2. **Inconsistent numbering** — Slides 2, 4-9 have badge numbers (01, 02...), but slides 1, 3, 10 do not. Breaks visual rhythm.

3. **Version confusion** — README shows v7.0.0 in code, PPTX footer shows v1.17. Which is correct?

4. **Missing key info from README**:
   - No mention of `un_bx` (units per box) concept
   - No warehouse details (VES, 40, 118, etc.)
   - No operational window (Lun-Sab 07:00-22:59)
   - No mention of keep-alive/probe mechanism
   - No stats on sin-catalogo SKUs (1,232 items)

---

## RECOMMENDATIONS (Priority Order)

### P0 — Structural
- Replace Slide 3 with actual architecture diagram
- Unify slide numbering (all or none)
- Verify and standardize version number

### P1 — Content
- Add missing technical details from README
- Increase word count to 40-60 words/slide minimum
- Vary slide layouts (don't use card grid everywhere)

### P2 — Polish
- Remove strapline footers
- Add speaker notes for presenter guidance
- Include actual screenshots in snapshot folder

---

## VERDICT

This deck is a **template shell** — structurally sound but empty. The card-grid treatment is consistent but monotonous. The placeholder on Slide 3 is a shipping violation. The content density is far too low for a technical manual.

**Do not ship as-is.** Complete the missing diagram, fill in technical details, and vary the layouts before presenting.
