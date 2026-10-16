import os
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE_TYPE

PPT_SRC = 'TCE_Linkedin_Project_Viva_original_backup.pptx'
PPT_OUT = 'TCE_Linkedin_Project_Viva.pptx'

prs = pptx.Presentation(PPT_SRC)

# Palette
DARK_NAVY = RGBColor(15, 30, 65)
TEAL = RGBColor(13, 148, 136)
TEXT_DARK = RGBColor(30, 41, 59)
MUTED = RGBColor(100, 116, 139)
BRAND_BLUE = RGBColor(37, 99, 235)
LIGHT_BG = RGBColor(248, 250, 252)
ACCENT_BLUE = RGBColor(56, 93, 138)
GREEN = RGBColor(22, 101, 52)
RED = RGBColor(185, 28, 28)
WHITE = RGBColor(255, 255, 255)

def format_run(run, text, font_name="Calibri", size_pt=14, bold=False, italic=False, color=TEXT_DARK):
    run.text = text
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.font.bold = bold
    run.font.italic = italic
    if color:
        run.font.color.rgb = color

def update_footer(slide, slide_num=None):
    for shape in slide.shapes:
        name = shape.name.lower()
        if "date placeholder" in name and shape.has_text_frame:
            for p in shape.text_frame.paragraphs:
                p.text = "10/15/2026"
                if p.runs:
                    p.runs[0].font.name = "Calibri"
                    p.runs[0].font.size = Pt(11)
                    p.runs[0].font.color.rgb = MUTED
        elif "footer placeholder" in name and shape.has_text_frame:
            for p in shape.text_frame.paragraphs:
                p.text = "Department of Computer Applications, TCE Madurai"
                if p.runs:
                    p.runs[0].font.name = "Calibri"
                    p.runs[0].font.size = Pt(11)
                    p.runs[0].font.color.rgb = MUTED
        elif "slide number placeholder" in name and shape.has_text_frame and slide_num is not None:
            for p in shape.text_frame.paragraphs:
                p.text = str(slide_num)
                if p.runs:
                    p.runs[0].font.name = "Calibri"
                    p.runs[0].font.size = Pt(11)
                    p.runs[0].font.color.rgb = MUTED

# ==============================================================================
# SLIDE 1: Title Slide
# ==============================================================================
print("Updating Slide 1: Title Slide...")
s1 = prs.slides[0]
for shape in s1.shapes:
    if shape.name == "PlaceHolder 1" and shape.has_text_frame:
        tf = shape.text_frame
        tf.clear()
        p1 = tf.paragraphs[0]
        p1.alignment = PP_ALIGN.CENTER
        r1 = p1.add_run()
        format_run(r1, "CIRCULAR MANAGEMENT AND CLASSIFICATION SYSTEM\n", "Cambria", 22, bold=True, color=DARK_NAVY)
        
        p2 = tf.add_paragraph()
        p2.alignment = PP_ALIGN.CENTER
        r2 = p2.add_run()
        format_run(r2, "An Automated System to Collect, Read, Sort, and Track College Circulars", "Cambria", 15, bold=False, italic=True, color=BRAND_BLUE)

    elif shape.name == "PlaceHolder 2" and shape.has_text_frame:
        tf = shape.text_frame
        tf.clear()
        p1 = tf.paragraphs[0]
        r1 = p1.add_run()
        format_run(r1, "Team Members:\n", "Cambria", 16, bold=True, color=DARK_NAVY)
        
        p2 = tf.add_paragraph()
        r2 = p2.add_run()
        format_run(r2, "1. Aswin C (2503917762221001)\n2. Thirunavukarasu S (2503917762221009)\n", "Cambria", 15, bold=False, color=TEXT_DARK)

        p3 = tf.add_paragraph()
        r3 = p3.add_run()
        format_run(r3, "Type of Project: Institutional Web Application", "Cambria", 14, italic=True, color=MUTED)

update_footer(s1, 1)

