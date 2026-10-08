import pypdfium2 as pdfium
pdf = pdfium.PdfDocument("_verify.pdf")
for pn in (11, 12):
    img = pdf[pn].render(scale=2).to_pil()
    out = "_p12_check_%d.png" % (pn + 1)
    img.save(out)
    print(out, img.size)
