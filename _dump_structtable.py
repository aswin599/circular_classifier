import sys; sys.argv=['x']
import make_docx as m
p = m.PAGES[11]
for t in p.get('tables', []):
    for ri, row in enumerate(t['rows']):
        rx0, rx1, rtop, rbot = row['bbox']
        for ci, cbox in enumerate(row['cells']):
            if cbox is None: continue
            cx0, cx1, ctop, cbot = cbox
            cc = sorted([c for c in p['chars']
                  if cbot - 0.1 <= c[2] <= ctop + 0.1
                  and c[0] >= cx0 - 0.6 and c[1] <= cx1 + 0.6], key=lambda c: (c[2], c[0]))
            buckets = {}
            for c in cc:
                buckets.setdefault(c[2], []).append(c)
            for y in sorted(buckets, reverse=True):
                cs = sorted(buckets[y], key=lambda c: c[0])
                txt = ''.join(m.group_runs(cs)[i]['t'] for i in range(len(m.group_runs(cs))))
                print("r%d c%d  y=%-6.1f  %r" % (ri, ci, y, txt[:60]))
