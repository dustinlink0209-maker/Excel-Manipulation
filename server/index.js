import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import filesRouter from './routes/files.js';
import excelRouter from './routes/excel.js';
import aiRouter from './routes/ai.js';
import analyzerRouter from './routes/analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: /^http:\/\/localhost(:\d+)?$/,
  optionsSuccessStatus: 200,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/files', filesRouter);
app.use('/api/excel', excelRouter);
app.use('/api/ai', aiRouter);
app.use('/api/analyzer', analyzerRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✅ Excel Manager Pro API running on http://localhost:${PORT}`);
});
