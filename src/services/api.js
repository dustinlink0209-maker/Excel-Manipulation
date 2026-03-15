const API_BASE = '/api';

async function req(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ── Files ─────────────────────────────────────────────────────────────────────

export const fetchFiles = () => req(`${API_BASE}/files`);

export const uploadFile = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return req(`${API_BASE}/files/upload`, { method: 'POST', body: fd });
};

export const deleteFile = (id) => req(`${API_BASE}/files/${id}`, { method: 'DELETE' });

export const downloadFile = async (id) => {
  const res = await fetch(`${API_BASE}/files/${id}/download`);
  if (!res.ok) throw new Error('Failed to download');
  return res.blob();
};

// ── Workbook ──────────────────────────────────────────────────────────────────

export const createWorkbook = (name, sheetName) =>
  req(`${API_BASE}/excel/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, sheetName }) });

export const readWorkbook = (id) => req(`${API_BASE}/excel/${id}`);
export const readSheet = (id, sheetName) => req(`${API_BASE}/excel/${id}/sheet/${encodeURIComponent(sheetName)}`);

// ── Sheet management ──────────────────────────────────────────────────────────

export const addSheet = (id, name) =>
  req(`${API_BASE}/excel/${id}/sheets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });

export const deleteSheet = (id, sheetName) =>
  req(`${API_BASE}/excel/${id}/sheets/${encodeURIComponent(sheetName)}`, { method: 'DELETE' });

export const duplicateSheet = (id, sheetName, newName) =>
  req(`${API_BASE}/excel/${id}/sheets/${encodeURIComponent(sheetName)}/duplicate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newName }) });

export const renameSheet = (id, oldName, newName) =>
  req(`${API_BASE}/excel/${id}/sheets/${encodeURIComponent(oldName)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newName }) });

// ── Cell data ─────────────────────────────────────────────────────────────────

export const updateCell = (id, sheet, row, col, value) =>
  req(`${API_BASE}/excel/${id}/cell`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheet, row, col, value }) });

export const appendRows = (id, sheet, rows) =>
  req(`${API_BASE}/excel/${id}/rows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheet, rows }) });

export const updateRow = (id, sheet, rowIndex, rowData) =>
  req(`${API_BASE}/excel/${id}/rows/${rowIndex}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheet, rowData }) });

export const writeSheetData = (id, sheetName, data, cells) =>
  req(`${API_BASE}/excel/${id}/sheet-data`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetName, data, cells }) });

// ── Formatting & metadata ─────────────────────────────────────────────────────

export const updateStyles = (id, sheetName, styles) =>
  req(`${API_BASE}/excel/${id}/styles`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetName, styles }) });

export const clearStyles = (id, sheetName, cellKeys) =>
  req(`${API_BASE}/excel/${id}/styles/clear`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetName, cellKeys }) });

export const updateColWidths = (id, sheetName, colWidths) =>
  req(`${API_BASE}/excel/${id}/col-widths`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetName, colWidths }) });

export const updateRowHeights = (id, sheetName, rowHeights) =>
  req(`${API_BASE}/excel/${id}/row-heights`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetName, rowHeights }) });

export const updateFreeze = (id, sheetName, frozenRows, frozenCols) =>
  req(`${API_BASE}/excel/${id}/freeze`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetName, frozenRows, frozenCols }) });

export const updateMerges = (id, sheetName, merges) =>
  req(`${API_BASE}/excel/${id}/merges`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetName, merges }) });

export const updateConditionalFormats = (id, sheetName, rules) =>
  req(`${API_BASE}/excel/${id}/conditional-formats`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetName, rules }) });

export const updateDataValidations = (id, sheetName, validations) =>
  req(`${API_BASE}/excel/${id}/data-validations`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetName, validations }) });

export const updateHidden = (id, sheetName, hiddenRows, hiddenCols) =>
  req(`${API_BASE}/excel/${id}/hidden`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetName, hiddenRows, hiddenCols }) });

export const updateComments = (id, sheetName, comments) =>
  req(`${API_BASE}/excel/${id}/comments`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetName, comments }) });

export const sortSheet = (id, sheetName, colIndex, direction, hasHeader) =>
  req(`${API_BASE}/excel/${id}/sort`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetName, colIndex, direction, hasHeader }) });

// ── AI & Analysis ─────────────────────────────────────────────────────────────

export const analyzeData = (data, sheetName, analysisType = 'full', provider = 'gemini') =>
  req(`${API_BASE}/ai/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, sheetName, analysisType, provider }) });

export const analyzeSheet = (fileId, sheetName, useAI = false, provider = 'gemini') =>
  req(`${API_BASE}/analyzer/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId, sheetName, useAI, provider }) });

export const applyNormalizations = (fileId, sheetName, rules) =>
  req(`${API_BASE}/analyzer/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId, sheetName, rules }) });

export const generateReport = (data, sheetName, provider = 'gemini') =>
  req(`${API_BASE}/ai/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, sheetName, provider }) });

export const generateReportExcel = (data, sheetName, fileId, provider = 'gemini') =>
  req(`${API_BASE}/ai/report-excel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, sheetName, fileId, provider }) });

export const generateJiraDashboard = (data, sheetName, fileId, provider = 'gemini') =>
  req(`${API_BASE}/ai/report-jira`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, sheetName, fileId, provider }) });

export const createJiraTemplate = () =>
  req(`${API_BASE}/excel/template/jira`, { method: 'POST' });
