import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import XLSX from 'xlsx';
import { createRateLimiter, safeError } from '../utils/security.js';
import { callAI } from '../utils/aiProvider.js';

dotenv.config();

const router = express.Router();

// 10 AI requests per minute per IP
const aiRateLimit = createRateLimiter(10, 60_000);

// Analyze data with AI
router.post('/analyze', aiRateLimit, async (req, res) => {
  try {
    const { data, headers, sheetName, analysisType, provider = 'gemini' } = req.body;

    if (!data || data.length === 0) {
      return safeError(res, 400, 'No data provided for analysis');
    }

    // Build a sample of the data (first 50 rows to avoid token limits)
    const sampleData = data.slice(0, 50);
    const dataPreview = JSON.stringify(sampleData, null, 2);

    let systemPrompt;
    let prompt;

    if (analysisType === 'normalize') {
      systemPrompt = 'You are a data quality expert.';
      prompt = `Analyze this spreadsheet data from a sheet called "${sheetName || 'Sheet1'}".

DATA (first ${sampleData.length} rows, headers in first row):
${dataPreview}

Provide a JSON response with this exact structure:
{
  "qualityScore": <number 0-100>,
  "summary": "<brief overall data quality summary>",
  "suggestions": [
    {
      "type": "normalize|format|duplicate|missing|inconsistency",
      "column": "<column name or index>",
      "title": "<short title>",
      "description": "<detailed description of the issue>",
      "affectedRows": [<row indices>],
      "currentValues": ["<sample current values>"],
      "suggestedValues": ["<suggested normalized values>"],
      "priority": "high|medium|low"
    }
  ]
}

Focus on:
1. Inconsistent formatting (dates, phone numbers, names, etc.)
2. Duplicate or near-duplicate entries
3. Missing values in important columns
4. Data type inconsistencies within columns
5. Standardization opportunities (e.g., abbreviations vs full names)
6. For Jira data: normalize status names, priority levels, sprint names
7. For portfolio data: normalize application names, statuses, categories

Return ONLY valid JSON.`;
    } else {
      systemPrompt = 'You are a data analyst.';
      prompt = `Analyze this spreadsheet data from a sheet called "${sheetName || 'Sheet1'}".

DATA (first ${sampleData.length} rows, headers in first row):
${dataPreview}

Provide a JSON response with this exact structure:
{
  "qualityScore": <number 0-100>,
  "summary": "<brief overall analysis summary>",
  "insights": [
    {
      "type": "pattern|trend|outlier|summary",
      "title": "<short title>",
      "description": "<detailed insight>",
      "priority": "high|medium|low"
    }
  ],
  "suggestions": [
    {
      "type": "normalize|format|duplicate|missing|inconsistency",
      "column": "<column name or index>",
      "title": "<short title>",
      "description": "<detailed description>",
      "priority": "high|medium|low"
    }
  ],
  "columnStats": [
    {
      "column": "<column name>",
      "type": "<detected type: text|number|date|mixed>",
      "uniqueValues": <count>,
      "emptyCount": <count>,
      "issues": ["<any issues found>"]
    }
  ]
}

Focus on actionable insights relevant to Jira and application portfolio management data.
Return ONLY valid JSON.`;
    }

    const analysis = await callAI({ provider, systemPrompt, prompt });
    res.json(analysis);
  } catch (error) {
    if (error.message.includes('not configured')) {
      return res.status(400).json({
        error: error.message,
        suggestions: [
          {
            type: 'info',
            title: 'AI Not Configured',
            description: `To enable AI analysis, add your key to the .env file as ${error.message.includes('Gemini') ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY'}.`,
          },
        ],
      });
    }
    safeError(res, 500, 'AI analysis failed', error);
  }
});

