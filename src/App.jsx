import React from 'react';
import { ToastProvider, useToast } from './components/Toast';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import FormatBar from './components/FormatBar';
import SheetTabs from './components/SheetTabs';
import Spreadsheet from './components/Spreadsheet';
import InsightsPanel from './components/InsightsPanel';
import FormulaBar from './components/FormulaBar';
import StatusBar from './components/StatusBar';
import ChartModal from './components/ChartModal';
import ConditionalFormatDialog from './components/ConditionalFormatDialog';
import DataValidationDialog from './components/DataValidationDialog';
import * as api from './services/api';

function AppContent() {
  const [files, setFiles] = React.useState([]);
  const [activeFileId, setActiveFileId] = React.useState(null);
  const [workbookData, setWorkbookData] = React.useState(null);
  const [activeSheet, setActiveSheet] = React.useState(null);
  const [isInsightsOpen, setIsInsightsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [extraCols, setExtraCols] = React.useState(0);
  const [formulaState, setFormulaState] = React.useState({ ref: '', value: '', isEditing: false });
  const [selectionStyle, setSelectionStyle] = React.useState({});
  const [frozenRows, setFrozenRows] = React.useState(0);
  const [frozenCols, setFrozenCols] = React.useState(0);
  const [filterActive, setFilterActive] = React.useState(false);
  const [zoom, setZoom] = React.useState(100);
  const [selRange, setSelRange] = React.useState(null);
  const [chartModalOpen, setChartModalOpen] = React.useState(false);
  const [cfDialogOpen, setCfDialogOpen] = React.useState(false);
  const [dvDialogOpen, setDvDialogOpen] = React.useState(false);
  const { addToast } = useToast();

  const spreadsheetRef = React.useRef(null);

  React.useEffect(() => { setExtraCols(0); }, [activeFileId, activeSheet]);
  React.useEffect(() => { setFrozenRows(0); setFrozenCols(0); setFilterActive(false); }, [activeFileId, activeSheet]);

  const loadFiles = React.useCallback(async () => {
    try { setFiles(await api.fetchFiles()); } catch { addToast('Failed to load files', 'error'); }
  }, [addToast]);

  React.useEffect(() => { loadFiles(); }, [loadFiles]);

  React.useEffect(() => {
    if (!activeFileId) { setWorkbookData(null); setActiveSheet(null); return; }
    (async () => {
      setIsLoading(true);
      try {
        const data = await api.readWorkbook(activeFileId);
        setWorkbookData(data);
        setActiveSheet(data.activeSheet || data.sheets[0]?.name);
      } catch (err) {
        addToast(`Failed to load workbook: ${err.message}`, 'error');
        setWorkbookData(null);
      } finally { setIsLoading(false); }
    })();
  }, [activeFileId, addToast]);

  const handleFileSelect = (fileId) => { setActiveFileId(fileId); setIsInsightsOpen(false); };
  const handleSheetSelect = (name) => setActiveSheet(name);

  const handleRenameSheet = async (oldName, newName) => {
    if (!activeFileId || oldName === newName) return;
    try {
      const data = await api.renameSheet(activeFileId, oldName, newName);
      setWorkbookData(data);
      setActiveSheet(newName);
      addToast(`Renamed to "${newName}"`, 'success');
    } catch (err) { addToast(`Rename failed: ${err.message}`, 'error'); }
  };

  const handleAddSheet = async (name) => {
    if (!activeFileId) return;
    try {
      const data = await api.addSheet(activeFileId, name);
      setWorkbookData(data);
      setActiveSheet(name);
      addToast(`Added sheet "${name}"`, 'success');
    } catch (err) { addToast(`Failed to add sheet: ${err.message}`, 'error'); }
  };

  const handleDeleteSheet = async (name) => {
    if (!activeFileId) return;
    if (!confirm(`Delete sheet "${name}"?`)) return;
    try {
      const data = await api.deleteSheet(activeFileId, name);
      setWorkbookData(data);
      setActiveSheet(data.sheets[0]?.name);
      addToast(`Deleted "${name}"`, 'info');
    } catch (err) { addToast(`Delete failed: ${err.message}`, 'error'); }
  };

  const handleDuplicateSheet = async (name) => {
    if (!activeFileId) return;
    const newName = `${name} (2)`;
    try {
      const data = await api.duplicateSheet(activeFileId, name, newName);
      setWorkbookData(data);
      setActiveSheet(newName);
      addToast(`Duplicated as "${newName}"`, 'success');
    } catch (err) { addToast(`Duplicate failed: ${err.message}`, 'error'); }
  };

  const handleAddRow = async () => {
    if (!activeFileId || !activeSheet) return;
    const currentSheet = workbookData?.sheets?.find(s => s.name === activeSheet);
    if (!currentSheet) return;
    const colCount = Math.max((currentSheet.colCount || 1) + extraCols, 1);
    try {
      const data = await api.appendRows(activeFileId, activeSheet, [Array(colCount).fill('')]);
      setWorkbookData(prev => ({ ...prev, sheets: prev.sheets.map(s => s.name === activeSheet ? data : s) }));
      addToast('New row added', 'success');
    } catch (err) { addToast(`Failed to add row: ${err.message}`, 'error'); }
  };

  const handleAddColumn = () => {
    if (!activeFileId || !activeSheet) return;
    setExtraCols(prev => prev + 1);
    addToast('Column added — click a cell to start typing', 'info');
  };

  const handleSheetDataChange = (newSheetData) => {
    setWorkbookData(prev => ({
      ...prev,
      sheets: prev.sheets.map(s => s.name === activeSheet ? newSheetData : s),
    }));
  };

  // ── Format bar handlers ────────────────────────────────────────────────────
  const handleFormat = (styleDelta) => spreadsheetRef.current?.applyFormat(styleDelta);
  const handleSort = (dir) => spreadsheetRef.current?.applySort(dir);
  const handleToggleFilter = () => spreadsheetRef.current?.toggleFilter();
  const handleFreeze = (type) => spreadsheetRef.current?.applyFreeze(type);
  const handleMergeCells = (type) => spreadsheetRef.current?.applyMerge(type);
  const handleClearFormat = () => spreadsheetRef.current?.clearFormat();
  const handleInsertChart = () => {
    if (!spreadsheetRef.current?.getSelectionRange()) {
      addToast('Select a range first', 'warning');
      return;
    }
    setChartModalOpen(true);
  };

  const handleCondFormat = () => setCfDialogOpen(true);
  const handleDataValidation = () => setDvDialogOpen(true);
  const handleAutoSum = () => spreadsheetRef.current?.applyAutoSum();

  const handleSaveCondFormats = async (rules) => {
    if (!activeFileId || !activeSheet) return;
    try {
      await api.updateConditionalFormats(activeFileId, activeSheet, rules);
      const data = await api.readWorkbook(activeFileId);
      setWorkbookData(data);
      addToast('Conditional formatting saved', 'success');
    } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
  };

  const handleSaveDataValidation = async (rule) => {
    if (!activeFileId || !activeSheet) return;
    try {
      // Save validation rule to sidecar via API
      const existing = activeSheetData?.dataValidations || [];
      const updated = rule === null ? [] : [
        ...existing.filter(r => !rangesOverlap(r.range, rule.range)),
        rule,
      ];
      await api.updateDataValidations(activeFileId, activeSheet, updated);
      const data = await api.readWorkbook(activeFileId);
      setWorkbookData(data);
      addToast(rule === null ? 'Data validation cleared' : 'Data validation saved', 'success');
    } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
  };

  const activeSheetData = workbookData?.sheets?.find(s => s.name === activeSheet);
  const activeFile = files.find(f => f.id === activeFileId);

  const rangesOverlap = (a, b) => {
    if (!a || !b) return false;
    return a.s.r <= b.e.r && a.e.r >= b.s.r && a.s.c <= b.e.c && a.e.c >= b.s.c;
  };

  return (
    <div className="app">
      <Sidebar
        files={files}
        activeFileId={activeFileId}
        onFileSelect={handleFileSelect}
        onFilesChange={loadFiles}
      />
      <div className="app-main">
        <Toolbar
          fileName={activeFile?.originalName}
          onAddRow={handleAddRow}
          onAddColumn={handleAddColumn}
          onToggleInsights={() => setIsInsightsOpen(prev => !prev)}
          isInsightsOpen={isInsightsOpen}
        />
        <FormatBar
          style={selectionStyle}
          frozenRows={frozenRows}
          frozenCols={frozenCols}
          filterActive={filterActive}
          hasSelection={!!activeFileId && !!activeSheet}
          disabled={!activeFileId || !activeSheet}
          onFormat={handleFormat}
          onSort={handleSort}
          onToggleFilter={handleToggleFilter}
          onFreeze={handleFreeze}
          onMergeCells={handleMergeCells}
          onClearFormat={handleClearFormat}
          onInsertChart={handleInsertChart}
          onCondFormat={handleCondFormat}
          onDataValidation={handleDataValidation}
          onAutoSum={handleAutoSum}
        />
        <FormulaBar
          activeCellRef={formulaState.ref}
          value={formulaState.value}
          readOnly={!activeFileId || !activeSheet}
          onChange={(val) => spreadsheetRef.current?.handleFormulaChange(val)}
          onFocus={() => spreadsheetRef.current?.handleFormulaFocus()}
          onKeyDown={(e) => spreadsheetRef.current?.handleFormulaKeyDown(e)}
        />
        {workbookData && (
          <SheetTabs
            sheets={workbookData.sheets}
            activeSheet={activeSheet}
            onSheetSelect={handleSheetSelect}
            onAddSheet={handleAddSheet}
            onRenameSheet={handleRenameSheet}
            onDeleteSheet={handleDeleteSheet}
            onDuplicateSheet={handleDuplicateSheet}
          />
        )}
        <div className="app-content">
          {isLoading ? (
            <div className="loading-overlay">
              <div className="spinner spinner-lg" />
              <p>Loading workbook...</p>
            </div>
          ) : (
            <Spreadsheet
              ref={spreadsheetRef}
              fileId={activeFileId}
              sheetData={activeSheetData}
              activeSheet={activeSheet}
              onDataChange={handleSheetDataChange}
              extraCols={extraCols}
              onFormulaStateChange={setFormulaState}
              onSelectionStyleChange={setSelectionStyle}
              onFreezeChange={(fr, fc) => { setFrozenRows(fr); setFrozenCols(fc); }}
              onFilterChange={setFilterActive}
              onSelectionRangeChange={setSelRange}
              zoom={zoom}
            />
          )}
          <InsightsPanel
            isOpen={isInsightsOpen}
            fileId={activeFileId}
            sheetData={activeSheetData}
            activeSheet={activeSheet}
            onDataChange={handleSheetDataChange}
          />
        </div>
        <StatusBar
          selRange={selRange}
          getCellValue={(r, c) => spreadsheetRef.current?.getCellValue(r, c)}
          zoom={zoom}
          onZoomChange={setZoom}
          activeSheet={activeSheet}
          sheetData={activeSheetData}
        />
      </div>

      <ChartModal
        isOpen={chartModalOpen}
        onClose={() => setChartModalOpen(false)}
        rawData={activeSheetData?.data}
        selRange={selRange}
      />

      <ConditionalFormatDialog
        isOpen={cfDialogOpen}
        onClose={() => setCfDialogOpen(false)}
        selRange={selRange}
        existingRules={activeSheetData?.conditionalFormats || []}
        onSave={handleSaveCondFormats}
      />

      <DataValidationDialog
        isOpen={dvDialogOpen}
        onClose={() => setDvDialogOpen(false)}
        selRange={selRange}
        existingRule={null}
        onSave={handleSaveDataValidation}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
