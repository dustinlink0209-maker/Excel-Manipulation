import React from 'react';

export default function FindReplace({ isOpen, mode, data, onClose, onNavigate, onReplaceAll }) {
  const [findText, setFindText] = React.useState('');
  const [replaceText, setReplaceText] = React.useState('');
  const [matchCase, setMatchCase] = React.useState(false);
  const [activeMode, setActiveMode] = React.useState(mode);
  const [results, setResults] = React.useState([]);
  const [resultIdx, setResultIdx] = React.useState(-1);
  const findInputRef = React.useRef(null);

  React.useEffect(() => {
    if (isOpen) {
      setActiveMode(mode);
      setResults([]);
      setResultIdx(-1);
      setTimeout(() => findInputRef.current?.focus(), 0);
    }
  }, [isOpen, mode]);

  const buildResults = React.useCallback((text, cased) => {
    if (!text || !data?.length) return [];
    const search = cased ? text : text.toLowerCase();
    const matches = [];
    data.forEach((row, r) => {
      (row || []).forEach((cell, c) => {
        const val = cased ? String(cell ?? '') : String(cell ?? '').toLowerCase();
        if (val.includes(search)) matches.push({ row: r, col: c });
      });
    });
    return matches;
  }, [data]);

  const handleFindNext = (dir = 1) => {
    const matches = buildResults(findText, matchCase);
    if (!matches.length) { setResults([]); setResultIdx(-1); return; }
    setResults(matches);
    const next = resultIdx < 0
      ? 0
      : (resultIdx + dir + matches.length) % matches.length;
    setResultIdx(next);
    onNavigate(matches[next].row, matches[next].col);
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    onReplaceAll(findText, replaceText, matchCase);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    if (e.key === 'Enter') { e.preventDefault(); handleFindNext(1); }
  };

  const count = results.length;
  const current = resultIdx >= 0 ? resultIdx + 1 : 0;

  if (!isOpen) return null;

  return (
    <div className="find-replace-dialog" onKeyDown={handleKeyDown}>
      <div className="find-replace-header">
        <div className="find-replace-tabs">
          <button
            className={activeMode === 'find' ? 'active' : ''}
            onClick={() => setActiveMode('find')}
          >Find</button>
          <button
            className={activeMode === 'replace' ? 'active' : ''}
            onClick={() => setActiveMode('replace')}
          >Replace</button>
        </div>
        <button className="find-replace-close" onClick={onClose} title="Close (Esc)">✕</button>
      </div>

      <div className="find-replace-body">
        <div className="find-replace-row">
          <label>Find</label>
          <input
            ref={findInputRef}
            className="form-input"
            value={findText}
            onChange={(e) => { setFindText(e.target.value); setResults([]); setResultIdx(-1); }}
            placeholder="Search..."
            spellCheck={false}
          />
        </div>

        {activeMode === 'replace' && (
          <div className="find-replace-row">
            <label>Replace</label>
            <input
              className="form-input"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with..."
              spellCheck={false}
            />
          </div>
        )}

        <div className="find-replace-options">
          <label className="find-replace-check">
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(e) => { setMatchCase(e.target.checked); setResults([]); setResultIdx(-1); }}
            />
            Match case
          </label>
          {count > 0 && findText && (
            <span className="find-replace-count">{current} / {count}</span>
          )}
          {findText && count === 0 && results !== [] && (
            <span className="find-replace-no-results">No results</span>
          )}
        </div>

        <div className="find-replace-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => handleFindNext(-1)} disabled={!findText}>
            &#8593; Prev
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => handleFindNext(1)} disabled={!findText}>
            &#8595; Next
          </button>
          {activeMode === 'replace' && (
            <button className="btn btn-secondary btn-sm" onClick={handleReplaceAll} disabled={!findText}>
              Replace All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
