// Node 22 has built-in fetch
import fs from 'fs';

async function testReportExcel() {
  const url = 'http://localhost:3002/api/ai/report-excel';
  const data = [
    ['Header1', 'Header2'],
    ['Value1', 'Value2'],
    ['Value3', 'Value4']
  ];
  const fileId = '2026 Budget'; 

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, fileId, sheetName: 'Sheet1', provider: 'gemini' })
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Raw Response:', text);

    try {
      const body = JSON.parse(text);
      console.log('Parsed Response:', JSON.stringify(body, null, 2));
    } catch (e) {
      console.log('Response is not JSON');
    }

    if (response.ok) {
      console.log('✅ Backend test passed!');
    } else {
      console.log('❌ Backend test failed!');
    }
  } catch (err) {
    console.error('Error during test:', err);
  }
}

testReportExcel();
