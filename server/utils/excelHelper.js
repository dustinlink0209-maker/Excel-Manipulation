import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// ── Sidecar (styles / metadata stored alongside xlsx) ──────────────────────
function sidecarPath(filePath) {
  return filePath.replace(/\.(xlsx?|csv)$/i, '.sidecar.json');
}

export function readSidecar(filePath) {
  const sp = sidecarPath(filePath);
  if (!fs.existsSync(sp)) return {};
  try { return JSON.parse(fs.readFileSync(sp, 'utf-8')); } catch { return {}; }
}

export function writeSidecar(filePath, data) {
  fs.writeFileSync(sidecarPath(filePath), JSON.stringify(data, null, 2));
}

function updateSidecarSheet(filePath, sheetName, updates) {
  const sc = readSidecar(filePath);
  if (!sc[sheetName]) sc[sheetName] = {};
  Object.assign(sc[sheetName], updates);
  writeSidecar(filePath, sc);
}

// ── Sheet data extraction ──────────────────────────────────────────────────
function extractSheet(worksheet, sidecarSheet = {}) {
  if (!worksheet) return { data: [], cells: {}, rowCount: 0, colCount: 0 };

  const ref = worksheet['!ref'];
  if (!ref) return { data: [], cells: {}, rowCount: 0, colCount: 0 };

  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r + 1;
  const colCount = range.e.c + 1;
  const data = [];
  const cells = {};

  for (let r = 0; r <= range.e.r; r++) {
    const row = [];
    for (let c = 0; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[addr];
      const key = `${r}:${c}`;

      if (!cell || cell.t === 'z') {
        row.push('');
      } else if (cell.f) {
        // Formula cell
        row.push(cell.v ?? '');
        if (!cells[key]) cells[key] = {};
        cells[key].f = `=${cell.f}`;
      } else if (cell.t === 'n') {
        row.push(cell.v);
      } else if (cell.t === 'b') {
        row.push(cell.v);
      } else if (cell.t === 'd') {
        row.push(cell.w || cell.v);
      } else {
        row.push(cell.v ?? '');
      }
    }
    data.push(row);
  }

  // Merge sidecar cell metadata (styles, formula overrides)
  const scCells = sidecarSheet.cells || {};
  for (const key of Object.keys(scCells)) {
    if (!cells[key]) cells[key] = {};
    if (scCells[key].s) cells[key].s = scCells[key].s;
    if (scCells[key].f && !cells[key].f) cells[key].f = scCells[key].f;
  }

  // Column widths from xlsx
  const xlsxColWidths = {};
  if (worksheet['!cols']) {
    worksheet['!cols'].forEach((col, i) => {
      if (col?.wch) xlsxColWidths[i] = Math.round(col.wch * 7);
      else if (col?.wpx) xlsxColWidths[i] = col.wpx;
    });
  }

  // Row heights from xlsx
  const xlsxRowHeights = {};
  if (worksheet['!rows']) {
    worksheet['!rows'].forEach((row, i) => {
      if (row?.hpx) xlsxRowHeights[i] = row.hpx;
    });
  }

  // Merge ranges
  const merges = (worksheet['!merges'] || []).map(m => ({
    s: { r: m.s.r, c: m.s.c },
    e: { r: m.e.r, c: m.e.c },
  }));

  return {
    data,
    cells,
    rowCount,
    colCount,
    xlsxColWidths,
    xlsxRowHeights,
    merges,
  };
}

function buildSheetResponse(sheetName, extracted, sidecarSheet = {}) {
  const colWidths = { ...extracted.xlsxColWidths, ...(sidecarSheet.colWidths || {}) };
  const rowHeights = { ...extracted.xlsxRowHeights, ...(sidecarSheet.rowHeights || {}) };

  return {
    name: sheetName,
    data: extracted.data,
    cells: extracted.cells,
    rowCount: extracted.rowCount,
    colCount: extracted.colCount,
    colWidths,
    rowHeights,
    frozenRows: sidecarSheet.frozenRows || 0,
    frozenCols: sidecarSheet.frozenCols || 0,
    merges: extracted.merges,
    filters: sidecarSheet.filters || null,
    conditionalFormats: sidecarSheet.conditionalFormats || [],
    dataValidations: sidecarSheet.dataValidations || [],
    hiddenRows: sidecarSheet.hiddenRows || [],
    hiddenCols: sidecarSheet.hiddenCols || [],
    comments: sidecarSheet.comments || {},
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export function readWorkbook(filePath) {
  const wb = XLSX.readFile(filePath, { cellFormula: true, cellNF: true, cellDates: false });
  const sc = readSidecar(filePath);

  const sheets = wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    const extracted = extractSheet(ws, sc[name] || {});
    return buildSheetResponse(name, extracted, sc[name] || {});
  });

  return { sheets, activeSheet: wb.SheetNames[0] };
}

