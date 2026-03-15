import React from 'react';

const SHORTCUTS = [
  {
    group: 'Navigation',
    items: [
      { keys: ['Arrow Keys'], desc: 'Move active cell' },
      { keys: ['Ctrl', 'Arrow'], desc: 'Jump to edge of data region' },
      { keys: ['Ctrl', 'Home'], desc: 'Go to cell A1' },
      { keys: ['Ctrl', 'End'], desc: 'Go to last used cell' },
      { keys: ['Page Up / Down'], desc: 'Move 20 rows up/down' },
      { keys: ['Home'], desc: 'Go to first column in row' },
      { keys: ['End'], desc: 'Go to last column in row' },
      { keys: ['Name Box'], desc: 'Type address (e.g. B15) + Enter to jump' },
    ],
  },
  {
    group: 'Selection',
    items: [
      { keys: ['Shift', 'Arrow'], desc: 'Extend selection' },
      { keys: ['Ctrl', 'A'], desc: 'Select all cells' },
      { keys: ['Click column header'], desc: 'Select entire column' },
      { keys: ['Click row number'], desc: 'Select entire row' },
      { keys: ['Shift', 'Click'], desc: 'Extend selection to cell' },
    ],
  },
  {
    group: 'Editing',
    items: [
      { keys: ['Enter / F2'], desc: 'Start editing active cell' },
      { keys: ['Escape'], desc: 'Cancel edit' },
      { keys: ['Delete / Backspace'], desc: 'Clear cell contents' },
      { keys: ['Tab'], desc: 'Move right (or left with Shift)' },
      { keys: ['Ctrl', 'Z'], desc: 'Undo' },
      { keys: ['Ctrl', 'Y'], desc: 'Redo' },
      { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Redo (alternate)' },
    ],
  },
  {
    group: 'Clipboard',
    items: [
      { keys: ['Ctrl', 'C'], desc: 'Copy selection' },
      { keys: ['Ctrl', 'X'], desc: 'Cut selection' },
      { keys: ['Ctrl', 'V'], desc: 'Paste' },
      { keys: ['Ctrl', 'Shift', 'V'], desc: 'Paste Special…' },
    ],
  },
  {
    group: 'Formatting',
    items: [
      { keys: ['Ctrl', 'B'], desc: 'Bold' },
      { keys: ['Ctrl', 'I'], desc: 'Italic' },
      { keys: ['Ctrl', 'U'], desc: 'Underline' },
    ],
  },
  {
    group: 'Find & Tools',
    items: [
      { keys: ['Ctrl', 'F'], desc: 'Find' },
      { keys: ['Ctrl', 'H'], desc: 'Find & Replace' },
      { keys: ['Ctrl', '?'], desc: 'Show this shortcuts reference' },
    ],
  },
];

export default function ShortcutsModal({ isOpen, onClose }) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay shortcuts-modal-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="shortcuts-modal-body">
          {SHORTCUTS.map((group) => (
            <div key={group.group} className="shortcuts-group">
              <div className="shortcuts-group-title">{group.group}</div>
              <div className="shortcuts-list">
                {group.items.map((item, i) => (
                  <div key={i} className="shortcuts-row">
                    <span className="shortcuts-desc">{item.desc}</span>
                    <span className="shortcuts-keys">
                      {item.keys.map((k, ki) => (
                        <React.Fragment key={ki}>
                          <kbd>{k}</kbd>
                          {ki < item.keys.length - 1 && <span className="key-plus">+</span>}
                        </React.Fragment>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
