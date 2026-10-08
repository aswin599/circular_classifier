import json, sys
from collections import defaultdict
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextLine, LTChar, LTFigure, LTTextContainer, LAParams

STRUCT = json.load(open('_structure.json'))['pages']
PDF = sys.argv[1] if len(sys.argv) > 1 else '_verify.pdf'
PAGES = [int(x) for x in sys.argv[2].split(',')] if len(sys.argv) > 2 else list(range(1, 45))

def collapse(t):
    return ' '.join(t.split())

def struct_lines(pg):
    rows = defaultdict(list)
    for x0, x1, y, font, size, color, t in pg['chars']:
        rows[round(y, 1)].append((x0, x1, t))
    ys = sorted(rows)
    merged = []
    for y in ys:
        if merged and abs(y - merged[-1][0]) < 0.6:
            merged[-1][1].extend(rows[y])
        else:
            merged.append([y, list(rows[y])])
    out = []
    for y, items in merged:
        items.sort()
        text = collapse(''.join(t for _, _, t in items))
        if text:
            out.append((y, text))
    return out

def export_lines(page):
    out = []
    def walk(el):
        if isinstance(el, LTTextLine):
            size = 0; text = ''
            for ch in el:
                if isinstance(ch, LTChar):
                    size = max(size, ch.size); text += ch.get_text()
            if collapse(text):
                out.append((el.y0 + 0.216 * size, collapse(text)))
        elif isinstance(el, (LTTextContainer, LTFigure)):
            for c in el: walk(c)
    for el in page: walk(el)
    return out

pages = list(extract_pages(PDF, laparams=LAParams()))
for pn in PAGES:
    s = STRUCT[pn - 1]
    sl = sorted(struct_lines(s), reverse=True)
    el = sorted(export_lines(pages[pn - 1]), reverse=True)
    print('=== p%d struct=%d export=%d' % (pn, len(sl), len(el)))
    print('  %-7s %-46s | %-7s %-46s | dy' % ('sy', 'struct', 'ey', 'export'))
    # nearest-y pairing
    used = set()
    for y, t in sl:
        best = None
        for j, (ey, et) in enumerate(el):
            if j in used: continue
            d = abs(ey - y)
            if best is None or d < best[0]: best = (d, j, ey, et)
        if best and best[0] < 120:
            used.add(best[1])
            dy = best[2] - y
            mark = '  <<' if abs(dy) > 2 else ''
            print('  %-7.1f %-46s | %-7.1f %-46s | %+.1f%s' % (y, t[:46], best[2], best[3][:46], dy, mark))
        else:
            print('  %-7.1f %-46s | %-7s %-46s | %s' % (y, t[:46], '-', 'NO NEAR EXPORT LINE', 'MISS'))
    for j, (ey, et) in enumerate(el):
        if j not in used:
            print('  %-7s %-46s | %-7.1f %-46s | %s' % ('-', 'no struct line', ey, et[:46], 'EXTRA'))