export function readSheet(filePath, sheetName) {
  const wb = XLSX.readFile(filePath, { cellFormula: true, cellNF: true, cellDates: false });
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

  const sc = readSidecar(filePath);
  const extracted = extractSheet(ws, sc[sheetName] || {});
  return buildSheetResponse(sheetName, extracted, sc[sheetName] || {});
}

export function createWorkbook(filePath, sheetName = 'Sheet1') {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[]]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filePath);
  return readWorkbook(filePath);
}

export function updateCell(filePath, sheetName, row, col, value) {
  const wb = XLSX.readFile(filePath, { cellFormula: true });
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

  const addr = XLSX.utils.encode_cell({ r: row, c: col });

  if (typeof value === 'string' && value.startsWith('=')) {
    ws[addr] = { t: 'f', f: value.slice(1), v: 0 };
    // Also save formula to sidecar for safety
    const sc = readSidecar(filePath);
    if (!sc[sheetName]) sc[sheetName] = {};
    if (!sc[sheetName].cells) sc[sheetName].cells = {};
    if (!sc[sheetName].cells[`${row}:${col}`]) sc[sheetName].cells[`${row}:${col}`] = {};
    sc[sheetName].cells[`${row}:${col}`].f = value;
    writeSidecar(filePath, sc);
  } else if (value === '' || value === null || value === undefined) {
    ws[addr] = { t: 'z' };
    // Clear formula from sidecar
    const sc = readSidecar(filePath);
    const key = `${row}:${col}`;
    if (sc[sheetName]?.cells?.[key]?.f) {
      delete sc[sheetName].cells[key].f;
      writeSidecar(filePath, sc);
    }
  } else if (!isNaN(value) && value !== '') {
    ws[addr] = { t: 'n', v: Number(value) };
  } else {
    ws[addr] = { t: 's', v: String(value) };
  }

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  if (row > range.e.r) range.e.r = row;
  if (col > range.e.c) range.e.c = col;
  ws['!ref'] = XLSX.utils.encode_range(range);

  XLSX.writeFile(wb, filePath);
  return readSheet(filePath, sheetName);
}

export function updateStyles(filePath, sheetName, styleUpdates) {
  // styleUpdates: { "r:c": { bold, italic, ... } }
  const sc = readSidecar(filePath);
  if (!sc[sheetName]) sc[sheetName] = {};
  if (!sc[sheetName].cells) sc[sheetName].cells = {};

  for (const [key, style] of Object.entries(styleUpdates)) {
    if (!sc[sheetName].cells[key]) sc[sheetName].cells[key] = {};
    sc[sheetName].cells[key].s = { ...(sc[sheetName].cells[key].s || {}), ...style };
  }
  writeSidecar(filePath, sc);
  return readSheet(filePath, sheetName);
}

export function clearStyles(filePath, sheetName, cellKeys) {
  const sc = readSidecar(filePath);
  if (!sc[sheetName]?.cells) return readSheet(filePath, sheetName);
  for (const key of cellKeys) {
    if (sc[sheetName].cells[key]) delete sc[sheetName].cells[key].s;
  }
  writeSidecar(filePath, sc);
  return readSheet(filePath, sheetName);
}

export function updateColWidths(filePath, sheetName, colWidths) {
  const sc = readSidecar(filePath);
  if (!sc[sheetName]) sc[sheetName] = {};
  sc[sheetName].colWidths = { ...(sc[sheetName].colWidths || {}), ...colWidths };
  writeSidecar(filePath, sc);

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (ws) {
    if (!ws['!cols']) ws['!cols'] = [];
    for (const [i, w] of Object.entries(colWidths)) {
      const idx = parseInt(i);
      while (ws['!cols'].length <= idx) ws['!cols'].push({});
      ws['!cols'][idx] = { wch: Math.round(w / 7) };
    }
    XLSX.writeFile(wb, filePath);
  }
}

