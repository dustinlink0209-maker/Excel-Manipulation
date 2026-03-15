import React from 'react';
import AnalyzerTab from './tabs/AnalyzerTab';
import AITab from './tabs/AITab';
import ReportTab from './tabs/ReportTab';

const TABS = [
  {
    id: 'analyzer',
    label: 'Analyzer',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        <path d="M8 11h6" /><path d="M11 8v6" />
      </svg>
    ),
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    id: 'ai',
    label: 'AI Insights',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
        <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 10V2z" />
        <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.58 3.25 3.93L12 10V2z" />
        <circle cx="12" cy="17" r="5" />
        <line x1="12" y1="14" x2="12" y2="20" /><line x1="9" y1="17" x2="15" y2="17" />
      </svg>
    ),
  },
];

export default function InsightsPanel({ isOpen, fileId, sheetData, activeSheet, onDataChange }) {
  const [activeTab, setActiveTab] = React.useState('analyzer');
  const [aiProvider, setAiProvider] = React.useState('gemini');

  if (!isOpen) return null;

  return (
    <div className="insights-panel">
      <div className="insights-header">
        <div className="insights-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`insights-tab ${activeTab === tab.id ? `active ${tab.id}` : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="ai-provider-toggle">
          <button 
            className={`provider-btn ${aiProvider === 'gemini' ? 'active' : ''}`}
            onClick={() => setAiProvider('gemini')}
            title="Use Google Gemini"
          >
            Gemini
          </button>
          <button 
            className={`provider-btn ${aiProvider === 'openai' ? 'active' : ''}`}
            onClick={() => setAiProvider('openai')}
            title="Use OpenAI ChatGPT"
          >
            ChatGPT
          </button>
        </div>
      </div>

      <div className="insights-content">
        {activeTab === 'analyzer' && (
          <AnalyzerTab 
            fileId={fileId} 
            activeSheet={activeSheet} 
            onDataChange={onDataChange} 
            provider={aiProvider}
          />
        )}
        {activeTab === 'reports' && (
          <ReportTab 
            fileId={fileId} 
            sheetData={sheetData} 
            activeSheet={activeSheet} 
            provider={aiProvider}
          />
        )}
        {activeTab === 'ai' && (
          <AITab 
            fileId={fileId} 
            sheetData={sheetData} 
            activeSheet={activeSheet} 
            provider={aiProvider}
          />
        )}
      </div>
    </div>
  );
}
