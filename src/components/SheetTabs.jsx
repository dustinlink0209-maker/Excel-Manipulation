import React from 'react';

export default function SheetTabs({ sheets, activeSheet, onSheetSelect, onAddSheet, onRenameSheet, onDeleteSheet, onDuplicateSheet }) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [newSheetName, setNewSheetName] = React.useState('');
  const [renamingTab, setRenamingTab] = React.useState(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [tabMenu, setTabMenu] = React.useState(null); // { name, x, y }
  const addInputRef = React.useRef(null);
  const renameInputRef = React.useRef(null);

  React.useEffect(() => { if (isAdding && addInputRef.current) addInputRef.current.focus(); }, [isAdding]);
  React.useEffect(() => {
    if (renamingTab && renameInputRef.current) { renameInputRef.current.focus(); renameInputRef.current.select(); }
  }, [renamingTab]);

  // Close tab menu on outside click
  React.useEffect(() => {
    if (!tabMenu) return;
    const handler = () => setTabMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [tabMenu]);

  const handleAdd = () => {
    const name = newSheetName.trim() || `Sheet${sheets.length + 1}`;
    onAddSheet(name);
    setNewSheetName('');
    setIsAdding(false);
  };

  const startRename = (name) => { setRenamingTab(name); setRenameValue(name); };
  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== renamingTab) onRenameSheet(renamingTab, trimmed);
    setRenamingTab(null);
    setRenameValue('');
  };
  const cancelRename = () => { setRenamingTab(null); setRenameValue(''); };

  if (!sheets || sheets.length === 0) return null;

  return (
    <div className="sheet-tabs">
      {sheets.map(sheet => (
        <div
          key={sheet.name}
          className={`sheet-tab ${sheet.name === activeSheet ? 'active' : ''}`}
          onClick={() => !renamingTab && onSheetSelect(sheet.name)}
          onDoubleClick={() => sheet.name === activeSheet && startRename(sheet.name)}
          onContextMenu={(e) => { e.preventDefault(); setTabMenu({ name: sheet.name, x: e.clientX, y: e.clientY }); }}
          title="Double-click to rename, right-click for options"
        >
          {renamingTab === sheet.name ? (
            <input
              ref={renameInputRef}
              className="sheet-tab-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') cancelRename(); }}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            sheet.name
          )}
        </div>
      ))}

      {isAdding ? (
        <div className="sheet-tab" style={{ padding: '4px 8px' }}>
          <input
            ref={addInputRef}
            className="form-input"
            style={{ width: '120px', padding: '2px 6px', fontSize: 'var(--font-xs)', height: '22px' }}
            value={newSheetName}
            onChange={(e) => setNewSheetName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
            onBlur={handleAdd}
            placeholder="Sheet name"
          />
        </div>
      ) : (
        <div className="sheet-tab-add" onClick={() => setIsAdding(true)} title="Add sheet">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      )}

      {/* Tab context menu */}
      {tabMenu && (
        <div
          className="tab-context-menu"
          style={{ left: tabMenu.x, top: tabMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="tab-menu-item" onClick={() => { startRename(tabMenu.name); setTabMenu(null); }}>Rename</div>
          <div className="tab-menu-item" onClick={() => { onDuplicateSheet?.(tabMenu.name); setTabMenu(null); }}>Duplicate</div>
          <div className="tab-menu-item tab-menu-item-danger" onClick={() => { onDeleteSheet?.(tabMenu.name); setTabMenu(null); }}>Delete</div>
        </div>
      )}
    </div>
  );
}