export function updateRowHeights(filePath, sheetName, rowHeights) {
  const sc = readSidecar(filePath);
  if (!sc[sheetName]) sc[sheetName] = {};
  sc[sheetName].rowHeights = { ...(sc[sheetName].rowHeights || {}), ...rowHeights };
  writeSidecar(filePath, sc);

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (ws) {
    if (!ws['!rows']) ws['!rows'] = [];
    for (const [i, h] of Object.entries(rowHeights)) {
      const idx = parseInt(i);
      while (ws['!rows'].length <= idx) ws['!rows'].push({});
      ws['!rows'][idx] = { hpx: h };
    }
    XLSX.writeFile(wb, filePath);
  }
}

export function updateFreeze(filePath, sheetName, frozenRows, frozenCols) {
  updateSidecarSheet(filePath, sheetName, { frozenRows, frozenCols });
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (ws) {
    if (frozenRows > 0 || frozenCols > 0) {
      ws['!freeze'] = { xSplit: frozenCols, ySplit: frozenRows };
    } else {
      delete ws['!freeze'];
    }
    XLSX.writeFile(wb, filePath);
  }
}

export function updateMerges(filePath, sheetName, merges) {
  updateSidecarSheet(filePath, sheetName, { merges });
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (ws) {
    ws['!merges'] = merges.map(m => ({
      s: { r: m.s.r, c: m.s.c },
      e: { r: m.e.r, c: m.e.c },
    }));
    XLSX.writeFile(wb, filePath);
  }
  return readSheet(filePath, sheetName);
}

export function updateConditionalFormats(filePath, sheetName, rules) {
  updateSidecarSheet(filePath, sheetName, { conditionalFormats: rules });
  return readSheet(filePath, sheetName);
}

export function updateDataValidations(filePath, sheetName, validations) {
  updateSidecarSheet(filePath, sheetName, { dataValidations: validations });
  return readSheet(filePath, sheetName);
}

export function updateHidden(filePath, sheetName, hiddenRows, hiddenCols) {
  updateSidecarSheet(filePath, sheetName, { hiddenRows, hiddenCols });
  return readSheet(filePath, sheetName);
}

export function updateComments(filePath, sheetName, comments) {
  updateSidecarSheet(filePath, sheetName, { comments });
  return readSheet(filePath, sheetName);
}

export function sortSheet(filePath, sheetName, colIndex, direction = 'asc', hasHeader = true) {
  const wb = XLSX.readFile(filePath, { cellFormula: true });
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const header = hasHeader && data.length > 0 ? [data[0]] : [];
  const rows = hasHeader ? data.slice(1) : data;

  rows.sort((a, b) => {
    const av = a[colIndex] ?? '';
    const bv = b[colIndex] ?? '';
    const an = Number(av);
    const bn = Number(bv);
    if (!isNaN(an) && !isNaN(bn) && av !== '' && bv !== '') {
      return direction === 'asc' ? an - bn : bn - an;
    }
    const cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
    return direction === 'asc' ? cmp : -cmp;
  });

  wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  XLSX.writeFile(wb, filePath);
  return readSheet(filePath, sheetName);
}

export function appendRows(filePath, sheetName, rows) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const existing = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  let nextRow = (existing.length === 1 && existing[0].every(c => c === '')) ? 0 : range.e.r + 1;

  for (const row of rows) {
    for (let col = 0; col < row.length; col++) {
      const addr = XLSX.utils.encode_cell({ r: nextRow, c: col });
      const val = row[col];
      if (val === '' || val === null || val === undefined) ws[addr] = { t: 'z' };
      else if (!isNaN(val) && val !== '') ws[addr] = { t: 'n', v: Number(val) };
      else ws[addr] = { t: 's', v: String(val) };
    }
    if (nextRow > range.e.r) range.e.r = nextRow;
    if (row.length - 1 > range.e.c) range.e.c = row.length - 1;
    nextRow++;
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: range.e });
  XLSX.writeFile(wb, filePath);
  return readSheet(filePath, sheetName);
}

