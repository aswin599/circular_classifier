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
            tkey = (12, ri, ci)
            if tkey not in m.CE.TABLE_EDITS:
                continue
            text = m.CE.TABLE_EDITS[tkey]
            tf = m._dominant_font(clines)
            tsz = m.maxsize(clines[0])
            avail = cx1 - cx0 - 2.0
            wl, cur = [], ''
            for w in text.split():
                tt = (cur + ' ' + w).strip()
                if not cur or m._textw(tt, tf, tsz) <= avail:
                    cur = tt
                else:
                    wl.append(cur); cur = w
            if cur: wl.append(cur)
            print('r%d c%d  target=%d mine=%d   %r'
                  % (ri, ci, len(clines), len(wl), text[:80]))
