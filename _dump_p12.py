import json, importlib.util, sys
from pdfminer.high_level import extract_pages
from pdfminer.layout import LAParams

spec = importlib.util.spec_from_file_location('v', '_verify.py')
v = importlib.util.module_from_spec(spec)
sys.argv = ['_verify.py', '_verify.pdf']
spec.loader.exec_module(v)
pages = list(extract_pages('_verify.pdf', laparams=LAParams()))

pn = 12
s = v.STRUCT[pn - 1]
sl = v.struct_lines(s)
el = v.export_lines(pages[pn - 1])
used = set()
print('--- p%d pairs (struct y -> nearest export) ---' % pn)
for y, x0, x1, t in sl:
    best = None
    for j, (ey, ex0, ex1, et) in enumerate(el):
        if j in used:
            continue
        d = ey - y
        if best is None or abs(d) < abs(best[1]):
            best = (j, d)
    if best is None:
        print('S %.1f %-38r  ->  NO EXPORT' % (y, t))
        continue
    j, d = best
    used.add(j)
    flag = '' if abs(d) <= 2 else '  <<<'
    print('S %.1f %-38r  ->  E %.1f  %-38r dy%+.1f%s' % (y, t, el[j][0], el[j][3], d, flag))
for j, (ey, ex0, ex1, et) in enumerate(el):
    if j not in used:
        print('EXTRA  E %.1f %r' % (ey, et[:60]))