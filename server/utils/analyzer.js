/**
 * Local Data Analyzer & Normalizer Engine
 * Runs entirely locally — no AI API key required
 */
import { isJiraExport, normalizeJiraStatus, normalizeJiraPriority } from './jiraMapper.js';

/**
 * Analyze sheet data and return quality report + normalization rules
 * @param {Array<Array>} data - 2D array of sheet data (first row = headers)
 * @returns {Object} Analysis results with issues and normalization rules
 */
export function analyzeSheetData(data) {
  if (!data || data.length < 2) {
    return {
      qualityScore: 100,
      summary: 'Not enough data to analyze (need at least a header row and one data row).',
      categories: [],
      rules: [],
      columnProfiles: [],
      stats: { totalRows: data?.length || 0, totalCells: 0, issueCount: 0 },
    };
  }

  const headers = data[0].map((h, i) => (h ? String(h).trim() : `Column ${i + 1}`));
  const rows = data.slice(1);
  const totalCells = rows.length * headers.length;

  const rules = [];
  const issuesByCategory = {};

  // --- Column Profiling ---
  const columnProfiles = headers.map((header, colIdx) => {
    const values = rows.map(row => (row[colIdx] !== undefined && row[colIdx] !== null ? row[colIdx] : ''));
    const nonEmpty = values.filter(v => String(v).trim() !== '');
    const emptyCount = values.length - nonEmpty.length;
    const stringValues = nonEmpty.map(v => String(v));
    const uniqueValues = new Set(stringValues);

    // Detect type
    let type = 'text';
    const numberCount = stringValues.filter(v => !isNaN(v) && v.trim() !== '').length;
    const datePatterns = stringValues.filter(v => isDateLike(v)).length;

    if (nonEmpty.length > 0) {
      if (numberCount / nonEmpty.length > 0.7) type = 'number';
      else if (datePatterns / nonEmpty.length > 0.7) type = 'date';
      else if (uniqueValues.size <= Math.min(10, nonEmpty.length * 0.3)) type = 'category';
    }

    return {
      column: header,
      colIndex: colIdx,
      type,
      totalValues: values.length,
      emptyCount,
      uniqueCount: uniqueValues.size,
      sampleValues: [...uniqueValues].slice(0, 5),
    };
  });

  // --- Issue Detection ---

  // 1. Whitespace Issues
  rows.forEach((row, rowIdx) => {
    headers.forEach((header, colIdx) => {
      const val = row[colIdx];
      if (val === undefined || val === null || val === '') return;
      const str = String(val);
      const trimmed = str.trim().replace(/\s+/g, ' ');
      if (str !== trimmed) {
        addRule(rules, issuesByCategory, {
          category: 'whitespace',
          categoryLabel: 'Whitespace Issues',
          icon: '␣',
          column: header,
          row: rowIdx + 1,
          colIndex: colIdx,
          rowIndex: rowIdx + 1,
          currentValue: str,
          suggestedValue: trimmed,
          description: str.startsWith(' ') || str.endsWith(' ')
            ? 'Leading/trailing whitespace'
            : 'Extra internal spaces',
        });
      }
    });
  });

  // 2. Inconsistent Casing
  headers.forEach((header, colIdx) => {
    const profile = columnProfiles[colIdx];
    if (profile.type !== 'text' && profile.type !== 'category') return;

    const values = rows.map(row => row[colIdx]).filter(v => v && String(v).trim() !== '');
    if (values.length < 3) return;

    const stringVals = values.map(v => String(v).trim());
    const lowerMap = {};
    stringVals.forEach((v, i) => {
      const lower = v.toLowerCase();
      if (!lowerMap[lower]) lowerMap[lower] = [];
      lowerMap[lower].push({ value: v, rowIdx: i });
    });

    Object.entries(lowerMap).forEach(([lower, entries]) => {
      const uniqueForms = [...new Set(entries.map(e => e.value))];
      if (uniqueForms.length > 1) {
        // Suggest the most common form
        const formCounts = {};
        entries.forEach(e => {
          formCounts[e.value] = (formCounts[e.value] || 0) + 1;
        });
        const bestForm = Object.entries(formCounts).sort((a, b) => b[1] - a[1])[0][0];

        entries.forEach(e => {
          if (e.value !== bestForm) {
            addRule(rules, issuesByCategory, {
              category: 'casing',
              categoryLabel: 'Inconsistent Casing',
              icon: 'Aa',
              column: header,
              row: e.rowIdx + 1,
              colIndex: colIdx,
              rowIndex: e.rowIdx + 1,
              currentValue: e.value,
              suggestedValue: bestForm,
              description: `"${e.value}" → "${bestForm}" (standardize)`,
            });
          }
        });
      }
    });
  });

  // 3. Empty / Missing Values
  columnProfiles.forEach(profile => {
    if (profile.emptyCount > 0 && profile.emptyCount / profile.totalValues > 0.1) {
      const emptyRows = [];
      rows.forEach((row, rowIdx) => {
        const val = row[profile.colIndex];
        if (val === undefined || val === null || String(val).trim() === '') {
          emptyRows.push(rowIdx + 1);
        }
      });

      if (!issuesByCategory['missing']) {
        issuesByCategory['missing'] = {
          category: 'missing',
          categoryLabel: 'Missing Values',
          icon: '⚠',
          issues: [],
          count: 0,
        };
      }
      issuesByCategory['missing'].issues.push({
        column: profile.column,
        description: `${profile.emptyCount} empty cells (${Math.round(profile.emptyCount / profile.totalValues * 100)}%)`,
        affectedRows: emptyRows.slice(0, 10),
        severity: profile.emptyCount / profile.totalValues > 0.5 ? 'high' : 'medium',
      });
      issuesByCategory['missing'].count += profile.emptyCount;
    }
  });

  // 4. Duplicate Rows
  const rowStrings = rows.map(row => JSON.stringify(row));
  const duplicates = {};
  rowStrings.forEach((str, idx) => {
    if (!duplicates[str]) duplicates[str] = [];
    duplicates[str].push(idx + 1);
  });

  const dupGroups = Object.entries(duplicates).filter(([, indices]) => indices.length > 1);
  if (dupGroups.length > 0) {
    if (!issuesByCategory['duplicates']) {
      issuesByCategory['duplicates'] = {
        category: 'duplicates',
        categoryLabel: 'Duplicate Rows',
        icon: '⊕',
        issues: [],
        count: 0,
      };
    }
    dupGroups.forEach(([, indices]) => {
      issuesByCategory['duplicates'].issues.push({
        description: `Rows ${indices.join(', ')} are identical`,
        affectedRows: indices,
        severity: 'medium',
      });
      issuesByCategory['duplicates'].count += indices.length - 1;
    });
  }

  // 5. Inconsistent Number Formats
  headers.forEach((header, colIdx) => {
    const profile = columnProfiles[colIdx];
    if (profile.type !== 'number') return;

    rows.forEach((row, rowIdx) => {
      const val = row[colIdx];
      if (val === undefined || val === null || val === '') return;
      const str = String(val).trim();
      // Check for currency symbols, commas, etc.
      const cleaned = str.replace(/[$€£¥,\s]/g, '');
      if (cleaned !== str && !isNaN(cleaned)) {
        addRule(rules, issuesByCategory, {
          category: 'formatting',
          categoryLabel: 'Format Inconsistencies',
          icon: '#',
          column: header,
          row: rowIdx + 1,
          colIndex: colIdx,
          rowIndex: rowIdx + 1,
          currentValue: str,
          suggestedValue: cleaned,
          description: 'Remove currency/formatting characters',
        });
      }
    });
  });

  // 6. Jira-Specific Normalization
  if (isJiraExport(headers)) {
    headers.forEach((header, colIdx) => {
      const hLower = header.toLowerCase();
      
      if (hLower.includes('status')) {
        rows.forEach((row, rowIdx) => {
          const val = row[colIdx];
          const suggestion = normalizeJiraStatus(val);
          if (suggestion) {
            addRule(rules, issuesByCategory, {
              category: 'formatting',
              categoryLabel: 'Jira Status Mapping',
              icon: '📋',
              column: header,
              row: rowIdx + 1,
              colIndex: colIdx,
              rowIndex: rowIdx + 1,
              currentValue: val,
              suggestedValue: suggestion,
              description: `Standardize Jira status "${val}" to "${suggestion}"`,
            });
          }
        });
      }
      
      if (hLower.includes('priority')) {
        rows.forEach((row, rowIdx) => {
          const val = row[colIdx];
          const suggestion = normalizeJiraPriority(val);
          if (suggestion) {
            addRule(rules, issuesByCategory, {
              category: 'formatting',
              categoryLabel: 'Jira Priority Mapping',
              icon: '⚡',
              column: header,
              row: rowIdx + 1,
              colIndex: colIdx,
              rowIndex: rowIdx + 1,
              currentValue: val,
              suggestedValue: suggestion,
              description: `Standardize Jira priority "${val}" to "${suggestion}"`,
            });
          }
        });
      }
    });
  }
 
  // --- Build Categories Array ---
  const categories = Object.values(issuesByCategory).map(cat => ({
    ...cat,
    ruleCount: rules.filter(r => r.category === cat.category).length,
  }));

  // --- Quality Score ---
  const issueCount = rules.length +
    (issuesByCategory['missing']?.count || 0) +
    (issuesByCategory['duplicates']?.count || 0);

  const qualityScore = totalCells > 0
    ? Math.max(0, Math.min(100, Math.round(100 - (issueCount / totalCells) * 100 * 3)))
    : 100;

  // --- Summary ---
  const parts = [];
  if (rules.length > 0) parts.push(`${rules.length} fixable issues`);
  if (issuesByCategory['missing']) parts.push(`${issuesByCategory['missing'].count} missing values`);
  if (issuesByCategory['duplicates']) parts.push(`${issuesByCategory['duplicates'].count} duplicate rows`);

  const summary = parts.length > 0
    ? `Found ${parts.join(', ')} across ${rows.length} rows.`
    : `Your data looks clean! ${rows.length} rows analyzed with no issues found.`;

  return {
    qualityScore,
    summary,
    categories,
    rules,
    columnProfiles,
    stats: {
      totalRows: rows.length,
      totalColumns: headers.length,
      totalCells,
      issueCount,
      fixableCount: rules.length,
    },
  };
}

