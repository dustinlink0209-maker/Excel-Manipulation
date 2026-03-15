import React from 'react';

export default function ContextMenu({ x, y, items, onClose }) {
  const menuRef = React.useRef(null);

  // Close on outside click or Escape
  React.useEffect(() => {
    const handleDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Keep menu inside viewport
  React.useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth)
      menuRef.current.style.left = `${window.innerWidth - rect.width - 6}px`;
    if (rect.bottom > window.innerHeight)
      menuRef.current.style.top = `${window.innerHeight - rect.height - 6}px`;
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ position: 'fixed', top: y, left: x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === 'divider' ? (
          <div key={i} className="context-menu-divider" />
        ) : (
          <button
            key={i}
            className="context-menu-item"
            onClick={() => { item.action(); onClose(); }}
            disabled={item.disabled}
          >
            <span className="context-menu-icon">{item.icon}</span>
            <span className="context-menu-label">{item.label}</span>
            {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
}
