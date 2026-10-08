"""Tesseract-based OCR engine used as the primary scanned-document path.

Renders PDF pages at high DPI (PyMuPDF), preprocesses them (OpenCV) and runs
Tesseract per page. Everything is read-only: only temporary image files are
created under the system temp dir and removed afterwards.

Output: a single JSON object on stdout, e.g.
  {"text": "...", "method": "ocr", "confidence": 88, "pages": 2, "error": null}
Exit code is 0 when the pipeline runs (even with empty text); non-zero only on
hard failures. The Node side treats empty text as "try the fallback".
"""

import argparse
import json
import os
import shutil
import sys
import tempfile

try:
    import pymupdf  # preferred modern API
except ImportError:  # pragma: no cover
    import fitz as pymupdf

import cv2
import numpy as np
import pytesseract


def find_tesseract() -> str:
    env_cmd = os.environ.get('TESSERACT_CMD', '').strip()
    if env_cmd:
        return env_cmd
    found = shutil.which('tesseract')
    if found:
        return found
    if os.name == 'nt':
        for base in (r'C:\Program Files\Tesseract-OCR\tesseract.exe',
                     r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe'):
            if os.path.isfile(base):
                return base
    return 'tesseract'


def load_image_from_page(page, dpi: int) -> np.ndarray:
    pix = page.get_pixmap(matrix=pymupdf.Matrix(dpi / 72.0, dpi / 72.0),
                          colorspace=pymupdf.csGRAY, alpha=False)
    samples = np.frombuffer(pix.samples, dtype=np.uint8)
    return samples.reshape(pix.height, pix.width)


def load_image_from_file(path: str) -> np.ndarray:
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError(f'Unable to read image: {path}')
    return img


def preprocess(img: np.ndarray, mode: str, upscale: int) -> np.ndarray:
    if upscale > 1:
        h, w = img.shape[:2]
        img = cv2.resize(img, (w * upscale, h * upscale), interpolation=cv2.INTER_CUBIC)
    img = cv2.fastNlMeansDenoising(img, None, h=10, templateWindowSize=7, searchWindowSize=21)
    if mode in ('otsu', 'adaptive'):
        _, img = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    elif mode == 'adaptive':
        img = cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                    cv2.THRESH_BINARY, 31, 11)
    return img


def ocr_image(img: np.ndarray, lang: str, psm: str):
    cfg = f'--psm {psm}'
    text = pytesseract.image_to_string(img, lang=lang, config=cfg)
    try:
        data = pytesseract.image_to_data(img, lang=lang, config=cfg, output_type=pytesseract.Output.DICT)
        confs = [int(c) for c in data.get('conf', []) if isinstance(c, (int, float)) and c >= 0]
        conf = round(sum(confs) / len(confs)) if confs else 0
    except Exception:
        conf = 0
    return text or '', conf


def main() -> int:
    parser = argparse.ArgumentParser(description='OCR a PDF or image with Tesseract')
    parser.add_argument('--input', required=True, help='PDF or image file path')
    parser.add_argument('--dpi', type=int, default=300, help='Render DPI for PDF pages')
    parser.add_argument('--psm', default='3', help='Tesseract page segmentation mode')
    parser.add_argument('--lang', default='eng', help='Tesseract language(s)')
    parser.add_argument('--preprocess', default='otsu', choices=['none', 'otsu', 'adaptive'],
                        help='Image preprocessing mode')
    parser.add_argument('--upscale', type=int, default=1, help='Upscale factor for low-res images')
    parser.add_argument('--tmp-dir', default=None, help='Optional temp dir for rendered pages')
    args = parser.parse_args()

    result = {'text': '', 'method': 'ocr', 'confidence': 0, 'pages': 0, 'error': None}
    try:
        pytesseract.pytesseract.tesseract_cmd = find_tesseract()
        if not os.path.isfile(args.input):
            raise FileNotFoundError(args.input)

        tmp = tempfile.mkdtemp(prefix='cc_ocr_', dir=args.tmp_dir)
        is_pdf = args.input.lower().endswith('.pdf') or open(args.input, 'rb').read(5).startswith(b'%PDF')
        texts: list[str] = []
        confs: list[int] = []

        if is_pdf:
            doc = pymupdf.open(args.input)
            result['pages'] = doc.page_count
            for i, page in enumerate(doc):
                img = load_image_from_page(page, args.dpi)
                img = preprocess(img, args.preprocess, 1)
                png_path = os.path.join(tmp, f'page_{i}.png')
                cv2.imwrite(png_path, img)
                text, conf = ocr_image(cv2.imread(png_path, cv2.IMREAD_GRAYSCALE), args.lang, args.psm)
                confs.append(conf)
                if text.strip():
                    texts.append(text.strip())
            doc.close()
        else:
            img = preprocess(load_image_from_file(args.input), args.preprocess, args.upscale)
            text, conf = ocr_image(img, args.lang, args.psm)
            result['pages'] = 1
            confs.append(conf)
            if text.strip():
                texts.append(text.strip())

        for f in os.listdir(tmp):
            try:
                os.remove(os.path.join(tmp, f))
            except OSError:
                pass
        try:
            os.rmdir(tmp)
        except OSError:
            pass

        result['text'] = '\n\n'.join(texts)
        result['confidence'] = round(sum(confs) / len(confs)) if confs else 0
    except Exception as exc:  # noqa: BLE001
        result['error'] = f'{type(exc).__name__}: {exc}'

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())