import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing Gemini with key:', apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING');
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const models = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  
  for (const modelName of models) {
    console.log(`Trying model: ${modelName}`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Say hello");
      console.log(`✅ ${modelName} Success:`, result.response.text());
      return;
    } catch (err) {
      console.error(`❌ ${modelName} Failed:`, err.message);
    }
  }
}

testGemini();
