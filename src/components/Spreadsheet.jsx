import React from 'react';
import { HyperFormula } from 'hyperformula';
import { useToast } from './Toast';
import * as api from '../services/api';
import ContextMenu from './ContextMenu';
import FindReplace from './FindReplace';

const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 22;
const MIN_COL_WIDTH = 30;
const MIN_ROW_HEIGHT = 16;

// ── Number formatting ─────────────────────────────────────────────────────────
function formatValue(value, numFmt) {
  if (value === null || value === undefined || value === '') return '';
  if (!numFmt || numFmt === 'General' || numFmt === '@') return String(value);
  const num = Number(value);
  if (isNaN(num)) return String(value);
  try {
    if (numFmt === '0') return Math.round(num).toString();
    if (numFmt === '0.00') return num.toFixed(2);
    if (numFmt === '#,##0') return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (numFmt === '#,##0.00') return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (numFmt === '$#,##0.00') return '$' + Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (numFmt === '_($#,##0.00)') return ' $' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (numFmt === '0%') return Math.round(num * 100) + '%';
    if (numFmt === '0.00%') return (num * 100).toFixed(2) + '%';
    if (numFmt === '0.00E+00') return num.toExponential(2).toUpperCase().replace('E+', 'E+').replace('E-', 'E-');
    if (numFmt === '#?/?') {
      const int = Math.trunc(num);
      const frac = Math.abs(num - int);
      const denom = 8;
      const numer = Math.round(frac * denom);
      if (numer === 0) return String(int);
      if (numer === denom) return String(int + 1);
      return int !== 0 ? `${int} ${numer}/${denom}` : `${numer}/${denom}`;
    }
    if (numFmt.includes('YYYY') || numFmt.includes('MM') || numFmt.includes('HH')) {
      // Excel serial date: 1 = Jan 1, 1900
      if (num > 0 && num < 2958466) {
        const msPerDay = 86400000;
        const excelEpoch = new Date(1899, 11, 30).getTime();
        const date = new Date(excelEpoch + num * msPerDay);
        const pad = (n) => String(n).padStart(2, '0');
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        if (numFmt === 'MM/DD/YYYY') return `${pad(date.getMonth()+1)}/${pad(date.getDate())}/${date.getFullYear()}`;
        if (numFmt === 'MMMM DD, YYYY') return `${months[date.getMonth()]} ${pad(date.getDate())}, ${date.getFullYear()}`;
        if (numFmt === 'MM/DD/YYYY HH:MM') return `${pad(date.getMonth()+1)}/${pad(date.getDate())}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        if (numFmt === 'HH:MM:SS') return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      }
    }
  } catch {}
  return String(value);
}

// ── Column label (A, B, ..., Z, AA, ...) ─────────────────────────────────────
function colLabel(i) {
  let label = '', n = i;
  do { label = String.fromCharCode(65 + (n % 26)) + label; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return label;
}

// ── Cell style → inline CSS ───────────────────────────────────────────────────
function styleToCSS(s) {
  if (!s) return {};
  return {
    fontWeight: s.bold ? 'bold' : undefined,
    fontStyle: s.italic ? 'italic' : undefined,
    textDecoration: [s.underline && 'underline', s.strike && 'line-through'].filter(Boolean).join(' ') || undefined,
    fontSize: s.fontSize ? `${s.fontSize}pt` : undefined,
    fontFamily: s.fontFamily || undefined,
    color: s.color || undefined,
    backgroundColor: s.bgColor || undefined,
    textAlign: s.align || undefined,
    verticalAlign: s.valign || undefined,
    whiteSpace: s.wrap ? 'normal' : undefined,
    wordBreak: s.wrap ? 'break-word' : undefined,
  };
}

// ── Border CSS for a cell ─────────────────────────────────────────────────────
function borderCSS(borders) {
  if (!borders) return {};
  const toBorder = (b) => b ? `${b.style === 'thick' ? 2 : b.style === 'double' ? 1 : 1}px ${b.style === 'double' ? 'double' : 'solid'} ${b.color || '#000'}` : undefined;
  return {
    borderTop: toBorder(borders.top),
    borderRight: toBorder(borders.right),
    borderBottom: toBorder(borders.bottom),
    borderLeft: toBorder(borders.left),
  };
}

// ── Conditional format evaluation ─────────────────────────────────────────────
function evalCondFormat(value, rule) {
  const v = Number(value);
  const t = rule.type;
  const v1 = Number(rule.value1);
  const v2 = Number(rule.value2);
  if (t === 'greaterThan') return !isNaN(v) && v > v1;
  if (t === 'lessThan') return !isNaN(v) && v < v1;
  if (t === 'between') return !isNaN(v) && v >= v1 && v <= v2;
  if (t === 'equal') return String(value) === String(rule.value1);
  if (t === 'contains') return String(value).toLowerCase().includes(String(rule.value1).toLowerCase());
  if (t === 'notEmpty') return value !== '' && value !== null && value !== undefined;
  if (t === 'empty') return value === '' || value === null || value === undefined;
  return false;
}

const Spreadsheet = React.forwardRef(function Spreadsheet(
  { fileId, sheetData, activeSheet, onDataChange, onFormulaStateChange, extraCols = 0, onSelectionStyleChange, onFreezeChange, onFilterChange, onSelectionRangeChange, zoom = 100 },
  ref
) {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [anchor, setAnchor] = React.useState(null);
  const [focus, setFocus] = React.useState(null);
  const [editingCell, setEditingCell] = React.useState(null);
  const [editValue, setEditValue] = React.useState('');
  const [clipboard, setClipboard] = React.useState(null);
  const [contextMenu, setContextMenu] = React.useState(null);
  const [findReplace, setFindReplace] = React.useState({ open: false, mode: 'find' });
  const [modifiedCells, setModifiedCells] = React.useState(new Set());
  const [isSelecting, setIsSelecting] = React.useState(false);

  // ── Layout state ────────────────────────────────────────────────────────────
  const [colWidths, setColWidths] = React.useState({});
  const [rowHeights, setRowHeights] = React.useState({});
  const [cellsData, setCellsData] = React.useState({});
  const [frozenRows, setFrozenRows] = React.useState(0);
  const [frozenCols, setFrozenCols] = React.useState(0);
  const [merges, setMerges] = React.useState([]);
  const [conditionalFormats, setConditionalFormats] = React.useState([]);
  const [dataValidations, setDataValidations] = React.useState([]);
  const [hiddenRows, setHiddenRows] = React.useState(new Set());
  const [hiddenCols, setHiddenCols] = React.useState(new Set());
  const [comments, setComments] = React.useState({});
  const [commentTooltip, setCommentTooltip] = React.useState(null); // { r, c, text, x, y }
  const [commentEditor, setCommentEditor] = React.useState(null); // { r, c, text, x, y }
  const [pasteSpecialOpen, setPasteSpecialOpen] = React.useState(false);
  const [filterState, setFilterState] = React.useState(null); // { col: n, values: Set }
  const [filterDropdown, setFilterDropdown] = React.useState(null); // { col, x, y, values }

  // ── Resize state ────────────────────────────────────────────────────────────
  const colResizeRef = React.useRef(null);
  const rowResizeRef = React.useRef(null);

  // ── Fill handle state ───────────────────────────────────────────────────────
  const fillRef = React.useRef(null);
  const [fillTarget, setFillTarget] = React.useState(null); // { minRow, maxRow, minCol, maxCol }

  // ── Undo/Redo ───────────────────────────────────────────────────────────────
  const undoStack = React.useRef([]);
  const redoStack = React.useRef([]);

  // ── HyperFormula ────────────────────────────────────────────────────────────
  const hfRef = React.useRef(null);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const inputRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const editSource = React.useRef('cell');
  const { addToast } = useToast();

  const rawData = sheetData?.data || [];
  const colCount = sheetData?.colCount || 0;
  const displayCols = Math.max(colCount + extraCols, 26);
  const displayRows = Math.max(rawData.length, 100);

  // ── Sync sheetData changes to local state ───────────────────────────────────
  React.useEffect(() => {
    if (!sheetData) return;
    setCellsData(sheetData.cells || {});
    setColWidths(sheetData.colWidths || {});
    setRowHeights(sheetData.rowHeights || {});
    setFrozenRows(sheetData.frozenRows || 0);
    setFrozenCols(sheetData.frozenCols || 0);
    setMerges(sheetData.merges || []);
    setConditionalFormats(sheetData.conditionalFormats || []);
    setDataValidations(sheetData.dataValidations || []);
    setHiddenRows(new Set(sheetData.hiddenRows || []));
    setHiddenCols(new Set(sheetData.hiddenCols || []));
    setComments(sheetData.comments || {});
  }, [sheetData]);

  // ── Initialize HyperFormula ─────────────────────────────────────────────────
  React.useEffect(() => {
    if (!sheetData?.data) return;

    const hfData = sheetData.data.map((row, r) =>
      Array.from({ length: Math.max(row.length, displayCols) }, (_, c) => {
        const key = `${r}:${c}`;
        const meta = sheetData.cells?.[key];
        if (meta?.f) return meta.f;
        return row[c] ?? '';
      })
    );
    // Pad to displayRows
    while (hfData.length < displayRows) hfData.push(Array(displayCols).fill(''));

    if (hfRef.current) { try { hfRef.current.destroy(); } catch {} }

    hfRef.current = HyperFormula.buildFromArray(hfData, { licenseKey: 'gpl-v3' });
  }, [fileId, activeSheet]);

  // ── Reset on file/sheet change ──────────────────────────────────────────────
  React.useEffect(() => {
    setAnchor(null);
    setFocus(null);
    setEditingCell(null);
    setEditValue('');
    setClipboard(null);
    setContextMenu(null);
    setModifiedCells(new Set());
    setFindReplace({ open: false, mode: 'find' });
    setFilterState(null);
    setFilterDropdown(null);
    undoStack.current = [];
    redoStack.current = [];
    editSource.current = 'cell';
  }, [fileId, activeSheet]);

  // ── Global mouseup ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    const up = () => { setIsSelecting(false); fillRef.current = null; setFillTarget(null); };
    document.addEventListener('mouseup', up);
    return () => document.removeEventListener('mouseup', up);
  }, []);

  // ── Merge lookup helpers ────────────────────────────────────────────────────
  const getMergeAt = React.useCallback((r, c) => {
    return merges.find(m => m.s.r === r && m.s.c === c) || null;
  }, [merges]);

  const isCovered = React.useCallback((r, c) => {
    return merges.some(m => {
      if (m.s.r === r && m.s.c === c) return false; // anchor is not "covered"
      return r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c;
    });
  }, [merges]);

  // ── Derived selection ───────────────────────────────────────────────────────
  const selRange = React.useMemo(() => {
    if (!anchor) return null;
    const f = focus || anchor;
    return {
      minRow: Math.min(anchor.row, f.row),
      maxRow: Math.max(anchor.row, f.row),
      minCol: Math.min(anchor.col, f.col),
      maxCol: Math.max(anchor.col, f.col),
    };
  }, [anchor, focus]);

  const isInRange = (r, c) =>
    selRange && r >= selRange.minRow && r <= selRange.maxRow && c >= selRange.minCol && c <= selRange.maxCol;

  // ── Notify parent of selection range ────────────────────────────────────────
  React.useEffect(() => {
    if (onSelectionRangeChange) onSelectionRangeChange(selRange);
  }, [selRange, onSelectionRangeChange]);

  // ── Notify parent of selection style ───────────────────────────────────────
  React.useEffect(() => {
    if (!anchor || !onSelectionStyleChange) return;
    const key = `${anchor.row}:${anchor.col}`;
    const s = cellsData[key]?.s || {};
    onSelectionStyleChange(s);
  }, [anchor, cellsData, onSelectionStyleChange]);

  // ── Get computed cell value ─────────────────────────────────────────────────
  const getCellValue = React.useCallback((r, c) => {
    if (r >= rawData.length && !(cellsData[`${r}:${c}`]?.f)) return '';
    const key = `${r}:${c}`;
    if (cellsData[key]?.f && hfRef.current) {
      try {
        const val = hfRef.current.getCellValue({ sheet: 0, row: r, col: c });
        if (val && typeof val === 'object' && val.type) return `#${val.type}!`; // Error
        return val ?? '';
      } catch { return rawData[r]?.[c] ?? ''; }
    }
    return rawData[r]?.[c] ?? '';
  }, [rawData, cellsData]);

  // ── Get display value (formatted) ───────────────────────────────────────────
  const getDisplayValue = React.useCallback((r, c) => {
    const val = getCellValue(r, c);
    const s = cellsData[`${r}:${c}`]?.s;
    if (s?.numFmt) return formatValue(val, s.numFmt);
    return val === null || val === undefined ? '' : String(val);
  }, [getCellValue, cellsData]);

  // ── Conditional format style for a cell ────────────────────────────────────
  const getCondFormatStyle = React.useCallback((r, c) => {
    if (!conditionalFormats.length) return null;
    const val = getCellValue(r, c);
    for (const rule of conditionalFormats) {
      if (!rule.range) continue;
      const { s: rs, e: re } = rule.range;
      if (r >= rs.r && r <= re.r && c >= rs.c && c <= re.c) {
        if (evalCondFormat(val, rule)) return rule.style || {};
      }
    }
    return null;
  }, [conditionalFormats, getCellValue]);

  // ── Movement ────────────────────────────────────────────────────────────────
  const clampR = (r) => Math.max(0, Math.min(r, displayRows - 1));
  const clampC = (c) => Math.max(0, Math.min(c, displayCols - 1));

  const moveTo = (r, c, extend = false) => {
    const dest = { row: clampR(r), col: clampC(c) };
    if (extend && anchor) setFocus(dest);
    else { setAnchor(dest); setFocus(dest); }
  };

  // ── Formula bar state ───────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!onFormulaStateChange) return;
    const refStr = anchor ? `${colLabel(anchor.col)}${anchor.row + 1}` : '';
    let valStr = '';
    if (editingCell) {
      valStr = editValue;
    } else if (anchor) {
      const key = `${anchor.row}:${anchor.col}`;
      valStr = cellsData[key]?.f || String(getCellValue(anchor.row, anchor.col));
    }
    onFormulaStateChange({ ref: refStr, value: valStr, isEditing: !!editingCell });
  }, [anchor, editingCell, editValue, rawData, cellsData, onFormulaStateChange]);

  // ── Imperative handle ───────────────────────────────────────────────────────
  React.useImperativeHandle(ref, () => ({
    handleFormulaChange: (val) => {
      if (!editingCell && anchor) startEditing(anchor.row, anchor.col, val, 'bar');
      else setEditValue(val);
    },
    handleFormulaFocus: () => {
      if (!anchor) return;
      if (!editingCell) startEditing(anchor.row, anchor.col, null, 'bar');
      else editSource.current = 'bar';
    },
    handleFormulaKeyDown: (e) => {
      if (!editingCell) return;
      const { row, col } = editingCell;
      if (e.key === 'Enter') { e.preventDefault(); commitCell(row, col, editValue, () => { containerRef.current?.focus(); moveTo(row + 1, col); }); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(row, col); containerRef.current?.focus(); }
    },
    applyFormat: (styleDelta) => applyFormat(styleDelta),
    applySort: (dir) => { if (anchor) handleSort(anchor.col, dir); },
    toggleFilter: () => handleToggleFilter(),
    applyFreeze: (type) => handleFreeze(type),
    applyMerge: (type) => handleMergeCells(type),
    clearFormat: () => clearFormat(),
    getSelectionRange: () => selRange,
    getFrozenRows: () => frozenRows,
    getFrozenCols: () => frozenCols,
    isFilterActive: () => !!filterState,
    getCellValue: (r, c) => getCellValue(r, c),
    applyAutoSum: () => applyAutoSum(),
    openPasteSpecial: () => setPasteSpecialOpen(true),
  }));

  // ── History ─────────────────────────────────────────────────────────────────
  const pushUndo = (snapshot) => {
    undoStack.current = [...undoStack.current.slice(-49), snapshot];
    redoStack.current = [];
  };

  const applyData = async (data, cells, successMsg) => {
    try {
      const result = await api.writeSheetData(fileId, activeSheet, data, cells);
      onDataChange(result);
      // Reinitialize HF
      if (hfRef.current) { try { hfRef.current.destroy(); } catch {} }
      const hfData = result.data.map((row, r) =>
        Array.from({ length: Math.max(row.length, displayCols) }, (_, c) => {
          const key = `${r}:${c}`;
          const meta = result.cells?.[key];
          return meta?.f || row[c] || '';
        })
      );
      hfRef.current = HyperFormula.buildFromArray(hfData, { licenseKey: 'gpl-v3' });
      if (successMsg) addToast(successMsg, 'info');
    } catch (err) {
      addToast(`Operation failed: ${err.message}`, 'error');
    }
  };

  const undo = async () => {
    if (!undoStack.current.length) { addToast('Nothing to undo', 'info'); return; }
    const prev = undoStack.current.at(-1);
    undoStack.current = undoStack.current.slice(0, -1);
    redoStack.current = [...redoStack.current, rawData];
    await applyData(prev, cellsData, 'Undone');
  };

  const redo = async () => {
    if (!redoStack.current.length) { addToast('Nothing to redo', 'info'); return; }
    const next = redoStack.current.at(-1);
    redoStack.current = redoStack.current.slice(0, -1);
    undoStack.current = [...undoStack.current, rawData];
    await applyData(next, cellsData, 'Redone');
  };

  // ── Editing ─────────────────────────────────────────────────────────────────
  const startEditing = (r, c, initial = null, source = 'cell') => {
    editSource.current = source;
    setAnchor({ row: r, col: c });
    setFocus({ row: r, col: c });
    setEditingCell({ row: r, col: c });
    const key = `${r}:${c}`;
    const formula = cellsData[key]?.f;
    const currentVal = formula || String(getCellValue(r, c));
    setEditValue(initial !== null ? initial : currentVal);
    if (source === 'cell') setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ── Data validation check ────────────────────────────────────────────────────
  const checkDataValidation = (r, c, value) => {
    for (const rule of dataValidations) {
      if (!rule.range) continue;
      const { s, e } = rule.range;
      if (r < s.r || r > e.r || c < s.c || c > e.c) continue;
      if (!rule.ignoreBlank || (value !== '' && value !== null)) {
        if (!validateValue(value, rule)) {
          if (rule.showAlert !== false) {
            const title = rule.alertTitle || 'Invalid entry';
            const msg = rule.alertMessage || 'The value you entered is not valid.';
            if (rule.alertStyle === 'stop') {
              alert(`${title}\n\n${msg}`);
              return false;
            } else {
              addToast(`${title}: ${msg}`, 'warning');
            }
          }
        }
      }
    }
    return true;
  };

  const validateValue = (value, rule) => {
    if (rule.type === 'any') return true;
    const num = Number(value);
    const v1 = Number(rule.value1);
    const v2 = Number(rule.value2);
    const isNum = !isNaN(num) && value !== '';
    if (rule.type === 'whole') {
      if (!isNum || !Number.isInteger(num)) return false;
    } else if (rule.type === 'decimal') {
      if (!isNum) return false;
    } else if (rule.type === 'textLength') {
      const len = String(value).length;
      return applyOp(len, rule.operator, v1, v2);
    } else if (rule.type === 'list') {
      if (!rule.listSource) return true;
      const items = rule.listSource.split(',').map(s => s.trim());
      return items.includes(String(value));
    } else if (rule.type === 'custom') {
      return true; // Formula validation handled server-side
    }
    if (['whole', 'decimal', 'date', 'time'].includes(rule.type)) {
      return isNum && applyOp(num, rule.operator, v1, v2);
    }
    return true;
  };

  const applyOp = (val, op, v1, v2) => {
    if (op === 'between') return val >= v1 && val <= v2;
    if (op === 'notBetween') return val < v1 || val > v2;
    if (op === 'equal') return val === v1;
    if (op === 'notEqual') return val !== v1;
    if (op === 'greaterThan') return val > v1;
    if (op === 'lessThan') return val < v1;
    if (op === 'greaterOrEqual') return val >= v1;
    if (op === 'lessOrEqual') return val <= v1;
    return true;
  };

  const commitCell = async (r, c, value, afterFn = null) => {
    setEditingCell(null);
    setEditValue('');
    editSource.current = 'cell';

    const key = `${r}:${c}`;
    const oldVal = cellsData[key]?.f || String(getCellValue(r, c));
    if (oldVal === value) { afterFn?.(); return; }

    // Data validation
    if (!checkDataValidation(r, c, value)) { afterFn?.(); return; }

    pushUndo(rawData);

    // Update HyperFormula
    if (hfRef.current) {
      try { hfRef.current.setCellContents({ sheet: 0, row: r, col: c }, [[value]]); } catch {}
    }

    try {
      const result = await api.updateCell(fileId, activeSheet, r, c, value);
      setModifiedCells(prev => new Set([...prev, key]));
      onDataChange(result);
    } catch (err) {
      addToast(`Save failed: ${err.message}`, 'error');
    }
    afterFn?.();
  };

  const cancelEdit = (r, c) => {
    setEditingCell(null);
    setEditValue('');
    editSource.current = 'cell';
    setAnchor({ row: r, col: c });
    setFocus({ row: r, col: c });
  };

  // ── Bulk operations ──────────────────────────────────────────────────────────
  const clearRange = async (range = selRange) => {
    if (!range) return;
    pushUndo(rawData);
    const newData = rawData.map((row, r) =>
      row.map((cell, c) => r >= range.minRow && r <= range.maxRow && c >= range.minCol && c <= range.maxCol ? '' : cell)
    );
    await applyData(newData, cellsData);
  };

  // ── Formatting ───────────────────────────────────────────────────────────────
  const applyFormat = async (styleDelta) => {
    if (!selRange || !fileId) return;
    const styles = {};
    for (let r = selRange.minRow; r <= selRange.maxRow; r++) {
      for (let c = selRange.minCol; c <= selRange.maxCol; c++) {
        styles[`${r}:${c}`] = styleDelta;
      }
    }
    try {
      const result = await api.updateStyles(fileId, activeSheet, styles);
      onDataChange(result);
    } catch (err) {
      addToast(`Format failed: ${err.message}`, 'error');
    }
  };

  const clearFormat = async () => {
    if (!selRange || !fileId) return;
    const keys = [];
    for (let r = selRange.minRow; r <= selRange.maxRow; r++) {
      for (let c = selRange.minCol; c <= selRange.maxCol; c++) keys.push(`${r}:${c}`);
    }
    try {
      const result = await api.clearStyles(fileId, activeSheet, keys);
      onDataChange(result);
    } catch (err) {
      addToast(`Clear format failed: ${err.message}`, 'error');
    }
  };

  // ── Clipboard ─────────────────────────────────────────────────────────────────
  const copySelection = (isCut = false) => {
    if (!selRange) return;
    const cells = [];
    for (let r = selRange.minRow; r <= selRange.maxRow; r++) {
      const row = [];
      for (let c = selRange.minCol; c <= selRange.maxCol; c++) row.push(String(getCellValue(r, c)));
      cells.push(row);
    }
    setClipboard({ data: cells, mode: isCut ? 'cut' : 'copy', range: selRange });
    navigator.clipboard.writeText(cells.map(r => r.join('\t')).join('\n')).catch(() => {});
    const sz = `${selRange.maxRow - selRange.minRow + 1}×${selRange.maxCol - selRange.minCol + 1}`;
    addToast(isCut ? `Cut ${sz}` : `Copied ${sz}`, 'info');
    if (isCut) clearRange(selRange);
  };

  const paste = async () => {
    if (!anchor) return;
    let cells = clipboard?.data;
    try {
      const text = await navigator.clipboard.readText();
      if (text) cells = text.split('\n').map(r => r.split('\t'));
    } catch { /* use internal clipboard */ }
    if (!cells?.length) return;

    pushUndo(rawData);
    const newData = rawData.map(r => [...r]);
    for (let r = 0; r < cells.length; r++) {
      const tr = anchor.row + r;
      while (newData.length <= tr) newData.push([]);
      for (let c = 0; c < cells[r].length; c++) {
        const tc = anchor.col + c;
        while (newData[tr].length <= tc) newData[tr].push('');
        newData[tr][tc] = cells[r][c];
      }
    }
    await applyData(newData, cellsData);
    setClipboard(null);
    addToast('Pasted', 'success');
  };

  // ── Row / Column operations ──────────────────────────────────────────────────
  const insertRow = async (at) => {
    pushUndo(rawData);
    const newData = [...rawData.slice(0, at), Array(displayCols).fill(''), ...rawData.slice(at)];
    await applyData(newData, cellsData, 'Row inserted');
  };

  const deleteRows = async (min, max) => {
    pushUndo(rawData);
    const newData = rawData.filter((_, i) => i < min || i > max);
    setAnchor(null); setFocus(null);
    await applyData(newData, cellsData, `${max - min + 1} row(s) deleted`);
  };

  const insertCol = async (at) => {
    pushUndo(rawData);
    const newData = rawData.map(row => [...row.slice(0, at), '', ...row.slice(at)]);
    await applyData(newData, cellsData, 'Column inserted');
  };

  const deleteCols = async (min, max) => {
    pushUndo(rawData);
    const newData = rawData.map(row => row.filter((_, i) => i < min || i > max));
    setAnchor(null); setFocus(null);
    await applyData(newData, cellsData, `${max - min + 1} column(s) deleted`);
  };

  // ── Sort ─────────────────────────────────────────────────────────────────────
  const handleSort = async (colIndex, direction) => {
    try {
      const result = await api.sortSheet(fileId, activeSheet, colIndex, direction, true);
      onDataChange(result);
      addToast(`Sorted ${direction === 'asc' ? 'A→Z' : 'Z→A'}`, 'success');
    } catch (err) {
      addToast(`Sort failed: ${err.message}`, 'error');
    }
  };

  // ── Filter ───────────────────────────────────────────────────────────────────
  const handleToggleFilter = () => {
    if (filterState) {
      setFilterState(null);
      if (onFilterChange) onFilterChange(false);
    } else {
      setFilterState({ active: true });
      if (onFilterChange) onFilterChange(true);
    }
  };

  // ── Freeze panes ─────────────────────────────────────────────────────────────
  const handleFreeze = async (type) => {
    let fr = frozenRows, fc = frozenCols;
    if (type === 'row') { fr = 1; fc = 0; }
    else if (type === 'col') { fr = 0; fc = 1; }
    else if (type === 'both') { fr = anchor ? anchor.row + 1 : 1; fc = anchor ? anchor.col + 1 : 1; }
    else { fr = 0; fc = 0; }

    try {
      await api.updateFreeze(fileId, activeSheet, fr, fc);
      setFrozenRows(fr);
      setFrozenCols(fc);
      if (onFreezeChange) onFreezeChange(fr, fc);
      addToast(type === 'none' ? 'Unfrozen' : `Frozen: ${fr} rows, ${fc} cols`, 'success');
    } catch (err) {
      addToast(`Freeze failed: ${err.message}`, 'error');
    }
  };

  // ── Merge cells ───────────────────────────────────────────────────────────────
  const handleMergeCells = async (type) => {
    if (!selRange) return;
    const { minRow, maxRow, minCol, maxCol } = selRange;

    if (type === 'unmerge') {
      const newMerges = merges.filter(m => !(m.s.r >= minRow && m.e.r <= maxRow && m.s.c >= minCol && m.e.c <= maxCol));
      try {
        const result = await api.updateMerges(fileId, activeSheet, newMerges);
        setMerges(newMerges);
        onDataChange(result);
        addToast('Cells unmerged', 'success');
      } catch (err) { addToast(`Unmerge failed: ${err.message}`, 'error'); }
      return;
    }

    const newMerge = { s: { r: minRow, c: minCol }, e: { r: maxRow, c: maxCol } };
    if (type === 'merge-center') {
      await applyFormat({ align: 'center' });
    }

    const filtered = merges.filter(m => !(
      m.s.r >= minRow && m.e.r <= maxRow && m.s.c >= minCol && m.e.c <= maxCol
    ));
    const newMerges = [...filtered, newMerge];

    try {
      const result = await api.updateMerges(fileId, activeSheet, newMerges);
      setMerges(newMerges);
      onDataChange(result);
      addToast('Cells merged', 'success');
    } catch (err) { addToast(`Merge failed: ${err.message}`, 'error'); }
  };

  // ── Fill handle ───────────────────────────────────────────────────────────────
  const handleFillHandleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selRange) return;
    fillRef.current = { startRange: selRange, startY: e.clientY, startX: e.clientX };

    const onMove = (e) => {
      if (!fillRef.current) return;
      const { startRange } = fillRef.current;
      // Determine fill direction and target
      const dy = e.clientY - fillRef.current.startY;
      const dx = e.clientX - fillRef.current.startX;
      const rowH = DEFAULT_ROW_HEIGHT;
      const extraRows = Math.max(0, Math.round(dy / rowH));
      const extraCols = Math.max(0, Math.round(dx / DEFAULT_COL_WIDTH));
      if (Math.abs(dy) > Math.abs(dx)) {
        setFillTarget({
          minRow: startRange.minRow, maxRow: startRange.maxRow + extraRows,
          minCol: startRange.minCol, maxCol: startRange.maxCol,
        });
      } else {
        setFillTarget({
          minRow: startRange.minRow, maxRow: startRange.maxRow,
          minCol: startRange.minCol, maxCol: startRange.maxCol + extraCols,
        });
      }
    };

    const onUp = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!fillRef.current || !fillTarget) { fillRef.current = null; setFillTarget(null); return; }
      const { startRange } = fillRef.current;
      await executeFill(startRange, fillTarget);
      fillRef.current = null;
      setFillTarget(null);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const executeFill = async (srcRange, destRange) => {
    pushUndo(rawData);
    const newData = rawData.map(r => [...r]);

    // Fill downward
    if (destRange.maxRow > srcRange.maxRow) {
      const srcRows = srcRange.maxRow - srcRange.minRow + 1;
      for (let r = srcRange.maxRow + 1; r <= destRange.maxRow; r++) {
        while (newData.length <= r) newData.push([]);
        for (let c = srcRange.minCol; c <= srcRange.maxCol; c++) {
          const srcR = srcRange.minRow + ((r - srcRange.minRow) % srcRows);
          while (newData[r].length <= c) newData[r].push('');
          const srcVal = rawData[srcR]?.[c];
          // Smart fill: detect number series
          const num = Number(srcVal);
          if (!isNaN(num) && srcVal !== '' && srcRows === 1) {
            const firstNum = Number(rawData[srcRange.minRow]?.[c]);
            const secondNum = srcRows > 1 ? Number(rawData[srcRange.minRow + 1]?.[c]) : null;
            const step = secondNum !== null ? secondNum - firstNum : 1;
            newData[r][c] = firstNum + (r - srcRange.minRow) * step;
          } else {
            newData[r][c] = srcVal ?? '';
          }
        }
      }
    }

    // Fill rightward
    if (destRange.maxCol > srcRange.maxCol) {
      for (let r = srcRange.minRow; r <= srcRange.maxRow; r++) {
        if (!newData[r]) continue;
        for (let c = srcRange.maxCol + 1; c <= destRange.maxCol; c++) {
          while (newData[r].length <= c) newData[r].push('');
          const srcC = srcRange.minCol + ((c - srcRange.minCol) % (srcRange.maxCol - srcRange.minCol + 1));
          newData[r][c] = rawData[r]?.[srcC] ?? '';
        }
      }
    }

    await applyData(newData, cellsData, 'Filled');
    moveTo(destRange.maxRow, destRange.maxCol);
  };

  // ── Auto-fit column width ─────────────────────────────────────────────────────
  const handleColAutoFit = (colIndex) => {
    let maxChars = Math.max(colLabel(colIndex).length, 4);
    for (let r = 0; r < Math.min(rawData.length, displayRows); r++) {
      const val = getDisplayValue(r, colIndex);
      if (val) maxChars = Math.max(maxChars, String(val).length);
    }
    const w = Math.min(300, Math.max(MIN_COL_WIDTH, maxChars * 7 + 16));
    setColWidths(prev => ({ ...prev, [colIndex]: w }));
    if (fileId) api.updateColWidths(fileId, activeSheet, { [colIndex]: w }).catch(() => {});
  };

  // ── Hide / Unhide rows ────────────────────────────────────────────────────────
  const hideRows = async (min, max) => {
    const next = new Set(hiddenRows);
    for (let r = min; r <= max; r++) next.add(r);
    setHiddenRows(next);
    const arr = [...next];
    try { await api.updateHidden(fileId, activeSheet, arr, [...hiddenCols]); } catch {}
    addToast(`${max - min + 1} row(s) hidden`, 'info');
  };

  const unhideRows = async (min, max) => {
    const next = new Set(hiddenRows);
    for (let r = min; r <= max; r++) next.delete(r);
    setHiddenRows(next);
    const arr = [...next];
    try { await api.updateHidden(fileId, activeSheet, arr, [...hiddenCols]); } catch {}
    addToast('Rows unhidden', 'success');
  };

  // ── Hide / Unhide cols ────────────────────────────────────────────────────────
  const hideCols = async (min, max) => {
    const next = new Set(hiddenCols);
    for (let c = min; c <= max; c++) next.add(c);
    setHiddenCols(next);
    try { await api.updateHidden(fileId, activeSheet, [...hiddenRows], [...next]); } catch {}
    addToast(`${max - min + 1} column(s) hidden`, 'info');
  };

  const unhideCols = async (min, max) => {
    const next = new Set(hiddenCols);
    for (let c = min; c <= max; c++) next.delete(c);
    setHiddenCols(next);
    try { await api.updateHidden(fileId, activeSheet, [...hiddenRows], [...next]); } catch {}
    addToast('Columns unhidden', 'success');
  };

  // ── Paste Special ─────────────────────────────────────────────────────────────
  const pasteSpecial = async (mode) => {
    if (!anchor) return;
    let cells = clipboard?.data;
    if (!cells?.length) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) cells = text.split('\n').map(r => r.split('\t'));
      } catch {}
    }
    if (!cells?.length) return;

    if (mode === 'transpose') {
      const transposed = cells[0].map((_, ci) => cells.map(row => row[ci] ?? ''));
      cells = transposed;
    }

    pushUndo(rawData);
    const newData = rawData.map(r => [...r]);
    const newCells = { ...cellsData };

    for (let r = 0; r < cells.length; r++) {
      const tr = anchor.row + r;
      while (newData.length <= tr) newData.push([]);
      for (let c = 0; c < cells[r].length; c++) {
        const tc = anchor.col + c;
        while (newData[tr].length <= tc) newData[tr].push('');
        const srcKey = clipboard?.range
          ? `${clipboard.range.minRow + r}:${clipboard.range.minCol + c}`
          : null;

        if (mode === 'values' || mode === 'transpose') {
          newData[tr][tc] = cells[r][c];
          if (newCells[`${tr}:${tc}`]) newCells[`${tr}:${tc}`] = { ...newCells[`${tr}:${tc}`], f: undefined };
        } else if (mode === 'formats' && srcKey && cellsData[srcKey]) {
          newCells[`${tr}:${tc}`] = { ...(newCells[`${tr}:${tc}`] || {}), s: cellsData[srcKey].s };
        } else if (mode === 'formulas' && srcKey && cellsData[srcKey]?.f) {
          newData[tr][tc] = cellsData[srcKey].f;
        } else {
          newData[tr][tc] = cells[r][c];
        }
      }
    }

    if (mode === 'formats') {
      try {
        const styles = {};
        Object.keys(newCells).forEach(k => { if (newCells[k]?.s) styles[k] = newCells[k].s; });
        await api.updateStyles(fileId, activeSheet, styles);
        addToast('Formats pasted', 'success');
      } catch (err) { addToast(`Paste failed: ${err.message}`, 'error'); }
    } else {
      await applyData(newData, newCells, `Pasted (${mode})`);
    }
    setClipboard(null);
    setPasteSpecialOpen(false);
  };

  // ── Cell Comments ─────────────────────────────────────────────────────────────
  const saveComments = async (newComments) => {
    setComments(newComments);
    try { await api.updateComments(fileId, activeSheet, newComments); } catch {}
  };

  const upsertComment = async (r, c, text) => {
    const key = `${r}:${c}`;
    const newComments = { ...comments };
    if (text.trim()) newComments[key] = { text: text.trim(), author: 'User' };
    else delete newComments[key];
    await saveComments(newComments);
    setCommentEditor(null);
    addToast(text.trim() ? 'Comment saved' : 'Comment deleted', 'success');
  };

  // ── AutoSum ───────────────────────────────────────────────────────────────────
  const applyAutoSum = () => {
    if (!anchor) return;
    const { row, col } = anchor;

    // Look above for contiguous numbers
    let top = row - 1;
    while (top >= 0 && getCellValue(top, col) !== '' && !isNaN(Number(getCellValue(top, col)))) top--;
    const topRange = top + 1;
    if (topRange < row) {
      const formula = `=SUM(${colLabel(col)}${topRange + 1}:${colLabel(col)}${row})`;
      startEditing(row, col, formula, 'cell');
      return;
    }

    // Look left for contiguous numbers
    let left = col - 1;
    while (left >= 0 && getCellValue(row, left) !== '' && !isNaN(Number(getCellValue(row, left)))) left--;
    const leftRange = left + 1;
    if (leftRange < col) {
      const formula = `=SUM(${colLabel(leftRange)}${row + 1}:${colLabel(col - 1)}${row + 1})`;
      startEditing(row, col, formula, 'cell');
      return;
    }

    // Nothing detected — insert blank SUM
    startEditing(row, col, '=SUM()', 'cell');
  };

  // ── Find & Replace ────────────────────────────────────────────────────────────
  const replaceAll = async (findText, replaceText, matchCase) => {
    const search = matchCase ? findText : findText.toLowerCase();
    pushUndo(rawData);
    let count = 0;
    const newData = rawData.map(row =>
      row.map(cell => {
        const val = String(cell ?? '');
        const cmp = matchCase ? val : val.toLowerCase();
        if (cmp === search) { count++; return replaceText; }
        return cell;
      })
    );
    await applyData(newData, cellsData, `Replaced ${count} occurrence(s)`);
  };

  // ── Column resize ─────────────────────────────────────────────────────────────
  const handleColResizeStart = (e, colIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = colWidths[colIndex] || DEFAULT_COL_WIDTH;
    colResizeRef.current = { colIndex, startX: e.clientX, startW };

    const onMove = (e) => {
      if (!colResizeRef.current) return;
      const { colIndex, startX, startW } = colResizeRef.current;
      const w = Math.max(MIN_COL_WIDTH, startW + e.clientX - startX);
      setColWidths(prev => ({ ...prev, [colIndex]: w }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!colResizeRef.current) return;
      const { colIndex } = colResizeRef.current;
      colResizeRef.current = null;
      setColWidths(prev => {
        const w = prev[colIndex];
        if (fileId && w) api.updateColWidths(fileId, activeSheet, { [colIndex]: w }).catch(() => {});
        return prev;
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Row resize ────────────────────────────────────────────────────────────────
  const handleRowResizeStart = (e, rowIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const startH = rowHeights[rowIndex] || DEFAULT_ROW_HEIGHT;
    rowResizeRef.current = { rowIndex, startY: e.clientY, startH };

    const onMove = (e) => {
      if (!rowResizeRef.current) return;
      const { rowIndex, startY, startH } = rowResizeRef.current;
      const h = Math.max(MIN_ROW_HEIGHT, startH + e.clientY - startY);
      setRowHeights(prev => ({ ...prev, [rowIndex]: h }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!rowResizeRef.current) return;
      const { rowIndex } = rowResizeRef.current;
      rowResizeRef.current = null;
      setRowHeights(prev => {
        const h = prev[rowIndex];
        if (fileId && h) api.updateRowHeights(fileId, activeSheet, { [rowIndex]: h }).catch(() => {});
        return prev;
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Column / Row header selection ─────────────────────────────────────────────
  const selectCol = (c, extend) => {
    if (extend && anchor) {
      setFocus({ row: displayRows - 1, col: c });
      if (!anchor) setAnchor({ row: 0, col: c });
    } else {
      setAnchor({ row: 0, col: c });
      setFocus({ row: displayRows - 1, col: c });
    }
    containerRef.current?.focus();
  };

  const selectRow = (r, extend) => {
    if (extend && anchor) {
      setFocus({ row: r, col: displayCols - 1 });
    } else {
      setAnchor({ row: r, col: 0 });
      setFocus({ row: r, col: displayCols - 1 });
    }
    containerRef.current?.focus();
  };

  // ── Context menu ───────────────────────────────────────────────────────────────
  const buildMenuItems = () => {
    const sr = selRange || (anchor ? { minRow: anchor.row, maxRow: anchor.row, minCol: anchor.col, maxCol: anchor.col } : null);
    if (!sr) return [];
    const multiRow = sr.maxRow > sr.minRow;
    const multiCol = sr.maxCol > sr.minCol;
    const commentKey = anchor ? `${anchor.row}:${anchor.col}` : null;
    const hasComment = commentKey && comments[commentKey];

    // Check for adjacent hidden rows/cols to show unhide
    const hasHiddenRowNearby = [...hiddenRows].some(r => r >= sr.minRow - 1 && r <= sr.maxRow + 1);
    const hasHiddenColNearby = [...hiddenCols].some(c => c >= sr.minCol - 1 && c <= sr.maxCol + 1);

    return [
      { icon: '✂️', label: 'Cut', shortcut: 'Ctrl+X', action: () => copySelection(true) },
      { icon: '📋', label: 'Copy', shortcut: 'Ctrl+C', action: () => copySelection(false) },
      { icon: '📌', label: 'Paste', shortcut: 'Ctrl+V', action: paste, disabled: !clipboard },
      { icon: '📋', label: 'Paste Special...', shortcut: 'Ctrl+Shift+V', action: () => setPasteSpecialOpen(true) },
      'divider',
      { icon: '🗑️', label: 'Clear Contents', shortcut: 'Delete', action: () => clearRange(sr) },
      { icon: '✕', label: 'Clear Formatting', action: () => clearFormat() },
      'divider',
      { icon: '💬', label: hasComment ? 'Edit Comment' : 'Insert Comment', action: () => {
        if (!anchor) return;
        const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
        setCommentEditor({ r: anchor.row, c: anchor.col, text: comments[commentKey]?.text || '', x: rect.left + 200, y: rect.top + 100 });
      }},
      hasComment && { icon: '🗑️', label: 'Delete Comment', action: () => anchor && upsertComment(anchor.row, anchor.col, '') },
      'divider',
      { icon: '⬆️', label: 'Insert Row Above', action: () => insertRow(sr.minRow) },
      { icon: '⬇️', label: 'Insert Row Below', action: () => insertRow(sr.maxRow + 1) },
      { icon: '👁️', label: multiRow ? 'Hide Rows' : 'Hide Row', action: () => hideRows(sr.minRow, sr.maxRow) },
      hasHiddenRowNearby && { icon: '👁️', label: 'Unhide Rows', action: () => unhideRows(Math.max(0, sr.minRow - 1), sr.maxRow + 1) },
      { icon: '❌', label: multiRow ? 'Delete Rows' : 'Delete Row', action: () => deleteRows(sr.minRow, sr.maxRow) },
      'divider',
      { icon: '⬅️', label: 'Insert Column Left', action: () => insertCol(sr.minCol) },
      { icon: '➡️', label: 'Insert Column Right', action: () => insertCol(sr.maxCol + 1) },
      { icon: '👁️', label: multiCol ? 'Hide Columns' : 'Hide Column', action: () => hideCols(sr.minCol, sr.maxCol) },
      hasHiddenColNearby && { icon: '👁️', label: 'Unhide Columns', action: () => unhideCols(Math.max(0, sr.minCol - 1), sr.maxCol + 1) },
      { icon: '↔️', label: 'Auto-fit Column Width', action: () => { for (let c = sr.minCol; c <= sr.maxCol; c++) handleColAutoFit(c); } },
      { icon: '❌', label: multiCol ? 'Delete Columns' : 'Delete Column', action: () => deleteCols(sr.minCol, sr.maxCol) },
      'divider',
      { icon: '↑', label: 'Sort A→Z', action: () => handleSort(anchor?.col ?? sr.minCol, 'asc') },
      { icon: '↓', label: 'Sort Z→A', action: () => handleSort(anchor?.col ?? sr.minCol, 'desc') },
      'divider',
      { icon: '⊞', label: 'Merge & Center', action: () => handleMergeCells('merge-center') },
      { icon: '⊟', label: 'Unmerge Cells', action: () => handleMergeCells('unmerge') },
    ].filter(Boolean);
  };

  // ── Keyboard ───────────────────────────────────────────────────────────────────
  const handleContainerKeyDown = (e) => {
    if (editingCell) return;
    const ac = focus || anchor;
    const shift = e.shiftKey;
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl) {
      switch (e.key.toLowerCase()) {
        case 'c': e.preventDefault(); copySelection(false); return;
        case 'x': e.preventDefault(); copySelection(true); return;
        case 'v': e.preventDefault(); if (shift) setPasteSpecialOpen(true); else paste(); return;
        case 'z': e.preventDefault(); if (shift) redo(); else undo(); return;
        case 'y': e.preventDefault(); redo(); return;
        case 'a': e.preventDefault(); setAnchor({ row: 0, col: 0 }); setFocus({ row: displayRows - 1, col: displayCols - 1 }); return;
        case 'f': e.preventDefault(); setFindReplace({ open: true, mode: 'find' }); return;
        case 'h': e.preventDefault(); setFindReplace({ open: true, mode: 'replace' }); return;
        case 'b': e.preventDefault(); applyFormat({ bold: !((anchor && cellsData[`${anchor.row}:${anchor.col}`]?.s?.bold)) }); return;
        case 'i': e.preventDefault(); applyFormat({ italic: !((anchor && cellsData[`${anchor.row}:${anchor.col}`]?.s?.italic)) }); return;
        case 'u': e.preventDefault(); applyFormat({ underline: !((anchor && cellsData[`${anchor.row}:${anchor.col}`]?.s?.underline)) }); return;
        case 'home': e.preventDefault(); moveTo(0, 0, shift); return;
        case 'end': {
          e.preventDefault();
          const lr = Math.max(0, rawData.length - 1);
          const lc = Math.max(0, Math.max(...rawData.map(r => r.length || 0)) - 1);
          moveTo(lr, lc, shift);
          return;
        }
        case 'arrowup': e.preventDefault(); if (!ac) return; { let r = ac.row - 1; while (r > 0 && !getCellValue(r, ac.col)) r--; moveTo(Math.max(0, r), ac.col, shift); return; }
        case 'arrowdown': e.preventDefault(); if (!ac) return; { let r = ac.row + 1; while (r < displayRows - 1 && !getCellValue(r, ac.col)) r++; moveTo(Math.min(displayRows - 1, r), ac.col, shift); return; }
        case 'arrowleft': e.preventDefault(); if (!ac) return; { let c = ac.col - 1; while (c > 0 && !getCellValue(ac.row, c)) c--; moveTo(ac.row, Math.max(0, c), shift); return; }
        case 'arrowright': e.preventDefault(); if (!ac) return; { let c = ac.col + 1; while (c < displayCols - 1 && !getCellValue(ac.row, c)) c++; moveTo(ac.row, Math.min(displayCols - 1, c), shift); return; }
        default: return;
      }
    }

    if (!anchor) return;

    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); moveTo(ac.row - 1, ac.col, shift); break;
      case 'ArrowDown': e.preventDefault(); moveTo(ac.row + 1, ac.col, shift); break;
      case 'ArrowLeft': e.preventDefault(); moveTo(ac.row, ac.col - 1, shift); break;
      case 'ArrowRight': e.preventDefault(); moveTo(ac.row, ac.col + 1, shift); break;
      case 'Tab': e.preventDefault(); moveTo(ac.row, ac.col + (shift ? -1 : 1)); break;
      case 'Enter': e.preventDefault(); if (shift) moveTo(ac.row - 1, ac.col); else startEditing(anchor.row, anchor.col); break;
      case 'F2': e.preventDefault(); startEditing(anchor.row, anchor.col); break;
      case 'Home': e.preventDefault(); moveTo(ac.row, 0, shift); break;
      case 'End': e.preventDefault(); moveTo(ac.row, displayCols - 1, shift); break;
      case 'PageUp': e.preventDefault(); moveTo(Math.max(0, ac.row - 20), ac.col, shift); break;
      case 'PageDown': e.preventDefault(); moveTo(Math.min(displayRows - 1, ac.row + 20), ac.col, shift); break;
      case 'Delete':
      case 'Backspace': e.preventDefault(); clearRange(); break;
      case 'Escape': setAnchor(null); setFocus(null); containerRef.current?.blur(); break;
      default:
        if (e.key.length === 1 && !ctrl && !e.altKey) { e.preventDefault(); startEditing(anchor.row, anchor.col, e.key); }
    }
  };

  const handleInputKeyDown = (e) => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    switch (e.key) {
      case 'Enter': e.preventDefault(); commitCell(row, col, editValue, () => moveTo(row + (e.shiftKey ? -1 : 1), col)); break;
      case 'Tab': e.preventDefault(); commitCell(row, col, editValue, () => moveTo(row, col + (e.shiftKey ? -1 : 1))); break;
      case 'Escape': e.preventDefault(); cancelEdit(row, col); break;
      default: break;
    }
  };

  // ── Mouse ─────────────────────────────────────────────────────────────────────
  const handleCellMouseDown = (e, r, c) => {
    if (e.button === 2) return;
    e.preventDefault();
    if (editingCell && (editingCell.row !== r || editingCell.col !== c)) {
      commitCell(editingCell.row, editingCell.col, editValue, () => {
        if (e.shiftKey && anchor) setFocus({ row: r, col: c });
        else { setAnchor({ row: r, col: c }); setFocus({ row: r, col: c }); }
      });
    } else {
      if (e.shiftKey && anchor) setFocus({ row: r, col: c });
      else { setAnchor({ row: r, col: c }); setFocus({ row: r, col: c }); setIsSelecting(true); }
      containerRef.current?.focus();
    }
  };

  const handleCellMouseEnter = (r, c) => {
    if (isSelecting) setFocus({ row: r, col: c });
  };

  const handleContextMenu = (e, r, c) => {
    e.preventDefault();
    if (!isInRange(r, c)) { setAnchor({ row: r, col: c }); setFocus({ row: r, col: c }); }
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // ── Filter dropdown ───────────────────────────────────────────────────────────
  const openFilterDropdown = (e, c) => {
    e.stopPropagation();
    const uniqueVals = new Set();
    rawData.slice(1).forEach(row => { const v = row[c]; if (v !== '' && v !== null && v !== undefined) uniqueVals.add(String(v)); });
    setFilterDropdown({ col: c, x: e.clientX, y: e.clientY + 10, values: uniqueVals });
  };

  // ── Render ─────────────────────────────────────────────────────────────────────
  if (!fileId) {
    return (
      <div className="spreadsheet-container">
        <div className="spreadsheet-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
          </svg>
          <h3>No Workbook Open</h3>
          <p>Create a new workbook or upload an existing Excel file from the sidebar to get started.</p>
        </div>
      </div>
    );
  }

  // Compute fill target highlight area
  const effectiveFillTarget = fillTarget || selRange;

  return (
    <>
      <div
        className="spreadsheet-container"
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
        onClick={() => { setContextMenu(null); setFilterDropdown(null); }}
        style={{ outline: 'none', zoom: zoom / 100 }}
      >
        <table className="spreadsheet-table" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {/* Corner cell */}
              <th
                className="row-header corner-header"
                onClick={() => { setAnchor({ row: 0, col: 0 }); setFocus({ row: displayRows - 1, col: displayCols - 1 }); containerRef.current?.focus(); }}
                style={{ position: 'sticky', top: 0, left: 0, zIndex: 30 }}
              />
              {Array.from({ length: displayCols }, (_, c) => {
                const isHidden = hiddenCols.has(c);
                const w = isHidden ? 0 : (colWidths[c] || DEFAULT_COL_WIDTH);
                const isColSelected = selRange && c >= selRange.minCol && c <= selRange.maxCol;
                const isFrozen = c < frozenCols;
                const leftOffset = isFrozen ? Array.from({ length: c }, (_, i) => hiddenCols.has(i) ? 0 : (colWidths[i] || DEFAULT_COL_WIDTH)).reduce((a, b) => a + b, 40) : undefined;
                return (
                  <th
                    key={c}
                    className={`col-header ${isColSelected ? 'col-selected' : ''} ${isFrozen ? 'frozen-col' : ''} ${isHidden ? 'col-hidden' : ''}`}
                    style={{
                      width: w, minWidth: w, maxWidth: w,
                      overflow: 'hidden', padding: isHidden ? 0 : undefined,
                      position: 'sticky', top: 0, zIndex: isFrozen ? 25 : 20,
                      left: isFrozen ? leftOffset : undefined,
                    }}
                    onClick={(e) => !isHidden && selectCol(c, e.shiftKey)}
                    onContextMenu={(e) => { e.preventDefault(); setAnchor(a => a || { row: 0, col: c }); selectCol(c, false); setContextMenu({ x: e.clientX, y: e.clientY }); }}
                  >
                    <span>{colLabel(c)}</span>
                    {filterState && c < (rawData[0]?.length || 0) && (
                      <span className="filter-indicator" onClick={(e) => openFilterDropdown(e, c)}>▾</span>
                    )}
                    <div
                      className="col-resize-handle"
                      onMouseDown={(e) => handleColResizeStart(e, c)}
                      onDoubleClick={(e) => { e.stopPropagation(); handleColAutoFit(c); }}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: displayRows }, (_, r) => {
              const isHiddenRow = hiddenRows.has(r);
              const rh = isHiddenRow ? 0 : (rowHeights[r] || DEFAULT_ROW_HEIGHT);
              const isRowSelected = selRange && r >= selRange.minRow && r <= selRange.maxRow;
              const isFrozenRow = r < frozenRows;
              const topOffset = isFrozenRow ? Array.from({ length: r }, (_, i) => hiddenRows.has(i) ? 0 : (rowHeights[i] || DEFAULT_ROW_HEIGHT)).reduce((a, b) => a + b, 26) : undefined;

              return (
                <tr key={r} style={{ height: rh, display: isHiddenRow ? 'none' : undefined }}>
                  {/* Row number */}
                  <td
                    className={`row-number ${isRowSelected ? 'row-selected' : ''} ${isFrozenRow ? 'frozen-row' : ''}`}
                    onClick={(e) => selectRow(r, e.shiftKey)}
                    onContextMenu={(e) => { e.preventDefault(); selectRow(r, false); setContextMenu({ x: e.clientX, y: e.clientY }); }}
                    style={{
                      height: rh,
                      position: isFrozenRow ? 'sticky' : undefined,
                      top: isFrozenRow ? topOffset : undefined,
                      zIndex: isFrozenRow ? 15 : undefined,
                      left: 0,
                    }}
                  >
                    {r + 1}
                    <div className="row-resize-handle" onMouseDown={(e) => handleRowResizeStart(e, r)} />
                  </td>

                  {Array.from({ length: displayCols }, (_, c) => {
                    if (isCovered(r, c)) return null;

                    const merge = getMergeAt(r, c);
                    const colSpan = merge ? merge.e.c - merge.s.c + 1 : 1;
                    const rowSpan = merge ? merge.e.r - merge.s.r + 1 : 1;

                    const isEditing = editingCell?.row === r && editingCell?.col === c;
                    const isAnchor = anchor?.row === r && anchor?.col === c;
                    const inRange = isInRange(r, c);
                    const isModified = modifiedCells.has(`${r}:${c}`);
                    const isFrozenCol = c < frozenCols;
                    const w = colWidths[c] || DEFAULT_COL_WIDTH;

                    const cellMeta = cellsData[`${r}:${c}`];
                    const cellStyle = cellMeta?.s || {};
                    const condStyle = getCondFormatStyle(r, c);
                    const mergedStyle = condStyle ? { ...cellStyle, ...condStyle } : cellStyle;
                    const inlineStyle = {
                      ...styleToCSS(mergedStyle),
                      ...borderCSS(mergedStyle.borders),
                      width: w, minWidth: w, maxWidth: w,
                      height: rh,
                    };

                    // Sticky for frozen cols
                    if (isFrozenCol) {
                      const leftOffset = Array.from({ length: c }, (_, i) => colWidths[i] || DEFAULT_COL_WIDTH).reduce((a, b) => a + b, 40);
                      inlineStyle.position = 'sticky';
                      inlineStyle.left = leftOffset;
                      inlineStyle.zIndex = isFrozenRow ? 12 : 5;
                    }
                    if (isFrozenRow) {
                      inlineStyle.position = inlineStyle.position || 'sticky';
                      inlineStyle.top = topOffset;
                      inlineStyle.zIndex = inlineStyle.zIndex || 10;
                    }

                    const value = getCellValue(r, c);
                    const displayVal = getDisplayValue(r, c);
                    const cellComment = comments[`${r}:${c}`];

                    // Fill target highlight
                    const inFillTarget = fillTarget && r >= fillTarget.minRow && r <= fillTarget.maxRow && c >= fillTarget.minCol && c <= fillTarget.maxCol;

                    return (
                      <td
                        key={c}
                        colSpan={colSpan > 1 ? colSpan : undefined}
                        rowSpan={rowSpan > 1 ? rowSpan : undefined}
                        className={[
                          isEditing ? 'editing' : '',
                          isAnchor ? 'selected' : inRange ? 'in-range' : '',
                          isModified ? 'modified' : '',
                          isFrozenCol ? 'frozen-col' : '',
                          isFrozenRow ? 'frozen-row-cell' : '',
                          inFillTarget ? 'fill-target' : '',
                          cellComment ? 'has-comment' : '',
                        ].filter(Boolean).join(' ')}
                        style={inlineStyle}
                        onMouseDown={(e) => handleCellMouseDown(e, r, c)}
                        onMouseEnter={(e) => {
                          handleCellMouseEnter(r, c);
                          if (cellComment) setCommentTooltip({ r, c, text: cellComment.text, x: e.clientX + 12, y: e.clientY + 12 });
                        }}
                        onMouseLeave={() => setCommentTooltip(null)}
                        onDoubleClick={() => startEditing(r, c)}
                        onContextMenu={(e) => handleContextMenu(e, r, c)}
                        title={undefined}
                      >
                        {isEditing && editSource.current === 'cell' ? (
                          <input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitCell(r, c, editValue)}
                            onKeyDown={handleInputKeyDown}
                            style={{ fontFamily: cellStyle.fontFamily, fontSize: cellStyle.fontSize ? `${cellStyle.fontSize}pt` : undefined }}
                          />
                        ) : isEditing ? (
                          <span className="formula-editing-cell">{editValue}</span>
                        ) : (
                          displayVal
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Fill handle */}
        {selRange && !editingCell && (() => {
          // Position at bottom-right corner of selection
          const r = selRange.maxRow;
          const c = selRange.maxCol;
          // We can't easily compute absolute position without refs per cell,
          // so we use a simple overlay indicator
          return (
            <div
              className="fill-handle-indicator"
              style={{ display: 'none' }} // Shown via CSS on .selected cell
              onMouseDown={handleFillHandleMouseDown}
            />
          );
        })()}
      </div>

      {/* Freeze pane border indicators */}
      {frozenRows > 0 && <div className="freeze-row-border" />}
      {frozenCols > 0 && <div className="freeze-col-border" />}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}

      {filterDropdown && (
        <div
          className="filter-dropdown-popup"
          style={{ left: filterDropdown.x, top: filterDropdown.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="filter-dropdown-header">Filter Column {colLabel(filterDropdown.col)}</div>
          <div className="filter-dropdown-content">
            <button className="btn btn-sm btn-secondary" style={{ width: '100%', marginBottom: 4 }}
              onClick={() => {
                setFilterState(null);
                setFilterDropdown(null);
                addToast('Filter cleared', 'info');
              }}>
              Clear Filter
            </button>
            <button className="btn btn-sm btn-primary" style={{ width: '100%', marginBottom: 8 }}
              onClick={() => {
                handleSort(filterDropdown.col, 'asc');
                setFilterDropdown(null);
              }}>
              Sort A→Z
            </button>
            <button className="btn btn-sm btn-primary" style={{ width: '100%' }}
              onClick={() => {
                handleSort(filterDropdown.col, 'desc');
                setFilterDropdown(null);
              }}>
              Sort Z→A
            </button>
            <div className="filter-dropdown-divider" />
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '4px 0' }}>Unique values:</div>
            <div className="filter-value-list">
              {[...filterDropdown.values].slice(0, 20).map(v => (
                <div key={v} className="filter-value-item">{v}</div>
              ))}
              {filterDropdown.values.size > 20 && (
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>+{filterDropdown.values.size - 20} more...</div>
              )}
            </div>
          </div>
        </div>
      )}

      <FindReplace
        isOpen={findReplace.open}
        mode={findReplace.mode}
        data={rawData}
        onClose={() => setFindReplace({ open: false, mode: 'find' })}
        onNavigate={(r, c) => { moveTo(r, c); containerRef.current?.focus(); }}
        onReplaceAll={replaceAll}
      />

      {/* Comment tooltip */}
      {commentTooltip && (
        <div className="comment-tooltip" style={{ left: commentTooltip.x, top: commentTooltip.y }}>
          {commentTooltip.text}
        </div>
      )}

      {/* Comment editor */}
      {commentEditor && (
        <div className="comment-editor" style={{ left: commentEditor.x, top: commentEditor.y }}
          onClick={(e) => e.stopPropagation()}>
          <div className="comment-editor-header">
            <span>Comment</span>
            <button className="modal-close-btn" style={{ fontSize: 11 }} onClick={() => setCommentEditor(null)}>✕</button>
          </div>
          <textarea
            className="comment-editor-textarea"
            autoFocus
            defaultValue={commentEditor.text}
            id="comment-editor-input"
            rows={4}
            placeholder="Add a comment..."
          />
          <div className="comment-editor-footer">
            <button className="btn btn-sm btn-secondary" onClick={() => setCommentEditor(null)}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={() => {
              const val = document.getElementById('comment-editor-input')?.value || '';
              upsertComment(commentEditor.r, commentEditor.c, val);
            }}>Save</button>
          </div>
        </div>
      )}

      {/* Paste Special dialog */}
      {pasteSpecialOpen && (
        <div className="modal-overlay" onClick={() => setPasteSpecialOpen(false)}>
          <div className="paste-special-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="paste-special-header">
              <h2>Paste Special</h2>
              <button className="modal-close-btn" onClick={() => setPasteSpecialOpen(false)}>✕</button>
            </div>
            <div className="paste-special-body">
              {[
                { id: 'all',       label: 'All',                 desc: 'Paste everything (same as Ctrl+V)' },
                { id: 'values',    label: 'Values Only',         desc: 'Paste computed values, strip formulas' },
                { id: 'formats',   label: 'Formats Only',        desc: 'Paste only cell formatting/styles' },
                { id: 'formulas',  label: 'Formulas Only',       desc: 'Paste formula text without values' },
                { id: 'transpose', label: 'Transpose',           desc: 'Flip rows and columns' },
              ].map(opt => (
                <button key={opt.id} className="paste-special-option" onClick={() => pasteSpecial(opt.id)}>
                  <span className="paste-special-label">{opt.label}</span>
                  <span className="paste-special-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default Spreadsheet;
