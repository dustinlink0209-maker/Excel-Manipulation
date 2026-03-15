import React from 'react';

const RULE_TYPES = [
  { id: 'any',          label: 'Any Value',         vals: 0 },
  { id: 'whole',        label: 'Whole Number',       vals: 2, numericOps: true },
  { id: 'decimal',      label: 'Decimal',            vals: 2, numericOps: true },
  { id: 'list',         label: 'List',               vals: 'list' },
  { id: 'date',         label: 'Date',               vals: 2, numericOps: true },
  { id: 'time',         label: 'Time',               vals: 2, numericOps: true },
  { id: 'textLength',   label: 'Text Length',        vals: 2, numericOps: true },
  { id: 'custom',       label: 'Custom Formula',     vals: 'formula' },
];

const OPERATORS = [
  { id: 'between',         label: 'between' },
  { id: 'notBetween',      label: 'not between' },
  { id: 'equal',           label: 'equal to' },
  { id: 'notEqual',        label: 'not equal to' },
  { id: 'greaterThan',     label: 'greater than' },
  { id: 'lessThan',        label: 'less than' },
  { id: 'greaterOrEqual',  label: 'greater than or equal to' },
  { id: 'lessOrEqual',     label: 'less than or equal to' },
];

const ALERT_STYLES = [
  { id: 'stop',        label: 'Stop',        icon: '⛔' },
  { id: 'warning',     label: 'Warning',     icon: '⚠️' },
  { id: 'information', label: 'Information', icon: 'ℹ️' },
];

function defaultRule() {
  return {
    type: 'whole',
    operator: 'between',
    value1: '1',
    value2: '100',
    listSource: '',
    formula: '',
    ignoreBlank: true,
    showDropdown: true,
    alertStyle: 'stop',
    alertTitle: 'Invalid entry',
    alertMessage: 'The value you entered is not valid.',
    showAlert: true,
    showInputMessage: false,
    inputTitle: '',
    inputMessage: '',
  };
}

