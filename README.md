# Doc2Excel Pro

A production-minded starter application that uploads PDFs, bills, images, and Word documents, extracts structured data, lets users review it, and exports it to Excel. The design includes a clean upgrade path for AI-assisted organization later.

## What this version does

- Upload PDF, DOCX, PNG, JPG, JPEG
- Detect file type and extract text/tables
- Handle digital PDFs with PyMuPDF
- Handle DOCX paragraphs and tables with python-docx
- Handle images and scanned PDFs with OCR when Tesseract is installed
- Normalize extracted content into a standard JSON structure
- Export structured results to Excel using openpyxl
- Store extraction history in SQLite by default, easily switchable to PostgreSQL
- Provide a React frontend for upload, review, extraction, and export
- Includes an optional AI organization hook for later use

## Important production truth

This is a strong real-world starter, not a magical universal parser. Accuracy depends on:

- document quality
- scan clarity
- consistency of vendor layouts
- OCR availability
- presence of real tables vs visually arranged text

For production at company scale, you should keep the review screen and template/mapping layer. That is how real systems stay reliable.

---

## Project structure

```text
Doc2Excel-Pro/
├── README.md
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   ├── base.py
│   │   │   ├── document.py
│   │   │   └── extraction_template.py
│   │   ├── schemas/
│   │   │   ├── document.py
│   │   │   └── extraction.py
│   │   ├── services/
│   │   │   ├── ai_organizer.py
│   │   │   ├── excel_exporter.py
│   │   │   ├── extractor.py
│   │   │   ├── parser.py
│   │   │   └── storage.py
│   │   └── api/
│   │       └── routes.py
│   └── storage/
│       ├── uploads/
│       └── exports/
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── .env.example
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/client.js
        ├── components/
        │   ├── Navbar.jsx
        │   ├── StatusBadge.jsx
        │   └── TableView.jsx
        └── pages/
            ├── UploadPage.jsx
            ├── DocumentDetailPage.jsx
            └── HistoryPage.jsx
```

---

## Backend setup

### 1) Create virtual environment

```bash
cd backend
python -m venv .venv
```

### 2) Activate it

#### Windows PowerShell

```powershell
.\.venv\Scripts\Activate.ps1
```

#### Linux/macOS

```bash
source .venv/bin/activate
```

### 3) Install dependencies

```bash
pip install -r requirements.txt
```

### 4) Copy environment file

```bash
copy .env.example .env
```

On Linux/macOS:

```bash
cp .env.example .env
```

### 5) Start backend

```bash
uvicorn app.main:app --reload --port 8000
```

Backend will run at:

```text
http://localhost:8000
```

---

## Frontend setup

### 1) Install packages

```bash
cd frontend
npm install
```

### 2) Copy environment file

```bash
copy .env.example .env
```

On Linux/macOS:

```bash
cp .env.example .env
```

### 3) Start frontend

```bash
npm run dev
```

Frontend will run at:

```text
http://localhost:5173
```

---

## OCR setup for scanned bills and images

The app supports OCR through `pytesseract`, but your machine must also have the Tesseract executable installed.

### Windows
1. Install Tesseract OCR
2. Add it to PATH, or set `TESSERACT_CMD` in backend `.env`

Example:

```env
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

Without this, digital PDFs and DOCX files still work, but OCR for scanned files will be limited.

---

## How the system works

### Standard flow
1. Upload document
2. Save original file on server
3. Parse file by type
4. Normalize into a common JSON shape
5. Optionally run AI organization
6. Show preview in frontend
7. Export to Excel
8. Save result path and history

### Current storage
- SQLite by default for fast local setup
- local file storage for uploads and exports

### Production-ready upgrades you should do later
- switch SQLite to PostgreSQL
- move local storage to S3 / Azure Blob / GCS
- add auth and roles
- add template engine for vendor-specific mapping
- add background job queue for heavy files
- add virus scan / file validation
- add audit logs
- add AI provider integration if needed

---

## Recommended next phases

### Phase 1
Use exactly what is in this starter.

### Phase 2
Add:
- vendor templates
- manual column mapping UI
- duplicate row cleanup
- more invoice-specific parsing rules

### Phase 3
Add AI mode:
- smart document classification
- smart sheet layout
- smart column normalization
- summary generation

### Phase 4
Enterprise hardening:
- auth
- queues
- observability
- cloud storage
- PostgreSQL
- backups
- versioned exports
- approval workflow

---

## API summary

- `GET /health` → health check
- `POST /api/documents/upload` → upload file
- `GET /api/documents` → list documents
- `GET /api/documents/{id}` → get one document
- `POST /api/documents/{id}/extract` → run extraction
- `POST /api/documents/{id}/organize` → run AI organization hook
- `POST /api/documents/{id}/export` → create Excel file
- `GET /api/documents/{id}/download` → download Excel file

---

## Real-world note

This code is structured properly and is fit as a serious starter. But for true enterprise deployment, you still need production operations around it. The parsing and export core here is real. The “perfect accuracy on all docs” promise is not real for any system unless you restrict document types and build templates.