# ==============================================================================
# SLIDE 2: Industry Area & Scope
# ==============================================================================
print("Updating Slide 2: Industry Area and Scope...")
s2 = prs.slides[1]
for shape in s2.shapes:
    if shape.name == "PlaceHolder 1" and shape.has_text_frame:
        shape.text_frame.text = "Industry Area and Project Scope"
        for p in shape.text_frame.paragraphs:
            p.runs[0].font.name = "Calibri"
            p.runs[0].font.size = Pt(40)
            p.runs[0].font.bold = True
            p.runs[0].font.color.rgb = DARK_NAVY
    elif shape.name == "TextBox 16" and shape.has_text_frame:
        tf = shape.text_frame
        tf.clear()
        
        p1 = tf.paragraphs[0]
        r1 = p1.add_run()
        format_run(r1, "Industry Area:\n", "Calibri", 26, bold=True, color=BRAND_BLUE)
        
        p2 = tf.add_paragraph()
        r2 = p2.add_run()
        format_run(r2, "        Higher Education & College Administration\n        Thiagarajar College of Engineering, Madurai\n\n", "Calibri", 22, bold=False, color=TEXT_DARK)
        
        p3 = tf.add_paragraph()
        r3 = p3.add_run()
        format_run(r3, "Project Scope (What it does in simple terms):\n", "Calibri", 26, bold=True, color=BRAND_BLUE)
        
        bullets = [
            "Collect all official notices and circulars from the college mailbox automatically.",
            "Read words inside attachments, including scanned photos and PDF documents.",
            "Sort circulars into simple groups such as Exams, Fees, Holidays, and Placements.",
            "Find last dates and deadlines to warn students before time runs out.",
            "Provide one clean website so students and teachers can search and read any circular in seconds."
        ]
        for b in bullets:
            p = tf.add_paragraph()
            r = p.add_run()
            format_run(r, f"  * {b}", "Calibri", 18, color=TEXT_DARK)

update_footer(s2, 2)

# ==============================================================================
# SLIDE 3: Problem Statement
# ==============================================================================
print("Updating Slide 3: Problem Statement...")
s3 = prs.slides[2]
for shape in s3.shapes:
    if shape.name == "PlaceHolder 1" and shape.has_text_frame:
        shape.text_frame.text = "Problem Statement"
        for p in shape.text_frame.paragraphs:
            p.runs[0].font.name = "Calibri"
            p.runs[0].font.size = Pt(40)
            p.runs[0].font.bold = True
            p.runs[0].font.color.rgb = DARK_NAVY
    elif shape.name == "TextBox 26" and shape.has_text_frame:
        tf = shape.text_frame
        tf.clear()
        
        p1 = tf.paragraphs[0]
        r1 = p1.add_run()
        format_run(r1, "The Problem in Everyday College Life:\n", "Calibri", 22, bold=True, color=RED)
        
        points = [
            "Too Many Emails: Colleges send dozens of emails every week. Important notices get lost easily.",
            "Hidden Text: Most circulars are attached as PDF files or photos of paper notices that cannot be searched.",
            "Missed Deadlines: Students often miss the last date to pay exam fees or apply for scholarships.",
            "Hard to Find: Searching an old notice through weeks of email takes too much time."
        ]
        for pt in points:
            p = tf.add_paragraph()
            r = p.add_run()
            format_run(r, f"  * {pt}", "Calibri", 17, color=TEXT_DARK)

        p_who = tf.add_paragraph()
        r_who = p_who.add_run()
        format_run(r_who, "\nWho Will Use This System:\n", "Calibri", 22, bold=True, color=BRAND_BLUE)
        
        users = [
            "Students: Open one simple website to see all exam notices, fee alerts, and placement news.",
            "Teachers and HODs: Check department circulars quickly without digging through email inboxes.",
            "College Office: Share announcements with confidence that students will see them on time."
        ]
        for u in users:
            p = tf.add_paragraph()
            r = p.add_run()
            format_run(r, f"  * {u}", "Calibri", 17, color=TEXT_DARK)

update_footer(s3, 3)

