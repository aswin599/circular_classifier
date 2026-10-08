import json
from collections import defaultdict
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextLine, LTChar, LTTextContainer, LTFigure, LAParams

def collapse(t):
    return " ".join(t.split())

def export_lines(page):
    out = []
    def walk(el):
        if isinstance(el, LTTextLine):
            size = 0; text = ""
            for ch in el:
                if isinstance(ch, LTChar):
                    size = max(size, ch.size); text += ch.get_text()
            if collapse(text):
                out.append((el.y0 + 0.216 * size, el.x0, el.x1, collapse(text)))
        elif isinstance(el, (LTTextContainer, LTFigure)):
            for c in el:
                walk(c)
    for el in page:
        walk(el)
    out.sort()
    clusters = []
    for y, x0, x1, t in out:
        if clusters and abs(y - clusters[-1][0]) < 1.6:
            clusters[-1][1].append((x0, x1, t))
        else:
            clusters.append([y, [(x0, x1, t)]])
    merged = []
    for y, items in clusters:
        items.sort()
        merged.append((y, items[0][0], max(i[1] for i in items), " ".join(t for _, _, t in items)))
    return merged

S = json.load(open("_structure.json"))["pages"][11]
rows = S["tables"][0]["rows"]
pages = list(extract_pages("_verify.pdf", laparams=LAParams()))
el = [x for x in export_lines(pages[11])]
print("=== EXPORT baselines page 12 (%d) ===" % len(el))
for y, x0, x1, t in el:
    print("%7.1f  x%-5.0f %s" % (y, x0, t[:60]))
print()
PCH = S["chars"]
print("=== struct row bands ===")
for ri, row in enumerate(rows):
    rx0, rx1, rtop, rbot = row["bbox"]
    print("r%d top=%6.1f bot=%6.1f h=%5.1f" % (ri, rtop, rbot, rtop - rbot))
    for ci, c in enumerate(row["cells"]):
        if c is None:
            continue
        cx0, cx1, ctop, cbot = c
        found = [ch for ch in PCH if cbot - 0.1 <= ch[2] <= ctop + 0.1 and ch[0] >= cx0 - 0.6 and ch[1] <= cx1 + 0.6]
        ys = sorted({round(ch[2], 1) for ch in found}, reverse=True)
        print("   c%d x=%.0f-%.0f baselines=%s" % (ci, cx0, cx1, ys))
