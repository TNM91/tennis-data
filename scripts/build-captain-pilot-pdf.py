"""Create the one-page Captain Pilot flyer from the shared offer source."""

import json
import sys
from pathlib import Path

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

root = Path(__file__).resolve().parent.parent
offer = json.load(sys.stdin)
output = root / 'public' / offer['pdfPath'].lstrip('/')
output.parent.mkdir(parents=True, exist_ok=True)

navy, green, blue, white_blue, muted, line = map(HexColor, [
    '#06172F', '#9BE11D', '#245E91', '#F4F8FC', '#40536D', '#DCE3ED'
])
pdf = canvas.Canvas(str(output), pagesize=(612, 792), pageCompression=1, invariant=1)
pdf.setTitle('TenAceIQ - Fall Captain Pilot - 3 months free')
pdf.setAuthor('TenAceIQ')
pdf.setSubject('One-page Captain pilot flyer. Three months from activation.')


def paragraph(text, x, top, width, size=11, color=navy, bold=False, align=0, leading=None):
    style = ParagraphStyle(
        'copy', fontName='Helvetica-Bold' if bold else 'Helvetica', fontSize=size,
        leading=leading or size * 1.3, textColor=color, alignment=align,
    )
    item = Paragraph(text, style)
    _, height = item.wrap(width, 792)
    item.drawOn(pdf, x, top - height)
    return top - height


def tool_icon(index, x, y):
    """Draw print-safe, app-like Captain tool icons without relying on font glyphs."""
    pdf.setFillColor(HexColor('#EFF8D8'))
    pdf.setStrokeColor(HexColor('#B9D87B'))
    pdf.setLineWidth(.7)
    pdf.circle(x, y, 14, fill=1, stroke=1)
    pdf.setStrokeColor(navy)
    pdf.setFillColor(navy)
    pdf.setLineWidth(1.4)
    if index == 1:  # Availability
        pdf.roundRect(x - 7, y - 7, 14, 13, 2, fill=0, stroke=1)
        pdf.line(x - 7, y + 2, x + 7, y + 2)
        pdf.circle(x - 3, y + 7, .9, fill=1, stroke=0)
        pdf.circle(x + 3, y + 7, .9, fill=1, stroke=0)
        pdf.circle(x - 3, y - 2, .8, fill=1, stroke=0)
        pdf.circle(x + 3, y - 2, .8, fill=1, stroke=0)
    elif index == 2:  # Lineup
        for row in range(2):
            for col in range(3):
                pdf.roundRect(x - 7 + col * 5, y - 5 + row * 6, 3.2, 4, .7, fill=0, stroke=1)
    elif index == 3:  # Scouting
        pdf.circle(x, y, 7, fill=0, stroke=1)
        pdf.circle(x, y, 3, fill=0, stroke=1)
        pdf.line(x + 5, y - 5, x + 9, y - 9)
    else:  # Team plan and scorecard
        pdf.roundRect(x - 8, y - 6, 16, 11, 2, fill=0, stroke=1)
        pdf.line(x - 4, y + 1, x + 4, y + 1)
        pdf.line(x - 4, y - 2, x + 2, y - 2)
        pdf.line(x + 1, y - 6, x + 4, y - 9)


def tool_card(index, x, y, title, copy):
    pdf.setFillColor(white_blue)
    pdf.setStrokeColor(line)
    pdf.setLineWidth(.8)
    pdf.roundRect(x, y, 160, 76, 10, fill=1, stroke=1)
    pdf.setFillColor(green)
    pdf.roundRect(x + 16, y + 58, 36, 3, 1.5, fill=1, stroke=0)
    tool_icon(index, x + 28, y + 29)
    title_bottom = paragraph(title, x + 51, y + 52, 96, 11, blue, True)
    paragraph(copy, x + 51, title_bottom - 5, 96, 8.5, muted, False, leading=10.5)


def phone_preview(x, y, width, height):
    """Show a real Captain screen in a compact, print-safe device window."""
    image = ImageReader(str(root / 'public/media/product-tours/captain-phone-scorecard.png'))
    source_width, source_height = image.getSize()
    drawn_height = width * source_height / source_width
    image_y = y - ((drawn_height - height) * .65)
    pdf.setFillColor(navy)
    pdf.roundRect(x - 4, y - 4, width + 8, height + 8, 12, fill=1, stroke=0)
    pdf.setStrokeColor(green)
    pdf.setLineWidth(.8)
    pdf.roundRect(x - 4, y - 4, width + 8, height + 8, 12, fill=0, stroke=1)
    pdf.saveState()
    clip = pdf.beginPath()
    clip.roundRect(x, y, width, height, 8)
    pdf.clipPath(clip, stroke=0, fill=0)
    pdf.drawImage(image, x, image_y, width=width, height=drawn_height, mask='auto')
    pdf.restoreState()


# Paper ground
pdf.setFillColor(white)
pdf.rect(0, 0, 612, 792, fill=1, stroke=0)