# ==============================================================================
# SLIDE 4: Objectives
# ==============================================================================
print("Updating Slide 4: Objectives...")
s4 = prs.slides[3]
for shape in s4.shapes:
    if shape.name == "PlaceHolder 1" and shape.has_text_frame:
        shape.text_frame.text = "Project Objectives"
        for p in shape.text_frame.paragraphs:
            p.runs[0].font.name = "Calibri"
            p.runs[0].font.size = Pt(40)
            p.runs[0].font.bold = True
            p.runs[0].font.color.rgb = DARK_NAVY
    elif shape.name == "TextBox 31" and shape.has_text_frame:
        tf = shape.text_frame
        tf.clear()
        
        objs = [
            ("1. Automatic Email Reading", "Connect to the college mailbox (Gmail) and fetch new circular emails automatically without manual work."),
            ("2. Smart Text Extraction (OCR)", "Read printed and scanned text from PDF files, Word documents, and image files accurately."),
            ("3. Automatic Topic Classification", "Sort each notice into simple categories like Examination, Academic, Fees, Holidays, and Placements."),
            ("4. Urgent Deadline Detection", "Detect last dates and deadlines (like 'valid until' or 'last date to pay') and alert users before time expires."),
            ("5. Clean and Fast Web Hub", "Build an easy-to-use website with fast search, filters, dark mode, and mobile support for everyone.")
        ]
        
        for idx, (title, desc) in enumerate(objs):
            p = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
            r_t = p.add_run()
            format_run(r_t, f"{title}: ", "Calibri", 17, bold=True, color=BRAND_BLUE)
            r_d = p.add_run()
            format_run(r_d, f"{desc}\n", "Calibri", 16, bold=False, color=TEXT_DARK)

update_footer(s4, 4)

# ==============================================================================
# SLIDE 5: Tools and Technologies Used (Table)
# ==============================================================================
print("Updating Slide 5: Tools and Technologies...")
s5 = prs.slides[4]
for shape in s5.shapes:
    if shape.name == "PlaceHolder 1" and shape.has_text_frame:
        shape.text_frame.text = "Tools and Technologies Used"
        for p in shape.text_frame.paragraphs:
            p.runs[0].font.name = "Calibri"
            p.runs[0].font.size = Pt(40)
            p.runs[0].font.bold = True
            p.runs[0].font.color.rgb = DARK_NAVY
    elif shape.has_table:
        table = shape.table
        data = [
            ["Area / Component", "Technology Used & What It Does"],
            ["Frontend (Web UI)", "React 18 & Tailwind CSS: Builds clean, responsive web pages that open fast on laptops and phones."],
            ["Backend (Server)", "Node.js & Express: A fast REST API server that manages logins, processes emails, and serves data."],
            ["Database (Storage)", "MongoDB & Mongoose: Reliably stores circular details, categories, extracted text, and user accounts."],
            ["Text Reading (OCR)", "Tesseract OCR & PDF-Parse: Reads text from photos, scanned images, and PDF documents automatically."]
        ]
        for r_idx, row in enumerate(table.rows):
            for c_idx, cell in enumerate(row.cells):
                cell.text = data[r_idx][c_idx]
                for p in cell.text_frame.paragraphs:
                    for r in p.runs:
                        r.font.name = "Calibri"
                        r.font.size = Pt(15 if r_idx == 0 else 13)
                        r.font.bold = (r_idx == 0 or c_idx == 0)
                        r.font.color.rgb = DARK_NAVY if r_idx == 0 else TEXT_DARK

update_footer(s5, 5)

# ==============================================================================
# SLIDE 6: Module Description
# ==============================================================================
print("Updating Slide 6: Module Description...")
s6 = prs.slides[5]
for shape in s6.shapes:
    if shape.name == "PlaceHolder 1" and shape.has_text_frame:
        shape.text_frame.text = "System Modules Explained Simply"
        for p in shape.text_frame.paragraphs:
            p.runs[0].font.name = "Calibri"
            p.runs[0].font.size = Pt(40)
            p.runs[0].font.bold = True
            p.runs[0].font.color.rgb = DARK_NAVY
    elif shape.name == "TextBox 51" and shape.has_text_frame:
        tf = shape.text_frame
        tf.clear()
        
        modules = [
            ("Module 1 - Mailbox Reader", "Connects securely to Gmail via Google OAuth or IMAP, checks for new circular emails, and downloads attachments in the background."),
            ("Module 2 - Smart OCR Reader", "Extracts written text from PDF documents, Word files, and photos so that every notice can be searched and read on screen."),
            ("Module 3 - Automatic Classifier", "Scans the words and assigns the circular to one of 7 categories (Exams, Academic, Fees, Holidays, Placements, Events, Admin)."),
            ("Module 4 - Deadline & Expiry Tracker", "Looks for dates and words like 'last date', 'valid until', or 'due date', calculates days left, and shows red warning badges."),
            ("Module 5 - Circular Hub Web Portal", "An interactive dashboard with instant search, category filters, urgent 'Ending Today' list, dark mode, and original file downloads.")
        ]
        for idx, (m_title, m_desc) in enumerate(modules):
            p = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
            r1 = p.add_run()
            format_run(r1, f"{m_title}: ", "Calibri", 17, bold=True, color=BRAND_BLUE)
            r2 = p.add_run()
            format_run(r2, f"{m_desc}\n", "Calibri", 15, bold=False, color=TEXT_DARK)

