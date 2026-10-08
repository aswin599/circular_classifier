import sys; sys.argv=['dbg']
import make_docx as m
p = m.PAGES[11]
cbox = p['tables'][0]['rows'][1]['cells'][3]
cx0, cx1, ctop, cbot = cbox
cc = [c for c in p['chars'] if cbot - 0.1 <= c[2] <= ctop + 0.1 and c[0] >= cx0 - 0.6 and c[1] <= cx1 + 0.6]
buckets = {}
for c in cc: buckets.setdefault(c[2], []).append(c)
clines = []
for y in sorted(buckets, reverse=True):
    cs = sorted(buckets[y], key=lambda c: c[0])
    clines.append({'y': y, 'runs': m.group_runs(cs), 'text': ''.join(r['t'] for r in m.group_runs(cs))})
tf = m._dominant_font(clines); tsz = m.maxsize(clines[0]); avail = cx1 - cx0 - 2.0
for txt in ["Automatic daily ingestion from email and document uploads into one searchable central repository",
            "Automatic ingestion from email and uploads into one searchable and central repository"]:
    wl, cur = [], ''
    for w in txt.split():
        tt = (cur + ' ' + w).strip()
        if not cur or m._textw(tt, tf, tsz) <= avail: cur = tt
        else: wl.append(cur); cur = w
    if cur: wl.append(cur)
    print(len(wl), wl) if False else print(len(wl), '|' + '|'.join(wl) + '|')