# Hero: high-contrast site-style launch panel
pdf.setFillColor(navy)
pdf.roundRect(26, 520, 560, 246, 13, fill=1, stroke=0)
pdf.setFillColor(green)
pdf.roundRect(26, 762, 560, 4, 2, fill=1, stroke=0)
pdf.setStrokeColor(HexColor('#315477'))
pdf.setLineWidth(.8)
pdf.circle(556, 730, 106, fill=0, stroke=1)
pdf.circle(556, 730, 82, fill=0, stroke=1)
pdf.setStrokeColor(HexColor('#91B52B'))
pdf.setLineWidth(1.2)
pdf.arc(483, 658, 628, 803, 102, 78)
pdf.drawImage(
    str(root / 'public/brand/logos/tenaceiq-full-white.png'),
    48, 707, width=172, height=46, preserveAspectRatio=True, anchor='c', mask='auto',
)
pdf.setFillColor(green)
pdf.roundRect(434, 722, 122, 22, 11, fill=1, stroke=0)
paragraph('FALL CAPTAIN PILOT', 438, 737, 114, 7.2, navy, True, TA_CENTER)
paragraph('STOP CHASING', 48, 686, 430, 41, white, True, leading=41)
paragraph('THE GROUP TEXT.', 48, 642, 470, 41, white, True, leading=41)
paragraph('Captain turns availability, lineups, scouting, and the team plan into one clear match-week flow.', 50, 579, 422, 14, HexColor('#D8E7FB'), False, leading=19)
paragraph('YOUR TEAM. ONE CLEAR PLAN.', 50, 541, 360, 9.5, green, True)

# Offer: the second visual hit
pdf.setFillColor(green)
pdf.roundRect(26, 438, 560, 64, 12, fill=1, stroke=0)
paragraph(offer['offer'].upper(), 44, 488, 524, 27, navy, True, TA_CENTER)
paragraph(offer['duration'], 44, 457, 524, 10, navy, False, TA_CENTER)
paragraph(offer['renewal'], 38, 427, 536, 8.9, muted, False, TA_CENTER)

# Feature cards use the same compact dark/bright language as the Captain interface
pdf.setFillColor(green)
pdf.roundRect(30, 405, 34, 3, 1.5, fill=1, stroke=0)
paragraph('THE CAPTAIN MATCH-WEEK FLOW', 30, 396, 342, 10, blue, True)
phone_preview(30, 202, 160, 176)
paragraph('REAL LIVE SCORECARD', 30, 194, 160, 7.5, blue, True, TA_CENTER)
tool_card(2, 206, 306, 'Build the lineup', 'with your real team context.')
tool_card(4, 206, 212, 'Send one plan', 'and share the scorecard after.')

# The QR is treated as the primary action, not a footer afterthought
pdf.setFillColor(navy)
pdf.roundRect(390, 180, 196, 228, 12, fill=1, stroke=0)
pdf.setStrokeColor(green)
pdf.setLineWidth(.9)
pdf.roundRect(390.5, 180.5, 195, 227, 11.5, fill=0, stroke=1)
pdf.setFillColor(green)
pdf.roundRect(409, 381, 158, 3, 1.5, fill=1, stroke=0)
paragraph('LOCAL CAPTAIN INVITATION', 402, 397, 172, 7.5, green, True, TA_CENTER)
qr = QrCodeWidget(offer['applyUrl'], barLevel='M')
bounds = qr.getBounds()
scale = 132 / (bounds[2] - bounds[0])
drawing = Drawing(132, 132, transform=[scale, 0, 0, scale, 0, 0])
drawing.add(qr)
pdf.setFillColor(white)
pdf.roundRect(422, 236, 132, 132, 7, fill=1, stroke=0)
renderPDF.draw(drawing, pdf, 422, 236)
paragraph('SCAN TO START', 402, 221, 172, 16, green, True, TA_CENTER)
paragraph('tenaceiq.com/captain-pilot', 402, 200, 172, 8.5, white, False, TA_CENTER)
pdf.linkURL(offer['applyUrl'], (390, 180, 586, 408), relative=0, thickness=0)

# Feedback and terms remain practical and print-readable
pdf.setFillColor(green)
pdf.roundRect(30, 173, 34, 3, 1.5, fill=1, stroke=0)
paragraph('BUILT WITH LOCAL CAPTAINS', 30, 164, 340, 9, navy, True)
paragraph('Your feedback helps shape what Captain does next.', 30, 146, 340, 10.5, muted)
paragraph('Questions or feedback? Nathan@TenAceiQ.com', 30, 126, 340, 9.5, muted)
pdf.linkURL('mailto:nathan@tenaceiq.com', (30, 112, 340, 130), relative=0, thickness=0)
pdf.setStrokeColor(line)
pdf.setLineWidth(.8)
pdf.line(30, 106, 582, 106)
paragraph('PILOT TERMS', 30, 94, 552, 7.3, muted, True)
end = paragraph(offer['terms'], 30, 80, 552, 7.1, muted, leading=8.8)
if end < 24:
    raise ValueError('Flyer terms no longer fit inside the one-page safe area.')

pdf.showPage()
pdf.save()
output.with_suffix('.json').write_text(json.dumps(offer, indent=2) + '\n', encoding='utf-8')
print(f'Created one-page flyer: {output}')
