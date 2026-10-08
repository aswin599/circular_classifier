# Rebuild pages 1 (cover) and 2 (bonafide) of the sample report with the new
# project title / team names, leaving all other pages byte-for-byte intact.
# Technique: draw white rectangles over the old lines + new text on top,
# stamped onto the original pages with pypdf.
import io

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas as rl_canvas
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTChar
from pypdf import PdfReader, PdfWriter

SRC = r"C:\Users\User\OneDrive\Desktop\Circular_Classification\Project Report.pdf"
DST = r"C:\Users\User\OneDrive\Desktop\Circular_Classification\Circular Classifier - Project Report.pdf"
PAGE_W, PAGE_H = 596, 842

TITLE = "CIRCULAR CLASSIFIER"
NAME1 = "THIRUNAVUKARASU S (2503917762221009)"
NAME2 = "ASWIN C (2503917762221001)"


def walk(el):
    if isinstance(el, LTChar):
        yield el
    elif hasattr(el, "__iter__"):
        for c in el:
            yield from walk(c)


def lines_of(layout):
    buckets = {}
    for c in walk(layout):
        buckets.setdefault(round(c.matrix[5], 1), []).append(c)
    return [(y, sorted(buckets[y], key=lambda c: c.matrix[4]))
            for y in sorted(buckets, reverse=True)]


def visible_span(chars):
    lo = hi = None
    for c in chars:
        if not c.get_text().strip():
            continue
        x0, x1 = c.matrix[4], c.matrix[4] + c.width
        lo = x0 if lo is None else min(lo, x0)
        hi = x1 if hi is None else max(hi, x1)
    return lo, hi


# ---------------------------------------------------------------- gather page 1 geometry
pages = list(extract_pages(SRC, page_numbers=[0, 1]))
p1 = {round(y, 1): cs for y, cs in lines_of(pages[0])}
p2 = {round(y, 1): cs for y, cs in lines_of(pages[1])}

t_lo, t_hi = visible_span(p1[753.2])          # HEAL N GLOW
cx_title = (t_lo + t_hi) / 2.0
n1_lo, n1_hi = visible_span(p1[593.0])        # RAMKUMAR G (...)
cx_name1 = (n1_lo + n1_hi) / 2.0
n2_lo, n2_hi = visible_span(p1[574.6])        # YOGESHWARAN R (...)
cx_name2 = (n2_lo + n2_hi) / 2.0


# ---------------------------------------------------------------- page 1 overlay
def draw_page1(c):
    white(c, 178, 716, 244, 56)               # old two title lines
    white(c, 160, 568, 312, 46)               # old two name lines
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Times-Bold", 18)
    c.drawCentredString(cx_title, 753.2, TITLE)
    c.setFont("Times-Bold", 16)
    c.drawCentredString(cx_name1, 593.0, NAME1)
    c.drawCentredString(cx_name2, 574.6, NAME2)


# ---------------------------------------------------------------- page 2 paragraph
RUNS = [
    ("Times-Roman", 14, "Certified that this project report \u201c"),
    ("Times-Bold", 14, TITLE + "\u201d"),
    ("Times-Roman", 14, " is the bonafide work of \u201c"),
    ("Times-Bold", 16, NAME1 + ","),
    ("Times-Roman", 14, " "),
    ("Times-Bold", 16, NAME2),
    ("Times-Bold", 14, "\u201d"),
    ("Times-Roman", 14,
     " who carried out the Mini project work under my supervision "
     "during the Academic Year 2025-2026."),
]
LEFT, RIGHT = 108.0, 526.5
WIDTH = RIGHT - LEFT
BASELINES = [552.3, 526.3, 498.7, 473.0, 448.8]


def tokenise(runs):
    """-> items: ('w', [(font,size,seg)...]) and ('s', font, size)"""
    items = []
    for font, size, text in runs:
        parts = text.split(" ")
        for i, part in enumerate(parts):
            if i:
                items.append(("s", font, size))
            if part:
                if items and items[-1][0] == "w" and items[-1][1][0][0] == font \
                        and items[-1][1][0][1] == size:
                    items[-1][1].append((font, size, part))
                else:
                    items.append(("w", [(font, size, part)]))
    return items


def word_width(segs):
    return sum(pdfmetrics.stringWidth(t, f, s) for f, s, t in segs)


def wrap2(items, width):
    """Greedy wrap; returns list of lines, each a list of
    (segs, space_font, space_size) where space precedes the word (None on
    first word of line)."""
    lines, cur, curw = [], [], 0.0
    pend_sp = None
    for it in items:
        if it[0] == "s":
            pend_sp = (it[1], it[2])
            continue
        segs = it[1]
        w = word_width(segs)
        sp_w = pdfmetrics.stringWidth(" ", *pend_sp) if pend_sp else 0.0
        if cur and curw + sp_w + w > width:
            lines.append(cur)
            cur, curw, pend_sp = [(segs, None)], w, None
        else:
            if cur:
                curw += sp_w
            curw += w
            cur.append((segs, pend_sp))
            pend_sp = None
    if cur:
        lines.append(cur)
    return lines


def draw_line(c, segs_words, y, extra):
    """segs_words: [(segs, sp_or_None)] drawn left->right with justification."""
    x = LEFT
    gaps = len(segs_words) - 1
    add = (extra / gaps) if (gaps and extra) else 0.0
    for i, (segs, sp) in enumerate(segs_words):
        if i and sp:
            x += pdfmetrics.stringWidth(" ", *sp) + add
        elif i:
            x += add
        for font, size, txt in segs:
            c.setFont(font, size)
            c.drawString(x, y, txt)
            x += pdfmetrics.stringWidth(txt, font, size)


def draw_page2(c):
    white(c, 104, 442, 430, 128)              # old five-line paragraph
    c.setFillColorRGB(0, 0, 0)
    items = tokenise(RUNS)
    lines = wrap2(items, WIDTH)
    if len(lines) != len(BASELINES):
        raise SystemExit("paragraph wrapped to %d lines, expected %d"
                         % (len(lines), len(BASELINES)))
    for i, (line, y) in enumerate(zip(lines, BASELINES)):
        nat = 0.0
        for j, (segs, sp) in enumerate(line):
            if j and sp:
                nat += pdfmetrics.stringWidth(" ", *sp)
            nat += word_width(segs)
        last = (i == len(lines) - 1)
        extra = 0.0 if last else max(0.0, WIDTH - nat)
        draw_line(c, line, y, extra)


def white(c, x, y, w, h):
    c.setFillColorRGB(1, 1, 1)
    c.rect(x, y, w, h, stroke=0, fill=1)


def overlay_pdf(draw_fn):
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))
    draw_fn(c)
    c.showPage()
    c.save()
    buf.seek(0)
    return PdfReader(buf)


reader = PdfReader(SRC)
reader.pages[0].merge_page(overlay_pdf(draw_page1).pages[0])
reader.pages[1].merge_page(overlay_pdf(draw_page2).pages[0])

writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)
with open(DST, "wb") as fh:
    writer.write(fh)

print("wrote", DST)
print("title centre %.1f  name1 centre %.1f  name2 centre %.1f"
      % (cx_title, cx_name1, cx_name2))
print("name1 width %.1f  name2 width %.1f  title width %.1f"
      % (pdfmetrics.stringWidth(NAME1, "Times-Bold", 16),
         pdfmetrics.stringWidth(NAME2, "Times-Bold", 16),
         pdfmetrics.stringWidth(TITLE, "Times-Bold", 18)))
