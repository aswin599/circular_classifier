import json, importlib.util
from collections import defaultdict
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextLine, LTChar, LTFigure, LTTextContainer, LAParams

spec = importlib.util.spec_from_file_location('v', '_verify.py')
v = importlib.util.module_from_spec(spec)
import sys
sys.argv = ['_verify.py', '_verify.pdf']
spec.loader.exec_module(v)

pages = list(extract_pages('_verify.pdf', laparams=LAParams()))

def show(pn):
    s = v.STRUCT[pn - 1]
    sl = v.struct_lines(s)
    el = v.export_lines(pages[pn - 1])
    print('--- page %d: struct lines %d export lines %d' % (pn, len(sl), len(el)))
    for y, x0, x1, t in sl:
        if any(abs(y - ey) <= 40 for ey, _, _, _ in el):
            print('  S %.1f %r' % (y, t[:70]))
    print('  -- export near those --')
    for ey, ex0, ex1, et in el:
        if any(abs(ey - sy) <= 40 for sy, _, _, _ in sl):
            print('  E %.1f %r' % (ey, et[:70]))

for p in (1, 32, 2):
    show(p)