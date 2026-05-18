import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.get('/progress', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const progress = await queryAll(
      `SELECT rp.*, b.title, b.author, b.coverUrl, b.pageCount as bookPageCount, b.language, b.difficulty,
              c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor
       FROM reading_progress rp
       JOIN books b ON rp.bookId = b.id
       LEFT JOIN book_categories c ON b.categoryId = c.id
       WHERE rp.userId = ?
       ORDER BY rp.lastReadAt DESC`,
      [userId]
    );

    const formatted = progress.map(p => ({
      ...p,
      book: {
        id: p.bookId,
        title: p.title,
        author: p.author,
        coverUrl: p.coverUrl,
        pageCount: p.bookPageCount,
        language: p.language,
        difficulty: p.difficulty,
        category: p.categoryName ? {
          id: p.categoryId,
          name: p.categoryName,
          icon: p.categoryIcon,
          color: p.categoryColor,
        } : null,
      },
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch reading progress' });
  }
});

router.get('/progress/:bookId', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const progress = await queryOne(
      `SELECT rp.*, b.title, b.author, b.coverUrl, b.pageCount as bookPageCount
       FROM reading_progress rp
       JOIN books b ON rp.bookId = b.id
       WHERE rp.userId = ? AND rp.bookId = ?`,
      [userId, req.params.bookId]
    );

    if (!progress) {
      res.status(404).json({ success: false, error: 'No reading progress found' });
      return;
    }

    res.json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch reading progress' });
  }
});

router.post('/progress', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { bookId, currentPage, totalPages, lastPosition } = req.body;

    if (!bookId || currentPage === undefined || !totalPages) {
      res.status(400).json({ success: false, error: 'bookId, currentPage, and totalPages are required' });
      return;
    }

    const book = await queryOne('SELECT id, pageCount FROM books WHERE id = ?', [bookId]);
    if (!book) {
      res.status(404).json({ success: false, error: 'Book not found' });
      return;
    }

    const percentage = Math.round((currentPage / totalPages) * 100 * 100) / 100;
    const isCompleted = currentPage >= totalPages ? 1 : 0;
    const now = new Date().toISOString();

    const existing = await queryOne('SELECT id FROM reading_progress WHERE userId = ? AND bookId = ?', [userId, bookId]);

    if (existing) {
      await run(
        'UPDATE reading_progress SET currentPage = ?, totalPages = ?, percentage = ?, lastReadAt = ?, isCompleted = ?, lastPosition = ? WHERE userId = ? AND bookId = ?',
        [currentPage, totalPages, percentage, now, isCompleted, lastPosition || null, userId, bookId]
      );
    } else {
      await run(
        'INSERT INTO reading_progress (id, userId, bookId, currentPage, totalPages, percentage, lastReadAt, isCompleted, startedAt, lastPosition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, bookId, currentPage, totalPages, percentage, now, isCompleted, now, lastPosition || null]
      );
      await run('UPDATE books SET readCount = readCount + 1 WHERE id = ?', [bookId]);
    }

    if (isCompleted) {
      await run('UPDATE users SET points = points + 10 WHERE id = ?', [userId]);
      await run(
        'INSERT INTO points (id, userId, points, type, description, referenceId) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, 10, 'reading', 'Completed reading a book', bookId]
      );
    }

    const updated = await queryOne('SELECT * FROM reading_progress WHERE userId = ? AND bookId = ?', [userId, bookId]);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update reading progress' });
  }
});

router.post('/sessions', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { bookId, startPage, endPage, duration } = req.body;

    if (!bookId || startPage === undefined || endPage === undefined || duration === undefined) {
      res.status(400).json({ success: false, error: 'bookId, startPage, endPage, and duration are required' });
      return;
    }

    const now = new Date().toISOString();
    const sessionId = uuidv4();

    await run(
      'INSERT INTO reading_sessions (id, userId, bookId, startPage, endPage, duration, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sessionId, userId, bookId, startPage, endPage, duration, now, now]
    );

    const pointsEarned = Math.floor(duration / 60) * 2;
    if (pointsEarned > 0) {
      await run('UPDATE users SET points = points + ? WHERE id = ?', [pointsEarned, userId]);
      await run(
        'INSERT INTO points (id, userId, points, type, description, referenceId) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, pointsEarned, 'reading', `Reading session: ${duration} seconds`, sessionId]
      );
    }

    const session = await queryOne('SELECT * FROM reading_sessions WHERE id = ?', [sessionId]);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create reading session' });
  }
});

