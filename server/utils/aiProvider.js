import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

export async function callAI({ provider = 'gemini', prompt, systemPrompt, responseType = 'json' }) {
  if (provider === 'openai') {
    return callOpenAI({ prompt, systemPrompt, responseType });
  } else {
    return callGemini({ prompt, systemPrompt, responseType });
  }
}

/**
 * Specialized helper for data normalization
 */
export async function getNormalizationSuggestions({ data, sheetName, provider = 'gemini' }) {
  const systemPrompt = `You are a data quality and normalization expert.
Your goal is to find semantic inconsistencies in spreadsheet data that cannot be caught by simple rules.

Examples of what to find:
1. Misspellings (e.g., "Gogle" -> "Google")
2. Abbreviation inconsistencies (e.g., "St." vs "Street", "CA" vs "California")
3. Semantic duplicates (e.g., "Acme Corp" vs "Acme Corporation")
4. Platform-specific normalization (e.g., Jira statuses, priority levels)
5. General data mapping/standardization

Input Data (JSON):
The data provided is a sample of the spreadsheet rows.

Output Format (JSON):
Return ONLY a JSON array of "rules" with this exact structure:
[
  {
    "category": "ai_suggestion",
    "categoryLabel": "AI Semantic Suggestion",
    "icon": "✨",
    "column": "<column name>",
    "row": <row number 1-indexed>,
    "colIndex": <0-indexed column index>,
    "rowIndex": <0-indexed row index including header>,
    "currentValue": "<original value>",
    "suggestedValue": "<normalized value>",
    "description": "<brief explanation of why this fix is suggested>",
    "isAI": true
  }
]

Return an empty array [] if no semantic issues are found. Do NOT suggest changes for whitespace or casing issues as those are handled by local rules.`;

  const prompt = `Sheet Name: ${sheetName || 'Sheet1'}
Data Sample:
${JSON.stringify(data, null, 2)}

Analyze and return normalization rules.`;

  return callAI({ provider, systemPrompt, prompt, responseType: 'json' });
}

/**
 * Specialized helper for Portfolio / Advanced Roadmaps analysis
 */
export async function analyzePortfolioData({ data, sheetName, provider = 'gemini' }) {
  const systemPrompt = `You are a Project Management and Portfolio Analysis expert.
You are analyzing data from Jira Portfolio / Advanced Roadmaps.

Your goal is to:
1. Identify plan health issues (e.g., Target Start after Target End, missing dates).
2. Capacity & Velocity: Based on "Original Estimate" and "Story Points", predict if the current "Team" or "Assignee" distribution is realistic.
3. Find dependency risks (e.g., "Blocked By" links with late target dates).
4. Standardize Portfolio-specific fields (Teams, Program Increments, Initiatives).
5. Provide a strategic "Plan Health" score and actionable release advice.

Output Format (JSON):
Return a JSON object with this structure:
{
  "healthScore": <0-100>,
  "insights": [
    { "type": "warning|success|info", "label": "<short title>", "detail": "<explanation>" }
  ],
  "recommendations": ["<action item 1>", "<action item 2>"],
  "capacityForecast": {
    "status": "Healthy|At Risk|Overloaded",
    "observation": "<brief summary of capacity findings>"
  }
}`;

  const prompt = `Sheet Name: ${sheetName || 'Portfolio Plan'}
Data Sample:
${JSON.stringify(data, null, 2)}

Analyze this Portfolio data and provide plan health insights.`;

  return callAI({ provider, systemPrompt, prompt, responseType: 'json' });
}

async function callGemini({ prompt, systemPrompt, responseType }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured');
  }

  // Use a model ID we KNOW is functional from our list
  const modelId = 'gemini-2.5-flash'; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  console.log(`[AI] Calling Gemini via Fetch (${modelId}). Key present: ${!!apiKey}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[AI] Gemini API Error (${response.status}):`, errText);
      try {
        const fs = await import('fs');
        fs.writeFileSync('ai-debug.txt', `STATUS: ${response.status}\nERROR: ${errText}\nJSON: ${JSON.stringify({url, modelId}, null, 2)}`);
      } catch (e) {}
      throw new Error(`AI Request Failed: ${response.status}`);
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('[AI] Gemini returned empty response:', JSON.stringify(data));
      throw new Error('AI returned empty response');
    }

    console.log('[AI] Gemini response received via Fetch.');

    if (responseType === 'json') {
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('[AI] Failed to parse Gemini JSON:', text);
        throw new Error('AI returned invalid JSON');
      }
    }

    return text;
  } catch (error) {
    console.error('[AI] Gemini Fetch Call Failed:', error.message);
    throw error;
  }
}

async function callOpenAI({ prompt, systemPrompt, responseType }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey });

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // or 'gpt-3.5-turbo'
    messages: messages,
    response_format: responseType === 'json' ? { type: 'json_object' } : undefined,
  });

  let text = response.choices[0].message.content;

  if (responseType === 'json') {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse OpenAI JSON:', text);
      throw new Error('AI returned invalid JSON');
    }
  }

  return text;
}
