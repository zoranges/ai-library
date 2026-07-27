import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';
import { checkAndUnlockAchievements, calculateStreak, calculateLongestStreak } from '../services/achievementChecker.js';
import { awardDailyReading, awardStreakBonus, awardEffectiveReading } from '../services/pointsService.js';

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
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const existing = await queryOne(
      'SELECT id, isCompleted FROM reading_progress WHERE userId = ? AND bookId = ?',
      [userId, bookId]
    );

    const wasAlreadyCompleted = existing?.isCompleted === 1;
    const completedAt = isCompleted ? now : null;

    if (existing) {
      await run(
        'UPDATE reading_progress SET currentPage = ?, totalPages = ?, percentage = ?, lastReadAt = ?, isCompleted = ?, completedAt = ?, lastPosition = ? WHERE userId = ? AND bookId = ?',
        [currentPage, totalPages, percentage, now, isCompleted, completedAt, lastPosition || null, userId, bookId]
      );
    } else {
      await run(
        'INSERT INTO reading_progress (id, userId, bookId, currentPage, totalPages, percentage, lastReadAt, isCompleted, completedAt, startedAt, lastPosition) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, bookId, currentPage, totalPages, percentage, now, isCompleted, completedAt, now, lastPosition || null]
      );
      await run('UPDATE books SET readCount = readCount + 1 WHERE id = ?', [bookId]);
    }

    // Completion bonus is now awarded via quiz completion (awardBookCompletionWithQuiz)
    if (isCompleted && !wasAlreadyCompleted) {
      // Check achievements
      checkAndUnlockAchievements(userId).then(r => {
        if (r.unlocked.length > 0) console.log(`User ${userId} unlocked: ${r.unlocked.join(', ')}`);
      });
    }

    // Check if a quiz already exists for this user+book
    let quizAvailable = false;
    if (isCompleted) {
      const existingQuiz = await queryOne(
        'SELECT id FROM quiz_results WHERE userId = ? AND bookId = ?',
        [userId, bookId]
      );
      quizAvailable = !existingQuiz;
    }

    const updated = await queryOne(
      'SELECT * FROM reading_progress WHERE userId = ? AND bookId = ?',
      [userId, bookId]
    );

    res.json({
      success: true,
      data: {
        ...updated,
        quizAvailable,
      },
    });
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

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sessionId = uuidv4();

    await run(
      'INSERT INTO reading_sessions (id, userId, bookId, startPage, endPage, duration, startedAt, endedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sessionId, userId, bookId, startPage, endPage, duration, now, now]
    );

    // New points system: daily reading, streak, effective reading
    awardDailyReading(userId);
    awardStreakBonus(userId);
    awardEffectiveReading(userId, duration, startPage, endPage);
    // Check achievements
    checkAndUnlockAchievements(userId).then(r => {
      if (r.unlocked.length > 0) console.log(`User ${userId} unlocked: ${r.unlocked.join(', ')}`);
    });

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
    const user = await queryOne('SELECT points, totalPoints, monthlyPoints, yearlyPoints, level FROM users WHERE id = ?', [userId]);
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
        totalPoints: user?.totalPoints || 0,
        monthlyPoints: user?.monthlyPoints || 0,
        yearlyPoints: user?.yearlyPoints || 0,
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