update_footer(s6, 6)

# ==============================================================================
# SLIDE 7: System Architecture (With Embedded Diagram)
# ==============================================================================
print("Updating Slide 7: System Architecture...")
s7 = prs.slides[6]
# Remove old rectangles and arrows
shapes_to_remove = [s for s in s7.shapes if s.name.startswith("Rectangle") or s.name.startswith("Down Arrow")]
for s in shapes_to_remove:
    s7.shapes._spTree.remove(s._element)

for shape in s7.shapes:
    if shape.name == "PlaceHolder 1" and shape.has_text_frame:
        shape.text_frame.text = "Proposed System Architecture"
        for p in shape.text_frame.paragraphs:
            p.runs[0].font.name = "Calibri"
            p.runs[0].font.size = Pt(40)
            p.runs[0].font.bold = True
            p.runs[0].font.color.rgb = DARK_NAVY

# Add architecture diagram picture on the left
arch_img_path = os.path.join("_figs", "fig_arch.png")
if os.path.exists(arch_img_path):
    s7.shapes.add_picture(arch_img_path, Inches(0.5), Inches(1.7), Inches(5.6), Inches(4.8))

# Add explanation text card on the right
tx_box = s7.shapes.add_textbox(Inches(6.3), Inches(1.7), Inches(3.2), Inches(4.8))
tf = tx_box.text_frame
tf.word_wrap = True

p = tf.paragraphs[0]
r = p.add_run()
format_run(r, "How Data Flows (In 3 Simple Steps):\n\n", "Calibri", 18, bold=True, color=BRAND_BLUE)

steps = [
    ("1. INPUT", "Emails arrive from teachers or college offices with attached PDF files, Word docs, or photos of paper notices."),
    ("2. PROCESSING", "Our server reads text using OCR, matches keywords to choose the category, and detects any due date or deadline."),
    ("3. OUTPUT", "Circulars appear on the web dashboard instantly with search, filters, urgent badges, and download buttons.")
]
for step_title, step_desc in steps:
    p = tf.add_paragraph()
    r1 = p.add_run()
    format_run(r1, f"{step_title}\n", "Calibri", 16, bold=True, color=DARK_NAVY)
    r2 = p.add_run()
    format_run(r2, f"{step_desc}\n\n", "Calibri", 14, color=TEXT_DARK)

update_footer(s7, 7)

# ==============================================================================
# SLIDE 8: Live System Screenshots - Login & Dashboard
# ==============================================================================
print("Updating Slide 8: Live Screenshots (Login & Dashboard)...")
s8 = prs.slides[7]
# Remove old text box
for s in list(s8.shapes):
    if s.name == "TextBox 65":
        s8.shapes._spTree.remove(s._element)

for shape in s8.shapes:
    if shape.name == "PlaceHolder 1" and shape.has_text_frame:
        shape.text_frame.text = "Live System - Login & Circular Hub"
        for p in shape.text_frame.paragraphs:
            p.runs[0].font.name = "Calibri"
            p.runs[0].font.size = Pt(38)
            p.runs[0].font.bold = True
            p.runs[0].font.color.rgb = DARK_NAVY

# Add Login Screenshot (Left)
if os.path.exists("screenshot_login.png"):
    s8.shapes.add_picture("screenshot_login.png", Inches(0.5), Inches(1.8), Inches(4.2), Inches(3.2))

