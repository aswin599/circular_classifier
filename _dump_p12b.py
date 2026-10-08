import json, importlib.util, sys
from pdfminer.high_level import extract_pages
from pdfminer.layout import LAParams

spec = importlib.util.spec_from_file_location('v', '_verify.py')
v = importlib.util.module_from_spec(spec)
sys.argv = ['_verify.py', '_verify.pdf']
spec.loader.exec_module(v)
pages = list(extract_pages('_verify.pdf', laparams=LAParams()))

p = v.STRUCT[11]
print('--- struct p12 tables ---')
for ti, t in enumerate(p.get('tables', [])):
    print('table%d y_top=%.1f y_bot=%.1f rows=%d cols=%d' % (
        ti, t['y_top'], t['y_bot'], len(t['rows']), len(t['rows'][0]['cells'])))
    for ri, r in enumerate(t['rows']):
        rx0, rx1, rtop, rbot = r['bbox']
        lines_in_row = []
        for ci, cbox in enumerate(r['cells']):
            if cbox is None:
                continue
            cx0, cx1, ctop, cbot = cbox
            cells = [c for c in p['chars']
                     if cbot - 0.1 <= c[2] <= ctop + 0.1
                     and c[0] >= cx0 - 0.6 and c[1] <= cx1 + 0.6]
            ys = sorted({round(c[2], 1) for c in cells})
            lines_in_row.append((ci, ctop, cbot, len(ys), ys[:3]))
        print('  r%-2d h=%.1f (%.1f->%.1f) ' % (ri, rtop - rbot, rtop, rbot), lines_in_row)

el = v.export_lines(pages[11])
print('--- export p12 lines (every struct-ish y) ---')
for ey, ex0, ex1, et in el:
    print('  E %.1f %r' % (ey, et[:54]))