// Personal reading report with preferences analysis
router.get('/report', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const user = await queryOne('SELECT username, email, points, totalPoints, monthlyPoints, yearlyPoints, level FROM users WHERE id = ?', [userId]);
    const completedBooks = await queryOne('SELECT COUNT(*) as count FROM reading_progress WHERE userId = ? AND isCompleted = 1', [userId]);
    const totalBooks = await queryOne('SELECT COUNT(*) as count FROM reading_progress WHERE userId = ?', [userId]);
    const totalMinutes = await queryOne('SELECT COALESCE(SUM(duration), 0) as total FROM reading_sessions WHERE userId = ?', [userId]);
    const totalPages = await queryOne('SELECT COALESCE(SUM(currentPage), 0) as total FROM reading_progress WHERE userId = ?', [userId]);
    const quizStats = await queryOne<{ totalQuizzes: number; avgScore: number; totalCorrect: number; totalQuestions: number }>(
      'SELECT COUNT(*) as totalQuizzes, COALESCE(AVG(score), 0) as avgScore, COALESCE(SUM(correctAnswers), 0) as totalCorrect, COALESCE(SUM(totalQuestions), 0) as totalQuestions FROM quiz_results WHERE userId = ?',
      [userId]
    );
    const highlights = await queryOne('SELECT COUNT(*) as count FROM highlights WHERE userId = ?', [userId]);
    const notes = await queryOne('SELECT COUNT(*) as count FROM notes WHERE userId = ?', [userId]);
    const achievements = await queryOne('SELECT COUNT(*) as count FROM user_achievements WHERE userId = ?', [userId]);

    // Language distribution
    const languageDist = await queryAll(
      `SELECT b.language, COUNT(rp.id) as count
       FROM reading_progress rp
       JOIN books b ON rp.bookId = b.id
       WHERE rp.userId = ?
       GROUP BY b.language
       ORDER BY count DESC`,
      [userId]
    );

    // Category preferences
    const categoryPref = await queryAll(
      `SELECT c.name, c.icon, c.color, COUNT(rp.id) as count, COALESCE(SUM(rp.currentPage), 0) as totalPages
       FROM reading_progress rp
       JOIN books b ON rp.bookId = b.id
       JOIN book_categories c ON b.categoryId = c.id
       WHERE rp.userId = ?
       GROUP BY c.id, c.name, c.icon, c.color
       ORDER BY count DESC
       LIMIT 6`,
      [userId]
    );

    // Difficulty preference
    const difficultyDist = await queryAll(
      `SELECT b.difficulty, COUNT(rp.id) as count
       FROM reading_progress rp
       JOIN books b ON rp.bookId = b.id
       WHERE rp.userId = ?
       GROUP BY b.difficulty
       ORDER BY count DESC`,
      [userId]
    );

    // Monthly reading trend (last 12 months)
    const monthlyTrend: { month: string; books: number; minutes: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStr = date.toISOString().substring(0, 7);
      const books = (await queryOne(
        "SELECT COUNT(*) as count FROM reading_progress WHERE userId = ? AND isCompleted = 1 AND DATE_FORMAT(completedAt, '%Y-%m') = ?",
        [userId, monthStr]
      ))?.count || 0;
      const minutes = (await queryOne(
        "SELECT COALESCE(SUM(duration), 0) as total FROM reading_sessions WHERE userId = ? AND DATE_FORMAT(startedAt, '%Y-%m') = ?",
        [userId, monthStr]
      ))?.total || 0;
      monthlyTrend.push({ month: monthStr, books: books as number, minutes: Math.round((minutes as number) / 60) });
    }

    // Top authors
    const topAuthors = await queryAll(
      `SELECT b.author, COUNT(rp.id) as count
       FROM reading_progress rp
       JOIN books b ON rp.bookId = b.id
       WHERE rp.userId = ?
       GROUP BY b.author
       ORDER BY count DESC
       LIMIT 5`,
      [userId]
    );

    // Reading streak
    const streak = await calculateStreak(userId);
    const longestStreak = await calculateLongestStreak(userId);

    // Weekly reading minutes (last 7 days)
    const weeklyMinutes: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().substring(0, 10);
      const mins = await queryOne<{ total: number }>(
        'SELECT COALESCE(SUM(duration), 0) as total FROM reading_sessions WHERE userId = ? AND DATE(startedAt) = ?',
        [userId, dateStr]
      );
      weeklyMinutes.push(Math.round((mins?.total || 0) / 60));
    }

    // Reading speed: pages per minute
    const totalMins = Math.round(((totalMinutes?.total as number) || 0) / 60);
    const speed = totalMins > 0 ? Math.round((((totalPages?.total as number) || 0) / totalMins) * 10) / 10 : 0;

    // Quiz accuracy
    const quizAccuracy = (quizStats?.totalQuestions || 0) > 0
      ? Math.round(((quizStats?.totalCorrect || 0) / (quizStats?.totalQuestions || 1)) * 100)
      : 0;

    // Determine reading preference profile
    let preferenceProfile = 'balanced';
    if (categoryPref.length > 0) {
      const topCategory = categoryPref[0];
      const secondCategory = categoryPref[1];
      if (topCategory && (!secondCategory || (Number(topCategory.count) > (Number(secondCategory.count) * 2)))) {
        preferenceProfile = 'specialized';
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          username: user?.username,
          email: user?.email,
          points: user?.points,
          totalPoints: user?.totalPoints,
          monthlyPoints: user?.monthlyPoints,
          yearlyPoints: user?.yearlyPoints,
          level: user?.level,
        },
        overview: {
          totalBooks: totalBooks?.count || 0,
          completedBooks: completedBooks?.count || 0,
          completionRate: totalBooks?.count ? Math.round((Number(completedBooks?.count) / Number(totalBooks?.count)) * 100) : 0,
          totalReadingMinutes: Math.round(((totalMinutes?.total as number) || 0) / 60),
          totalPages: totalPages?.total || 0,
          totalQuizzes: quizStats?.totalQuizzes || 0,
          avgQuizScore: Math.round((quizStats?.avgScore as number) || 0),
          totalHighlights: highlights?.count || 0,
          totalNotes: notes?.count || 0,
          totalAchievements: achievements?.count || 0,
          readingStreak: streak,
          readingSpeed: speed,
        },
        readingStreak: streak,
        longestStreak,
        readingSpeed: speed,
        weeklyMinutes,
        quizAccuracy,
        quizTotalCorrect: quizStats?.totalCorrect || 0,
        quizTotalQuestions: quizStats?.totalQuestions || 0,
        languageDistribution: languageDist,
        categoryPreferences: categoryPref,
        difficultyDistribution: difficultyDist,
        topAuthors,
        monthlyTrend,
        preferenceProfile,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate reading report' });
  }
});

