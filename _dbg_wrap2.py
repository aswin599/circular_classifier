import sys
sys.argv = ['dbg']
import make_docx as m
p = m.PAGES[11]
t = p['tables'][0]
def lines_for(cbox):
    cx0, cx1, ctop, cbot = cbox
    cc = [c for c in p['chars']
          if cbot - 0.1 <= c[2] <= ctop + 0.1 and c[0] >= cx0 - 0.6 and c[1] <= cx1 + 0.6]
    buckets = {}
    for c in cc:
        buckets.setdefault(c[2], []).append(c)
    clines = []
    for y in sorted(buckets, reverse=True):
        cs = sorted(buckets[y], key=lambda c: c[0])
        runs = m.group_runs(cs)
        clines.append({'y': y, 'x0': cs[0][0], 'x1': max(c[1] for c in cs if c[6].strip()) if any(c[6].strip() for c in cs) else cs[-1][1], 'runs': runs, 'text': ''.join(r['t'] for r in runs)})
    return clines
def wrap(clines, cx0, cx1, text):
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
    return len(wl)
cands = {
 (1,3): ["Automatic daily ingestion from email and uploads into one searchable repository"],
 (7,2): ["No control over who publishes notices or edits them after publishing, and no audit trail"],
 (7,3): ["Role-based accounts for students, staff and administrators with per-role publish, edit and delete rights"],
}
for (ri, ci), texts in cands.items():
    cbox = t['rows'][ri]['cells'][ci]
    cl = lines_for(cbox)
    for txt in texts:
        print("r%d c%d target=%d -> %d  %r" % (ri, ci, len(cl), wrap(cl, cbox[0], cbox[1], txt), txt[:70]))
