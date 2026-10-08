import json
import sys
import make_docx as m

out = open("_paras.txt", "w", encoding="utf-8")
for pno in range(1, 45):
    if pno == 2:
        lines = m.page_lines(2, skip_y=(552.3, 526.3, 498.7, 473.0, 448.8))
    else:
        lines = m.page_lines(pno)
    if pno == 1:
        lines = m.page1_edits(lines)
    paras = m.group_paras(lines, pno)
    out.write("PAGE %d\n" % pno)
    for i, pa in enumerate(paras):
        pl = [l for l in pa["lines"] if l["text"].strip()]
        if not pl:
            continue
        out.write("  %2d y=%7.1f n=%d s=%4.1f x0=%6.1f h=%d | %s\n" % (
            i, pl[0]["y"], len(pl), m.maxsize(pl[0]), pl[0]["x0"],
            m.is_heading(pl[0]),
            " ".join(l["text"].strip() for l in pl)))
out.close()
print("written")
