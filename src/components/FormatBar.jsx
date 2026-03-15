import React from 'react';

const FONTS = ['Calibri', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS', 'Impact'];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36, 48, 72];
const BORDER_STYLES = [
  { id: 'all', label: 'All Borders' },
  { id: 'outer', label: 'Outside Borders' },
  { id: 'thick-outer', label: 'Thick Outside Borders' },
  { id: 'inner', label: 'Inside Borders' },
  { id: 'none', label: 'No Border' },
  { id: 'top', label: 'Top Border' },
  { id: 'bottom', label: 'Bottom Border' },
  { id: 'left', label: 'Left Border' },
  { id: 'right', label: 'Right Border' },
  { id: 'top-bottom', label: 'Top and Bottom' },
  { id: 'double-bottom', label: 'Bottom Double Border' },
  { id: 'thick-bottom', label: 'Thick Bottom Border' },
];
const NUM_FORMATS = [
  { id: 'General', label: 'General' },
  { id: '0', label: 'Number (0)' },
  { id: '0.00', label: 'Number (0.00)' },
  { id: '#,##0', label: 'Number (1,000)' },
  { id: '#,##0.00', label: 'Number (1,000.00)' },
  { id: '$#,##0.00', label: 'Currency' },
  { id: '_($#,##0.00)', label: 'Accounting' },
  { id: '0%', label: 'Percentage (0%)' },
  { id: '0.00%', label: 'Percentage (0.00%)' },
  { id: '0.00E+00', label: 'Scientific' },
  { id: 'MM/DD/YYYY', label: 'Date Short' },
  { id: 'MMMM DD, YYYY', label: 'Date Long' },
  { id: 'MM/DD/YYYY HH:MM', label: 'Date Time' },
  { id: 'HH:MM:SS', label: 'Time' },
  { id: '#?/?', label: 'Fraction' },
  { id: '@', label: 'Text' },
];

function ColorPicker({ value, onChange, title }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  const PRESETS = [
    '#000000','#ffffff','#ff0000','#00b050','#0070c0','#ffc000','#7030a0','#ff7f00',
    '#c00000','#70ad47','#4472c4','#ed7d31','#a5a5a5','#ffd966','#5b9bd5','#70ad47',
    '#404040','#808080','#bfbfbf','#d9d9d9','#f2f2f2','#dae3f3','#fce4d6','#e2efda',
    '#c6efce','#ffeb9c','#9b2335','#1f4e79','#375623','#833c00','#3f3151','#984807',
  ];

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="fb-colorpicker" ref={ref}>
      <button className="fb-colorpicker-btn" title={title} onClick={() => setOpen(o => !o)}>
        <div className="fb-colorpicker-swatch" style={{ backgroundColor: value || 'transparent', border: !value ? '1px dashed #666' : 'none' }} />
        <span className="fb-chevron">▾</span>
      </button>
      {open && (
        <div className="fb-colorpicker-popup">
          <div className="fb-colorpicker-none">
            <button onClick={() => { onChange(null); setOpen(false); }}>No Color</button>
          </div>
          <div className="fb-colorpicker-grid">
            {PRESETS.map(c => (
              <button
                key={c}
                className={`fb-colorpicker-cell ${value === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => { onChange(c); setOpen(false); }}
                title={c}
              />
            ))}
          </div>
          <div className="fb-colorpicker-custom">
            <label>Custom:
              <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function Dropdown({ trigger, children, className = '' }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={`fb-dropdown ${className}`} ref={ref}>
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && <div className="fb-dropdown-menu" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}

export default function FormatBar({
  style = {},
  frozenRows = 0,
  frozenCols = 0,
  filterActive = false,
  hasSelection = false,
  onFormat,
  onSort,
  onToggleFilter,
  onFreeze,
  onMergeCells,
  onInsertChart,
  onClearFormat,
  onCondFormat,
  onDataValidation,
  onAutoSum,
  disabled = false,
}) {
  const [fontFamily, setFontFamily] = React.useState(style.fontFamily || 'Calibri');
  const [fontSize, setFontSize] = React.useState(style.fontSize || 11);
  const [fontSizeInput, setFontSizeInput] = React.useState(String(style.fontSize || 11));

  // Sync from selection
  React.useEffect(() => {
    setFontFamily(style.fontFamily || 'Calibri');
    setFontSize(style.fontSize || 11);
    setFontSizeInput(String(style.fontSize || 11));
  }, [style.fontFamily, style.fontSize]);

  const apply = (delta) => { if (!disabled && onFormat) onFormat(delta); };

  const applyBorder = (borderStyle) => {
    const thin = { style: 'thin', color: '#000000' };
    const thick = { style: 'thick', color: '#000000' };
    const double = { style: 'double', color: '#000000' };
    const borders = {
      'all':          { top: thin, right: thin, bottom: thin, left: thin },
      'outer':        { top: thin, right: thin, bottom: thin, left: thin, inner: false },
      'thick-outer':  { top: thick, right: thick, bottom: thick, left: thick, inner: false },
      'inner':        { inner: thin },
      'none':         { top: null, right: null, bottom: null, left: null },
      'top':          { top: thin },
      'bottom':       { bottom: thin },
      'left':         { left: thin },
      'right':        { right: thin },
      'top-bottom':   { top: thin, bottom: thin },
      'double-bottom':{ bottom: double },
      'thick-bottom': { bottom: thick },
    }[borderStyle] || {};
    apply({ borders });
  };

  const isActive = (key, val = true) => style[key] === val;

  const freezeLabel = frozenRows > 0 || frozenCols > 0
    ? `Freeze: ${frozenRows}R/${frozenCols}C`
    : 'Freeze Panes';

  return (
    <div className={`format-bar ${disabled ? 'format-bar-disabled' : ''}`}>
      {/* ── Font ── */}
      <div className="fb-group">
        <span className="fb-group-label">Font</span>
        <div className="fb-group-controls">
          <Dropdown
            className="fb-font-family-dd"
            trigger={
              <button className="fb-select" title="Font Family" style={{ fontFamily }}>
                <span>{fontFamily}</span>
                <span className="fb-chevron">▾</span>
              </button>
            }
          >
            {FONTS.map(f => (
              <div
                key={f}
                className={`fb-menu-item ${fontFamily === f ? 'active' : ''}`}
                style={{ fontFamily: f }}
                onClick={() => { setFontFamily(f); apply({ fontFamily: f }); }}
              >{f}</div>
            ))}
          </Dropdown>

          <div className="fb-font-size">
            <input
              className="fb-size-input"
              type="text"
              value={fontSizeInput}
              onChange={e => setFontSizeInput(e.target.value)}
              onBlur={() => {
                const n = parseInt(fontSizeInput);
                if (!isNaN(n) && n > 0 && n <= 400) { setFontSize(n); apply({ fontSize: n }); }
                else setFontSizeInput(String(fontSize));
              }}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
              title="Font Size"
            />
            <div className="fb-size-arrows">
              <button onClick={() => { const n = fontSize + 1; setFontSize(n); setFontSizeInput(String(n)); apply({ fontSize: n }); }} title="Increase Font Size">▲</button>
              <button onClick={() => { const n = Math.max(1, fontSize - 1); setFontSize(n); setFontSizeInput(String(n)); apply({ fontSize: n }); }} title="Decrease Font Size">▼</button>
            </div>
          </div>

          <button className={`fb-btn ${isActive('bold') ? 'fb-btn-active' : ''}`} onClick={() => apply({ bold: !style.bold })} title="Bold (Ctrl+B)"><b>B</b></button>
          <button className={`fb-btn ${isActive('italic') ? 'fb-btn-active' : ''}`} onClick={() => apply({ italic: !style.italic })} title="Italic (Ctrl+I)"><i>I</i></button>
          <button className={`fb-btn ${isActive('underline') ? 'fb-btn-active' : ''}`} onClick={() => apply({ underline: !style.underline })} title="Underline (Ctrl+U)" style={{ textDecoration: 'underline' }}>U</button>
          <button className={`fb-btn ${isActive('strike') ? 'fb-btn-active' : ''}`} onClick={() => apply({ strike: !style.strike })} title="Strikethrough" style={{ textDecoration: 'line-through' }}>S</button>

          <div className="fb-color-group" title="Text Color">
            <button className="fb-btn fb-color-label" onClick={() => apply({ color: style.color || '#000000' })}>A</button>
            <div className="fb-color-bar" style={{ backgroundColor: style.color || '#000000' }} />
            <ColorPicker value={style.color} onChange={c => apply({ color: c })} title="Text Color" />
          </div>

          <div className="fb-color-group" title="Fill Color">
            <button className="fb-btn fb-color-label" style={{ backgroundColor: style.bgColor || 'transparent' }} onClick={() => apply({ bgColor: style.bgColor })}>
              <span style={{ color: style.bgColor ? '#000' : 'inherit' }}>◩</span>
            </button>
            <div className="fb-color-bar" style={{ backgroundColor: style.bgColor || 'transparent', border: !style.bgColor ? '1px dashed #666' : 'none' }} />
            <ColorPicker value={style.bgColor} onChange={c => apply({ bgColor: c })} title="Fill Color" />
          </div>

          <Dropdown
            trigger={<button className="fb-btn" title="Borders">⊞ <span className="fb-chevron">▾</span></button>}
          >
            {BORDER_STYLES.map(b => (
              <div key={b.id} className="fb-menu-item" onClick={() => applyBorder(b.id)}>{b.label}</div>
            ))}
          </Dropdown>
        </div>
      </div>

      <div className="fb-separator" />

      {/* ── Align ── */}
      <div className="fb-group">
        <span className="fb-group-label">Align</span>
        <div className="fb-group-controls">
          <button className={`fb-btn ${isActive('align', 'left') ? 'fb-btn-active' : ''}`} onClick={() => apply({ align: 'left' })} title="Align Left">≡</button>
          <button className={`fb-btn ${isActive('align', 'center') ? 'fb-btn-active' : ''}`} onClick={() => apply({ align: 'center' })} title="Center">≡</button>
          <button className={`fb-btn ${isActive('align', 'right') ? 'fb-btn-active' : ''}`} onClick={() => apply({ align: 'right' })} title="Align Right">≡</button>
          <button className={`fb-btn ${isActive('valign', 'top') ? 'fb-btn-active' : ''}`} onClick={() => apply({ valign: 'top' })} title="Top Align">⊤</button>
          <button className={`fb-btn ${isActive('valign', 'middle') ? 'fb-btn-active' : ''}`} onClick={() => apply({ valign: 'middle' })} title="Middle Align">⊢</button>
          <button className={`fb-btn ${isActive('valign', 'bottom') ? 'fb-btn-active' : ''}`} onClick={() => apply({ valign: 'bottom' })} title="Bottom Align">⊥</button>
          <button className={`fb-btn ${isActive('wrap') ? 'fb-btn-active' : ''}`} onClick={() => apply({ wrap: !style.wrap })} title="Wrap Text">↵</button>
          <Dropdown
            trigger={<button className="fb-btn" title="Merge Cells">⊞M <span className="fb-chevron">▾</span></button>}
          >
            <div className="fb-menu-item" onClick={() => onMergeCells?.('merge-center')}>Merge & Center</div>
            <div className="fb-menu-item" onClick={() => onMergeCells?.('merge')}>Merge Cells</div>
            <div className="fb-menu-item" onClick={() => onMergeCells?.('merge-across')}>Merge Across</div>
            <div className="fb-menu-item" onClick={() => onMergeCells?.('unmerge')}>Unmerge Cells</div>
          </Dropdown>
        </div>
      </div>

      <div className="fb-separator" />

      {/* ── Number ── */}
      <div className="fb-group">
        <span className="fb-group-label">Number</span>
        <div className="fb-group-controls">
          <Dropdown
            className="fb-numfmt-dd"
            trigger={
              <button className="fb-select" title="Number Format">
                <span>{NUM_FORMATS.find(f => f.id === (style.numFmt || 'General'))?.label || 'General'}</span>
                <span className="fb-chevron">▾</span>
              </button>
            }
          >
            {NUM_FORMATS.map(f => (
              <div key={f.id} className={`fb-menu-item ${(style.numFmt || 'General') === f.id ? 'active' : ''}`} onClick={() => apply({ numFmt: f.id })}>
                {f.label}
              </div>
            ))}
          </Dropdown>
        </div>
      </div>

      <div className="fb-separator" />

      {/* ── Data ── */}
      <div className="fb-group">
        <span className="fb-group-label">Data</span>
        <div className="fb-group-controls">
          <button className="fb-btn" onClick={() => onSort?.('asc')} title="Sort A→Z" disabled={!hasSelection}>A↑</button>
          <button className="fb-btn" onClick={() => onSort?.('desc')} title="Sort Z→A" disabled={!hasSelection}>Z↓</button>
          <button
            className={`fb-btn ${filterActive ? 'fb-btn-active' : ''}`}
            onClick={onToggleFilter}
            title="Toggle Auto-Filter"
            disabled={!hasSelection}
          >▽</button>
          <Dropdown
            trigger={<button className="fb-btn" title="Freeze Panes">❄ <span className="fb-chevron">▾</span></button>}
          >
            <div className="fb-menu-item" onClick={() => onFreeze?.('row')}>Freeze Top Row</div>
            <div className="fb-menu-item" onClick={() => onFreeze?.('col')}>Freeze First Column</div>
            <div className="fb-menu-item" onClick={() => onFreeze?.('both')}>Freeze Rows & Columns</div>
            <div className="fb-menu-item" onClick={() => onFreeze?.('none')}>Unfreeze All</div>
          </Dropdown>
        </div>
      </div>

      <div className="fb-separator" />

      {/* ── Tools ── */}
      <div className="fb-group">
        <span className="fb-group-label">Tools</span>
        <div className="fb-group-controls">
          <button className="fb-btn fb-autosum" onClick={onAutoSum} title="AutoSum (detect SUM range)" disabled={!hasSelection}>Σ</button>
          <button className="fb-btn" onClick={onInsertChart} title="Insert Chart" disabled={!hasSelection}>📊</button>
          <button className="fb-btn" onClick={onCondFormat} title="Conditional Formatting" disabled={!hasSelection}>🎨CF</button>
          <button className="fb-btn" onClick={onDataValidation} title="Data Validation" disabled={!hasSelection}>✔DV</button>
          <button className="fb-btn" onClick={onClearFormat} title="Clear Formatting" disabled={!hasSelection}>✕Fmt</button>
        </div>
      </div>
    </div>
  );
}
