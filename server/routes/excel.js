import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileId, safeError } from '../utils/security.js';
import {
  readWorkbook, readSheet, createWorkbook, updateCell, appendRows, updateRow,
  addSheet, deleteSheet, duplicateSheet, getSheetNames, writeSheet, writeSheetWithCells,
  renameSheet, updateStyles, clearStyles, updateColWidths, updateRowHeights,
  updateFreeze, updateMerges, updateConditionalFormats, updateDataValidations,
  updateHidden, updateComments, sortSheet,
} from '../utils/excelHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');

const router = express.Router();

function resolveFilePath(safeId) {
  const metaPath = path.join(uploadsDir, `${safeId}.meta.json`);
  if (!fs.existsSync(metaPath)) return null;
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  return path.join(uploadsDir, meta.filename);
}

// ── Workbook ─────────────────────────────────────────────────────────────────

router.post('/create', (req, res) => {
  try {
    const { name, sheetName } = req.body;
    const id = uuidv4();
    const filename = `${id}.xlsx`;
    const filePath = path.join(uploadsDir, filename);
    const result = createWorkbook(filePath, sheetName || 'Sheet1');
    const meta = { id, originalName: name || 'Untitled.xlsx', filename, size: fs.statSync(filePath).size, uploadedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(uploadsDir, `${id}.meta.json`), JSON.stringify(meta, null, 2));
    res.json({ ...meta, ...result });
  } catch (e) { safeError(res, 500, 'Failed to create workbook', e); }
});

router.get('/:id', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    res.json(readWorkbook(fp));
  } catch (e) { safeError(res, 500, 'Failed to read workbook', e); }
});

router.get('/:id/sheets', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    res.json(getSheetNames(fp));
  } catch (e) { safeError(res, 500, 'Failed to read sheet names', e); }
});

router.get('/:id/sheet/:sheetName', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    res.json(readSheet(fp, req.params.sheetName));
  } catch (e) { safeError(res, 500, 'Failed to read sheet', e); }
});

// ── Sheet management ─────────────────────────────────────────────────────────

router.post('/:id/sheets', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    res.json(addSheet(fp, req.body.name));
  } catch (e) { safeError(res, 500, 'Failed to add sheet', e); }
});

router.delete('/:id/sheets/:sheetName', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    res.json(deleteSheet(fp, req.params.sheetName));
  } catch (e) { safeError(res, 500, 'Failed to delete sheet', e); }
});

router.post('/:id/sheets/:sheetName/duplicate', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    res.json(duplicateSheet(fp, req.params.sheetName, req.body.newName));
  } catch (e) { safeError(res, 500, 'Failed to duplicate sheet', e); }
});

router.patch('/:id/sheets/:oldName', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { newName } = req.body;
    if (!newName?.trim()) return safeError(res, 400, 'Missing newName');
    res.json(renameSheet(fp, req.params.oldName, newName.trim()));
  } catch (e) { safeError(res, 500, 'Failed to rename sheet', e); }
});

// ── Cell data ────────────────────────────────────────────────────────────────

router.put('/:id/cell', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { sheet, row, col, value } = req.body;
    res.json(updateCell(fp, sheet, row, col, value));
  } catch (e) { safeError(res, 500, 'Failed to update cell', e); }
});

router.post('/:id/rows', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    res.json(appendRows(fp, req.body.sheet, req.body.rows));
  } catch (e) { safeError(res, 500, 'Failed to append rows', e); }
});

router.put('/:id/rows/:rowIndex', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    res.json(updateRow(fp, req.body.sheet, parseInt(req.params.rowIndex), req.body.rowData));
  } catch (e) { safeError(res, 500, 'Failed to update row', e); }
});

router.put('/:id/sheet-data', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { sheetName, data, cells } = req.body;
    if (!sheetName || !Array.isArray(data)) return safeError(res, 400, 'Missing sheetName or data');
    const result = cells ? writeSheetWithCells(fp, sheetName, data, cells) : writeSheet(fp, sheetName, data);
    res.json(result);
  } catch (e) { safeError(res, 500, 'Failed to write sheet data', e); }
});

// ── Formatting & metadata ────────────────────────────────────────────────────

