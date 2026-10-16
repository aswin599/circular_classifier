# Production Dockerfile for Circular Management System
FROM node:20-bookworm-slim

# Install system dependencies (Tesseract OCR, Python 3, and OpenCV runtime libraries)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install Python OCR dependencies for scanned PDFs
RUN pip3 install --no-cache-dir --break-system-packages \
    pymupdf \
    pytesseract \
    opencv-python-headless \
    numpy || true

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies across all npm workspaces
RUN npm install

# Copy source code
COPY . .

# Build client and server
RUN npm run build

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=5000
ENV OCR_PYTHON_EXE=python3

EXPOSE 5000

# Start Express server (serves API & prebuilt client)
CMD ["npm", "start"]
