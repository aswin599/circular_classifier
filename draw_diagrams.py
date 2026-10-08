# Draw the 7 report figures (architecture, DFDs, UML diagrams) as PNGs.
import math
import os

from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_figs")
os.makedirs(OUT, exist_ok=True)

ARIAL = r"C:\Windows\Fonts\arial.ttf"
ARIALB = r"C:\Windows\Fonts\arialbd.ttf"

INK = "#1F2937"
LINE = "#475569"
BOX_FILL = "#F8FAFC"
BOX_FILL2 = "#EEF2FF"
PROC_FILL = "#FFFFFF"
STORE_FILL = "#FFF7ED"
ACTOR_FILL = "#FFFFFF"
FLOW = "#334155"


def F(sz, bold=False):
    return ImageFont.truetype(ARIALB if bold else ARIAL, sz)


def wrap(draw, text, font, max_w):
    lines, cur = [], ""
    for word in text.split():
        t = (cur + " " + word).strip()
        if draw.textbbox((0, 0), t, font=font)[2] <= max_w or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def ctext(d, cx, cy, text, font, fill=INK, max_w=None, gap=4, anchor="mm"):
    """Centered possibly-multiline text; returns bbox."""
    lines = text.split("\n") if max_w is None else wrap(d, text, font, max_w)
    heights = [d.textbbox((0, 0), ln or " ", font=font)[3] for ln in lines]
    total = sum(heights) + gap * (len(lines) - 1)
    y = cy - total / 2
    box = None
    for ln, h in zip(lines, heights):
        w = d.textbbox((0, 0), ln or " ", font=font)[2]
        if anchor == "mm":
            x = cx - w / 2
            d.text((x, y), ln, font=font, fill=fill)
            bb = (x, y, x + w, y + h)
        y += h + gap
        box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]),
                                      max(box[2], bb[2]), max(box[3], bb[3]))
    return box


def rbox(d, xy, label, font=None, fill=BOX_FILL, outline=LINE, w=3, radius=14,
         font_size=26, bold=True, max_w_ratio=0.9, cy_off=0):
    x0, y0, x1, y1 = xy
    d.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=w)
    if not label:
        return xy
    font = font or F(font_size, bold)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 + cy_off
    bb = ctext(d, cx, cy, label, font, max_w=(x1 - x0) * max_w_ratio, gap=3)
    assert bb[0] >= x0 - 1 and bb[2] <= x1 + 1 and bb[1] >= y0 - 1 and bb[3] <= y1 + 1, \
        "text overflow in box %r: %s vs %s" % (label, bb, xy)
    return xy


def arrow(d, p1, p2, color=FLOW, w=3, head=14, dashed=False):
    x1, y1 = p1
    x2, y2 = p2
    ang = math.atan2(y2 - y1, x2 - x1)
    sx = x2 - head * math.cos(ang)
    sy = y2 - head * math.sin(ang)
    if dashed:
        dist = math.hypot(x2 - x1, y2 - y1)
        dash, gapd, t = 16, 10, 0.0
        while t < dist - head:
            t2 = min(t + dash, dist - head)
            for tt in (t, t2):
                pass
            ax = x1 + (x2 - x1) * (t / dist)
            ay = y1 + (y2 - y1) * (t / dist)
            bx = x1 + (x2 - x1) * (t2 / dist)
            by = y1 + (y2 - y1) * (t2 / dist)
            d.line([ax, ay, bx, by], fill=color, width=w)
            t = t2 + gapd
    else:
        d.line([x1, y1, sx, sy], fill=color, width=w)
    d.polygon([(x2, y2),
               (x2 - head * math.cos(ang - 0.42), y2 - head * math.sin(ang - 0.42)),
               (x2 - head * math.cos(ang + 0.42), y2 - head * math.sin(ang + 0.42))],
              fill=color)


