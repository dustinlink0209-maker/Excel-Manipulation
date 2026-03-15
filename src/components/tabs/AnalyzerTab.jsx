import React from 'react';
import { useToast } from '../Toast';
import * as api from '../../services/api';

const categoryIcons = { whitespace: '␣', casing: 'Aa', missing: '⚠', duplicates: '⊕', formatting: '#' };

const scoreColor = (s) =>
  s >= 80 ? 'var(--accent-success)' : s >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)';

export default function AnalyzerTab({ fileId, activeSheet, onDataChange, provider = 'gemini' }) {
  const [result, setResult] = React.useState(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [isApplying, setIsApplying] = React.useState(false);
  const [useAI, setUseAI] = React.useState(false);
  const [selectedCategories, setSelectedCategories] = React.useState({});
  const [expandedCategories, setExpandedCategories] = React.useState({});
  const [selectedRules, setSelectedRules] = React.useState(new Set());
  const { addToast } = useToast();

  const handleRun = async () => {
    if (!fileId || !activeSheet) {
      addToast('Select a file and sheet first.', 'warning');
      return;
    }
    setIsRunning(true);
    setResult(null);
    try {
      const data = await api.analyzeSheet(fileId, activeSheet, useAI, provider);
      setResult(data);
      const cats = {};
      const expanded = {};
      data.categories?.forEach(c => { cats[c.category] = true; expanded[c.category] = true; });
      setSelectedCategories(cats);
      setExpandedCategories(expanded);
      setSelectedRules(new Set(data.rules?.map((_, i) => i) || []));
      addToast(data.rules?.length > 0 ? `Found ${data.rules.length} fixable issues!` : 'Data looks clean!',
        data.rules?.length > 0 ? 'info' : 'success');
    } catch (err) {
      addToast(`Analysis failed: ${err.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleApply = async (applyAll = true) => {
    if (!result?.rules?.length) return;
    const rules = applyAll
      ? result.rules.filter(r => selectedCategories[r.category])
      : result.rules.filter((r, i) => selectedRules.has(i) && selectedCategories[r.category]);
    if (rules.length === 0) { addToast('No rules selected.', 'warning'); return; }

    setIsApplying(true);
    try {
      const res = await api.applyNormalizations(fileId, activeSheet, rules);
      addToast(`Applied ${res.appliedCount} normalizations!`, 'success');
      if (onDataChange && res.sheet) onDataChange(res.sheet);
      const updated = await api.analyzeSheet(fileId, activeSheet, useAI, provider);
      setResult(updated);
      const cats = {};
      updated.categories?.forEach(c => { cats[c.category] = true; });
      setSelectedCategories(cats);
      setSelectedRules(new Set(updated.rules?.map((_, i) => i) || []));
    } catch (err) {
      addToast(`Failed to apply: ${err.message}`, 'error');
    } finally {
      setIsApplying(false);
    }
  };

  const toggleCategory = (cat) => setSelectedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  const toggleExpand = (cat) => setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  const toggleRule = (i) => setSelectedRules(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const enabledCount = result?.rules?.filter(r => selectedCategories[r.category]).length || 0;

  return (
    <>
      <div className="insights-panel-content">
        {!result && !isRunning ? (
          <div className="analyzer-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <h3>Analyze & Normalize</h3>
            <p>Scan your data for quality issues — whitespace, inconsistent casing, duplicates, and more. Apply fixes with one click.</p>
            <div className="analyzer-features">
              {[['␣','Whitespace'],['Aa','Casing'],['⊕','Duplicates'],['#','Formatting']].map(([icon, label]) => (
                <div key={label} className="analyzer-feature">
                  <span className="analyzer-feature-icon">{icon}</span><span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : isRunning ? (
          <div className="loading-overlay">
            <div className="spinner spinner-lg"></div>
            <p>Scanning your data...</p>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Checking for quality issues</p>
          </div>
        ) : result ? (
          <>
            <div className="analyzer-score-section">
              <div className="ai-score-circle" style={{ '--score': result.qualityScore, color: scoreColor(result.qualityScore) }}>
                {result.qualityScore}
              </div>
              <div className="ai-score-label">Data Quality Score</div>
            </div>

            <div className="analyzer-summary">{result.summary}</div>

            <div className="analyzer-stats">
              {[['totalRows','Rows'],['totalColumns','Columns'],['issueCount','Issues'],['fixableCount','Fixable']].map(([key, label]) => (
                <div key={key} className="analyzer-stat">
                  <span className="analyzer-stat-value">{result.stats?.[key] || 0}</span>
                  <span className="analyzer-stat-label">{label}</span>
                </div>
              ))}
            </div>

            {result.categories?.map(cat => {
              const catRules = result.rules?.filter(r => r.category === cat.category) || [];
              const isExpanded = expandedCategories[cat.category];
              const isEnabled = selectedCategories[cat.category];
              return (
                <div key={cat.category} className={`analyzer-category ${isEnabled ? '' : 'disabled'}`}>
                  <div className="analyzer-category-header" onClick={() => toggleExpand(cat.category)}>
                    <div className="analyzer-category-left">
                      <span className={`analyzer-category-chevron ${isExpanded ? 'expanded' : ''}`}>▶</span>
                      <span className="analyzer-category-icon">{categoryIcons[cat.category] || '?'}</span>
                      <span className="analyzer-category-name">{cat.categoryLabel}</span>
                      <span className="analyzer-category-count">{cat.count}</span>
                    </div>
                    <label className="analyzer-toggle" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isEnabled} onChange={() => toggleCategory(cat.category)} />
                      <span className="analyzer-toggle-slider"></span>
                    </label>
                  </div>
                  {isExpanded && (
                    <div className="analyzer-category-body">
                      {cat.issues?.map((issue, i) => (
                        <div key={`info-${i}`} className="analyzer-issue-card">
                          <div className="analyzer-issue-desc">
                            {issue.column && <strong>{issue.column}: </strong>}{issue.description}
                          </div>
                          {issue.affectedRows?.length > 0 && (
                            <div className="analyzer-issue-rows">
                              Rows: {issue.affectedRows.slice(0, 8).join(', ')}
                              {issue.affectedRows.length > 8 && ` +${issue.affectedRows.length - 8} more`}
                            </div>
                          )}
                        </div>
                      ))}
                      {catRules.slice(0, 20).map(rule => {
                        const globalIdx = result.rules.indexOf(rule);
                        return (
                          <div
                            key={`rule-${globalIdx}`}
                            className={`analyzer-rule ${selectedRules.has(globalIdx) ? 'selected' : ''}`}
                            onClick={() => toggleRule(globalIdx)}
                          >
                            <div className="analyzer-rule-check">
                              <input type="checkbox" checked={selectedRules.has(globalIdx)} onChange={() => toggleRule(globalIdx)} />
                            </div>
                            <div className="analyzer-rule-content">
                              <div className="analyzer-rule-location">{rule.column} · Row {rule.row}</div>
                              <div className="analyzer-rule-transform">
                                <span className="analyzer-rule-before">{String(rule.currentValue)}</span>
                                <span className="analyzer-rule-arrow">→</span>
                                <span className="analyzer-rule-after">{String(rule.suggestedValue)}</span>
                              </div>
                              {rule.isAI && <div className="ai-badge">AI Suggested</div>}
                            </div>
                          </div>
                        );
                      })}
                      {catRules.length > 20 && <div className="analyzer-more">+{catRules.length - 20} more</div>}
                    </div>
                  )}
                </div>
              );
            })}

            {result.columnProfiles?.length > 0 && (
              <div className="analyzer-profiles">
                <div className="sidebar-section-title" style={{ paddingLeft: 0, marginTop: 'var(--space-md)' }}>Column Profiles</div>
                {result.columnProfiles.map((col, i) => (
                  <div key={i} className="analyzer-profile-card">
                    <div className="analyzer-profile-header">
                      <span className="analyzer-profile-name">{col.column}</span>
                      <span className={`analyzer-profile-type type-${col.type}`}>{col.type}</span>
                    </div>
                    <div className="analyzer-profile-stats">{col.uniqueCount} unique · {col.emptyCount} empty</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>

      <div className="insights-panel-actions">
        {result?.rules?.length > 0 && (
          <>
            <div className="analyzer-action-info">{enabledCount} fix{enabledCount !== 1 ? 'es' : ''} ready to apply</div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary btn-sm flex-1" onClick={() => handleApply(false)} disabled={isApplying || selectedRules.size === 0} id="btn-apply-selected">
                Apply Selected
              </button>
              <button className="btn btn-success btn-sm flex-1" onClick={() => handleApply(true)} disabled={isApplying || enabledCount === 0} id="btn-apply-all">
                {isApplying ? <><div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }}></div>Applying...</> : <>✓ Apply All</>}
              </button>
            </div>
          </>
        )}
        <div className="analyzer-ai-toggle-section">
          <label className="analyzer-toggle-label">
            <span className="analyzer-toggle-text">Use AI Semantic Suggestions</span>
            <label className="analyzer-toggle">
              <input type="checkbox" checked={useAI} onChange={() => setUseAI(!useAI)} />
              <span className="analyzer-toggle-slider ai"></span>
            </label>
          </label>
        </div>
        <button className="btn btn-analyze btn-block" onClick={handleRun} disabled={isRunning || !fileId} id="btn-run-analyzer">
          {isRunning
            ? <><div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>Scanning...</>
            : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>{result ? 'Re-Analyze' : 'Analyze Data'}</>
          }
        </button>
      </div>
    </>
  );
}