router.get('/sessions', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { bookId, limit = '20' } = req.query;

    let sql = `SELECT rs.*, b.title, b.author, b.coverUrl
               FROM reading_sessions rs
               JOIN books b ON rs.bookId = b.id
               WHERE rs.userId = ?`;
    const params: unknown[] = [userId];

    if (bookId) {
      sql += ' AND rs.bookId = ?';
      params.push(bookId);
    }

    sql += ' ORDER BY rs.endedAt DESC LIMIT ?';
    params.push(parseInt(limit as string));

    const sessions = await queryAll(sql, params);
    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch reading sessions' });
  }
});

router.get('/history', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { page = '1', pageSize = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * pageSizeNum;

    const countResult = await queryOne(
      'SELECT COUNT(*) as total FROM reading_sessions WHERE userId = ?',
      [userId]
    );
    const total = countResult ? (countResult.total as number) : 0;

    const sessions = await queryAll(
      `SELECT rs.*, b.title, b.author, b.coverUrl
       FROM reading_sessions rs
       JOIN books b ON rs.bookId = b.id
       WHERE rs.userId = ?
       ORDER BY rs.endedAt DESC
       LIMIT ? OFFSET ?`,
      [userId, pageSizeNum, offset]
    );

    res.json({
      success: true,
      data: {
        data: sessions,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch reading history' });
  }
});

router.get('/stats', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const completedBooks = await queryOne(
      'SELECT COUNT(*) as count FROM reading_progress WHERE userId = ? AND isCompleted = 1',
      [userId]
    );
    const totalPages = await queryOne(
      'SELECT COALESCE(SUM(currentPage), 0) as total FROM reading_progress WHERE userId = ?',
      [userId]
    );
    const totalMinutes = await queryOne(
      'SELECT COALESCE(SUM(duration), 0) as total FROM reading_sessions WHERE userId = ?',
      [userId]
    );
    const totalBooks = await queryOne(
      'SELECT COUNT(*) as count FROM reading_progress WHERE userId = ?',
      [userId]
    );
    const user = await queryOne('SELECT points, level FROM users WHERE id = ?', [userId]);
    const quizAvg = await queryOne(
      'SELECT COALESCE(AVG(score), 0) as avg FROM quiz_results WHERE userId = ?',
      [userId]
    );
    const quizCount = await queryOne(
      'SELECT COUNT(*) as count FROM quiz_results WHERE userId = ?',
      [userId]
    );

    const categoryDist = await queryAll(
      `SELECT c.name as category, COUNT(rp.id) as count
       FROM reading_progress rp
       JOIN books b ON rp.bookId = b.id
       JOIN book_categories c ON b.categoryId = c.id
       WHERE rp.userId = ?
       GROUP BY c.name`,
      [userId]
    );

    const weeklyMinutes: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const result = await queryOne(
        `SELECT COALESCE(SUM(duration), 0) as total FROM reading_sessions WHERE userId = ? AND DATE(startedAt) = ?`,
        [userId, dateStr]
      );
      weeklyMinutes.push(Math.round((result?.total as number || 0) / 60));
    }

    const monthlyBooks: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStr = date.toISOString().substring(0, 7);
      const result = await queryOne(
        `SELECT COUNT(*) as count FROM reading_progress WHERE userId = ? AND isCompleted = 1 AND DATE_FORMAT(startedAt, '%Y-%m') = ?`,
        [userId, monthStr]
      );
      monthlyBooks.push(result?.count as number || 0);
    }

    const totalSessions = await queryOne(
      'SELECT COUNT(*) as count FROM reading_sessions WHERE userId = ?',
      [userId]
    );
    const avgSpeed = totalSessions && (totalSessions.count as number) > 0
      ? Math.round(((totalPages?.total as number) || 0) / Math.max(1, (totalMinutes?.total as number) || 1) * 60)
      : 0;

    res.json({
      success: true,
      data: {
        totalBooks: totalBooks?.count || 0,
        completedBooks: completedBooks?.count || 0,
        totalPages: totalPages?.total || 0,
        totalMinutes: Math.round(((totalMinutes?.total as number) || 0) / 60),
        averageSpeed: avgSpeed,
        streak: 0,
        longestStreak: 0,
        quizAverage: Math.round((quizAvg?.avg as number) || 0),
        points: user?.points || 0,
        level: user?.level || 1,
        weeklyMinutes,
        monthlyBooks,
        categoryDistribution: categoryDist,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch reading stats' });
  }
});

export default router;
