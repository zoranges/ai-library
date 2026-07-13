import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { queryAll, queryOne, run } from '../db/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { extractAndScan, getBookBuffer, generateCoverFromBook, generateCoverFromBookBuffer } from '../services/bookMetadata.js';
import { analyzeBookMetadata, type AIMetadata } from '../services/aiMetadata.js';
import type { ScannedBook } from '../services/bookMetadata.js';
import { getStorageProvider, buildKey } from '../services/storage/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

router.use(verifyToken);
router.use(requireRole('admin', 'super_admin'));

// ── Multer for ZIP ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are allowed'));
    }
  },
});

// ── In-memory batch sessions ──
interface BatchBook extends ScannedBook {
  aiMetadata?: AIMetadata;
  import: boolean;
  userEdits?: Partial<AIMetadata>;
}

interface SkippedItem {
  fileName: string;
  title: string;
  reason: string;
}

interface BatchSession {
  batchId: string;
  status: 'extracting' | 'analyzing' | 'ready' | 'importing' | 'done' | 'error';
  progress: { stage: string; current: number; total: number; message: string };
  books: BatchBook[];
  errors: string[];
  skippedItems: SkippedItem[];
  zipBuffer: Buffer;
  createdAt: number;
}

const sessions = new Map<string, BatchSession>();

// Cleanup old sessions every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 3600000;
  for (const [id, session] of sessions) {
    if (session.createdAt < cutoff) {
      const tmpDir = path.join(__dirname, '..', '..', 'uploads', 'tmp', `batch-${id}`);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      sessions.delete(id);
    }
  }
}, 300000);

