import dotenv from 'dotenv';
dotenv.config();

async function testRawFetch() {
  const apiKey = process.env.GEMINI_API_KEY;
  const versions = ['v1', 'v1beta'];
  const model = 'gemini-1.5-flash';

  for (const v of versions) {
    console.log(`Testing version ${v}...`);
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/${v}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say hello" }] }]
        })
      });
      const data = await resp.json();
      console.log(`Status ${resp.status}:`, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(`Failed ${v}:`, err.message);
    }
  }
}

testRawFetch();
