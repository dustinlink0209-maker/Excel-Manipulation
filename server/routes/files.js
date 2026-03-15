import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { sanitizeFileId, safeError } from '../utils/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');

const router = express.Router();

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const ALLOWED_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
  'text/csv',
  'application/csv',
  'text/plain', // some browsers send this for .csv
];

/**
 * Generate a unique filename by appending (1), (2), etc. if a file already exists.
 */
function uniqueFilename(dir, originalName) {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  let candidate = originalName;
  let counter = 1;

  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base} (${counter})${ext}`;
    counter++;
  }

  return candidate;
}

/**
 * Create a slug ID from a filename (used for the .meta.json sidecar).
 * e.g. "Test 1 - 3.13.26.xlsx" -> "Test 1 - 3.13.26"
 */
function fileId(filename) {
  return path.basename(filename, path.extname(filename));
}

// Multer config — save with original filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safeName = uniqueFilename(uploadsDir, file.originalname);
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Only .xlsx, .xls, and .csv files are allowed'));
    }
    if (!ALLOWED_MIMES.includes(mime)) {
      return cb(new Error('File MIME type does not match its extension'));
    }
    cb(null, true);
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Upload file
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return safeError(res, 400, 'No file uploaded');
    }

    const id = fileId(req.file.filename);
    const fileInfo = {
      id,
      originalName: req.file.filename,
      filename: req.file.filename,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
    };

    // Save metadata
    const metaPath = path.join(uploadsDir, `${id}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(fileInfo, null, 2));

    res.json(fileInfo);
  } catch (error) {
    safeError(res, 500, 'Upload failed', error);
  }
});

// List all files
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(uploadsDir)) {
      return res.json([]);
    }

    const metaFiles = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.meta.json'));
    const files = metaFiles.map(f => {
      const content = fs.readFileSync(path.join(uploadsDir, f), 'utf-8');
      return JSON.parse(content);
    });

    files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.json(files);
  } catch (error) {
    safeError(res, 500, 'Failed to list files', error);
  }
});

// Download file
router.get('/:id/download', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');

    const metaPath = path.join(uploadsDir, `${safeId}.meta.json`);
    if (!fs.existsSync(metaPath)) {
      return safeError(res, 404, 'File not found');
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const filePath = path.join(uploadsDir, meta.filename);

    res.download(filePath, meta.originalName);
  } catch (error) {
    safeError(res, 500, 'Download failed', error);
  }
});

// Delete file
router.delete('/:id', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');

    const metaPath = path.join(uploadsDir, `${safeId}.meta.json`);
    if (!fs.existsSync(metaPath)) {
      return safeError(res, 404, 'File not found');
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const filePath = path.join(uploadsDir, meta.filename);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    fs.unlinkSync(metaPath);

    res.json({ success: true });
  } catch (error) {
    safeError(res, 500, 'Delete failed', error);
  }
});

export default router;
