import React from 'react';

const RULE_TYPES = [
  { id: 'greaterThan',  label: 'Greater Than',      vals: 1 },
  { id: 'lessThan',     label: 'Less Than',          vals: 1 },
  { id: 'between',      label: 'Between',            vals: 2 },
  { id: 'equal',        label: 'Equal To',           vals: 1 },
  { id: 'contains',     label: 'Text Contains',      vals: 1 },
  { id: 'notEmpty',     label: 'Not Empty',          vals: 0 },
  { id: 'empty',        label: 'Empty',              vals: 0 },
  { id: 'duplicate',    label: 'Duplicate Values',   vals: 0 },
  { id: 'top10',        label: 'Top 10 Values',      vals: 0 },
  { id: 'aboveAvg',     label: 'Above Average',      vals: 0 },
  { id: 'belowAvg',     label: 'Below Average',      vals: 0 },
];

const PRESET_STYLES = [
  { label: 'Red Fill',    style: { bgColor: '#fca5a5', color: '#7f1d1d' } },
  { label: 'Yellow Fill', style: { bgColor: '#fde68a', color: '#78350f' } },
  { label: 'Green Fill',  style: { bgColor: '#bbf7d0', color: '#14532d' } },
  { label: 'Blue Fill',   style: { bgColor: '#bfdbfe', color: '#1e3a8a' } },
  { label: 'Red Text',    style: { color: '#ef4444', bold: true } },
  { label: 'Green Text',  style: { color: '#22c55e', bold: true } },
  { label: 'Bold',        style: { bold: true } },
];

function RuleRow({ rule, index, onChange, onDelete }) {
  const typeDef = RULE_TYPES.find(t => t.id === rule.type) || RULE_TYPES[0];

  return (
    <div className="cf-rule-row">
      <div className="cf-rule-left">
        <select
          className="form-input cf-select"
          value={rule.type}
          onChange={e => onChange(index, 'type', e.target.value)}
        >
          {RULE_TYPES.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>

        {typeDef.vals >= 1 && (
          <input
            className="form-input cf-input"
            type="text"
            placeholder="Value 1"
            value={rule.value1 || ''}
            onChange={e => onChange(index, 'value1', e.target.value)}
          />
        )}
        {typeDef.vals >= 2 && (
          <>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>and</span>
            <input
              className="form-input cf-input"
              type="text"
              placeholder="Value 2"
              value={rule.value2 || ''}
              onChange={e => onChange(index, 'value2', e.target.value)}
            />
          </>
        )}
      </div>

      <div className="cf-rule-right">
        <select
          className="form-input cf-select-sm"
          value={JSON.stringify(rule.style || {})}
          onChange={e => onChange(index, 'style', JSON.parse(e.target.value))}
        >
          {PRESET_STYLES.map(ps => (
            <option key={ps.label} value={JSON.stringify(ps.style)}>{ps.label}</option>
          ))}
        </select>

        {/* Preview */}
        <div
          className="cf-style-preview"
          style={{
            backgroundColor: rule.style?.bgColor || 'transparent',
            color: rule.style?.color || 'var(--text-primary)',
            fontWeight: rule.style?.bold ? 'bold' : 'normal',
          }}
        >
          AaBbCc
        </div>

        <button className="btn btn-danger btn-icon btn-sm" onClick={() => onDelete(index)} title="Remove rule">✕</button>
      </div>
    </div>
  );
}

export default function ConditionalFormatDialog({ isOpen, onClose, selRange, existingRules = [], onSave }) {
  const [rules, setRules] = React.useState(existingRules);

  React.useEffect(() => {
    if (isOpen) setRules(existingRules.length ? existingRules : []);
  }, [isOpen]);

  if (!isOpen) return null;

  const addRule = () => {
    setRules(prev => [...prev, {
      type: 'greaterThan',
      value1: '0',
      value2: '',
      style: PRESET_STYLES[0].style,
      range: selRange ? { s: { r: selRange.minRow, c: selRange.minCol }, e: { r: selRange.maxRow, c: selRange.maxCol } } : null,
    }]);
  };

  const updateRule = (index, field, value) => {
    setRules(prev => prev.map((r, i) => {
      if (i !== index) return r;
      if (field === 'style') return { ...r, style: value };
      return { ...r, [field]: value };
    }));
  };

  const deleteRule = (index) => setRules(prev => prev.filter((_, i) => i !== index));

  const handleSave = () => {
    const withRanges = rules.map(r => ({
      ...r,
      range: r.range || (selRange ? { s: { r: selRange.minRow, c: selRange.minCol }, e: { r: selRange.maxRow, c: selRange.maxCol } } : null),
    }));
    onSave(withRanges);
    onClose();
  };

  const rangeStr = selRange
    ? `Applies to: rows ${selRange.minRow + 1}–${selRange.maxRow + 1}, cols ${selRange.minCol + 1}–${selRange.maxCol + 1}`
    : 'No range selected';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="cf-dialog" onClick={e => e.stopPropagation()}>
        <div className="cf-dialog-header">
          <h2>Conditional Formatting</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="cf-dialog-range">{rangeStr}</div>

        <div className="cf-dialog-body">
          {rules.length === 0 && (
            <div className="cf-empty">
              <p>No rules defined. Add a rule to highlight cells based on their values.</p>
            </div>
          )}

          {rules.map((rule, i) => (
            <RuleRow
              key={i}
              rule={rule}
              index={i}
              onChange={updateRule}
              onDelete={deleteRule}
            />
          ))}

          <button className="btn btn-secondary btn-sm" onClick={addRule} style={{ marginTop: 8 }}>
            + Add Rule
          </button>
        </div>

        <div className="cf-dialog-footer">
          <button className="btn btn-secondary" onClick={() => { setRules([]); onSave([]); onClose(); }}>
            Clear All
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}
