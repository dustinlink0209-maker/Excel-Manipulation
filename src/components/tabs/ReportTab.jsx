import React from 'react';
import { useToast } from '../Toast';
import * as api from '../../services/api';

export default function ReportTab({ fileId, sheetData, activeSheet, provider = 'gemini' }) {
  const [report, setReport] = React.useState(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const { addToast } = useToast();

  const handleGenerate = async () => {
    if (!sheetData?.data?.length) {
      addToast('No data to report on. Add some data first.', 'warning');
      return;
    }
    setIsGenerating(true);
    setReport(null);
    try {
      const result = await api.generateReport(sheetData.data, activeSheet, provider);
      setReport(result);
      addToast('Report generated!', 'success');
    } catch (err) {
      addToast(`Report failed: ${err.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportExcel = async () => {
    if (!sheetData?.data?.length) return;
    setIsExporting(true);
    try {
      const result = await api.generateReportExcel(sheetData.data, activeSheet, fileId, provider);
      addToast('Excel Dashboard created! Refresh to see the new sheets.', 'success');
      if (result.report) setReport(result.report);
    } catch (err) {
      addToast(`Export failed: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJira = async () => {
    if (!sheetData?.data?.length) return;
    setIsExporting(true);
    try {
      const result = await api.generateJiraDashboard(sheetData.data, activeSheet, fileId, provider);
      addToast('Jira Dashboard created! Refresh to see the new sheets.', 'success');
      if (result.report) setReport(result.report); // Might need a different format display or just toast
    } catch (err) {
      addToast(`Jira Dashboard failed: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const isJiraData = React.useMemo(() => {
    if (!sheetData?.data?.length) return false;
    const headers = sheetData.data[0];
    const indicators = ['issue', 'type', 'status', 'priority', 'summary', 'sprint'];
    return headers.some(h => indicators.some(ind => String(h).toLowerCase().includes(ind)));
  }, [sheetData]);

  const handleCopy = () => {
    if (!report) return;
    const lines = [];
    if (report.title) lines.push(report.title);
    if (report.generatedAt) lines.push(`Generated: ${report.generatedAt}`);
    lines.push('');
    if (report.overview) { lines.push('OVERVIEW'); lines.push(report.overview); lines.push(''); }
    if (report.keyFindings?.length) {
      lines.push('KEY FINDINGS');
      report.keyFindings.forEach(f => lines.push(`${f.emoji || '•'} ${f.headline}: ${f.detail}`));
      lines.push('');
    }
    if (report.highlights?.length) {
      lines.push('DATA HIGHLIGHTS');
      report.highlights.forEach(h => lines.push(`${h.label}: ${h.value} (${h.context})`));
      lines.push('');
    }
    if (report.concerns?.length) {
      lines.push('CONCERNS');
      report.concerns.forEach(c => lines.push(`${c.emoji || '⚠️'} ${c.title}: ${c.detail}`));
      lines.push('');
    }
    if (report.recommendations?.length) {
      lines.push('RECOMMENDATIONS');
      report.recommendations.forEach(r => lines.push(`${r.emoji || '💡'} ${r.action}: ${r.reason}`));
    }
    navigator.clipboard.writeText(lines.join('\n'));
    addToast('Report copied to clipboard!', 'success');
  };

  return (
    <>
      <div className="insights-panel-content">
        {!report && !isGenerating ? (
          <div className="report-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <h3>Generate a Report</h3>
            <p>Create a clear, easy-to-read summary of your data. Written in plain English — perfect for sharing with anyone.</p>
            <div className="analyzer-features">
              {[['📋','Overview'],['🔑','Key Findings'],['📊','Highlights'],['💡','Advice']].map(([icon, label]) => (
                <div key={label} className="analyzer-feature">
                  <span className="analyzer-feature-icon" style={{ color: '#f59e0b' }}>{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : isGenerating ? (
          <div className="loading-overlay">
            <div className="spinner spinner-lg"></div>
            <p>Writing your report...</p>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>AI is summarizing your data in plain English</p>
          </div>
        ) : report ? (
          <div className="report-content" id="printable-report">
            <div className="report-title-section">
              <h2 className="report-title">{report.title || 'Data Report'}</h2>
              <div className="report-date">{report.generatedAt || 'Just now'}</div>
            </div>

            {report.overview && (
              <div className="report-section">
                <div className="report-section-header">
                  <span className="report-section-icon">📋</span>
                  <span className="report-section-label">Overview</span>
                </div>
                <p className="report-overview-text">{report.overview}</p>
              </div>
            )}

            {report.highlights?.length > 0 && (
              <div className="report-section">
                <div className="report-section-header">
                  <span className="report-section-icon">📊</span>
                  <span className="report-section-label">Data Highlights</span>
                </div>
                <div className="report-highlights-grid">
                  {report.highlights.map((h, i) => (
                    <div key={i} className="report-highlight-card">
                      <div className="report-highlight-value">{h.value}</div>
                      <div className="report-highlight-label">{h.label}</div>
                      <div className="report-highlight-context">{h.context}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.keyFindings?.length > 0 && (
              <div className="report-section">
                <div className="report-section-header">
                  <span className="report-section-icon">🔑</span>
                  <span className="report-section-label">Key Findings</span>
                </div>
                {report.keyFindings.map((f, i) => (
                  <div key={i} className="report-finding-card">
                    <div className="report-finding-emoji">{f.emoji || '•'}</div>
                    <div className="report-finding-body">
                      <div className="report-finding-headline">{f.headline}</div>
                      <div className="report-finding-detail">{f.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {report.concerns?.length > 0 && (
              <div className="report-section">
                <div className="report-section-header">
                  <span className="report-section-icon">⚠️</span>
                  <span className="report-section-label">Concerns</span>
                </div>
                {report.concerns.map((c, i) => (
                  <div key={i} className="report-concern-card">
                    <div className="report-finding-emoji">{c.emoji || '⚠️'}</div>
                    <div className="report-finding-body">
                      <div className="report-finding-headline">{c.title}</div>
                      <div className="report-finding-detail">{c.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {report.recommendations?.length > 0 && (
              <div className="report-section">
                <div className="report-section-header">
                  <span className="report-section-icon">💡</span>
                  <span className="report-section-label">Recommendations</span>
                </div>
                {report.recommendations.map((r, i) => (
                  <div key={i} className="report-rec-card">
                    <div className="report-finding-emoji">{r.emoji || '💡'}</div>
                    <div className="report-finding-body">
                      <div className="report-finding-headline">{r.action}</div>
                      <div className="report-finding-detail">{r.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="insights-panel-actions">
        {report && (
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
            <button className="btn btn-secondary btn-sm flex-1" onClick={handleCopy} id="btn-copy-report">
              📋 Copy
            </button>
            <button className="btn btn-secondary btn-sm flex-1" onClick={() => window.print()} id="btn-print-report">
              🖨️ Print
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button 
            className="btn btn-report flex-1" 
            onClick={handleGenerate} 
            disabled={isGenerating || isExporting || !fileId} 
            id="btn-generate-report"
          >
            {isGenerating
              ? <><div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>...</>
              : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>{report ? 'Regenerate' : 'Generate'}</>
            }
          </button>
          <button 
            className="btn btn-secondary flex-1" 
            onClick={handleExportExcel} 
            disabled={isGenerating || isExporting || !fileId} 
            title="Create Dashboard sheet in Excel"
            id="btn-export-excel"
          >
            {isExporting 
              ? <><div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>...</> 
              : '📊 Export Excel'
            }
          </button>
          {isJiraData && (
            <button 
              className="btn btn-primary flex-1" 
              onClick={handleExportJira} 
              disabled={isGenerating || isExporting || !fileId} 
              title="Create Specialized Jira Dashboard"
              id="btn-export-jira"
              style={{ background: 'linear-gradient(135deg, #0052CC, #2684FF)' }}
            >
              {isExporting 
                ? <><div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>...</> 
                : '🚀 Jira Dashboard'
              }
            </button>
          )}
        </div>
      </div>
    </>
  );
}