def flow_label(d, x, y, text, size=21):
    f = F(size)
    bb = d.textbbox((0, 0), text, font=f)
    w = bb[2] - bb[0]
    h = bb[3] - bb[1]
    d.rectangle((x - w / 2 - 5, y - h / 2 - 3, x + w / 2 + 5, y + h / 2 + 3),
                fill="#FFFFFF")
    d.text((x - w / 2, y - h / 2 - bb[1]), text, font=f, fill="#334155")


def arrowhead_at(d, x, y, ang, color=FLOW, head=14):
    d.polygon([(x, y),
               (x - head * math.cos(ang - 0.42), y - head * math.sin(ang - 0.42)),
               (x - head * math.cos(ang + 0.42), y - head * math.sin(ang + 0.42))],
              fill=color)


def polyline_arrow(d, pts, color=FLOW, w=3, head=14):
    for a, b in zip(pts, pts[1:-1]):
        d.line([a, b], fill=color, width=w)
    d.line([pts[-2], pts[-1]], fill=color, width=w)
    (x1, y1), (x2, y2) = pts[-2], pts[-1]
    arrowhead_at(d, x2, y2, math.atan2(y2 - y1, x2 - x1), color, head)


# ------------------------------------------------------------------ 5.1 arch
def draw_arch():
    W, H = 1485, 1299
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    # client
    rbox(d, (50, 50, 1435, 340), "", fill=BOX_FILL2, w=4, radius=18)
    ctext(d, 742, 90, "React Client  (Vite + TypeScript + Tailwind CSS)", F(30, True))
    for i, t in enumerate(["Dashboard\n(Circular Hub)", "Search & Filter UI",
                           "Admin Console\n(Categories / Users)"]):
        rbox(d, (95 + i * 445, 140, 95 + i * 445 + 415, 310), t, fill=BOX_FILL)
    arrow(d, (742, 340), (742, 430))
    flow_label(d, 742, 385, "REST API \u00b7 JSON \u00b7 JWT", 24)
    # api
    rbox(d, (50, 430, 1435, 700), "", fill=BOX_FILL2, w=4, radius=18)
    ctext(d, 742, 470, "Node.js / Express API Server", F(30, True))
    for i, t in enumerate(["Auth &\nUser Module", "Circulars &\nSearch Module",
                           "Categories\nModule", "Processor Module\n(Bull Queue)"]):
        rbox(d, (95 + i * 333, 520, 95 + i * 333 + 308, 670), t, fill=BOX_FILL)
    for x in (450, 742, 1035):
        arrow(d, (x, 700), (x, 770))
    # services
    rbox(d, (50, 770, 1435, 950), "", fill=BOX_FILL2, w=4, radius=18)
    ctext(d, 742, 806, "Background Services (Queue Workers)", F(30, True))
    for i, t in enumerate(["Text Extraction\nPDF / DOCX / OCR", "Keyword\nClassifier",
                           "Expiry Date\nDetector", "Email Sync\n(IMAP / Gmail)"]):
        rbox(d, (95 + i * 333, 845, 95 + i * 333 + 308, 935), t, fill=BOX_FILL,
             font_size=24)
    for x in (450, 742, 1035, 1249):
        arrow(d, (x, 950), (x, 1015))
    for i, t in enumerate(["MongoDB\n(Circulars, Users,\nCategories, Logs)",
                           "Redis + Bull\n(Job Queues)",
                           "Attachment Store\n(PDF, Images)",
                           "External Mail Server\n(Gmail / IMAP)"]):
        rbox(d, (95 + i * 333, 1015, 95 + i * 333 + 308, 1175), t, fill=STORE_FILL,
             font_size=24, cy_off=4)
    img.save(os.path.join(OUT, "fig_arch.png"))