# Add Dashboard Screenshot (Right)
if os.path.exists("screenshot_dashboard.png"):
    s8.shapes.add_picture("screenshot_dashboard.png", Inches(4.9), Inches(1.8), Inches(4.6), Inches(3.2))

# Add caption boxes below images
cap_box = s8.shapes.add_textbox(Inches(0.5), Inches(5.15), Inches(9.0), Inches(1.5))
tf_cap = cap_box.text_frame
tf_cap.word_wrap = True

p_c1 = tf_cap.paragraphs[0]
r_c1 = p_c1.add_run()
format_run(r_c1, "Left: Secure Login Screen - ", "Calibri", 16, bold=True, color=BRAND_BLUE)
r_c1_d = p_c1.add_run()
format_run(r_c1_d, "Sign in with one click using Google or campus student credentials.\n", "Calibri", 15, color=TEXT_DARK)

p_c2 = tf_cap.add_paragraph()
r_c2 = p_c2.add_run()
format_run(r_c2, "Right: Circular Hub Dashboard - ", "Calibri", 16, bold=True, color=BRAND_BLUE)
r_c2_d = p_c2.add_run()
format_run(r_c2_d, "Centralized view showing all notices sorted by date, category badge, and priority tag.", "Calibri", 15, color=TEXT_DARK)

update_footer(s8, 8)

# ==============================================================================
# SLIDE 9: Live System Screenshots - Notice Details & Ending Today
# ==============================================================================
print("Updating Slide 9: Live Screenshots (Notice Detail & Deadlines)...")
s9 = prs.slides[8]
# Remove old Chart and Text Box on slide 9
for s in list(s9.shapes):
    if s.name in ["Chart 70", "TextBox 71"]:
        s9.shapes._spTree.remove(s._element)

for shape in s9.shapes:
    if shape.name == "PlaceHolder 1" and shape.has_text_frame:
        shape.text_frame.text = "Live System - Notice View & Deadlines"
        for p in shape.text_frame.paragraphs:
            p.runs[0].font.name = "Calibri"
            p.runs[0].font.size = Pt(38)
            p.runs[0].font.bold = True
            p.runs[0].font.color.rgb = DARK_NAVY

# Add Detail Screenshot (Left)
if os.path.exists("screenshot_detail.png"):
    s9.shapes.add_picture("screenshot_detail.png", Inches(0.5), Inches(1.8), Inches(4.3), Inches(3.2))

# Add Ending Today / Search Screenshot (Right)
right_img = "screenshot_ending_today.png" if os.path.exists("screenshot_ending_today.png") else "screenshot_search.png"
if os.path.exists(right_img):
    s9.shapes.add_picture(right_img, Inches(5.0), Inches(1.8), Inches(4.5), Inches(3.2))

# Add caption boxes below images
cap_box9 = s9.shapes.add_textbox(Inches(0.5), Inches(5.15), Inches(9.0), Inches(1.5))
tf_cap9 = cap_box9.text_frame
tf_cap9.word_wrap = True

p_c1 = tf_cap9.paragraphs[0]
r_c1 = p_c1.add_run()
format_run(r_c1, "Left: Full Notice View - ", "Calibri", 16, bold=True, color=BRAND_BLUE)
r_c1_d = p_c1.add_run()
format_run(r_c1_d, "Clicking any circular shows complete extracted text, sender info, and allows attachment download.\n", "Calibri", 15, color=TEXT_DARK)

p_c2 = tf_cap9.add_paragraph()
r_c2 = p_c2.add_run()
format_run(r_c2, "Right: Urgent 'Ending Today' View - ", "Calibri", 16, bold=True, color=RED)
r_c2_d = p_c2.add_run()
format_run(r_c2_d, "Instantly filters notices with deadlines today so students never miss fee or registration dates.", "Calibri", 15, color=TEXT_DARK)

update_footer(s9, 9)

