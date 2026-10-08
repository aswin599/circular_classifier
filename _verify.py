import json, sys, re
from collections import defaultdict
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextLine, LTChar, LTFigure, LTTextContainer, LAParams

STRUCT = json.load(open('_structure.json'))['pages']
_args = [a for a in sys.argv[1:] if not a.startswith('--')]
PDF = _args[0] if _args else '_verify.pdf'

def collapse(t):
    return ' '.join(t.split())

def struct_lines(pg):
    chars = pg['chars']
    rows = defaultdict(list)
    for c in chars:
        x0, x1, y, font, size, color, t = c
        rows[round(y, 1)].append((x0, x1, t))
    # merge rows whose y differ < 0.6pt
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
        text = ''.join(t for _, _, t in items)
        if collapse(text):
            out.append((y, min(i[0] for i in items), max(i[1] for i in items), collapse(text)))
    return out

def export_lines(page):
    out = []
    def walk(el):
        if isinstance(el, LTTextLine):
            size = 0
            text = ''
            for ch in el:
                if isinstance(ch, LTChar):
                    size = max(size, ch.size)
                    text += ch.get_text()
            if collapse(text):
                out.append((el.y0 + 0.216 * size, el.x0, el.x1, collapse(text)))
        elif isinstance(el, (LTTextContainer, LTFigure)):
            for c in el:
                walk(c)
    for el in page:
        walk(el)
    # Word stretches justified lines so far that pdfminer splits one visual
    # line into several containers at the wide gaps (same for adjacent table
    # cells on one baseline): cluster fragments whose estimated baseline is
    # within 1.6pt (line spacing is >= 11pt) and reassemble left-to-right.
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
        merged.append((y, items[0][0], max(i[1] for i in items),
                       ' '.join(t for _, _, t in items)))
    return merged

def export_figs(page):
    figs = []
    def walk(el):
        if isinstance(el, LTFigure):
            figs.append((el.y1, el.y0, el.x0, el.x1))
        elif hasattr(el, '__iter__'):
            for c in el:
                walk(c)
    for el in page:
        walk(el)
    return figs

pages = list(extract_pages(PDF, laparams=LAParams()))
print('export pages:', len(pages))


def geom_check():
    total_miss = 0
    for i, pg in enumerate(pages):
        pn = i + 1
        if i >= len(STRUCT):
            print('p%-3d *** EXTRA EXPORT PAGE' % pn)
            total_miss += 1
            continue
        sl = struct_lines(STRUCT[i])
        el = export_lines(pg)
        used = set()
        miss = []
        for y, x0, x1, t in sl:
            best = None
            for j, (ey, ex0, ex1, et) in enumerate(el):
                if j in used:
                    continue
                d = ey - y
                if best is None or abs(d) < abs(best[1]):
                    best = (j, d)
            if best is None:
                miss.append((y, 'NO EXPORT LINE'))
            elif abs(best[1]) > 2:
                miss.append((y, 'dy=%.1f' % best[1]))
            else:
                used.add(best[0])
        if miss:
            total_miss += len(miss)
            print('p%-3d hits=%d/%d misses=%d' % (pn, len(sl) - len(miss), len(sl), len(miss)))
            for y, why in miss[:8]:
                print('     y=%.1f %s' % (y, why))
        simgs = sorted(STRUCT[i].get('images', []), key=lambda m: -m['y_top'])
        xfigs = sorted(export_figs(pg), key=lambda f: -f[0])
        for k in range(max(len(simgs), len(xfigs))):
            if k < len(simgs) and k < len(xfigs):
                m = simgs[k]; fy1, fy0, fx0, fx1 = xfigs[k]
                dy = fy1 - m['y_top']; dx = fx0 - m['x0']
                if abs(dy) > 2 or abs(dx) > 2:
                    print('p%-3d img%d dy=%.1f dx=%.1f' % (pn, k, dy, dx))
            elif k < len(simgs):
                print('p%-3d img%d MISSING' % (pn, k))
            else:
                print('p%-3d img%d EXTRA' % (pn, k))
    print('geom total baseline misses:', total_miss)
    return total_miss


if '--geom' in sys.argv:
    geom_check()
    sys.exit()
report = []
for i, pg in enumerate(pages):
    pn = i + 1
    if i >= len(STRUCT):
        print('p%-2d *** EXTRA EXPORT PAGE (%d struct pages total)' % (pn, len(STRUCT)))
        continue
    s = STRUCT[i]
    sl = struct_lines(s)
    el = export_lines(pg)
    used = set()
    pairs = []
    unmatched = []
    for y, x0, x1, t in sl:
        best = None
        for j, (ey, ex0, ex1, et) in enumerate(el):
            if j in used or et != t:
                continue
            d = ey - y
            if best is None or abs(d) < abs(best[1]):
                best = (j, d)
        if best is None:
            unmatched.append((y, t))
        else:
            used.add(best[0])
            pairs.append((y, best[1], t))
    dys = sorted(p[1] for p in pairs)
    med = dys[len(dys) // 2] if dys else float('nan')
    big = [(y, d, t) for y, d, t in pairs if abs(d - med) > 2 or abs(d) > 2]
    # images
    simgs = sorted(s.get('images', []), key=lambda m: -m['y_top'])
    xfigs = sorted(export_figs(pg), key=lambda f: -f[0])
    imgres = []
    for k in range(max(len(simgs), len(xfigs))):
        if k < len(simgs) and k < len(xfigs):
            m = simgs[k]; fy1, fy0, fx0, fx1 = xfigs[k]
            imgres.append('img%d dy=%.1f dx=%.1f (y %.1f->%.1f)' % (k, fy1 - m['y_top'], fx0 - m['x0'], m['y_top'], fy1))
        elif k < len(simgs):
            imgres.append('img%d MISSING in export' % k)
        else:
            imgres.append('img%d EXTRA in export' % k)
    flag = 'OK'
    if abs(med) > 2 or big or unmatched or any('MISSING' in x or 'EXTRA' in x for x in imgres) or \
       any(abs(float(re.search(r'dy=(-?\d+\.\d+)', x).group(1))) > 2 for x in imgres if 'dy=' in x):
        flag = '***'
    print('p%-2d %s lines=%d/%d unmatched=%d med=%+.1f big=%d' % (
        pn, flag, len(pairs), len(sl), len(unmatched), med, len(big)))
    for y, t in unmatched:
        print('    UNMATCH y=%.1f %r' % (y, t[:70]))
    for y, d, t in big:
        print('    DY %+.1f y=%.1f %r' % (d, y, t[:70]))
    for x in imgres:
        if 'dy=' not in x or abs(float(re.search(r'dy=(-?\d+\.\d+)', x).group(1))) > 2 or abs(float(re.search(r'dx=(-?\d+\.\d+)', x).group(1))) > 2:
            print('   ', x)
