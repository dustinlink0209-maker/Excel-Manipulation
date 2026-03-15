import React from 'react';
import { useToast } from '../Toast';
import * as api from '../../services/api';

const scoreColor = (s) =>
  s >= 80 ? 'var(--accent-success)' : s >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)';

export default function AITab({ fileId, sheetData, activeSheet, provider = 'gemini' }) {
  const [analysis, setAnalysis] = React.useState(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisType, setAnalysisType] = React.useState('full');
  const { addToast } = useToast();

  const handleAnalyze = async () => {
    if (!sheetData?.data?.length) {
      addToast('No data to analyze. Add some data first.', 'warning');
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = await api.analyzeData(sheetData.data, activeSheet, analysisType, provider);
      setAnalysis(result);
      addToast(result.error === 'AI returned non-JSON response'
        ? 'AI returned a text response — see panel for details'
        : 'AI Analysis complete!',
        result.error ? 'info' : 'success');
    } catch (err) {
      addToast(`Analysis failed: ${err.message}`, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <div className="insights-panel-content">
        {!analysis && !isAnalyzing ? (
          <div className="ai-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
            </svg>
            <h3>Ready to Analyze</h3>
            <p>Click "AI Analyze" to get AI-powered insights including data quality scores, normalization suggestions, and pattern detection.</p>
          </div>
        ) : isAnalyzing ? (
          <div className="loading-overlay">
            <div className="spinner spinner-lg"></div>
            <p>Analyzing your data with AI...</p>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>This may take a few seconds</p>
          </div>
        ) : analysis ? (
          <>
            {analysis.qualityScore != null && (
              <div className="ai-score">
                <div className="ai-score-circle" style={{ '--score': analysis.qualityScore, color: scoreColor(analysis.qualityScore) }}>
                  {analysis.qualityScore}
                </div>
                <div className="ai-score-label">Data Quality Score</div>
              </div>
            )}

            {analysis.summary && (
              <div className="ai-suggestion" style={{ borderLeftColor: 'var(--accent-primary)' }}>
                <div className="ai-suggestion-header"><span className="ai-suggestion-title">Summary</span></div>
                <div className="ai-suggestion-desc">{analysis.summary}</div>
              </div>
            )}

            {analysis.insights?.map((insight, i) => (
              <div key={i} className={`ai-suggestion ${insight.priority}`}>
                <div className="ai-suggestion-header">
                  <span className="ai-suggestion-title">{insight.title}</span>
                  <span className={`ai-suggestion-badge ${insight.priority}`}>{insight.type}</span>
                </div>
                <div className="ai-suggestion-desc">{insight.description}</div>
              </div>
            ))}

            {analysis.capacityForecast && (
              <div className={`ai-suggestion ${analysis.capacityForecast.status === 'Overloaded' ? 'high' : analysis.capacityForecast.status === 'At Risk' ? 'medium' : 'success'}`} style={{ borderLeftWidth: '4px' }}>
                <div className="ai-suggestion-header">
                  <span className="ai-suggestion-title">Capacity Forecast</span>
                  <span className={`ai-suggestion-badge ${analysis.capacityForecast.status === 'Overloaded' ? 'high' : analysis.capacityForecast.status === 'At Risk' ? 'medium' : 'success'}`}>
                    {analysis.capacityForecast.status}
                  </span>
                </div>
                <div className="ai-suggestion-desc">{analysis.capacityForecast.observation}</div>
              </div>
            )}

            {analysis.suggestions?.map((s, i) => (
              <div key={i} className={`ai-suggestion ${s.priority}`}>
                <div className="ai-suggestion-header">
                  <span className="ai-suggestion-title">{s.title}</span>
                  <span className={`ai-suggestion-badge ${s.priority}`}>{s.priority}</span>
                </div>
                <div className="ai-suggestion-desc">{s.description}</div>
                {s.column && (
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                    Column: <strong>{s.column}</strong>
                  </div>
                )}
                {s.currentValues?.length > 0 && s.suggestedValues?.length > 0 && (
                  <div className="ai-suggestion-values">
                    {s.currentValues.slice(0, 3).map((val, j) => (
                      <div key={j}>
                        <span className="current">{val}</span>
                        {s.suggestedValues[j] && <span className="suggested"> → {s.suggestedValues[j]}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {analysis.columnStats?.length > 0 && (
              <div style={{ marginTop: 'var(--space-md)' }}>
                <div className="sidebar-section-title" style={{ paddingLeft: 0 }}>Column Statistics</div>
                {analysis.columnStats.map((col, i) => (
                  <div key={i} className="ai-suggestion low">
                    <div className="ai-suggestion-header">
                      <span className="ai-suggestion-title">{col.column}</span>
                      <span className="ai-suggestion-badge low">{col.type}</span>
                    </div>
                    <div className="ai-suggestion-desc">
                      {col.uniqueValues} unique · {col.emptyCount} empty
                      {col.issues?.length > 0 && <span> · Issues: {col.issues.join(', ')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>

      <div className="insights-panel-actions">
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className={`btn btn-sm flex-1 ${analysisType === 'full' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAnalysisType('full')}>
            Full Analysis
          </button>
          <button className={`btn btn-sm flex-1 ${analysisType === 'normalize' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setAnalysisType('normalize')}>
            Normalize
          </button>
        </div>
        <button className="btn btn-success btn-block" onClick={handleAnalyze} disabled={isAnalyzing || !fileId} id="btn-ai-analyze">
          {isAnalyzing
            ? <><div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>Analyzing...</>
            : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>AI Analyze</>
          }
        </button>
      </div>
    </>
  );
}