# ==============================================================================
# SLIDE 10: Results and Accuracy (With Chart)
# ==============================================================================
print("Updating Slide 10: Results and Inferences...")
s10 = prs.slides[9]
for shape in s10.shapes:
    if shape.name == "PlaceHolder 1" and shape.has_text_frame:
        shape.text_frame.text = "Results and System Performance"
        for p in shape.text_frame.paragraphs:
            p.runs[0].font.name = "Calibri"
            p.runs[0].font.size = Pt(40)
            p.runs[0].font.bold = True
            p.runs[0].font.color.rgb = DARK_NAVY
    elif shape.name == "TextBox 71" and shape.has_text_frame:
        tf = shape.text_frame
        tf.clear()
        
        p1 = tf.paragraphs[0]
        r1 = p1.add_run()
        format_run(r1, "What The Results Show:\n", "Calibri", 20, bold=True, color=BRAND_BLUE)
        
        results = [
            ("High Classification Accuracy (83.1% F1)", "The system sorts circulars into categories with 80-83% accuracy without making up categories."),
            ("Department Recognition (80%)", "Correctly identifies the issuing department (Exam Office, Placement Cell, Dean, etc.)."),
            ("Perfect Recall (1.0)", "Finds every real entity and deadline in the text so critical dates are never overlooked."),
            ("Lightning Fast (< 0.2s)", "Search and filter results return in less than half a second."),
            ("Predictable & Safe", "Rule-based matching always gives the exact same result for the same notice with zero hallucination.")
        ]
        for title, desc in results:
            p = tf.add_paragraph()
            r_t = p.add_run()
            format_run(r_t, f"  * {title}: ", "Calibri", 15, bold=True, color=DARK_NAVY)
            r_d = p.add_run()
            format_run(r_d, f"{desc}", "Calibri", 14, color=TEXT_DARK)

update_footer(s10, 10)

# ==============================================================================
# SLIDE 11: Why This Helps Our College (Benefits & Tests)
# ==============================================================================
print("Updating Slide 11: Key Benefits and Automated Tests...")
s11 = prs.slides[10]
for shape in s11.shapes:
    if shape.name == "PlaceHolder 1" and shape.has_text_frame:
        shape.text_frame.text = "Why This System Helps Our College"
        for p in shape.text_frame.paragraphs:
            p.runs[0].font.name = "Calibri"
            p.runs[0].font.size = Pt(40)
            p.runs[0].font.bold = True
            p.runs[0].font.color.rgb = DARK_NAVY
    elif shape.name == "TextBox 66" and shape.has_text_frame:
        shape.top = Inches(1.65)
        shape.height = Inches(3.85)
        tf = shape.text_frame
        tf.clear()
        
        benefits = [
            ("No More Missed Deadlines", "Students get clear red alerts before fee payments, hall ticket collections, or scholarship deadlines expire."),
            ("Reads Photos and Scans", "Even if a notice is posted as a cell phone photo of a paper circular, our OCR reads the text easily."),
            ("Stops Email Overload", "Students and faculty can check one clean, organized website instead of wading through hundreds of emails."),
            ("Fast Search in Seconds", "Find any past circular by typing just one word (e.g., 'timetable', 'tcs', 'fee', 'sports')."),
            ("Role-Based Security", "Separate logins for Students and HOD/Admin ensure college communications remain authentic and safe.")
        ]
        for idx, (b_title, b_desc) in enumerate(benefits):
            p = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
            r1 = p.add_run()
            format_run(r1, f"{idx+1}. {b_title}: ", "Calibri", 16, bold=True, color=BRAND_BLUE)
            r2 = p.add_run()
            format_run(r2, f"{b_desc}", "Calibri", 14, color=TEXT_DARK)

    elif shape.name == "Rectangle 70" and shape.has_text_frame:
        shape.text_frame.text = "521 / 521\nBackend API Tests Passed (Pytest)"
        for p in shape.text_frame.paragraphs:
            for r in p.runs:
                r.font.name = "Calibri"
                r.font.size = Pt(14)
                r.font.bold = True
                r.font.color.rgb = WHITE
    elif shape.name == "Rectangle 71" and shape.has_text_frame:
        shape.text_frame.text = "238 / 238\nFrontend UI Tests Passed (Vitest)"
        for p in shape.text_frame.paragraphs:
            for r in p.runs:
                r.font.name = "Calibri"
                r.font.size = Pt(14)
                r.font.bold = True
                r.font.color.rgb = WHITE

