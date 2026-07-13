import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import booksRoutes from './routes/books.js';
import readingRoutes from './routes/reading.js';
import learningRoutes from './routes/learning.js';
import aiRoutes from './routes/ai.js';
import leaderboardRoutes from './routes/leaderboard.js';
import adminRoutes from './routes/admin.js';
import batchRoutes from './routes/batchUpload.js';
import systemRoutes from './routes/system.js';
import { requestLogger } from './middleware/requestLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: express.Application = express();

app.use(cors());

// Log large requests + skip body parsing for batch upload to avoid size limits
app.use((req: Request, _res: Response, next: NextFunction): void => {
  const len = parseInt(req.headers['content-length'] || '0', 10);
  if (len > 10 * 1024 * 1024) {
    console.log(`[REQ] ${req.method} ${req.url} type=${req.headers['content-type']} len=${(len / 1024 / 1024).toFixed(1)}MB`);
  }
  // Mark body as already parsed for batch upload route so body parsers skip it
  if (req.path === '/api/admin/batch/upload' && req.method === 'POST') {
    (req as any)._body = true;
  }
  next();
});

app.use(express.json({ limit: '250mb' }));
app.use(express.urlencoded({ extended: true, limit: '250mb' }));
app.use('/api', (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(requestLogger);

// Serve uploads as static files for local storage mode; in S3 mode files are served via signed URLs
const uploadsPath = path.join(__dirname, '..', 'uploads');
if (fs.existsSync(uploadsPath)) {
  app.use('/uploads', express.static(uploadsPath));
}

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

app.use('/api/auth', authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/reading', readingRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin/batch', batchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', systemRoutes);

app.get('/api/health', (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'ok' });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Server error:', error);
  res.status(500).json({ success: false, error: 'Server internal error' });
});

app.use((_req: Request, res: Response): void => {
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ success: false, error: 'API not found' });
  }
});

export default app;
