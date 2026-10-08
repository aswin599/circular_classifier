from pdfminer.high_level import extract_pages
from pdfminer.layout import LAParams, LTTextLine, LTChar, LTTextContainer, LTFigure

def lines(page):
    out = []
    def walk(el):
        if isinstance(el, LTTextLine):
            t = "".join(c.get_text() for c in el if isinstance(c, LTChar))
            if " ".join(t.split()):
                out.append(" ".join(t.split()))
        elif isinstance(el, (LTTextContainer, LTFigure)):
            for c in el:
                walk(c)
    for el in page:
        walk(el)
    return out

pages = list(extract_pages("_verify.pdf", laparams=LAParams()))
print("=== EXPORT PAGE 13 (first 12 text lines) ===")
for t in lines(pages[12])[:12]:
    print(repr(t))
print()
print("=== EXPORT PAGE 12 (table rows) ===")
for t in lines(pages[11]):
    print(repr(t[:75]))