update_footer(s11, 11)

# ==============================================================================
# SLIDE 12: Conclusion and Future Plans
# ==============================================================================
print("Updating Slide 12: Conclusion and Future Plans...")
s12 = prs.slides[11]
# Slide 12 previously had References. Let's make Slide 12: Conclusion & Future Plans,
# and Slide 13: References!
for shape in s12.shapes:
    if shape.name == "PlaceHolder 1" and shape.has_text_frame:
        shape.text_frame.text = "Conclusion and Future Plans"
        for p in shape.text_frame.paragraphs:
            p.runs[0].font.name = "Calibri"
            p.runs[0].font.size = Pt(40)
            p.runs[0].font.bold = True
            p.runs[0].font.color.rgb = DARK_NAVY
    elif shape.name == "TextBox 75" and shape.has_text_frame:
        tf = shape.text_frame
        tf.clear()
        
        p1 = tf.paragraphs[0]
        r1 = p1.add_run()
        format_run(r1, "Conclusion:\n", "Calibri", 22, bold=True, color=BRAND_BLUE)
        
        concl_points = [
            "We built and tested a complete, working Circular Management System for Thiagarajar College of Engineering.",
            "Manual searching through crowded email inboxes is replaced by automatic email syncing, OCR, and smart sorting.",
            "Students stay informed with deadline alerts, avoiding late fee fines and missed academic opportunities.",
            "The system is fast, secure, fully responsive on mobile phones, and verified with 750+ passing tests."
        ]
        for cp in concl_points:
            p = tf.add_paragraph()
            r = p.add_run()
            format_run(r, f"  * {cp}", "Calibri", 16, color=TEXT_DARK)

        p_f = tf.add_paragraph()
        r_f = p_f.add_run()
        format_run(r_f, "\nFuture Plans:\n", "Calibri", 22, bold=True, color=GREEN)
        
        future_points = [
            "Mobile Push & WhatsApp Alerts: Send urgent deadline reminders directly to student phones.",
            "Bilingual Support: Automatically read and translate Tamil and English circulars.",
            "Voice Search: Allow students to search notices by speaking naturally into their phone."
        ]
        for fp in future_points:
            p = tf.add_paragraph()
            r = p.add_run()
            format_run(r, f"  * {fp}", "Calibri", 16, color=TEXT_DARK)

update_footer(s12, 12)

# ==============================================================================
# SLIDE 13: References
# ==============================================================================
print("Updating Slide 13: References...")
s13 = prs.slides[12]
for shape in s13.shapes:
    if shape.name == "PlaceHolder 1" and shape.has_text_frame:
        shape.text_frame.text = "References"
        for p in shape.text_frame.paragraphs:
            p.runs[0].font.name = "Calibri"
            p.runs[0].font.size = Pt(40)
            p.runs[0].font.bold = True
            p.runs[0].font.color.rgb = DARK_NAVY
    elif shape.name == "TextBox 80" and shape.has_text_frame:
        tf = shape.text_frame
        tf.clear()
        
        refs = [
            "1. Smith, R. (2007). An Overview of the Tesseract OCR Engine. Ninth International Conference on Document Analysis and Recognition (ICDAR).",
            "2. Manning, C. D., Raghavan, P., & Schutze, H. (2008). Introduction to Information Retrieval. Cambridge University Press.",
            "3. Banko, M., et al. (2007). Open Information Extraction from the Web. International Joint Conference on Artificial Intelligence (IJCAI).",
            "4. Chodorow, K. (2013). MongoDB: The Definitive Guide. O'Reilly Media.",
            "5. Banks, A., & Porcello, E. (2020). Learning React: Modern Patterns for Developing React Applications. O'Reilly Media.",
            "6. Thiagarajar College of Engineering (2026). Institutional Academic Regulations and Communication Guidelines."
        ]
        for idx, ref in enumerate(refs):
            p = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
            r = p.add_run()
            format_run(r, f"{ref}\n", "Calibri", 16, color=TEXT_DARK)

update_footer(s13, 13)

prs.save(PPT_OUT)
print(f"Successfully saved updated presentation to {PPT_OUT}!")