/**
 * Apply normalization rules to sheet data
 * @param {Array<Array>} data - Original 2D array
 * @param {Array} rules - Rules to apply (each has rowIndex, colIndex, suggestedValue)
 * @returns {Array<Array>} Normalized data
 */
export function applyNormalizationRules(data, rules) {
  // Deep clone the data
  const normalized = data.map(row => [...row]);

  rules.forEach(rule => {
    const row = rule.rowIndex; // 1-indexed (data rows), but data[0] is headers
    const col = rule.colIndex;
    if (normalized[row] && col < normalized[row].length) {
      normalized[row][col] = rule.suggestedValue;
    }
  });

  return normalized;
}

// --- Helpers ---

function addRule(rules, issuesByCategory, rule) {
  rules.push(rule);

  if (!issuesByCategory[rule.category]) {
    issuesByCategory[rule.category] = {
      category: rule.category,
      categoryLabel: rule.categoryLabel,
      icon: rule.icon,
      issues: [],
      count: 0,
    };
  }
  issuesByCategory[rule.category].count++;
}

function isDateLike(value) {
  const str = String(value).trim();
  // Common date patterns
  const patterns = [
    /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/,  // M/D/Y or D/M/Y
    /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/,      // Y-M-D
    /^[A-Z][a-z]+ \d{1,2},? \d{4}$/,              // Month D, YYYY
    /^\d{1,2} [A-Z][a-z]+ \d{4}$/,                // D Month YYYY
  ];
  return patterns.some(p => p.test(str));
}
