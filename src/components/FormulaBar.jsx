
import React from 'react';

function parseAddress(addr) {
  const m = addr.toUpperCase().trim().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
  col -= 1;
  const row = parseInt(m[2]) - 1;
  if (row < 0 || col < 0) return null;
  return { row, col };
}

export default function FormulaBar({
  activeCellRef,
  value,
  onChange,
  onFocus,
  onKeyDown,
  onCellRefSubmit,
  readOnly
}) {
  const [nameBoxValue, setNameBoxValue] = React.useState(activeCellRef || '');
  const [nameBoxEditing, setNameBoxEditing] = React.useState(false);

  React.useEffect(() => {
    if (!nameBoxEditing) setNameBoxValue(activeCellRef || '');
  }, [activeCellRef, nameBoxEditing]);

  const handleNameBoxFocus = (e) => {
    setNameBoxEditing(true);
    e.target.select();
  };

  const handleNameBoxBlur = () => {
    setNameBoxEditing(false);
    setNameBoxValue(activeCellRef || '');
  };

  const handleNameBoxKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const parsed = parseAddress(nameBoxValue);
      if (parsed && onCellRefSubmit) {
        onCellRefSubmit(parsed.row, parsed.col);
      }
      setNameBoxEditing(false);
      e.target.blur();
    } else if (e.key === 'Escape') {
      setNameBoxEditing(false);
      setNameBoxValue(activeCellRef || '');
      e.target.blur();
    }
  };

  return (
    <div className="formula-bar">
      <input
        className="formula-bar-ref name-box"
        value={nameBoxValue}
        onChange={(e) => setNameBoxValue(e.target.value)}
        onFocus={handleNameBoxFocus}
        onBlur={handleNameBoxBlur}
        onKeyDown={handleNameBoxKeyDown}
        spellCheck={false}
        title="Cell Reference — type an address (e.g. B15) and press Enter to navigate"
      />
      <div className="formula-bar-fx">fx</div>
      <input
        className="formula-bar-input"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        readOnly={readOnly}
        spellCheck={false}
        placeholder={readOnly ? 'Select a cell to edit' : ''}
        id="formula-bar-input"
      />
    </div>
  );
}