# ------------------------------------------------------------------ 5.2.1 dfd0
def draw_dfd0():
    W, H = 1458, 342
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    rbox(d, (40, 45, 330, 165), "Mail Server\n(Gmail / IMAP)", fill=BOX_FILL, font_size=25)
    rbox(d, (520, 40, 940, 175), "1.0\nCircular Management System",
         fill=PROC_FILL, outline=INK, w=4, font_size=27)
    rbox(d, (1128, 45, 1418, 165), "Student / Staff\nUser", fill=BOX_FILL, font_size=25)
    rbox(d, (520, 240, 940, 335), "Circular Database\n(Attachments, Users, Categories)",
         fill=STORE_FILL, font_size=25, cy_off=6)
    rbox(d, (40, 240, 330, 335), "Administrator", fill=BOX_FILL, font_size=25)
    arrow(d, (330, 105), (520, 105))
    flow_label(d, 425, 78, "circular emails")
    arrow(d, (940, 105), (1128, 105))
    flow_label(d, 1034, 78, "search / list")
    arrow(d, (730, 175), (730, 240))
    flow_label(d, 730, 207, "store / update")
    arrow(d, (330, 285), (520, 205))
    flow_label(d, 415, 230, "keywords, users")
    img.save(os.path.join(OUT, "fig_dfd0.png"))


# ------------------------------------------------------------------ 5.2.2 dfd1
def draw_dfd1():
    W, H = 1458, 834
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    rbox(d, (40, 40, 300, 150), "Administrator", fill=BOX_FILL, font_size=25)
    rbox(d, (40, 340, 300, 460), "Mail Server\n(Gmail / IMAP)", fill=BOX_FILL, font_size=25)
    rbox(d, (40, 650, 300, 760), "Student /\nStaff User", fill=BOX_FILL, font_size=25)
    rbox(d, (470, 60, 830, 180), "1.1\nFetch Circular Emails", fill=PROC_FILL,
         outline=INK, w=4, font_size=26)
    rbox(d, (470, 320, 830, 440), "1.2\nExtract Text (PDF / OCR)", fill=PROC_FILL,
         outline=INK, w=4, font_size=26)
    rbox(d, (470, 580, 830, 700), "1.3\nClassify & Store Circulars", fill=PROC_FILL,
         outline=INK, w=4, font_size=26)
    rbox(d, (980, 60, 1380, 180), "Raw Mail &\nAttachment Store", fill=STORE_FILL,
         font_size=25)
    rbox(d, (980, 320, 1380, 440), "Extracted Text Store", fill=STORE_FILL, font_size=25)
    rbox(d, (980, 580, 1380, 700), "Circular Database", fill=STORE_FILL, font_size=25)
    arrow(d, (300, 400), (470, 140))
    flow_label(d, 372, 268, "tagged emails")
    arrow(d, (830, 120), (980, 120))
    flow_label(d, 905, 95, "attachments")
    arrow(d, (650, 180), (650, 320))
    flow_label(d, 650, 250, "raw content")
    arrow(d, (830, 380), (980, 380))
    flow_label(d, 905, 355, "plain text")
    arrow(d, (650, 440), (650, 580))
    flow_label(d, 650, 510, "extracted text")
    arrow(d, (830, 640), (980, 640))
    flow_label(d, 905, 615, "circulars")
    polyline_arrow(d, [(300, 95), (400, 95), (400, 640), (470, 640)])
    flow_label(d, 400, 455, "category keywords")
    arrow(d, (470, 665), (300, 705))
    flow_label(d, 383, 672, "filtered circulars")
    img.save(os.path.join(OUT, "fig_dfd1.png"))


