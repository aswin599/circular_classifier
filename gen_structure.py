# Dump char-level structure of the original report to _structure.json:
# per page: chars [x0, x1, baseline_y, fontname, size, color, text],
# tables (bbox + row/col grid), images (deduped bboxes, PDF coords).
import json

import pdfplumber
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTChar

SRC = r"C:\Users\User\OneDrive\Desktop\Circular_Classification\Project Report.pdf"
OUT = r"C:\Users\User\OneDrive\Desktop\Circular_Classification\_structure.json"
PAGE_H = 842.0


def walk(el):
    if isinstance(el, LTChar):
        yield el
    elif hasattr(el, "__iter__"):
        for c in el:
            yield from walk(c)


def norm_color(c):
    if c is None:
        return None
    if isinstance(c, (int, float)):
        return [float(c)] * 3
    vals = list(c)
    if len(vals) == 1:
        return [float(vals[0])] * 3
    if len(vals) == 3:
        return [float(v) for v in vals]
    return None


pages_out = []
for pno, layout in enumerate(extract_pages(SRC)):
    chars = []
    for c in walk(layout):
        if not isinstance(c, LTChar):
            continue
        ch = c.get_text()
        if not ch:
            continue
        if ord(ch) < 32:
            ch = " "
        color = norm_color(getattr(c, "non_stroking_color", None))
        font = c.fontname.split("+")[-1]
        chars.append([
            round(c.bbox[0], 2), round(c.bbox[2], 2),
            round(c.matrix[5], 1),
            font, round(c.size, 1), color, ch,
        ])
    chars.sort(key=lambda r: (-r[2], r[0]))
    pages_out.append({"chars": chars})
    print("page %2d chars %d" % (pno + 1, len(chars)))

pdf = pdfplumber.open(SRC)
for pno, page in enumerate(pdf.pages):
    tabs = []
    for t in page.find_tables():
        rects = [r for r in page.rects
                 if r["x0"] >= t.bbox[0] - 1 and r["x1"] <= t.bbox[2] + 1
                 and r["top"] >= t.bbox[1] - 1 and r["bottom"] <= t.bbox[3] + 1
                 and (r.get("non_stroking_color") or (1, 1, 1)) != (1.0, 1.0, 1.0)]
        grid = []
        for row in t.rows:
            cells = []
            for cell in row.cells:
                if cell is None:
                    cells.append(None)
                else:
                    cx0, ctop, cx1, cbot = cell[:4]
                    cells.append([round(cx0, 2), round(cx1, 2),
                                  round(PAGE_H - ctop, 2),
                                  round(PAGE_H - cbot, 2)])
            rb = row.bbox
            row_y = (rb[1] + rb[3]) / 2.0
            fill = None
            for r in rects:
                if r["top"] <= row_y <= r["bottom"]:
                    col = r.get("non_stroking_color") or (1, 1, 1)
                    fill = [round(float(v), 4) for v in col[:3]]
                    break
            grid.append({
                "bbox": [round(rb[0], 2), round(rb[2], 2),
                         round(PAGE_H - rb[1], 2), round(PAGE_H - rb[3], 2)],
                "cells": cells,
                "fill": fill,
            })
        tabs.append({
            "x0": round(t.bbox[0], 2), "x1": round(t.bbox[2], 2),
            "y_top": round(PAGE_H - t.bbox[1], 2),
            "y_bot": round(PAGE_H - t.bbox[3], 2),
            "rows": grid,
        })
    imgs, seen = [], set()
    for im in page.images:
        key = (round(im["x0"], 2), round(im["x1"], 2),
               round(PAGE_H - im["top"], 2), round(PAGE_H - im["bottom"], 2))
        if key in seen:
            print("page %2d duplicate image bbox skipped" % (pno + 1))
            continue
        seen.add(key)
        imgs.append({"x0": key[0], "x1": key[1],
                     "y_top": key[2], "y_bot": key[3]})
    pages_out[pno]["tables"] = tabs
    pages_out[pno]["images"] = imgs

with open(OUT, "w", encoding="utf-8") as fh:
    json.dump({"page_h": PAGE_H, "pages": pages_out}, fh)
print("wrote", OUT)
