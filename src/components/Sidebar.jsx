import React from 'react';
import { useToast } from './Toast';
import * as api from '../services/api';

export default function Sidebar({ files, activeFileId, onFileSelect, onFilesChange }) {
  const [showNewDialog, setShowNewDialog] = React.useState(false);
  const [newFileName, setNewFileName] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const { addToast } = useToast();

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await api.uploadFile(file);
      addToast(`Uploaded "${file.name}" successfully`, 'success');
      onFilesChange();
    } catch (err) {
      addToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateNew = async () => {
    if (!newFileName.trim()) return;
    try {
      const name = newFileName.endsWith('.xlsx') ? newFileName : `${newFileName}.xlsx`;
      const result = await api.createWorkbook(name);
      addToast(`Created "${name}"`, 'success');
      setShowNewDialog(false);
      setNewFileName('');
      onFilesChange();
      onFileSelect(result.id);
    } catch (err) {
      addToast(`Create failed: ${err.message}`, 'error');
    }
  };

  const handleCreateJiraTemplate = async () => {
    try {
      const result = await api.createJiraTemplate();
      addToast(`Created Jira Template: ${result.originalName}`, 'success');
      onFilesChange();
      onFileSelect(result.id);
    } catch (err) {
      addToast(`Template creation failed: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (e, fileId, fileName) => {
    e.stopPropagation();
    if (!confirm(`Delete "${fileName}"?`)) return;
    try {
      await api.deleteFile(fileId);
      addToast(`Deleted "${fileName}"`, 'info');
      onFilesChange();
    } catch (err) {
      addToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleDownload = async (e, fileId, fileName) => {
    e.stopPropagation();
    try {
      const blob = await api.downloadFile(fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      addToast(`Downloading "${fileName}"`, 'success');
    } catch (err) {
      addToast(`Download failed: ${err.message}`, 'error');
    }
  };

  // Handle drag and drop
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      addToast('Only .xlsx, .xls, and .csv files are supported', 'warning');
      return;
    }
    setIsUploading(true);
    try {
      await api.uploadFile(file);
      addToast(`Uploaded "${file.name}" successfully`, 'success');
      onFilesChange();
    } catch (err) {
      addToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
          <h1>Excel Manager Pro</h1>
        </div>
        <div className="sidebar-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewDialog(true)} id="btn-new-file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading} id="btn-upload-file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <polyline points="16,16 12,12 8,16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
            </svg>
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        <div style={{ marginTop: 'var(--space-sm)' }}>
          <button className="btn btn-ghost btn-sm btn-block" onClick={handleCreateJiraTemplate} id="btn-jira-template">
            <span style={{ fontSize: '1.1em', marginRight: '4px' }}>✨</span>
            Create Jira Template
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>

      <div
        className="sidebar-files"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="dropzone dragging" style={{ margin: '8px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16,16 12,12 8,16" />
              <line x1="12" y1="12" x2="12" y2="21" />
            </svg>
            <p>Drop file here</p>
          </div>
        )}

        {!isDragging && (
          <>
            <div className="sidebar-section-title">Files</div>
            {files.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>
                <p>No files yet</p>
                <p style={{ marginTop: '4px' }}>Create or upload an Excel file to get started</p>
              </div>
            ) : (
              files.map(file => (
                <div
                  key={file.id}
                  className={`file-item ${file.id === activeFileId ? 'active' : ''}`}
                  onClick={() => onFileSelect(file.id)}
                  id={`file-${file.id}`}
                >
                  <svg className="file-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="file-item-name" title={file.originalName}>
                    {file.originalName}
                  </span>
                  <div className="file-item-actions">
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={(e) => handleDownload(e, file.id, file.originalName)}
                      title="Download"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>
                    <button
                      className="btn btn-danger btn-icon"
                      onClick={(e) => handleDelete(e, file.id, file.originalName)}
                      title="Delete"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-2 14H7L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* New File Modal */}
      {showNewDialog && (
        <div className="modal-overlay" onClick={() => setShowNewDialog(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create New Workbook</h2>
            <div className="form-group">
              <label className="form-label">File Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g., Jira Export Q1 2026"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()}
                autoFocus
                id="input-new-filename"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowNewDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateNew} disabled={!newFileName.trim()} id="btn-create-workbook">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