function getTmpDir(batchId: string): string {
  const dir = path.join(__dirname, '..', '..', 'uploads', 'tmp', `batch-${batchId}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Multer error wrapper ──
function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
}

// ── POST /upload ──
router.post('/upload', uploadMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No ZIP file provided' });
      return;
    }

    const batchId = uuidv4();
    const zipBuffer = req.file.buffer;

    // Save files to temp disk
    const tmpDir = getTmpDir(batchId);

    const session: BatchSession = {
      batchId,
      status: 'extracting',
      progress: { stage: 'extract', current: 0, total: 0, message: '正在解压 ZIP 文件...' },
      books: [],
      errors: [],
      skippedItems: [],
      zipBuffer,
      createdAt: Date.now(),
    };
    sessions.set(batchId, session);

    // Return immediately, process async
    res.json({
      success: true,
      data: { batchId, status: 'extracting' },
    });

    // Async processing
    processBatch(session, tmpDir).catch(err => {
      console.error('Batch processing error:', err);
      session.status = 'error';
      session.errors.push(err.message);
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function processBatch(session: BatchSession, tmpDir: string) {
  const zipBuffer = session.zipBuffer;

  // Stage 1: Extract & Scan
  session.progress = { stage: 'extract', current: 0, total: 0, message: '正在解压并扫描文件...' };
  const { books: scanned, errors } = extractAndScan(zipBuffer);

  if (scanned.length === 0) {
    session.status = 'error';
    session.errors.push(...errors);
    return;
  }

  session.errors.push(...errors);

  // Write files to tmp disk
  for (const book of scanned) {
    const bookDir = path.join(tmpDir, book.id);
    fs.mkdirSync(bookDir, { recursive: true });

    const bookBuf = getBookBuffer(zipBuffer, book.filePath);
    if (bookBuf) {
      fs.writeFileSync(path.join(bookDir, book.fileName), bookBuf);
    }

    if (book.coverPath) {
      const coverBuf = getBookBuffer(zipBuffer, book.coverPath);
      if (coverBuf) {
        const coverExt = path.extname(book.coverFileName || 'cover.jpg');
        fs.writeFileSync(path.join(bookDir, `cover${coverExt}`), coverBuf);
      }
    }
  }

  const batchBooks: BatchBook[] = scanned.map(b => ({ ...b, import: true }));
  session.books = batchBooks;

  // Stage 2: AI Analysis
  session.progress = { stage: 'analyze', current: 0, total: batchBooks.length, message: '正在 AI 分析图书元数据...' };

  for (let i = 0; i < batchBooks.length; i++) {
    const book = batchBooks[i];
    session.progress = {
      stage: 'analyze',
      current: i + 1,
      total: batchBooks.length,
      message: `AI 分析中: ${book.fileName} (${i + 1}/${batchBooks.length})`,
    };

    const aiResult = await analyzeBookMetadata(book);
    book.aiMetadata = aiResult;
  }

  // Done — release zip buffer from memory
  session.zipBuffer = Buffer.alloc(0);
  session.status = 'ready';
  session.progress = { stage: 'ready', current: batchBooks.length, total: batchBooks.length, message: '分析完成，等待审核' };
}

// ── GET /status/:batchId ──
router.get('/status/:batchId', (req: Request, res: Response): void => {
  const session = sessions.get(req.params.batchId);
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found or expired' });
    return;
  }

  const books = session.status === 'ready' || session.status === 'importing' || session.status === 'done'
    ? session.books.map(b => ({
        id: b.id,
        fileName: b.fileName,
        format: b.format,
        fileSize: b.fileSize,
        coverFileName: b.coverFileName,
        suggestedCategory: b.suggestedCategory,
        extractedMetadata: b.extractedMetadata,
        aiMetadata: b.aiMetadata,
        import: b.import,
        userEdits: b.userEdits,
      }))
    : undefined;

  res.json({
    success: true,
    data: {
      batchId: session.batchId,
      status: session.status,
      progress: session.progress,
      books,
      errors: session.errors,
      skippedItems: session.skippedItems,
    },
  });
});

// ── POST /import ──
router.post('/import', async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId, books: booksToImport } = req.body;

    const session = sessions.get(batchId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found or expired' });
      return;
    }

    if (session.status !== 'ready') {
      res.status(400).json({ success: false, error: 'Batch is not ready for import' });
      return;
    }

    session.status = 'importing';
    session.progress = { stage: 'import', current: 0, total: 0, message: '正在准备...' };

    const tmpDir = path.join(__dirname, '..', '..', 'uploads', 'tmp', `batch-${batchId}`);
    const storage = getStorageProvider();

    // ── Phase 1: Resolve categories & check duplicates (fast, sequential) ──
    const tasks: Array<{
      input: any;
      meta: any;
      categoryId: string | null;
      bookId: string;
      bookKey: string;
      coverKey: string;
      srcBookPath: string;
      srcCoverPath: string;
      skipReason?: string;
    }> = [];

    for (const input of booksToImport) {
      if (!input.import) continue;

      const meta = { ...input.aiMetadata, ...input.userEdits };

      // Resolve category
      let categoryId: string | null = null;
      if (meta.categoryName) {
        const existing = await queryOne<{ id: string }>(
          'SELECT id FROM book_categories WHERE name = ?', [meta.categoryName]
        );
        if (existing) {
          categoryId = existing.id;
        } else {
          const newCatId = uuidv4();
          const maxOrder = await queryOne<{ m: number }>(
            'SELECT MAX(sortOrder) as m FROM book_categories'
          );
          await run(
            'INSERT INTO book_categories (id, name, icon, color, sortOrder) VALUES (?, ?, ?, ?, ?)',
            [newCatId, meta.categoryName, '📚', '#6366f1', (maxOrder?.m || 0) + 1]
          );
          categoryId = newCatId;
        }
      } else {
        const firstCat = await queryOne<{ id: string }>(
          'SELECT id FROM book_categories ORDER BY sortOrder ASC LIMIT 1'
        );
        if (firstCat) {
          categoryId = firstCat.id;
        } else {
          const newCatId = uuidv4();
          await run(
            'INSERT INTO book_categories (id, name, icon, color, sortOrder) VALUES (?, ?, ?, ?, ?)',
            [newCatId, '未分类', '📚', '#6366f1', 1]
          );
          categoryId = newCatId;
        }
      }

      // Check for duplicate
      const existing = await queryOne<{ id: string }>(
        'SELECT id, title FROM books WHERE title = ? AND author = ? AND isActive = 1 LIMIT 1',
        [meta.title || input.fileName, meta.author || '']
      );
      if (existing) {
        session.skippedItems.push({
          fileName: input.fileName,
          title: meta.title || input.fileName,
          reason: 'Duplicate: already exists in library',
        });
        continue;
      }

      const bookId = uuidv4();
      const bookExt = path.extname(input.fileName);
      const srcBookPath = path.join(tmpDir, input.id, input.fileName);
      const bookKey = buildKey('books', `${bookId}${bookExt}`);

      // Determine cover source
      let coverKey = '';
      let srcCoverPath = '';
      const coverExt = input.coverFileName ? path.extname(input.coverFileName) : '';
      if (input.coverFileName) {
        srcCoverPath = path.join(tmpDir, input.id, `cover${coverExt}`);
        if (fs.existsSync(srcCoverPath)) {
          coverKey = buildKey('covers', `${bookId}${coverExt}`);
        }
      }

      tasks.push({ input, meta, categoryId, bookId, bookKey, coverKey, srcBookPath, srcCoverPath });
    }

    const total = tasks.length;
    session.progress = { stage: 'import', current: 0, total, message: `正在上传 ${total} 本书...` };

    // ── Phase 2: Upload files to OSS in parallel ──
    const CONCURRENCY = 3;
    let completed = 0;

    async function uploadOne(task: typeof tasks[0]) {
      // Upload book file
      let fileKey = '';
      if (fs.existsSync(task.srcBookPath)) {
        const bookBuffer = fs.readFileSync(task.srcBookPath);
        await storage.upload(task.bookKey, bookBuffer, 'application/octet-stream');
        fileKey = task.bookKey;
      }

      // Upload or generate cover
      let coverKey = task.coverKey;
      if (task.srcCoverPath && fs.existsSync(task.srcCoverPath)) {
        const coverExt = path.extname(task.srcCoverPath);
        const coverBuffer = fs.readFileSync(task.srcCoverPath);
        const mimeType = coverExt === '.png' ? 'image/png' : coverExt === '.webp' ? 'image/webp' : 'image/jpeg';
        await storage.upload(coverKey, coverBuffer, mimeType);
      } else if (!coverKey && fileKey) {
        const bookFormat = task.input.format || path.extname(task.input.fileName).replace('.', '');
        if (bookFormat === 'pdf' || bookFormat === 'epub') {
          const bookBuffer = fs.readFileSync(task.srcBookPath);
          const coverBuffer = generateCoverFromBookBuffer(bookBuffer, bookFormat);
          if (coverBuffer) {
            coverKey = buildKey('covers', `${task.bookId}.jpg`);
            await storage.upload(coverKey, coverBuffer, 'image/jpeg');
          }
        }
      }

      completed++;
      session.progress = {
        stage: 'import',
        current: completed,
        total,
        message: `上传中: ${task.meta.title || task.input.fileName} (${completed}/${total})`,
      };

      return { task, fileKey, coverKey };
    }

    // Run with concurrency limit
    const results: Awaited<ReturnType<typeof uploadOne>>[] = [];
    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      const batch = tasks.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(uploadOne));
      results.push(...batchResults);
    }

    // ── Phase 3: Insert into DB (fast, sequential) ──
    let imported = 0;
    const skipped = booksToImport.length - total;

    session.progress = { stage: 'import', current: completed, total, message: '正在写入数据库...' };

    for (const { task, fileKey, coverKey } of results) {
      await run(
        `INSERT INTO books (id, title, author, isbn, publisher, description, categoryId,
          language, fileType, coverUrl, fileUrl, difficulty, pageCount, copyright, publishDate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.bookId,
          task.meta.title || task.input.fileName,
          task.meta.author || '',
          task.meta.isbn || '',
          task.meta.publisher || '',
          task.meta.description || '',
          task.categoryId,
          task.meta.language || 'zh',
          task.input.format || path.extname(task.input.fileName).toLowerCase().replace('.', '') || 'epub',
          coverKey,
          fileKey,
          task.meta.difficulty || 'intermediate',
          task.meta.pageCount || 0,
          task.meta.copyright || '',
          task.meta.publishDate || '',
        ]
      );
      imported++;
    }

    // Cleanup temp files
    fs.rmSync(tmpDir, { recursive: true, force: true });
    session.status = 'done';
    session.progress = { stage: 'done', current: imported, total: imported, message: '导入完成' };

    res.json({
      success: true,
      data: { imported, skipped, skippedItems: session.skippedItems },
    });
  } catch (err: any) {
    console.error('Import error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
