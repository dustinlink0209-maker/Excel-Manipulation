import dotenv from 'dotenv';
dotenv.config();

async function dumpModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await resp.json();
  fs.writeFileSync('models_dump.json', JSON.stringify(data, null, 2));
  console.log('Dumped models to models_dump.json');
}

import fs from 'fs';
dumpModels();