// Generate a plain-English report
router.post('/report', aiRateLimit, async (req, res) => {
  try {
    const { data, sheetName, provider = 'gemini' } = req.body;

    if (!data || data.length === 0) {
      return safeError(res, 400, 'No data provided for report generation');
    }

    const sampleData = data.slice(0, 100);
    const dataPreview = JSON.stringify(sampleData, null, 2);
    const totalRows = data.length;

    const systemPrompt = `You are a friendly business analyst writing a report for someone who is NOT technical.
Write in plain, conversational English — like you're explaining it to a coworker over coffee.
Avoid jargon, technical terms, and spreadsheet-specific language.`;

    const prompt = `Analyze this spreadsheet data from "${sheetName || 'Sheet1'}" (showing ${sampleData.length} of ${totalRows} total rows):
${dataPreview}

Return a JSON response with this EXACT structure:
{
  "title": "<A clear, descriptive title for this report — e.g. 'Monthly Budget Overview' or 'Team Task Summary'>",
  "generatedAt": "<current date in 'Month Day, Year' format>",
  "overview": "<2-3 sentences explaining what this data contains, who it's for, and what time period or scope it covers. Write it like the opening paragraph of a memo.>",
  "keyFindings": [
    {
      "emoji": "<one relevant emoji>",
      "headline": "<short headline, 5-8 words>",
      "detail": "<1-2 sentences explaining this finding in plain language. Use specific numbers. Explain WHY it matters.>"
    }
  ],
  "highlights": [
    {
      "label": "<what this number represents — e.g. 'Total Revenue' or 'Tasks Completed'>",
      "value": "<the number or value, formatted nicely — e.g. '$12,450.00' or '47 tasks'>",
      "context": "<brief context — e.g. 'across all departments' or 'so far this quarter'>"
    }
  ],
  "concerns": [
    {
      "emoji": "⚠️",
      "title": "<what the concern is>",
      "detail": "<explain the problem simply and why someone should care>"
    }
  ],
  "recommendations": [
    {
      "emoji": "💡",
      "action": "<what to do — start with a verb>",
      "reason": "<why this helps, in simple terms>"
    }
  ]
}

Guidelines:
- keyFindings: 3-5 items, the most important takeaways
- highlights: 3-6 notable numbers or stats
- concerns: 1-3 problems or gaps (or empty array if none)
- recommendations: 2-4 actionable next steps
- Use real numbers from the data, not placeholders
- Write for an average person, not a data scientist
- Be specific and helpful, not generic

Return ONLY valid JSON.`;

    const report = await callAI({ provider, systemPrompt, prompt });
    res.json(report);
  } catch (error) {
    console.error('[AI Router] Error:', error);
    if (error.message.includes('not configured')) {
      return res.status(400).json({ error: error.message });
    }
    safeError(res, 500, 'Report generation failed', error);
  }
});

// Generate a report and save to Excel dashboard
router.post('/report-excel', aiRateLimit, async (req, res) => {
  try {
    const { data, sheetName, fileId, provider = 'gemini' } = req.body;

    if (!data || data.length === 0 || !fileId) {
      return safeError(res, 400, 'Missing data or fileId');
    }

    // 1. Generate the AI report (reusing the same prompt logic)
    const sampleData = data.slice(0, 100);
    const dataPreview = JSON.stringify(sampleData, null, 2);
    const totalRows = data.length;

    const systemPrompt = `You are a friendly business analyst writing a report for someone who is NOT technical.
Write in plain, conversational English — like you're explaining it to a coworker over coffee.
Avoid jargon, technical terms, and spreadsheet-specific language.`;

    const prompt = `Analyze this spreadsheet data from "${sheetName || 'Sheet1'}" (showing ${sampleData.length} of ${totalRows} total rows):
${dataPreview}

Return a JSON response with this EXACT structure:
{
  "title": "<title>",
  "generatedAt": "<Month Day, Year>",
  "overview": "<2-3 sentence overview>",
  "keyFindings": [{ "emoji": "<emoji>", "headline": "<headline>", "detail": "<detail>" }],
  "highlights": [{ "label": "<label>", "value": "<value>", "context": "<context>" }],
  "concerns": [{ "emoji": "⚠️", "title": "<title>", "detail": "<detail>" }],
  "recommendations": [{ "emoji": "💡", "action": "<action>", "reason": "<reason>" }]
}

Return ONLY valid JSON.`;

    const report = await callAI({ provider, systemPrompt, prompt });

    // 2. Load the existing Excel file
    const uploadsDir = path.join(process.cwd(), 'server', 'uploads');
    const filePath = path.join(uploadsDir, `${fileId}.xlsx`);

    if (!fs.existsSync(filePath)) {
      return safeError(res, 404, 'File not found');
    }

    const workbook = XLSX.readFile(filePath);

    // 3. Create "Dashboard" sheet
    const dashboardData = [
      ['AI ANALYSIS DASHBOARD', '', ''],
      ['Title', report.title, ''],
      ['Generated At', report.generatedAt, ''],
      ['', '', ''],
      ['OVERVIEW', '', ''],
      [report.overview, '', ''],
      ['', '', ''],
      ['KEY FINDINGS', '', ''],
      ...report.keyFindings.map(f => [`${f.emoji} ${f.headline}`, f.detail, '']),
      ['', '', ''],
      ['DATA HIGHLIGHTS', '', ''],
      ...report.highlights.map(h => [h.label, h.value, h.context]),
      ['', '', ''],
      ['CONCERNS', '', ''],
      ...report.concerns.map(c => [`${c.emoji} ${c.title}`, c.detail, '']),
      ['', '', ''],
      ['RECOMMENDATIONS', '', ''],
      ...report.recommendations.map(r => [`${r.emoji} ${r.action}`, r.reason, '']),
    ];

    const dashboardSheet = XLSX.utils.aoa_to_sheet(dashboardData);

    // Remove existing Dashboard if it exists
    if (workbook.SheetNames.includes('Dashboard')) {
      const index = workbook.SheetNames.indexOf('Dashboard');
      workbook.SheetNames.splice(index, 1);
      delete workbook.Sheets['Dashboard'];
    }

    // Add new Dashboard at the beginning
    workbook.SheetNames.unshift('Dashboard');
    workbook.Sheets['Dashboard'] = dashboardSheet;

    // 4. Update "Report History" sheet
    let historySheet;
    const historyHeader = ['Timestamp', 'Title', 'Overview', 'Provider'];
    const historyRow = [new Date().toISOString(), report.title, report.overview, provider];

    if (workbook.SheetNames.includes('Report History')) {
      historySheet = workbook.Sheets['Report History'];
      const historyData = XLSX.utils.sheet_to_json(historySheet, { header: 1 });
      historyData.push(historyRow);
      historySheet = XLSX.utils.aoa_to_sheet(historyData);
      workbook.Sheets['Report History'] = historySheet;
    } else {
      workbook.SheetNames.push('Report History');
      historySheet = XLSX.utils.aoa_to_sheet([historyHeader, historyRow]);
      workbook.Sheets['Report History'] = historySheet;
    }

    // 5. Save the file
    XLSX.writeFile(workbook, filePath);

    res.json({ 
      success: true, 
      message: 'Dashboard created successfully', 
      report, 
      sheets: workbook.SheetNames 
    });
  } catch (error) {
    console.error('[500] Failed to create Excel dashboard:', error);
    safeError(res, 500, 'Failed to create Excel dashboard', error);
  }
});