export default function DataValidationDialog({ isOpen, onClose, selRange, existingRule, onSave }) {
  const [rule, setRule] = React.useState(existingRule || defaultRule());
  const [tab, setTab] = React.useState('settings'); // 'settings' | 'input' | 'error'

  React.useEffect(() => {
    if (isOpen) {
      setRule(existingRule || defaultRule());
      setTab('settings');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const typeDef = RULE_TYPES.find(t => t.id === rule.type) || RULE_TYPES[0];
  const needsOps = typeDef.numericOps;
  const needsBoth = ['between', 'notBetween'].includes(rule.operator);

  const update = (field, value) => setRule(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    const withRange = {
      ...rule,
      range: selRange
        ? { s: { r: selRange.minRow, c: selRange.minCol }, e: { r: selRange.maxRow, c: selRange.maxCol } }
        : null,
    };
    onSave(withRange);
    onClose();
  };

  const rangeStr = selRange
    ? `Applies to: rows ${selRange.minRow + 1}–${selRange.maxRow + 1}, cols ${selRange.minCol + 1}–${selRange.maxCol + 1}`
    : 'No range selected';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="dv-dialog" onClick={e => e.stopPropagation()}>
        <div className="dv-dialog-header">
          <h2>Data Validation</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="dv-dialog-range">{rangeStr}</div>

        {/* Tabs */}
        <div className="dv-tabs">
          {[['settings', 'Settings'], ['input', 'Input Message'], ['error', 'Error Alert']].map(([id, label]) => (
            <button
              key={id}
              className={`dv-tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >{label}</button>
          ))}
        </div>

        <div className="dv-dialog-body">
          {/* ── Settings Tab ── */}
          {tab === 'settings' && (
            <div className="dv-settings">
              <div className="dv-field">
                <label className="dv-label">Allow</label>
                <select
                  className="form-input dv-select"
                  value={rule.type}
                  onChange={e => update('type', e.target.value)}
                >
                  {RULE_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              <label className="dv-checkbox-label">
                <input type="checkbox" checked={rule.ignoreBlank} onChange={e => update('ignoreBlank', e.target.checked)} />
                Ignore blank
              </label>

              {rule.type === 'list' && (
                <label className="dv-checkbox-label">
                  <input type="checkbox" checked={rule.showDropdown} onChange={e => update('showDropdown', e.target.checked)} />
                  In-cell dropdown
                </label>
              )}

              {needsOps && (
                <div className="dv-field">
                  <label className="dv-label">Data</label>
                  <select
                    className="form-input dv-select"
                    value={rule.operator}
                    onChange={e => update('operator', e.target.value)}
                  >
                    {OPERATORS.map(op => (
                      <option key={op.id} value={op.id}>{op.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {needsOps && (
                <div className="dv-field">
                  <label className="dv-label">{needsBoth ? 'Minimum' : 'Value'}</label>
                  <input
                    className="form-input"
                    type="text"
                    value={rule.value1}
                    onChange={e => update('value1', e.target.value)}
                    placeholder={needsBoth ? 'Minimum' : 'Value'}
                  />
                </div>
              )}

              {needsOps && needsBoth && (
                <div className="dv-field">
                  <label className="dv-label">Maximum</label>
                  <input
                    className="form-input"
                    type="text"
                    value={rule.value2}
                    onChange={e => update('value2', e.target.value)}
                    placeholder="Maximum"
                  />
                </div>
              )}

              {typeDef.vals === 'list' && (
                <div className="dv-field">
                  <label className="dv-label">Source</label>
                  <input
                    className="form-input"
                    type="text"
                    value={rule.listSource}
                    onChange={e => update('listSource', e.target.value)}
                    placeholder="Item1,Item2,Item3  or  =A1:A10"
                  />
                  <div className="dv-hint">Separate items with commas, or enter a range like =A1:A10</div>
                </div>
              )}

              {typeDef.vals === 'formula' && (
                <div className="dv-field">
                  <label className="dv-label">Formula</label>
                  <input
                    className="form-input"
                    type="text"
                    value={rule.formula}
                    onChange={e => update('formula', e.target.value)}
                    placeholder="=AND(A1>0, A1<100)"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Input Message Tab ── */}
          {tab === 'input' && (
            <div className="dv-settings">
              <label className="dv-checkbox-label">
                <input type="checkbox" checked={rule.showInputMessage} onChange={e => update('showInputMessage', e.target.checked)} />
                Show input message when cell is selected
              </label>
              <div className="dv-field">
                <label className="dv-label">Title</label>
                <input
                  className="form-input"
                  type="text"
                  value={rule.inputTitle}
                  onChange={e => update('inputTitle', e.target.value)}
                  placeholder="Optional title"
                  disabled={!rule.showInputMessage}
                />
              </div>
              <div className="dv-field">
                <label className="dv-label">Input message</label>
                <textarea
                  className="form-input dv-textarea"
                  value={rule.inputMessage}
                  onChange={e => update('inputMessage', e.target.value)}
                  placeholder="Message shown when cell is selected..."
                  disabled={!rule.showInputMessage}
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* ── Error Alert Tab ── */}
          {tab === 'error' && (
            <div className="dv-settings">
              <label className="dv-checkbox-label">
                <input type="checkbox" checked={rule.showAlert} onChange={e => update('showAlert', e.target.checked)} />
                Show error alert after invalid data is entered
              </label>

              <div className="dv-field">
                <label className="dv-label">Style</label>
                <div className="dv-alert-pills">
                  {ALERT_STYLES.map(a => (
                    <button
                      key={a.id}
                      className={`dv-alert-pill ${rule.alertStyle === a.id ? 'active' : ''}`}
                      onClick={() => update('alertStyle', a.id)}
                      disabled={!rule.showAlert}
                    >
                      <span>{a.icon}</span>
                      <span>{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="dv-field">
                <label className="dv-label">Title</label>
                <input
                  className="form-input"
                  type="text"
                  value={rule.alertTitle}
                  onChange={e => update('alertTitle', e.target.value)}
                  placeholder="Error title"
                  disabled={!rule.showAlert}
                />
              </div>

              <div className="dv-field">
                <label className="dv-label">Error message</label>
                <textarea
                  className="form-input dv-textarea"
                  value={rule.alertMessage}
                  onChange={e => update('alertMessage', e.target.value)}
                  placeholder="Message shown when invalid data is entered..."
                  disabled={!rule.showAlert}
                  rows={4}
                />
              </div>
            </div>
          )}
        </div>

        <div className="dv-dialog-footer">
          <button className="btn btn-secondary" onClick={() => { onSave(null); onClose(); }}>Clear All</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}