# ------------------------------------------------------------------ 5.2.3 dfd2
def draw_dfd2():
    W, H = 1416, 999
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    rbox(d, (40, 60, 300, 180), "Mail Server\n(Gmail / IMAP)", fill=BOX_FILL, font_size=25)
    rbox(d, (40, 430, 300, 550), "Administrator", fill=BOX_FILL, font_size=25)
    rbox(d, (480, 60, 840, 180), "1.2.1\nParse PDF / DOCX", fill=PROC_FILL,
         outline=INK, w=4, font_size=26)
    rbox(d, (480, 260, 840, 380), "1.2.2\nOCR Images (Tesseract)", fill=PROC_FILL,
         outline=INK, w=4, font_size=26)
    rbox(d, (480, 500, 840, 620), "1.3.1\nKeyword Category Match", fill=PROC_FILL,
         outline=INK, w=4, font_size=26)
    rbox(d, (480, 700, 840, 820), "1.3.2\nPriority & Expiry Detection", fill=PROC_FILL,
         outline=INK, w=4, font_size=26)
    rbox(d, (990, 160, 1370, 280), "Extracted Text Store", fill=STORE_FILL, font_size=25)
    rbox(d, (990, 540, 1370, 660), "Circular Database", fill=STORE_FILL, font_size=25)
    rbox(d, (990, 790, 1370, 910), "Student /\nStaff User", fill=BOX_FILL, font_size=25)
    arrow(d, (300, 120), (480, 120))
    flow_label(d, 390, 95, "attachments")
    arrow(d, (300, 160), (480, 320))
    flow_label(d, 370, 250, "image scans")
    arrow(d, (840, 120), (990, 220))
    flow_label(d, 930, 150, "text")
    arrow(d, (840, 330), (990, 250))
    flow_label(d, 938, 282, "OCR text")
    arrow(d, (990, 300), (840, 560))
    flow_label(d, 912, 425, "text")
    arrow(d, (300, 505), (480, 555))
    flow_label(d, 385, 512, "keywords")
    arrow(d, (660, 620), (660, 700))
    flow_label(d, 660, 660, "labelled data")
    arrow(d, (840, 560), (990, 600))
    flow_label(d, 912, 562, "record")
    arrow(d, (840, 780), (990, 640))
    flow_label(d, 912, 705, "priority")
    arrow(d, (840, 810), (990, 850))
    flow_label(d, 905, 845, "circulars")
    img.save(os.path.join(OUT, "fig_dfd2.png"))


# ------------------------------------------------------------------ 5.3.1 usecase
def actor(d, cx, top, label, scale=1.0):
    r = 22 * scale
    d.ellipse((cx - r, top, cx + r, top + 2 * r), fill=ACTOR_FILL, outline=INK, width=4)
    d.line([cx, top + 2 * r, cx, top + 2 * r + 60 * scale], fill=INK, width=4)
    d.line([cx - 34 * scale, top + 2 * r + 22 * scale,
            cx + 34 * scale, top + 2 * r + 22 * scale], fill=INK, width=4)
    d.line([cx, top + 2 * r + 60 * scale, cx - 28 * scale, top + 2 * r + 112 * scale],
           fill=INK, width=4)
    d.line([cx, top + 2 * r + 60 * scale, cx + 28 * scale, top + 2 * r + 112 * scale],
           fill=INK, width=4)
    f = F(26, True)
    w = d.textbbox((0, 0), label, font=f)[2]
    d.text((cx - w / 2, top + 2 * r + 126 * scale), label, font=f, fill=INK)


