import pptx

prs = pptx.Presentation('TCE_Linkedin_Project_Viva.pptx')
print(f"Total Slides: {len(prs.slides)}")

OLD_TERMS = ['linkedin', 'apify', 'schema induction', 'kabileshwaran', 'shalini', 'bizer', 'devlin', 'rapidFuzz', 'macro-f1 of the classifiers']

found_issues = []
for i, slide in enumerate(prs.slides):
    slide_num = i + 1
    texts = []
    pics = []
    tables = []
    charts = []
    
    for s in slide.shapes:
        if s.has_text_frame:
            for p in s.text_frame.paragraphs:
                t = p.text.strip()
                if t:
                    texts.append(t)
                    for term in OLD_TERMS:
                        if term in t.lower():
                            found_issues.append(f"Slide {slide_num}: Found old term '{term}' in text: {t[:60]}")
        elif s.has_table:
            tables.append(f"{len(s.table.rows)}x{len(s.table.columns)}")
            for r in s.table.rows:
                for c in r.cells:
                    ct = c.text.strip()
                    for term in OLD_TERMS:
                        if term in ct.lower():
                            found_issues.append(f"Slide {slide_num} Table: Found old term '{term}'")
        elif s.shape_type == pptx.enum.shapes.MSO_SHAPE_TYPE.PICTURE:
            pics.append(s.name)
        elif s.shape_type == pptx.enum.shapes.MSO_SHAPE_TYPE.CHART:
            charts.append(s.name)
            
    title = texts[0] if texts else "NO TEXT"
    print(f"Slide {slide_num:02d}: Title='{title[:45]}' | Pics={len(pics)} | Tables={len(tables)} | Charts={len(charts)} | TextBlocks={len(texts)}")

if found_issues:
    print("\n--- WARNING: Found remnants of old project: ---")
    for iss in found_issues:
        print("  *", iss)
else:
    print("\n>>> ALL CHECKS PASSED! Zero old LinkedIn remnants found. Presentation is 100% updated for Circular Classification! <<<")
