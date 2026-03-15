import React from 'react';

function calcStats(selRange, getCellValue) {
  if (!selRange) return null;
  const nums = [];
  let count = 0;
  for (let r = selRange.minRow; r <= selRange.maxRow; r++) {
    for (let c = selRange.minCol; c <= selRange.maxCol; c++) {
      const v = getCellValue(r, c);
      if (v !== '' && v !== null && v !== undefined) count++;
      const n = Number(v);
      if (!isNaN(n) && v !== '' && v !== null) nums.push(n);
    }
  }
  const cells = (selRange.maxRow - selRange.minRow + 1) * (selRange.maxCol - selRange.minCol + 1);
  if (!nums.length) return { cells, count };
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    cells,
    count: nums.length,
    sum,
    avg: sum / nums.length,
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}

export default function StatusBar({ selRange, getCellValue, zoom, onZoomChange, activeSheet, sheetData }) {
  const stats = React.useMemo(
    () => getCellValue ? calcStats(selRange, getCellValue) : null,
    [selRange, getCellValue]
  );

  const fmt = (n) => {
    if (n === undefined || n === null) return '—';
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e4) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  };

  return (
    <div className="status-bar">
      {/* Left: sheet info */}
      <div className="status-bar-left">
        {activeSheet && (
          <span className="status-bar-sheet">
            <span className="status-dot" />
            {activeSheet}
          </span>
        )}
        {sheetData && (
          <span className="status-bar-dim">
            {sheetData.rowCount} × {sheetData.colCount}
          </span>
        )}
      </div>

      {/* Center: selection stats */}
      <div className="status-bar-stats">
        {stats && selRange && (
          <>
            {stats.cells > 1 && (
              <span className="status-stat" title="Selected cells">
                <span className="status-stat-label">Cells</span>
                <span className="status-stat-val">{stats.cells.toLocaleString()}</span>
              </span>
            )}
            {stats.count !== undefined && stats.sum !== undefined && (
              <>
                <span className="status-stat" title="Count of numeric values">
                  <span className="status-stat-label">Count</span>
                  <span className="status-stat-val">{stats.count.toLocaleString()}</span>
                </span>
                <span className="status-stat" title="Sum of selection">
                  <span className="status-stat-label">Sum</span>
                  <span className="status-stat-val">{fmt(stats.sum)}</span>
                </span>
                <span className="status-stat" title="Average of selection">
                  <span className="status-stat-label">Avg</span>
                  <span className="status-stat-val">{fmt(stats.avg)}</span>
                </span>
                <span className="status-stat" title="Minimum value">
                  <span className="status-stat-label">Min</span>
                  <span className="status-stat-val">{fmt(stats.min)}</span>
                </span>
                <span className="status-stat" title="Maximum value">
                  <span className="status-stat-label">Max</span>
                  <span className="status-stat-val">{fmt(stats.max)}</span>
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* Right: zoom */}
      <div className="status-bar-zoom">
        <button
          className="zoom-btn"
          onClick={() => onZoomChange(Math.max(25, zoom - 10))}
          title="Zoom out"
        >−</button>
        <input
          type="range"
          className="zoom-slider"
          min={25}
          max={200}
          step={5}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          title={`Zoom: ${zoom}%`}
        />
        <button
          className="zoom-btn"
          onClick={() => onZoomChange(Math.min(200, zoom + 10))}
          title="Zoom in"
        >+</button>
        <span
          className="zoom-label"
          title="Reset zoom"
          onClick={() => onZoomChange(100)}
          style={{ cursor: 'pointer' }}
        >{zoom}%</span>
      </div>
    </div>
  );
}