def draw_usecase():
    W, H = 549, 909
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((128, 26, 541, 883), radius=16, outline=INK, width=4,
                        fill="#F8FAFC")
    ctext(d, 334, 58, "Circular Management System", F(23, True), max_w=390)
    actor(d, 66, 210, "Student")
    actor(d, 66, 630, "Admin")
    ovals = ["Login", "Browse Circulars", "Search & Filter", "View Circular Detail",
             "Mark as Read", "Download Attachment", "Manage Categories",
             "Manage Users", "Sync Mailbox & Train"]
    y0, oh, gap = 96, 64, 22
    pos = []
    for i, t in enumerate(ovals):
        y = y0 + i * (oh + gap)
        d.rounded_rectangle((160, y, 520, y + oh), radius=oh // 2, fill="#FFFFFF",
                            outline=LINE, width=3)
        ctext(d, 340, y + oh // 2, t, F(24), max_w=330)
        pos.append(y + oh // 2)
    for i in range(6):
        d.line([96, 268, 160, pos[i]], fill=LINE, width=2)
    for i in (0, 6, 7, 8):
        d.line([96, 690, 160, pos[i]], fill=LINE, width=2)
    img.save(os.path.join(OUT, "fig_usecase.png"))


# ------------------------------------------------------------------ 5.4.1 component
def draw_component():
    W, H = 1301, 588
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    rbox(d, (40, 36, 560, 552), "", fill=BOX_FILL2, w=4, radius=16)
    ctext(d, 300, 74, "Client Package \u2014 React (TypeScript)", F(27, True))
    inner = ["Auth & Profile Components", "Dashboard & Circular Table",
             "Search & Filter Components", "Admin (Categories, Users)",
             "Attachment & Image Gallery"]
    for i, t in enumerate(inner):
        rbox(d, (80, 112 + i * 84, 520, 112 + i * 84 + 68), t, fill=BOX_FILL,
             font_size=24)
    rbox(d, (741, 36, 1261, 552), "", fill=BOX_FILL2, w=4, radius=16)
    ctext(d, 1001, 74, "Server Package \u2014 Express (Node.js)", F(27, True))
    inner2 = ["Auth Module (JWT / OAuth)", "Circulars Module", "Search Module",
              "Categories Module", "Processor Module (Queues)", "Admin Module"]
    for i, t in enumerate(inner2):
        rbox(d, (781, 104 + i * 72, 1221, 104 + i * 72 + 58), t, fill=BOX_FILL,
             font_size=23)
    arrow(d, (560, 300), (741, 300))
    flow_label(d, 650, 272, "REST API")
    img.save(os.path.join(OUT, "fig_component.png"))


# ------------------------------------------------------------------ 5.4.2 deployment
def draw_deployment():
    W, H = 1301, 1260
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    rbox(d, (250, 40, 1051, 170), "Web Browser\n(Student / Admin)", fill=BOX_FILL,
         w=4, font_size=28)
    arrow(d, (650, 170), (650, 270))
    flow_label(d, 650, 220, "HTTPS")
    rbox(d, (250, 270, 1051, 400), "Web Server\nStatic Client Build (Vite \u2192 Nginx / PaaS)",
         fill=BOX_FILL, w=4, font_size=27)
    arrow(d, (650, 400), (650, 500))
    flow_label(d, 650, 450, "/api proxy")
    rbox(d, (150, 500, 1151, 820), "", fill=BOX_FILL2, w=4, radius=16)
    ctext(d, 650, 545, "Node.js API Server (Express)", F(30, True))
    inner = ["Auth & Users", "Circulars & Search", "Categories & Admin",
             "Processor (Bull Workers)"]
    for i, t in enumerate(inner):
        rbox(d, (190 + i * 240, 600, 190 + i * 240 + 220, 740), t, fill=BOX_FILL,
             font_size=24)
    targets = [(200, "MongoDB\nDatabase", "Mongoose ODM"),
               (520, "Redis\nBull Job Queues", "enqueue jobs"),
               (840, "Tesseract OCR\nText Engine", "file I/O"),
               (1100, "Mail Server\n(Gmail / IMAP)", "IMAP / OAuth")]
    for x, label, flow in targets:
        arrow(d, (650 + (x - 650) * 0.35, 820), (x, 940))
        flow_label(d, (650 + (x - 650) * 0.35 + x) / 2 + 6, 878, flow, 20)
    for i, (x, label, _) in enumerate(targets):
        rbox(d, (x - 140, 940, x + 140, 1090), label, fill=STORE_FILL, font_size=25,
             cy_off=4)
    img.save(os.path.join(OUT, "fig_deployment.png"))


if __name__ == "__main__":
    draw_arch()
    draw_dfd0()
    draw_dfd1()
    draw_dfd2()
    draw_usecase()
    draw_component()
    draw_deployment()
    print("diagrams written to", OUT)