// Specialized Jira/Portfolio Dashboard
router.post('/report-jira', aiRateLimit, async (req, res) => {
  try {
    const { data, sheetName, fileId, provider = 'gemini' } = req.body;

    if (!data || data.length === 0 || !fileId) {
      return safeError(res, 400, 'Missing data or fileId');
    }

    const sampleData = data.slice(0, 100);
    const dataPreview = JSON.stringify(sampleData, null, 2);

    const systemPrompt = `You are a Senior Project Management Consultant specialized in Jira and Portfolio/Advanced Roadmaps.
Your goal is to provide high-impact, strategic insights for a PMO or Project Manager.`;

    const prompt = `Analyze this Jira/Portfolio data from "${sheetName || 'Plan'}":
${dataPreview}

Return a JSON response with this EXACT structure:
{
  "title": "<title>",
  "healthScore": <0-100>,
  "planHealth": {
    "status": "Green|Amber|Red",
    "summary": "<brief summary>"
  },
  "metrics": [
    { "label": "Velocity Trend", "value": "<value>", "trend": "up|down|stable" },
    { "label": "Capacity Utilization", "value": "<percentage>", "trend": "high|balanced|low" }
  ],
  "topRisks": [
    { "type": "Schedule|Resource|Dependency", "description": "<description>", "mitigation": "<action>" }
  ],
  "sprintInsights": [
    { "sprint": "<name>", "status": "<detail>", "completion": "<percentage>" }
  ]
}

Return ONLY valid JSON.`;

    const report = await callAI({ provider, systemPrompt, prompt });

    const uploadsDir = path.join(process.cwd(), 'server', 'uploads');
    const filePath = path.join(uploadsDir, `${fileId}.xlsx`);

    if (!fs.existsSync(filePath)) {
      return safeError(res, 404, 'File not found');
    }

    const workbook = XLSX.readFile(filePath);

    // Create "Jira Dashboard" sheet
    const dashboardData = [
      ['JIRA PORTFOLIO DASHBOARD', '', ''],
      ['Plan Health Score', `${report.healthScore}%`, ''],
      ['Status', report.planHealth.status, report.planHealth.summary],
      ['', '', ''],
      ['STRATEGIC METRICS', '', ''],
      ...report.metrics.map(m => [m.label, m.value, m.trend]),
      ['', '', ''],
      ['PLAN RISKS & MITIGATION', '', ''],
      ['Type', 'Description', 'Mitigation'],
      ...report.topRisks.map(r => [r.type, r.description, r.mitigation]),
      ['', '', ''],
      ['SPRINT PROGRESS', '', ''],
      ['Sprint', 'Status', 'Completion'],
      ...report.sprintInsights.map(s => [s.sprint, s.status, s.completion]),
    ];

    const dashboardSheet = XLSX.utils.aoa_to_sheet(dashboardData);

    if (workbook.SheetNames.includes('Jira Dashboard')) {
      const index = workbook.SheetNames.indexOf('Jira Dashboard');
      workbook.SheetNames.splice(index, 1);
      delete workbook.Sheets['Jira Dashboard'];
    }

    workbook.SheetNames.unshift('Jira Dashboard');
    workbook.Sheets['Jira Dashboard'] = dashboardSheet;

    XLSX.writeFile(workbook, filePath);

    res.json({ 
      success: true, 
      message: 'Jira Dashboard created', 
      report, 
      sheets: workbook.SheetNames 
    });
  } catch (error) {
    safeError(res, 500, 'Jira Dashboard failed', error);
  }
});

export default router;
