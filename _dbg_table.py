import sys
sys.argv = ['dbg']
import make_docx as m
p = m.PAGES[11]
for t in p.get('tables', []):
    for ri, row in enumerate(t['rows']):
        rx0, rx1, rtop, rbot = row['bbox']
        for ci, cbox in enumerate(row['cells']):
            if cbox is None:
                continue
            cx0, cx1, ctop, cbot = cbox
            cc = [c for c in p['chars']
                  if cbot - 0.1 <= c[2] <= ctop + 0.1
                  and c[0] >= cx0 - 0.6 and c[1] <= cx1 + 0.6]
            buckets = {}
            for c in cc:
                buckets.setdefault(c[2], []).append(c)
            clines = []
            for y in sorted(buckets, reverse=True):
                cs = sorted(buckets[y], key=lambda c: c[0])
                runs = m.group_runs(cs)
                ink = [c for c in cs if c[6].strip()]
                clines.append({'y': y, 'x0': cs[0][0],
                              'x1': max(c[1] for c in ink) if ink else cs[-1][1],
                              'runs': runs,
                              'text': ''.join(r['t'] for r in runs)})
            if not clines:
                continue
            s = m.maxsize(clines[0])
            n = len(clines)
            if n >= 2:
                L = (clines[0]['y'] - clines[-1]['y']) / (n - 1)
            else:
                L = 1.15 * m.nat(s)
            S = rtop - m.off(L, s) - clines[0]['y']
            tkey = (12, ri, ci)
            ne = '  EDITED' if tkey in m.CE.TABLE_EDITS else ''
            print('r%d c%d  box(%.0f->%.0f) n=%d L=%.1f s=%.1f S=%+6.1f  y0=%.1f%s'
                  % (ri, ci, rtop, rbot, n, L, s, S, clines[0]['y'], ne))