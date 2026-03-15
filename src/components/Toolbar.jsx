import React from 'react';

export default function Toolbar({ fileName, onAddRow, onAddColumn, onToggleInsights, isInsightsOpen, onFind, onShortcuts }) {
  return (
    <div className="toolbar">
      <div className="toolbar-filename">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        {fileName || 'No file selected'}
      </div>

      <div className="toolbar-spacer" />

      {fileName && (
        <>
          <div className="toolbar-group">
            <button className="btn btn-secondary btn-sm" onClick={onAddRow} title="Add new row" id="btn-add-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Row
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onAddColumn} title="Add new column" id="btn-add-column">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Col
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button
              className="btn btn-secondary btn-sm btn-icon"
              onClick={onFind}
              title="Find (Ctrl+F)"
              id="btn-find"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            <button
              className={`btn btn-sm ${isInsightsOpen ? 'btn-insights-active' : 'btn-secondary'}`}
              onClick={onToggleInsights}
              title="Toggle Insights Panel"
              id="btn-toggle-insights"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <path d="M8 11h6" />
                <path d="M11 8v6" />
              </svg>
              Insights
            </button>
            <button
              className="btn btn-secondary btn-sm btn-icon"
              onClick={onShortcuts}
              title="Keyboard Shortcuts (Ctrl+?)"
              id="btn-shortcuts"
            >
              ?
            </button>
          </div>
        </>
      )}
    </div>
  );
}