router.put('/:id/styles', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { sheetName, styles } = req.body;
    res.json(updateStyles(fp, sheetName, styles));
  } catch (e) { safeError(res, 500, 'Failed to update styles', e); }
});

router.put('/:id/styles/clear', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { sheetName, cellKeys } = req.body;
    res.json(clearStyles(fp, sheetName, cellKeys));
  } catch (e) { safeError(res, 500, 'Failed to clear styles', e); }
});

router.put('/:id/col-widths', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { sheetName, colWidths } = req.body;
    updateColWidths(fp, sheetName, colWidths);
    res.json({ ok: true });
  } catch (e) { safeError(res, 500, 'Failed to update col widths', e); }
});

router.put('/:id/row-heights', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { sheetName, rowHeights } = req.body;
    updateRowHeights(fp, sheetName, rowHeights);
    res.json({ ok: true });
  } catch (e) { safeError(res, 500, 'Failed to update row heights', e); }
});

router.put('/:id/freeze', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { sheetName, frozenRows = 0, frozenCols = 0 } = req.body;
    updateFreeze(fp, sheetName, frozenRows, frozenCols);
    res.json({ ok: true, frozenRows, frozenCols });
  } catch (e) { safeError(res, 500, 'Failed to update freeze', e); }
});

router.put('/:id/merges', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { sheetName, merges } = req.body;
    res.json(updateMerges(fp, sheetName, merges));
  } catch (e) { safeError(res, 500, 'Failed to update merges', e); }
});

router.put('/:id/conditional-formats', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { sheetName, rules } = req.body;
    res.json(updateConditionalFormats(fp, sheetName, rules));
  } catch (e) { safeError(res, 500, 'Failed to update conditional formats', e); }
});

router.put('/:id/data-validations', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { sheetName, validations } = req.body;
    res.json(updateDataValidations(fp, sheetName, validations));
  } catch (e) { safeError(res, 500, 'Failed to update data validations', e); }
});

router.put('/:id/hidden', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { sheetName, hiddenRows, hiddenCols } = req.body;
    res.json(updateHidden(fp, sheetName, hiddenRows, hiddenCols));
  } catch (e) { safeError(res, 500, 'Failed to update hidden', e); }
});

router.put('/:id/comments', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { sheetName, comments } = req.body;
    res.json(updateComments(fp, sheetName, comments));
  } catch (e) { safeError(res, 500, 'Failed to update comments', e); }
});

router.post('/:id/sort', (req, res) => {
  try {
    const safeId = sanitizeFileId(req.params.id);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');
    const fp = resolveFilePath(safeId);
    if (!fp) return safeError(res, 404, 'File not found');
    const { sheetName, colIndex, direction, hasHeader } = req.body;
    res.json(sortSheet(fp, sheetName, colIndex, direction, hasHeader));
  } catch (e) { safeError(res, 500, 'Failed to sort', e); }
});

// ── Templates ────────────────────────────────────────────────────────────────

router.post('/template/jira', (req, res) => {
  try {
    const id = uuidv4();
    const filename = `Jira_Template_${id.substring(0, 8)}.xlsx`;
    const filePath = path.join(uploadsDir, filename);
    const headers = [['Issue Type', 'Summary', 'Reporter', 'Assignee', 'Status', 'Priority', 'Original Estimate', 'Description', 'Due Date']];
    const sampleRows = [
      ['Story', 'Allow users to reset passwords', 'Admin', 'Unassigned', 'To Do', 'Medium', '4h', 'Implement password reset flow', '2026-12-31'],
      ['Bug', 'Login button overlaps on mobile', 'QA', 'Frontend Dev', 'Open', 'High', '1h', 'Fixed overlap on small screens', '2026-03-20'],
    ];
    createWorkbook(filePath, 'Issues');
    const result = writeSheet(filePath, 'Issues', [...headers, ...sampleRows]);
    const meta = { id, originalName: filename, filename, size: fs.statSync(filePath).size, uploadedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(uploadsDir, `${id}.meta.json`), JSON.stringify(meta, null, 2));
    res.json({ ...meta, ...result });
  } catch (e) { safeError(res, 500, 'Failed to create Jira template', e); }
});

export default router;