// AINS bridge: provides student + book + quiz data for Delima AINS integration
router.get('/ains-bridge/:bookId', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { bookId } = req.params;

    // Student info with school
    const student = await queryOne<{
      username: string; email: string; grade: string; icNumber: string;
      schoolName: string; schoolState: string;
    }>(
      `SELECT u.username, u.email, u.grade, u.icNumber, s.name as schoolName, s.state as schoolState
       FROM users u LEFT JOIN schools s ON u.schoolId = s.id WHERE u.id = ?`,
      [userId]
    );

    // Book info
    const book = await queryOne<{ title: string; author: string; pages: number; language: string }>(
      'SELECT title, author, pages AS pages, language FROM books WHERE id = ?', [bookId]
    );

    // Quiz result
    const quiz = await queryOne<{
      score: number; totalQuestions: number; correctAnswers: number; completedAt: string;
    }>(
      'SELECT score, totalQuestions, correctAnswers, completedAt FROM quiz_results WHERE userId = ? AND bookId = ?',
      [userId, bookId]
    );

    // Reading progress
    const progress = await queryOne<{
      currentPage: number; totalPages: number; percentage: number; isCompleted: number;
      lastReadAt: string; startedAt: string; completedAt: string;
    }>(
      'SELECT currentPage, totalPages, percentage, isCompleted, lastReadAt, startedAt, completedAt FROM reading_progress WHERE userId = ? AND bookId = ?',
      [userId, bookId]
    );

    // Total reading time for this book
    const readingTime = await queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(duration), 0) as total FROM reading_sessions WHERE userId = ? AND bookId = ?',
      [userId, bookId]
    );

    // Get AINS URL from config
    const ainsConfig = await queryOne<{ configValue: string }>(
      'SELECT configValue FROM ai_config WHERE configKey = ?', ['ains_url']
    );

    const ainsUrl = ainsConfig?.configValue || 'https://delima.moe-dl.edu.my';

    // Build pre-filled URL with student and book data
    const params = new URLSearchParams({
      studentName: student?.username || '',
      studentEmail: student?.email || '',
      studentGrade: student?.grade || '',
      studentIC: student?.icNumber || '',
      schoolName: student?.schoolName || '',
      schoolState: student?.schoolState || '',
      bookTitle: book?.title || '',
      bookAuthor: book?.author || '',
      bookPages: String(book?.pages || ''),
      bookLanguage: book?.language || '',
      quizScore: String(quiz?.score || 0),
      quizCorrect: String(quiz?.correctAnswers || 0),
      quizTotal: String(quiz?.totalQuestions || 0),
      quizDate: quiz?.completedAt?.substring(0, 10) || '',
      readingPages: String(progress?.currentPage || 0),
      readingMinutes: String(Math.round(((readingTime?.total as number) || 0) / 60)),
      readingCompleted: progress?.isCompleted ? 'true' : 'false',
      completedDate: progress?.completedAt?.substring(0, 10) || '',
    });

    res.json({
      success: true,
      data: {
        ainsUrl: `${ainsUrl}?${params.toString()}`,
        student: {
          name: student?.username,
          email: student?.email,
          grade: student?.grade,
          icNumber: student?.icNumber,
          schoolName: student?.schoolName,
          schoolState: student?.schoolState,
        },
        book: {
          title: book?.title,
          author: book?.author,
          pages: book?.pages,
          language: book?.language,
        },
        quiz: quiz ? {
          score: quiz.score,
          totalQuestions: quiz.totalQuestions,
          correctAnswers: quiz.correctAnswers,
          completedAt: quiz.completedAt,
        } : null,
        readingTime: Math.round(((readingTime?.total as number) || 0) / 60),
        readingPages: progress?.currentPage || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate AINS bridge data' });
  }
});

export default router;
