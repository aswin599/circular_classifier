import os
from PIL import Image, ImageDraw, ImageFont

ROOT = r"C:\Users\User\OneDrive\Desktop\Circular_Classification"
SLOT_W, SLOT_H = 511.5, 288.0
W, H = 1723, 970
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)

FB = os.path.join(os.environ["WINDIR"], "Fonts", "timesbd.ttf")
FR = os.path.join(os.environ["WINDIR"], "Fonts", "times.ttf")
FI = os.path.join(os.environ["WINDIR"], "Fonts", "timesi.ttf")

f_title = ImageFont.truetype(FB, 60)
f_body = ImageFont.truetype(FR, 42)
f_name = ImageFont.truetype(FB, 42)
f_sub = ImageFont.truetype(FR, 36)

title = "DECLARATION"
tw = d.textlength(title, font=f_title)
d.text(((W - tw) / 2, 60), title, font=f_title, fill="black")

body = (
    "We hereby declare that the project report entitled \u201cCIRCULAR CLASSIFIER\u201d "
    "submitted to the Department of Computer Applications, Thiagarajar College of "
    "Engineering, Madurai, is a record of the original work carried out by our team. "
    "All sources of information and contributions of others that were referred to "
    "during this project have been duly acknowledged with proper references. This "
    "work has not been submitted earlier, either in part or in full, for the award "
    "of any other degree or diploma of this or any other institution."
)
margin = 110
maxw = W - 2 * margin
words = body.split()
lines, cur = [], ""
for w in words:
    t = (cur + " " + w).strip()
    if d.textlength(t, font=f_body) <= maxw:
        cur = t
    else:
        lines.append(cur)
        cur = w
if cur:
    lines.append(cur)
y = 210
for ln in lines:
    d.text((margin, y), ln, font=f_body, fill="black")
    y += 66

y += 60
d.text((margin, y), "Signature of the Candidates", font=f_sub, fill="black")
y += 70
d.text((margin, y), "THIRUNAVUKARASU S (2503917762221009)", font=f_name, fill="black")
y += 58
d.text((margin, y), "ASWIN C (2503917762221001)", font=f_name, fill="black")

img = img.resize((int(round(SLOT_H * SLOT_W / SLOT_H)), int(round(SLOT_H))), Image.LANCZOS)
img.save(os.path.join(ROOT, "_figs", "declaration.png"))
print("saved", img.size)
