/**
 * Jira & Portfolio Data Mapping Utility
 * Helps normalize common Jira export fields
 */

const STATUS_MAPPINGS = {
  'To Do': ['Open', 'New', 'Backlog', 'Ready'],
  'In Progress': ['Doing', 'Developing', 'In Review', 'Testing', 'QA'],
  'Done': ['Closed', 'Resolved', 'Complete', 'Finished', 'Released'],
  'Blocked': ['On Hold', 'Stuck', 'Waiting']
};

const PRIORITY_MAPPINGS = {
  'Highest': ['P0', 'Critical', 'Emergency', 'Blocker'],
  'High': ['P1', 'Urgent', 'Major'],
  'Medium': ['P2', 'Normal', 'Average'],
  'Low': ['P3', 'Minor'],
  'Lowest': ['P4', 'Trivial', 'Optional']
};

/**
 * Detect if a sheet looks like a Jira export
 * @param {Array<string>} headers - Sheet headers
 * @returns {boolean}
 */
export function isJiraExport(headers) {
  const jiraIndicators = ['Issue Type', 'Issue key', 'Issue id', 'Summary', 'Status', 'Priority', 'Resolution'];
  const matches = headers.filter(h => jiraIndicators.some(ind => h.toLowerCase().includes(ind.toLowerCase())));
  return matches.length >= 3;
}

/**
 * Suggest normalization for Jira Status
 * @param {string} status - Current status
 * @returns {string|null} - Normalized status or null if already standard
 */
export function normalizeJiraStatus(status) {
  if (!status) return null;
  const s = status.trim();
  
  for (const [standard, variations] of Object.entries(STATUS_MAPPINGS)) {
    if (standard.toLowerCase() === s.toLowerCase()) return null;
    if (variations.some(v => v.toLowerCase() === s.toLowerCase())) {
      return standard;
    }
  }
  return null;
}

/**
 * Suggest normalization for Jira Priority
 */
export function normalizeJiraPriority(priority) {
  if (!priority) return null;
  const p = priority.trim();
  
  for (const [standard, variations] of Object.entries(PRIORITY_MAPPINGS)) {
    if (standard.toLowerCase() === p.toLowerCase()) return null;
    if (variations.some(v => v.toLowerCase() === p.toLowerCase())) {
      return standard;
    }
  }
  return null;
}
