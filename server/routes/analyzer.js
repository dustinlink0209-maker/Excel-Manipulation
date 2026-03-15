import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { sanitizeFileId, safeError } from '../utils/security.js';
import { analyzeSheetData } from '../utils/analyzer.js';
import { readSheet } from '../utils/excelHelper.js';
import { getNormalizationSuggestions } from '../utils/aiProvider.js';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');

const router = express.Router();

// Helper to resolve file path from ID (ID is already sanitized before calling this)
function resolveFilePath(safeId) {
  const metaPath = path.join(uploadsDir, `${safeId}.meta.json`);
  if (!fs.existsSync(metaPath)) return null;
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  return path.join(uploadsDir, meta.filename);
}

// Analyze a sheet's data
router.post('/analyze', async (req, res) => {
  try {
    const { fileId, sheetName, useAI = false, provider = 'gemini' } = req.body;

    if (!fileId) return safeError(res, 400, 'No file ID provided');

    const safeId = sanitizeFileId(fileId);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');

    const filePath = resolveFilePath(safeId);
    if (!filePath) return safeError(res, 404, 'File not found');

    const sheet = readSheet(filePath, sheetName);
    const analysis = analyzeSheetData(sheet.data);

    // If AI is enabled, fetch semantic suggestions
    if (useAI && sheet.data.length > 1) {
      try {
        // Sample data for AI (first 50 rows)
        const sampleData = sheet.data.slice(0, 50);
        const aiSuggestions = await getNormalizationSuggestions({
          data: sampleData,
          sheetName,
          provider
        });

        if (Array.isArray(aiSuggestions) && aiSuggestions.length > 0) {
          // Merge AI suggestions into the analysis
          analysis.rules = [...analysis.rules, ...aiSuggestions];
          
          // Add AI category to categories if not present
          const hasAICategory = analysis.categories.some(c => c.category === 'ai_suggestion');
          if (!hasAICategory) {
            analysis.categories.push({
              category: 'ai_suggestion',
              categoryLabel: 'AI Semantic Suggestions',
              icon: '✨',
              issues: aiSuggestions.map(s => ({
                column: s.column,
                description: s.description,
                affectedRows: [s.row],
                severity: 'medium'
              })),
              count: aiSuggestions.length,
              ruleCount: aiSuggestions.length
            });
          } else {
            const aiCat = analysis.categories.find(c => c.category === 'ai_suggestion');
            aiCat.count += aiSuggestions.length;
            aiCat.ruleCount += aiSuggestions.length;
            aiCat.issues.push(...aiSuggestions.map(s => ({
              column: s.column,
              description: s.description,
              affectedRows: [s.row],
              severity: 'medium'
            })));
          }
          
          analysis.stats.issueCount += aiSuggestions.length;
          analysis.stats.fixableCount += aiSuggestions.length;
          analysis.summary += ` Included ${aiSuggestions.length} AI-powered semantic suggestions.`;
        }
      } catch (aiError) {
        console.error('AI Normalization failed:', aiError);
        // Continue without AI suggestions if it fails
        analysis.summary += ' (AI semantic analysis failed, showing local rules only)';
      }
    }

    res.json(analysis);
  } catch (error) {
    safeError(res, 500, 'Analysis failed', error);
  }
});

// Apply normalization rules to a sheet
router.post('/apply', (req, res) => {
  try {
    const { fileId, sheetName, rules } = req.body;

    if (!fileId || !sheetName || !rules?.length) {
      return safeError(res, 400, 'Missing fileId, sheetName, or rules');
    }

    const safeId = sanitizeFileId(fileId);
    if (!safeId) return safeError(res, 400, 'Invalid file ID');

    const filePath = resolveFilePath(safeId);
    if (!filePath) return safeError(res, 404, 'File not found');

    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      return safeError(res, 404, 'Sheet not found');
    }

    rules.forEach(rule => {
      const cellAddress = XLSX.utils.encode_cell({ r: rule.rowIndex, c: rule.colIndex });
      const value = rule.suggestedValue;

      if (value === '' || value === null || value === undefined) {
        worksheet[cellAddress] = { t: 'z' };
      } else if (typeof value === 'number' || (!isNaN(value) && value !== '')) {
        worksheet[cellAddress] = { t: 'n', v: Number(value) };
      } else {
        worksheet[cellAddress] = { t: 's', v: String(value) };
      }
    });

    XLSX.writeFile(workbook, filePath);

    const updatedSheet = readSheet(filePath, sheetName);
    res.json({
      success: true,
      appliedCount: rules.length,
      sheet: updatedSheet,
    });
  } catch (error) {
    safeError(res, 500, 'Failed to apply normalizations', error);
  }
});

export default router;