export function updateRow(filePath, sheetName, rowIndex, rowData) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);

  for (let c = 0; c < rowData.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: rowIndex, c });
    const val = rowData[c];
    if (val === '' || val === null || val === undefined) ws[addr] = { t: 'z' };
    else if (!isNaN(val) && val !== '') ws[addr] = { t: 'n', v: Number(val) };
    else ws[addr] = { t: 's', v: String(val) };
  }

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  if (rowIndex > range.e.r) range.e.r = rowIndex;
  if (rowData.length - 1 > range.e.c) range.e.c = rowData.length - 1;
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: range.e });
  XLSX.writeFile(wb, filePath);
  return readSheet(filePath, sheetName);
}

export function addSheet(filePath, sheetName) {
  const wb = XLSX.readFile(filePath);
  if (wb.SheetNames.includes(sheetName)) throw new Error(`Sheet "${sheetName}" already exists`);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), sheetName);
  XLSX.writeFile(wb, filePath);
  return readWorkbook(filePath);
}

export function deleteSheet(filePath, sheetName) {
  const wb = XLSX.readFile(filePath);
  if (wb.SheetNames.length <= 1) throw new Error('Cannot delete the last sheet');
  const idx = wb.SheetNames.indexOf(sheetName);
  if (idx === -1) throw new Error(`Sheet "${sheetName}" not found`);
  wb.SheetNames.splice(idx, 1);
  delete wb.Sheets[sheetName];
  XLSX.writeFile(wb, filePath);

  const sc = readSidecar(filePath);
  if (sc[sheetName]) { delete sc[sheetName]; writeSidecar(filePath, sc); }

  return readWorkbook(filePath);
}

export function duplicateSheet(filePath, sheetName, newName) {
  const wb = XLSX.readFile(filePath, { cellFormula: true });
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`);
  if (wb.SheetNames.includes(newName)) throw new Error(`Sheet "${newName}" already exists`);

  const wsClone = JSON.parse(JSON.stringify(ws));
  XLSX.utils.book_append_sheet(wb, wsClone, newName);
  XLSX.writeFile(wb, filePath);

  const sc = readSidecar(filePath);
  if (sc[sheetName]) { sc[newName] = JSON.parse(JSON.stringify(sc[sheetName])); writeSidecar(filePath, sc); }

  return readWorkbook(filePath);
}

export function getSheetNames(filePath) {
  return XLSX.readFile(filePath).SheetNames;
}

export function renameSheet(filePath, oldName, newName) {
  const wb = XLSX.readFile(filePath);
  if (!wb.SheetNames.includes(oldName)) throw new Error(`Sheet "${oldName}" not found`);
  if (wb.SheetNames.includes(newName)) throw new Error(`Sheet "${newName}" already exists`);
  const idx = wb.SheetNames.indexOf(oldName);
  wb.SheetNames[idx] = newName;
  wb.Sheets[newName] = wb.Sheets[oldName];
  delete wb.Sheets[oldName];
  XLSX.writeFile(wb, filePath);

  const sc = readSidecar(filePath);
  if (sc[oldName]) { sc[newName] = sc[oldName]; delete sc[oldName]; writeSidecar(filePath, sc); }

  return readWorkbook(filePath);
}

export function writeSheet(filePath, sheetName, data) {
  const wb = XLSX.readFile(filePath, { cellFormula: true });
  if (!wb.Sheets[sheetName]) throw new Error(`Sheet "${sheetName}" not found`);
  wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(data);
  XLSX.writeFile(wb, filePath);
  return readSheet(filePath, sheetName);
}

export function writeSheetWithCells(filePath, sheetName, data, cells = {}) {
  const wb = XLSX.readFile(filePath, { cellFormula: true });
  if (!wb.Sheets[sheetName]) throw new Error(`Sheet "${sheetName}" not found`);
  const ws = XLSX.utils.aoa_to_sheet(data);

  for (const [key, cell] of Object.entries(cells)) {
    if (cell.f) {
      const [r, c] = key.split(':').map(Number);
      const addr = XLSX.utils.encode_cell({ r, c });
      const formula = cell.f.startsWith('=') ? cell.f.slice(1) : cell.f;
      ws[addr] = { t: 'f', f: formula, v: data[r]?.[c] ?? 0 };
    }
  }

  wb.Sheets[sheetName] = ws;
  XLSX.writeFile(wb, filePath);
  return readSheet(filePath, sheetName);
}
