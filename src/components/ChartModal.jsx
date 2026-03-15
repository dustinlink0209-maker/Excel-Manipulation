import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
);

const CHART_TYPES = [
  { id: 'bar',       label: 'Bar',       icon: '▦' },
  { id: 'line',      label: 'Line',      icon: '📈' },
  { id: 'pie',       label: 'Pie',       icon: '◑' },
  { id: 'doughnut',  label: 'Doughnut',  icon: '◎' },
  { id: 'area',      label: 'Area',      icon: '◿' },
];

const PALETTE = [
  '#6366f1','#06b6d4','#22c55e','#f59e0b','#ef4444',
  '#8b5cf6','#14b8a6','#f97316','#ec4899','#3b82f6',
];

function buildChartData(rawData, selRange, hasHeaders) {
  if (!rawData || !selRange) return null;

  const rows = [];
  for (let r = selRange.minRow; r <= selRange.maxRow; r++) {
    const row = [];
    for (let c = selRange.minCol; c <= selRange.maxCol; c++) {
      row.push(rawData[r]?.[c] ?? '');
    }
    rows.push(row);
  }

  if (rows.length === 0) return null;

  const dataRows = hasHeaders ? rows.slice(1) : rows;
  const headerRow = hasHeaders ? rows[0] : null;
  const numCols = rows[0]?.length || 0;

  // First column as labels, rest as series
  const labels = dataRows.map(r => String(r[0] ?? ''));

  const datasets = [];
  for (let c = 1; c < numCols; c++) {
    const seriesLabel = headerRow ? String(headerRow[c] ?? `Series ${c}`) : `Series ${c}`;
    const data = dataRows.map(r => {
      const v = Number(r[c]);
      return isNaN(v) ? 0 : v;
    });
    const color = PALETTE[(c - 1) % PALETTE.length];
    datasets.push({
      label: seriesLabel,
      data,
      backgroundColor: color + 'cc',
      borderColor: color,
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointRadius: 4,
    });
  }

  return { labels, datasets };
}

const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#94a3b8', font: { size: 12 } },
    },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      borderColor: '#253049',
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8' },
      grid: { color: '#1e293b' },
    },
    y: {
      ticks: { color: '#94a3b8' },
      grid: { color: '#1e293b' },
    },
  },
};

const PIE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#94a3b8' } },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      borderColor: '#253049',
      borderWidth: 1,
    },
  },
};

export default function ChartModal({ isOpen, onClose, rawData, selRange }) {
  const [chartType, setChartType] = React.useState('bar');
  const [hasHeaders, setHasHeaders] = React.useState(true);
  const [title, setTitle] = React.useState('Chart');

  if (!isOpen) return null;

  const chartData = buildChartData(rawData, selRange, hasHeaders);

  // For pie/doughnut, reshape data to use first dataset
  const pieData = chartData ? {
    labels: chartData.labels,
    datasets: [{
      data: chartData.datasets[0]?.data || [],
      backgroundColor: PALETTE.map(c => c + 'cc'),
      borderColor: PALETTE,
      borderWidth: 2,
    }],
  } : null;

  const renderChart = () => {
    if (!chartData) return (
      <div className="chart-no-data">
        <p>Select a range with at least 2 columns to create a chart.</p>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 8 }}>
          First column = labels, remaining columns = data series
        </p>
      </div>
    );

    const opts = { ...BASE_OPTIONS, plugins: { ...BASE_OPTIONS.plugins, title: { display: !!title, text: title, color: '#f1f5f9', font: { size: 14 } } } };

    if (chartType === 'area') {
      const areaData = { ...chartData, datasets: chartData.datasets.map(d => ({ ...d, fill: true })) };
      return <Line data={areaData} options={opts} />;
    }
    if (chartType === 'line') return <Line data={chartData} options={opts} />;
    if (chartType === 'pie') return <Pie data={pieData} options={PIE_OPTIONS} />;
    if (chartType === 'doughnut') return <Doughnut data={pieData} options={PIE_OPTIONS} />;
    return <Bar data={chartData} options={opts} />;
  };

  const rangeStr = selRange
    ? `${selRange.maxRow - selRange.minRow + 1} rows × ${selRange.maxCol - selRange.minCol + 1} cols`
    : 'No selection';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="chart-modal" onClick={e => e.stopPropagation()}>
        <div className="chart-modal-header">
          <h2>Insert Chart</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="chart-modal-body">
          {/* Controls */}
          <div className="chart-controls">
            <div className="chart-control-group">
              <label className="chart-control-label">Chart Type</label>
              <div className="chart-type-pills">
                {CHART_TYPES.map(t => (
                  <button
                    key={t.id}
                    className={`chart-type-pill ${chartType === t.id ? 'active' : ''}`}
                    onClick={() => setChartType(t.id)}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="chart-control-row">
              <div className="chart-control-group">
                <label className="chart-control-label">Chart Title</label>
                <input
                  className="form-input"
                  style={{ height: 32, fontSize: 13 }}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Chart title..."
                />
              </div>
              <div className="chart-control-group">
                <label className="chart-control-label">Data Range</label>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '4px 0' }}>
                  {rangeStr}
                </div>
              </div>
            </div>

            <label className="chart-checkbox-label">
              <input
                type="checkbox"
                checked={hasHeaders}
                onChange={e => setHasHeaders(e.target.checked)}
              />
              First row contains headers
            </label>
          </div>

          {/* Preview */}
          <div className="chart-preview">
            <div className="chart-preview-label">Preview</div>
            <div className="chart-canvas-wrap">
              {renderChart()}
            </div>
          </div>
        </div>

        <div className="chart-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={onClose}
            disabled={!chartData}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
