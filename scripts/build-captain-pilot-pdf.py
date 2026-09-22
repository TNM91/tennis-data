"""Render the shared Captain offer as a single Letter page.

Pipe JSON from CAPTAIN_PILOT_FLYER into this script. Brand inputs are exclusively
from public/brand; no account screenshots or customer data are accepted.
"""
import json
import sys
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

root = Path(__file__).resolve().parent.parent
offer = json.load(sys.stdin)
output = root / 'public' / offer['pdfPath'].lstrip('/')
output.parent.mkdir(parents=True, exist_ok=True)
navy, green, muted = map(HexColor, ['#06172F', '#9BE11D', '#40536D'])
pdf = canvas.Canvas(str(output), pagesize=(612, 792), pageCompression=1, invariant=1)
pdf.setTitle('TenAceIQ - Fall Captain Pilot - 3 months free')
pdf.setAuthor('TenAceIQ')
pdf.setSubject('One-page Captain pilot flyer. Three months from activation.')


def paragraph(text, x, top, width, size=11, color=navy, bold=False, align=0, leading=None):
    style = ParagraphStyle('copy', fontName='Helvetica-Bold' if bold else 'Helvetica',
                           fontSize=size, leading=leading or size * 1.35,
                           textColor=color, alignment=align)
    item = Paragraph(text, style)
    _, height = item.wrap(width, 792)
    item.drawOn(pdf, x, top - height)
    return top - height


pdf.setFillColor(white)
pdf.rect(0, 0, 612, 792, fill=1, stroke=0)
# Comfortable printer-safe margins; every important element is inside 0.35in.
pdf.setFillColor(navy)
pdf.rect(26, 526, 560, 240, fill=1, stroke=0)
pdf.setFillColor(green)
pdf.rect(26, 762, 560, 4, fill=1, stroke=0)
pdf.drawImage(str(root / 'public/brand/logos/tenaceiq-full-white.png'),
              194, 680, width=224, height=60, preserveAspectRatio=True, anchor='c', mask='auto')
paragraph('LOCAL TENNIS<br/>CAPTAINS', 50, 665, 512, 39, white, True, TA_CENTER, 39)
paragraph('FALL CAPTAIN PILOT', 50, 574, 512, 10, green, True, TA_CENTER)
paragraph('Start your fall season on us.', 50, 554, 512, 13, white, False, TA_CENTER)

pdf.setFillColor(green)
pdf.rect(26, 434, 560, 78, fill=1, stroke=0)
paragraph(offer['offer'], 42, 499, 528, 25, navy, True, TA_CENTER)
paragraph(offer['duration'], 42, 465, 528, 10, navy, False, TA_CENTER)
paragraph(offer['renewal'], 42, 425, 528, 9, muted, False, TA_CENTER)

paragraph('YOUR MATCH WEEK, UNDER CONTROL', 30, 380, 340, 10, muted, True)
top = 354
for index, benefit in enumerate(offer['benefits'], 1):
    paragraph(f'{index:02d}', 30, top, 24, 10, muted, True)
    paragraph(benefit, 66, top, 284, 12, navy, True)
    pdf.setStrokeColor(HexColor('#DCE3ED'))
    pdf.line(66, top - 38, 350, top - 38)
    top -= 45

pdf.setFillColor(navy)
pdf.rect(374, 132, 212, 255, fill=1, stroke=0)
qr = QrCodeWidget(offer['applyUrl'], barLevel='M')
bounds = qr.getBounds()
scale = 152 / (bounds[2] - bounds[0])
drawing = Drawing(152, 152, transform=[scale, 0, 0, scale, 0, 0])
drawing.add(qr)
pdf.setFillColor(white)
pdf.rect(399, 216, 162, 162, fill=1, stroke=0)
renderPDF.draw(drawing, pdf, 404, 221)
paragraph('Scan to start', 386, 199, 188, 19, green, True, TA_CENTER)
paragraph('tenaceiq.com/captain-pilot', 386, 170, 188, 10, white, False, TA_CENTER)
pdf.linkURL(offer['applyUrl'], (374, 132, 586, 387), relative=0, thickness=0)

paragraph('Built with local captains.', 30, 121, 550, 12, navy, True)
paragraph('Questions or feedback? Nathan@TenAceiQ.com', 30, 102, 550, 10, muted)
pdf.linkURL('mailto:nathan@tenaceiq.com', (30, 86, 360, 102), relative=0, thickness=0)
end = paragraph(offer['terms'], 30, 74, 552, 7.2, muted, leading=9.2)
if end < 25:
    raise ValueError('Flyer terms no longer fit inside the one-page safe area.')
pdf.showPage()
pdf.save()
output.with_suffix('.json').write_text(json.dumps(offer, indent=2) + '\n', encoding='utf-8')
print(f'Created one-page flyer: {output}')
