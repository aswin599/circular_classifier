from pdfminer.high_level import extract_pages
from pdfminer.layout import LAParams, LTChar, LTTextLine, LTTextContainer, LTFigure

def chars(page):
    out = []
    def walk(el):
        if isinstance(el, LTChar):
            out.append((el.y0 + 0.216 * el.size, el.x0, el.size, el.get_text()))
        elif isinstance(el, (LTTextContainer, LTFigure, LTTextLine)):
            for c in el:
                walk(c)
    for el in page:
        walk(el)
    return out

pages = list(extract_pages("_verify.pdf", laparams=LAParams()))
cs = [c for c in chars(pages[11]) if 250 <= c[0] <= 342 and c[1] >= 440]
seen = set()
rows = {}
for y, x, sz, t in cs:
    rows.setdefault(round(y, 1), []).append((round(x), t))
for y in sorted(rows, reverse=True):
    rows[y].sort()
    print("%7.1f sz=%.1f  %s" % (y, sz, "".join(t for _, t in rows[y])[:70]))
