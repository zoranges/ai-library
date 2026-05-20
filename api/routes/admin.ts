import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { queryAll, queryOne, run, safeJsonParse } from '../db/database.js';
import { verifyToken, requireRole, generateToken, type JwtPayload } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);
router.use(requireRole('admin', 'super_admin', 'teacher'));

// ============================================================
// DASHBOARD
// ============================================================

router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateRange = '60' } = req.query;
    const days = Math.min(365, Math.max(1, parseInt(dateRange as string) || 60));
    const user = req.user!;
    const isSuperAdmin = user.role === 'super_admin';
    const schoolId = user.schoolId;

    // Build school filter for non-super-admin users
    const schoolFilter = isSuperAdmin ? '' : ' AND u.schoolId = ?';
    const schoolFilterRs = isSuperAdmin ? '' : ' AND rs.userId IN (SELECT id FROM users WHERE schoolId = ?)';
    const schoolFilterRp = isSuperAdmin ? '' : ' AND rp.userId IN (SELECT id FROM users WHERE schoolId = ?)';
    const schoolFilterQr = isSuperAdmin ? '' : ' AND qr.userId IN (SELECT id FROM users WHERE schoolId = ?)';
    const schoolParams = isSuperAdmin ? [] : [schoolId];

    // Core stat cards
    const totalStudentsResult = await queryOne(
      `SELECT COUNT(*) as count FROM users u WHERE u.role = 'student'${schoolFilter}`,
      schoolParams
    );
    const totalBooks = (await queryOne('SELECT COUNT(*) as count FROM books WHERE isActive = 1'))?.count || 0;
    const totalSchools = (await queryOne('SELECT COUNT(*) as count FROM schools WHERE isActive = 1'))?.count || 0;
    const totalAdmins = (await queryOne(
      'SELECT COUNT(*) as count FROM admins a JOIN users u ON a.userId = u.id WHERE a.isActive = 1'
    ))?.count || 0;

    // Compliance rate: books with fileUrl set vs total books
    const compliantBooks = (await queryOne('SELECT COUNT(*) as count FROM books WHERE isActive = 1 AND fileUrl IS NOT NULL AND fileUrl != ?', ['']))?.count || 0;
    const complianceRate = Number(totalBooks) > 0 ? Math.round((Number(compliantBooks) / Number(totalBooks)) * 100) : 0;

    // Core KPI metrics
    const readingSessionsCount = (await queryOne(
      `SELECT COUNT(*) as count FROM reading_sessions rs WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)${schoolFilterRs}`,
      [...schoolParams, days]
    ))?.count || 0;

    const activeUsers = (await queryOne(
      `SELECT COUNT(DISTINCT rs.userId) as count FROM reading_sessions rs WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)${schoolFilterRs}`,
      [...schoolParams, days]
    ))?.count || 0;

    const totalReadingMinutes = (await queryOne(
      `SELECT COALESCE(SUM(rs.duration), 0) as total FROM reading_sessions rs WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)${schoolFilterRs}`,
      [...schoolParams, days]
    ))?.total || 0;

    // Book reading rate: books that have been read at least once / total books
    const booksWithReads = (await queryOne('SELECT COUNT(DISTINCT bookId) as count FROM reading_progress'))?.count || 0;
    const bookReadingRate = Number(totalBooks) > 0 ? Math.round((Number(booksWithReads) / Number(totalBooks)) * 100) : 0;

    const booksThisMonth = (await queryOne(
      `SELECT COUNT(*) as count FROM reading_progress rp WHERE rp.isCompleted = 1 AND rp.startedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)${schoolFilterRp}`,
      schoolParams
    ))?.count || 0;

    const avgQuiz = (await queryOne(
      `SELECT COALESCE(AVG(qr.score), 0) as avg FROM quiz_results qr WHERE 1=1${schoolFilterQr}`,
      schoolParams
    ))?.avg || 0;

    // School comparison table (all schools — super admin only; single school for school admin)
    let schoolComparison: unknown[] = [];
    if (isSuperAdmin) {
      schoolComparison = await queryAll(
        `SELECT s.id, s.name,
                COUNT(DISTINCT u.id) as studentCount,
                COALESCE(ROUND(COUNT(DISTINCT CASE WHEN u.createdAt IS NOT NULL THEN u.id END) * 100.0 / NULLIF(COUNT(DISTINCT u.id), 0)), 0) as registrationRate,
                COALESCE(ROUND(COUNT(DISTINCT CASE WHEN rs.id IS NOT NULL AND rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN u.id END) * 100.0 / NULLIF(COUNT(DISTINCT u.id), 0)), 0) as usageRate
         FROM schools s
         LEFT JOIN users u ON s.id = u.schoolId AND u.role = 'student'
         LEFT JOIN reading_sessions rs ON u.id = rs.userId
         WHERE s.isActive = 1
         GROUP BY s.id, s.name
         ORDER BY studentCount DESC
         LIMIT 10`,
        [days]
      );
    }

    // Category distribution (real data from books + reading_progress)
    const categoryDistribution = await queryAll(
      `SELECT bc.name, COUNT(DISTINCT rp.bookId) as count
       FROM book_categories bc
       LEFT JOIN books b ON bc.id = b.categoryId AND b.isActive = 1
       LEFT JOIN reading_progress rp ON b.id = rp.bookId
       GROUP BY bc.id, bc.name
       ORDER BY count DESC
       LIMIT 6`
    );

    // Top schools by reading activity
    const topSchools = await queryAll(
      `SELECT s.id, s.name, COUNT(DISTINCT u.id) as activeStudents,
              COUNT(DISTINCT rs.id) as totalSessions
       FROM schools s
       LEFT JOIN users u ON s.id = u.schoolId AND u.role = 'student'
       LEFT JOIN reading_sessions rs ON u.id = rs.userId AND rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
       WHERE s.isActive = 1
       GROUP BY s.id, s.name
       ORDER BY totalSessions DESC
       LIMIT 5`,
      [days]
    );

    // Recent activities
    const recentActivities = await queryAll(
      `SELECT rp.id, rp.userId, u.username, 'reading' as type,
              'completed a book' as description, rp.startedAt as createdAt
       FROM reading_progress rp
       JOIN users u ON rp.userId = u.id
       ${isSuperAdmin ? '' : 'JOIN schools s ON u.schoolId = s.id'}
       WHERE rp.isCompleted = 1
       ${isSuperAdmin ? '' : 'AND u.schoolId = ?'}
       ORDER BY rp.startedAt DESC LIMIT 5`,
      isSuperAdmin ? [] : [schoolId]
    );

    // Reading trend — full range
    const readingTrend: { date: string; sessions: number; completions: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const trendParams = isSuperAdmin ? [dateStr, dateStr] : [schoolId, dateStr, schoolId, dateStr];
      const sessions = (await queryOne(
        isSuperAdmin
          ? 'SELECT COUNT(*) as count FROM reading_sessions WHERE DATE(startedAt) = ?'
          : 'SELECT COUNT(*) as count FROM reading_sessions rs JOIN users u ON rs.userId = u.id WHERE u.schoolId = ? AND DATE(rs.startedAt) = ?',
        isSuperAdmin ? [dateStr] : [schoolId, dateStr]
      ))?.count || 0;
      const completions = (await queryOne(
        isSuperAdmin
          ? 'SELECT COUNT(*) as count FROM reading_progress WHERE isCompleted = 1 AND DATE(lastReadAt) = ?'
          : 'SELECT COUNT(*) as count FROM reading_progress rp JOIN users u ON rp.userId = u.id WHERE u.schoolId = ? AND rp.isCompleted = 1 AND DATE(rp.lastReadAt) = ?',
        isSuperAdmin ? [dateStr] : [schoolId, dateStr]
      ))?.count || 0;
      readingTrend.push({ date: dateStr, sessions: sessions as number, completions: completions as number });
    }

    res.json({
      success: true,
      data: {
        totalStudents: totalStudentsResult?.count || 0,
        totalBooks,
        totalSchools,
        totalAdmins,
        complianceRate,
        readingSessionsCount,
        activeUsers,
        totalReadingMinutes,
        bookReadingRate,
        booksReadThisMonth: booksThisMonth,
        averageQuizScore: Math.round(avgQuiz as number),
        topSchools,
        schoolComparison,
        categoryDistribution,
        recentActivities,
        readingTrend,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

// ============================================================
// SCHOOLS
// ============================================================

router.get('/schools', async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', pageSize = '20', search } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * pageSizeNum;

    let countSql = 'SELECT COUNT(*) as total FROM schools';
    let dataSql = 'SELECT * FROM schools';
    const params: unknown[] = [];

    if (search) {
      countSql += ' WHERE name LIKE ?';
      dataSql += ' WHERE name LIKE ?';
      params.push(`%${search}%`);
    }

    const countResult = await queryOne(countSql, params);
    const total = countResult ? (countResult.total as number) : 0;

    dataSql += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
    const schools = await queryAll(dataSql, [...params, pageSizeNum, offset]);

    res.json({
      success: true,
      data: {
        data: schools,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch schools' });
  }
});

router.post('/schools', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, address, district, state, country, contactPhone, contactEmail } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'School name is required' });
      return;
    }

    const id = uuidv4();
    await run(
      'INSERT INTO schools (id, name, address, district, state, country, contactPhone, contactEmail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, address || null, district || null, state || null, country || null, contactPhone || null, contactEmail || null]
    );

    const school = await queryOne('SELECT * FROM schools WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: school });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create school' });
  }
});

router.put('/schools/:id', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.params.id;
    const { name, address, district, state, country, contactPhone, contactEmail, isActive } = req.body;

    const existing = await queryOne('SELECT id FROM schools WHERE id = ?', [schoolId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'School not found' });
      return;
    }

    if (name) await run('UPDATE schools SET name = ? WHERE id = ?', [name, schoolId]);
    if (address !== undefined) await run('UPDATE schools SET address = ? WHERE id = ?', [address, schoolId]);
    if (district !== undefined) await run('UPDATE schools SET district = ? WHERE id = ?', [district, schoolId]);
    if (state !== undefined) await run('UPDATE schools SET state = ? WHERE id = ?', [state, schoolId]);
    if (country !== undefined) await run('UPDATE schools SET country = ? WHERE id = ?', [country, schoolId]);
    if (contactPhone !== undefined) await run('UPDATE schools SET contactPhone = ? WHERE id = ?', [contactPhone, schoolId]);
    if (contactEmail !== undefined) await run('UPDATE schools SET contactEmail = ? WHERE id = ?', [contactEmail, schoolId]);
    if (isActive !== undefined) await run('UPDATE schools SET isActive = ? WHERE id = ?', [isActive ? 1 : 0, schoolId]);

    const updated = await queryOne('SELECT * FROM schools WHERE id = ?', [schoolId]);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update school' });
  }
});

router.delete('/schools/:id', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.params.id;
    const existing = await queryOne('SELECT id FROM schools WHERE id = ?', [schoolId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'School not found' });
      return;
    }

    await run('UPDATE schools SET isActive = 0 WHERE id = ?', [schoolId]);
    res.json({ success: true, message: 'School deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete school' });
  }
});

// ============================================================
// STUDENTS
// ============================================================

router.get('/students', async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', pageSize = '20', search, schoolId, isDeregistered } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * pageSizeNum;

    let countSql = "SELECT COUNT(*) as total FROM users u WHERE u.role = 'student'";
    let dataSql = `SELECT u.*, s.name as schoolName
                   FROM users u
                   LEFT JOIN schools s ON u.schoolId = s.id
                   WHERE u.role = 'student'`;
    const countParams: unknown[] = [];
    const dataParams: unknown[] = [];

    if (search) {
      countSql += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      dataSql += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm);
      dataParams.push(searchTerm, searchTerm);
    }

    if (schoolId) {
      countSql += ' AND u.schoolId = ?';
      dataSql += ' AND u.schoolId = ?';
      countParams.push(schoolId);
      dataParams.push(schoolId);
    }

    // isDeregistered filter: default to showing non-deregistered only
    if (isDeregistered !== 'all') {
      const deregFilter = isDeregistered === '1' ? 1 : 0;
      countSql += ' AND u.isDeregistered = ?';
      dataSql += ' AND u.isDeregistered = ?';
      countParams.push(deregFilter);
      dataParams.push(deregFilter);
    } else {
      // Show all - no filter on isDeregistered
    }

    const countResult = await queryOne(countSql, countParams);
    const total = countResult ? (countResult.total as number) : 0;

    dataSql += ` ORDER BY u.createdAt DESC LIMIT ? OFFSET ?`;
    const students = await queryAll(dataSql, [...dataParams, pageSizeNum, offset]);

    const formatted = students.map(s => {
      const { password: _, ...rest } = s;
      return rest;
    });

    res.json({
      success: true,
      data: {
        data: formatted,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
});

// NOTE: /students/:id/report and /students/:id/reregister must be defined
// BEFORE /students/:id to avoid Express matching the :id param first.

router.get('/students/:id/report', async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id;
    const { startDate, endDate } = req.query;

    // Get student info
    const student = await queryOne(
      `SELECT u.*, s.name as schoolName
       FROM users u
       LEFT JOIN schools s ON u.schoolId = s.id
       WHERE u.id = ? AND u.role = 'student'`,
      [studentId]
    );

    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    const { password: _, ...studentInfo } = student;

    // Reading stats
    const readingStats = await queryOne(
      `SELECT
         COUNT(*) as totalBooks,
         COALESCE(SUM(CASE WHEN isCompleted = 1 THEN 1 ELSE 0 END), 0) as completedBooks,
         COALESCE(SUM(currentPage), 0) as totalPagesRead
       FROM reading_progress WHERE userId = ?`,
      [studentId]
    );

    const quizStats = await queryOne(
      'SELECT COUNT(*) as totalQuizzes, COALESCE(AVG(score), 0) as avgScore FROM quiz_results WHERE userId = ?',
      [studentId]
    );

    const sessionStats = await queryOne(
      'SELECT COUNT(*) as totalSessions, COALESCE(SUM(duration), 0) as totalMinutes FROM reading_sessions WHERE userId = ?',
      [studentId]
    );

    // Reading history with book details
    let historySql = `SELECT rp.*, b.title as bookTitle, b.author as bookAuthor, b.coverUrl as bookCover
      FROM reading_progress rp
      JOIN books b ON rp.bookId = b.id
      WHERE rp.userId = ?`;
    const historyParams: unknown[] = [studentId];
    if (startDate) {
      historySql += ' AND rp.startedAt >= ?';
      historyParams.push(startDate);
    }
    if (endDate) {
      historySql += ' AND rp.startedAt <= ?';
      historyParams.push(endDate);
    }
    historySql += ' ORDER BY rp.lastReadAt DESC';
    const readingHistory = await queryAll(historySql, historyParams);

    // Quiz results with book details
    let quizSql = `SELECT qr.*, b.title as bookTitle, b.author as bookAuthor
      FROM quiz_results qr
      JOIN books b ON qr.bookId = b.id
      WHERE qr.userId = ?`;
    const quizParams: unknown[] = [studentId];
    if (startDate) {
      quizSql += ' AND qr.completedAt >= ?';
      quizParams.push(startDate);
    }
    if (endDate) {
      quizSql += ' AND qr.completedAt <= ?';
      quizParams.push(endDate);
    }
    quizSql += ' ORDER BY qr.completedAt DESC';
    const quizResults = await queryAll(quizSql, quizParams);

    // Reading sessions
    let sessionsSql = `SELECT rs.*, b.title as bookTitle
      FROM reading_sessions rs
      JOIN books b ON rs.bookId = b.id
      WHERE rs.userId = ?`;
    const sessionsParams: unknown[] = [studentId];
    if (startDate) {
      sessionsSql += ' AND rs.startedAt >= ?';
      sessionsParams.push(startDate);
    }
    if (endDate) {
      sessionsSql += ' AND rs.startedAt <= ?';
      sessionsParams.push(endDate);
    }
    sessionsSql += ' ORDER BY rs.startedAt DESC';
    const readingSessions = await queryAll(sessionsSql, sessionsParams);

    // Highlights
    let highlightsSql = `SELECT h.*, b.title as bookTitle
      FROM highlights h
      JOIN books b ON h.bookId = b.id
      WHERE h.userId = ?`;
    const highlightsParams: unknown[] = [studentId];
    if (startDate) {
      highlightsSql += ' AND h.createdAt >= ?';
      highlightsParams.push(startDate);
    }
    if (endDate) {
      highlightsSql += ' AND h.createdAt <= ?';
      highlightsParams.push(endDate);
    }
    highlightsSql += ' ORDER BY h.createdAt DESC';
    const highlights = await queryAll(highlightsSql, highlightsParams);

    // Notes
    let notesSql = `SELECT n.*, b.title as bookTitle
      FROM notes n
      JOIN books b ON n.bookId = b.id
      WHERE n.userId = ?`;
    const notesParams: unknown[] = [studentId];
    if (startDate) {
      notesSql += ' AND n.createdAt >= ?';
      notesParams.push(startDate);
    }
    if (endDate) {
      notesSql += ' AND n.createdAt <= ?';
      notesParams.push(endDate);
    }
    notesSql += ' ORDER BY n.updatedAt DESC';
    const notes = await queryAll(notesSql, notesParams);

    // Achievements
    const achievements = await queryAll(
      `SELECT ua.*, a.name as achievementName, a.description as achievementDesc, a.icon, a.category, a.rarity, a.points as achievementPoints
       FROM user_achievements ua
       JOIN achievements a ON ua.achievementId = a.id
       WHERE ua.userId = ?
       ORDER BY ua.unlockedAt DESC`,
      [studentId]
    );

    // Badges
    const badges = await queryAll(
      `SELECT ub.*, b.name as badgeName, b.description as badgeDesc, b.icon, b.category, b.rarity
       FROM user_badges ub
       JOIN badges b ON ub.badgeId = b.id
       WHERE ub.userId = ?
       ORDER BY ub.unlockedAt DESC`,
      [studentId]
    );

    // Points history
    let pointsSql = 'SELECT * FROM points WHERE userId = ?';
    const pointsParams: unknown[] = [studentId];
    if (startDate) {
      pointsSql += ' AND createdAt >= ?';
      pointsParams.push(startDate);
    }
    if (endDate) {
      pointsSql += ' AND createdAt <= ?';
      pointsParams.push(endDate);
    }
    pointsSql += ' ORDER BY createdAt DESC';
    const points = await queryAll(pointsSql, pointsParams);

    res.json({
      success: true,
      data: {
        student: studentInfo,
        readingStats: {
          ...readingStats,
          ...quizStats,
          ...sessionStats,
        },
        readingHistory,
        quizResults,
        readingSessions,
        highlights,
        notes,
        achievements,
        badges,
        points,
        dateRange: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch student report' });
  }
});

router.post('/students/:id/reregister', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id;
    const existing = await queryOne("SELECT id FROM users WHERE id = ? AND role = 'student'", [studentId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    await run('UPDATE users SET isDeregistered = 0, updatedAt = NOW() WHERE id = ?', [studentId]);
    const updated = await queryOne('SELECT * FROM users WHERE id = ?', [studentId]);
    if (updated) {
      const { password: _, ...studentWithoutPassword } = updated;
      res.json({ success: true, message: 'Student re-registered successfully', data: studentWithoutPassword });
    } else {
      res.json({ success: true, message: 'Student re-registered successfully' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to re-register student' });
  }
});

router.get('/students/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const student = await queryOne(
      `SELECT u.*, s.name as schoolName
       FROM users u
       LEFT JOIN schools s ON u.schoolId = s.id
       WHERE u.id = ? AND u.role = 'student'`,
      [req.params.id]
    );

    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    const { password: _, ...studentWithoutPassword } = student;

    const readingStats = await queryOne(
      'SELECT COUNT(*) as totalBooks, COALESCE(SUM(CASE WHEN isCompleted = 1 THEN 1 ELSE 0 END), 0) as completedBooks FROM reading_progress WHERE userId = ?',
      [req.params.id]
    );
    const quizStats = await queryOne(
      'SELECT COUNT(*) as totalQuizzes, COALESCE(AVG(score), 0) as avgScore FROM quiz_results WHERE userId = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...studentWithoutPassword,
        readingStats,
        quizStats,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch student' });
  }
});

router.put('/students/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id;
    const { username, grade, schoolId, isActive, preferredLanguage, phone, guardianName, guardianPhone, address } = req.body;

    const existing = await queryOne("SELECT id FROM users WHERE id = ? AND role = 'student'", [studentId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    if (username) await run('UPDATE users SET username = ?, updatedAt = NOW() WHERE id = ?', [username, studentId]);
    if (grade !== undefined) await run('UPDATE users SET grade = ?, updatedAt = NOW() WHERE id = ?', [grade, studentId]);
    if (schoolId) await run('UPDATE users SET schoolId = ?, updatedAt = NOW() WHERE id = ?', [schoolId, studentId]);
    if (isActive !== undefined) await run('UPDATE users SET isDeregistered = ?, updatedAt = NOW() WHERE id = ?', [isActive ? 0 : 1, studentId]);
    if (preferredLanguage !== undefined) await run('UPDATE users SET preferredLanguage = ?, updatedAt = NOW() WHERE id = ?', [preferredLanguage, studentId]);
    if (phone !== undefined) await run('UPDATE users SET phone = ?, updatedAt = NOW() WHERE id = ?', [phone, studentId]);
    if (guardianName !== undefined) await run('UPDATE users SET guardianName = ?, updatedAt = NOW() WHERE id = ?', [guardianName, studentId]);
    if (guardianPhone !== undefined) await run('UPDATE users SET guardianPhone = ?, updatedAt = NOW() WHERE id = ?', [guardianPhone, studentId]);
    if (address !== undefined) await run('UPDATE users SET address = ?, updatedAt = NOW() WHERE id = ?', [address, studentId]);

    const updated = await queryOne('SELECT * FROM users WHERE id = ?', [studentId]);
    const { password: _, ...studentWithoutPassword } = updated!;
    res.json({ success: true, data: studentWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update student' });
  }
});

router.delete('/students/:id', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id;
    const existing = await queryOne("SELECT id FROM users WHERE id = ? AND role = 'student'", [studentId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    // Soft-deregister: set isDeregistered=1, preserve all data
    await run('UPDATE users SET isDeregistered = 1, updatedAt = NOW() WHERE id = ?', [studentId]);

    res.json({ success: true, message: 'Student deregistered successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to deregister student' });
  }
});

// ============================================================
// TEACHERS
// ============================================================

router.get('/teachers', async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', pageSize = '20', search, schoolId } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * pageSizeNum;

    let countSql = "SELECT COUNT(*) as total FROM users u WHERE u.role = 'teacher'";
    let dataSql = `SELECT u.*, s.name as schoolName
                   FROM users u
                   LEFT JOIN schools s ON u.schoolId = s.id
                   WHERE u.role = 'teacher'`;
    const countParams: unknown[] = [];
    const dataParams: unknown[] = [];

    if (search) {
      countSql += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      dataSql += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      const term = `%${search}%`;
      countParams.push(term, term);
      dataParams.push(term, term);
    }

    if (schoolId) {
      countSql += ' AND u.schoolId = ?';
      dataSql += ' AND u.schoolId = ?';
      countParams.push(schoolId);
      dataParams.push(schoolId);
    }

    const countResult = await queryOne(countSql, countParams);
    const total = countResult ? (countResult.total as number) : 0;

    dataSql += ' ORDER BY u.createdAt DESC LIMIT ? OFFSET ?';
    const teachers = await queryAll(dataSql, [...dataParams, pageSizeNum, offset]);

    const formatted = teachers.map(t => {
      const { password: _, ...rest } = t;
      return rest;
    });

    res.json({
      success: true,
      data: {
        data: formatted,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch teachers' });
  }
});

router.post('/teachers', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, schoolId, preferredLanguage, phone, guardianName, address } = req.body;
    if (!username || !email || !password || !schoolId) {
      res.status(400).json({ success: false, error: 'Username, email, password, and schoolId are required' });
      return;
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    const school = await queryOne('SELECT id FROM schools WHERE id = ?', [schoolId]);
    if (!school) {
      res.status(404).json({ success: false, error: 'School not found' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await run(
      `INSERT INTO users (id, username, email, password, schoolId, role, preferredLanguage, phone, guardianName, address)
       VALUES (?, ?, ?, ?, ?, 'teacher', ?, ?, ?, ?)`,
      [id, username, email, hashedPassword, schoolId, preferredLanguage || null, phone || null, guardianName || null, address || null]
    );

    const teacher = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
    if (teacher) {
      const { password: _, ...teacherWithoutPassword } = teacher;
      res.status(201).json({ success: true, data: teacherWithoutPassword });
    } else {
      res.status(500).json({ success: false, error: 'Failed to create teacher' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create teacher' });
  }
});

router.put('/teachers/:id', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const teacherId = req.params.id;
    const { username, schoolId, preferredLanguage, phone, guardianName, guardianPhone, address } = req.body;

    const existing = await queryOne("SELECT id FROM users WHERE id = ? AND role = 'teacher'", [teacherId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Teacher not found' });
      return;
    }

    if (username) await run('UPDATE users SET username = ?, updatedAt = NOW() WHERE id = ?', [username, teacherId]);
    if (schoolId) await run('UPDATE users SET schoolId = ?, updatedAt = NOW() WHERE id = ?', [schoolId, teacherId]);
    if (preferredLanguage !== undefined) await run('UPDATE users SET preferredLanguage = ?, updatedAt = NOW() WHERE id = ?', [preferredLanguage, teacherId]);
    if (phone !== undefined) await run('UPDATE users SET phone = ?, updatedAt = NOW() WHERE id = ?', [phone, teacherId]);
    if (guardianName !== undefined) await run('UPDATE users SET guardianName = ?, updatedAt = NOW() WHERE id = ?', [guardianName, teacherId]);
    if (guardianPhone !== undefined) await run('UPDATE users SET guardianPhone = ?, updatedAt = NOW() WHERE id = ?', [guardianPhone, teacherId]);
    if (address !== undefined) await run('UPDATE users SET address = ?, updatedAt = NOW() WHERE id = ?', [address, teacherId]);

    const updated = await queryOne('SELECT * FROM users WHERE id = ?', [teacherId]);
    if (updated) {
      const { password: _, ...teacherWithoutPassword } = updated;
      res.json({ success: true, data: teacherWithoutPassword });
    } else {
      res.json({ success: true, message: 'Teacher updated' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update teacher' });
  }
});

router.delete('/teachers/:id', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const teacherId = req.params.id;
    const existing = await queryOne("SELECT id FROM users WHERE id = ? AND role = 'teacher'", [teacherId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Teacher not found' });
      return;
    }

    await run('UPDATE users SET isDeregistered = 1, updatedAt = NOW() WHERE id = ?', [teacherId]);
    res.json({ success: true, message: 'Teacher deregistered' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to deregister teacher' });
  }
});

// ============================================================
// ADMINS
// ============================================================

router.get('/admins', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const admins = await queryAll(
      `SELECT a.*, u.username, u.email, u.avatar, s.name as schoolName
       FROM admins a
       JOIN users u ON a.userId = u.id
       LEFT JOIN schools s ON a.schoolId = s.id
       WHERE a.isActive = 1
       ORDER BY a.createdAt DESC`
    );

    const formatted = admins.map(a => ({
      ...a,
      permissions: safeJsonParse(a.permissions, []),
      user: {
        id: a.userId,
        username: a.username,
        email: a.email,
        avatar: a.avatar,
      },
      school: a.schoolName ? {
        id: a.schoolId,
        name: a.schoolName,
      } : null,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch admins' });
  }
});

router.post('/admins', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, schoolId, permissions } = req.body;
    if (!username || !email || !password || !schoolId) {
      res.status(400).json({ success: false, error: 'Username, email, password, and schoolId are required' });
      return;
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const adminId = uuidv4();

    await run(
      'INSERT INTO users (id, username, email, password, schoolId, role) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, username, email, hashedPassword, schoolId, 'admin']
    );

    await run(
      'INSERT INTO admins (id, userId, schoolId, role, permissions) VALUES (?, ?, ?, ?, ?)',
      [adminId, userId, schoolId, 'admin', JSON.stringify(permissions || ['read', 'write'])]
    );

    const admin = await queryOne(
      `SELECT a.*, u.username, u.email, s.name as schoolName
       FROM admins a
       JOIN users u ON a.userId = u.id
       LEFT JOIN schools s ON a.schoolId = s.id
       WHERE a.id = ?`,
      [adminId]
    );

    res.status(201).json({ success: true, data: admin });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create admin' });
  }
});

router.put('/admins/:id', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.params.id;
    const { permissions, isActive, schoolId } = req.body;

    const existing = await queryOne('SELECT id FROM admins WHERE id = ?', [adminId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Admin not found' });
      return;
    }

    if (permissions) await run('UPDATE admins SET permissions = ? WHERE id = ?', [JSON.stringify(permissions), adminId]);
    if (isActive !== undefined) await run('UPDATE admins SET isActive = ? WHERE id = ?', [isActive ? 1 : 0, adminId]);
    if (schoolId) await run('UPDATE admins SET schoolId = ? WHERE id = ?', [schoolId, adminId]);

    const updated = await queryOne(
      `SELECT a.*, u.username, u.email, s.name as schoolName
       FROM admins a
       JOIN users u ON a.userId = u.id
       LEFT JOIN schools s ON a.schoolId = s.id
       WHERE a.id = ?`,
      [adminId]
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update admin' });
  }
});

router.delete('/admins/:id', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.params.id;
    const existing = await queryOne('SELECT id, userId FROM admins WHERE id = ?', [adminId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Admin not found' });
      return;
    }

    await run('UPDATE admins SET isActive = 0 WHERE id = ?', [adminId]);
    await run("UPDATE users SET role = 'student' WHERE id = ?", [existing.userId]);

    res.json({ success: true, message: 'Admin removed' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove admin' });
  }
});

// ============================================================
// STATISTICS
// ============================================================

router.get('/statistics', async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = '7d', state, city, schoolId } = req.query;
    const user = req.user!;
    const isSuperAdmin = user.role === 'super_admin';

    let days = 7;
    if (period === '30d') days = 30;
    else if (period === '90d') days = 90;
    else if (period === '1y') days = 365;

    // Build school isolation + optional filters
    const conditions: string[] = [];
    const uConditions: string[] = ["u.role = 'student'"];

    if (!isSuperAdmin) {
      // School admin: only see their own school
      conditions.push('u.schoolId = ?');
      uConditions.push('u.schoolId = ?');
    } else if (schoolId) {
      conditions.push('u.schoolId = ?');
      uConditions.push('u.schoolId = ?');
    }

    if (state) {
      conditions.push('s.state = ?');
    }
    if (city) {
      conditions.push('s.city = ?');
    }

    const userFilterClause = uConditions.length > 0 ? `WHERE ${uConditions.join(' AND ')}` : '';

    // Build params array
    const buildParams = (base: unknown[] = []) => {
      const p = [...base];
      if (isSuperAdmin && schoolId) p.push(schoolId);
      else if (!isSuperAdmin) p.push(user.schoolId);
      if (state) p.push(state);
      if (city) p.push(city);
      return p;
    };

    const totalStudents = (await queryOne(`SELECT COUNT(*) as count FROM users u ${userFilterClause}`, buildParams()))?.count || 0;
    const totalBooks = (await queryOne('SELECT COUNT(*) as count FROM books WHERE isActive = 1'))?.count || 0;

    // Reading sessions with filters
    const sessionSchoolFilter = isSuperAdmin && schoolId ? ' AND rs.userId IN (SELECT id FROM users WHERE schoolId = ?)' : !isSuperAdmin ? ' AND rs.userId IN (SELECT id FROM users WHERE schoolId = ?)' : '';
    const sessionSchoolParam = buildParams([]);

    const totalReadingSessions = (await queryOne(`SELECT COUNT(*) as count FROM reading_sessions rs WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)${sessionSchoolFilter}`, [days, ...sessionSchoolParam]))?.count || 0;
    const totalQuizResults = (await queryOne(`SELECT COUNT(*) as count FROM quiz_results qr ${!isSuperAdmin ? `WHERE qr.userId IN (SELECT id FROM users WHERE schoolId = ?)` : `${schoolId ? `WHERE qr.userId IN (SELECT id FROM users WHERE schoolId = ?)` : ''}`}`, !isSuperAdmin ? [user.schoolId] : schoolId ? [schoolId] : []))?.count || 0;
    const avgQuizScore = (await queryOne(`SELECT COALESCE(AVG(qr.score), 0) as avg FROM quiz_results qr ${!isSuperAdmin ? `WHERE qr.userId IN (SELECT id FROM users WHERE schoolId = ?)` : `${schoolId ? `WHERE qr.userId IN (SELECT id FROM users WHERE schoolId = ?)` : ''}`}`, !isSuperAdmin ? [user.schoolId] : schoolId ? [schoolId] : []))?.avg || 0;
    const totalPoints = (await queryOne(`SELECT COALESCE(SUM(p.points), 0) as total FROM points p ${!isSuperAdmin ? `WHERE p.userId IN (SELECT id FROM users WHERE schoolId = ?)` : `${schoolId ? `WHERE p.userId IN (SELECT id FROM users WHERE schoolId = ?)` : ''}`}`, !isSuperAdmin ? [user.schoolId] : schoolId ? [schoolId] : []))?.total || 0;
    const totalReadingMinutes = (await queryOne(`SELECT COALESCE(SUM(rs.duration), 0) as total FROM reading_sessions rs WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)${sessionSchoolFilter}`, [days, ...sessionSchoolParam]))?.total || 0;

    // Reading trend by day
    const readingByDay: { date: string; sessions: number; completions: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const sessions = (await queryOne(
        `SELECT COUNT(*) as count FROM reading_sessions rs WHERE DATE(rs.startedAt) = ?${sessionSchoolFilter}`,
        [dateStr, ...sessionSchoolParam]
      ))?.count || 0;
      const completions = (await queryOne(
        `SELECT COUNT(*) as count FROM reading_progress rp WHERE rp.isCompleted = 1 AND DATE(rp.lastReadAt) = ?${sessionSchoolFilter.replace(/rs\./g, 'rp.')}`,
        [dateStr, ...sessionSchoolParam]
      ))?.count || 0;
      readingByDay.push({ date: dateStr, sessions: sessions as number, completions: completions as number });
    }

    const topBooks = await queryAll(
      'SELECT id, title, author, readCount, favoriteCount, rating FROM books WHERE isActive = 1 ORDER BY readCount DESC LIMIT 10'
    );

    // School stats with isolation
    let schoolFilterSql = 'WHERE s.isActive = 1';
    const sParams: unknown[] = [];
    if (!isSuperAdmin) {
      schoolFilterSql += ' AND s.id = ?';
      sParams.push(user.schoolId);
    } else if (schoolId) {
      schoolFilterSql += ' AND s.id = ?';
      sParams.push(schoolId);
    }
    if (state) {
      schoolFilterSql += ' AND s.state = ?';
      sParams.push(state);
    }
    if (city) {
      schoolFilterSql += ' AND s.city = ?';
      sParams.push(city);
    }

    const schoolStats = await queryAll(
      `SELECT s.id, s.name, s.studentCount,
              COUNT(DISTINCT rs.id) as totalSessions,
              COUNT(DISTINCT rp.id) as completedBooks
       FROM schools s
       LEFT JOIN users u ON s.id = u.schoolId AND u.role = 'student'
       LEFT JOIN reading_sessions rs ON u.id = rs.userId
       LEFT JOIN reading_progress rp ON u.id = rp.userId AND rp.isCompleted = 1
       ${schoolFilterSql}
       GROUP BY s.id
       ORDER BY totalSessions DESC`,
      sParams
    );

    res.json({
      success: true,
      data: {
        overview: {
          totalStudents,
          totalBooks,
          totalReadingSessions,
          totalQuizResults,
          avgQuizScore: Math.round(avgQuizScore as number),
          totalPoints,
          totalReadingMinutes,
        },
        readingByDay,
        topBooks,
        schoolStats,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

// ============================================================
// ACCOUNT
// ============================================================

router.put('/account', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { name, email, phone, username, avatar } = req.body;

    if (username) await run('UPDATE users SET username = ? WHERE id = ?', [username, userId]);
    if (name) await run('UPDATE users SET username = ? WHERE id = ?', [name, userId]);
    if (email) await run('UPDATE users SET email = ? WHERE id = ?', [email, userId]);
    if (phone !== undefined) await run('UPDATE users SET phone = ? WHERE id = ?', [phone, userId]);
    if (avatar) await run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, userId]);

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    const { password: _, ...userWithoutPassword } = user!;
    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update account' });
  }
});

router.put('/account/password', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: 'Current and new password required' });
      return;
    }

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) { res.status(404).json({ success: false, error: 'Not found' }); return; }

    const isValid = await bcrypt.compare(currentPassword, user.password as string);
    if (!isValid) { res.status(401).json({ success: false, error: 'Current password is incorrect' }); return; }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update password' });
  }
});

router.post('/account/avatar', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { avatar } = req.body;
    if (!avatar) { res.status(400).json({ success: false, error: 'Avatar data required' }); return; }
    await run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, userId]);
    res.json({ success: true, data: { avatar } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to upload avatar' });
  }
});

router.get('/account/devices', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const sessions = await queryAll(
      'SELECT id, ipAddress, userAgent, lastActiveAt, isCurrent FROM login_sessions WHERE userId = ? ORDER BY lastActiveAt DESC LIMIT 10',
      [userId]
    );
    const formatted = sessions.map((s: any) => ({
      id: s.id,
      name: s.userAgent || 'Unknown device',
      ip: s.ipAddress || 'Unknown',
      lastActive: s.lastActiveAt,
      current: s.isCurrent === 1,
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch devices' });
  }
});

router.delete('/account', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    await run('UPDATE users SET isDeregistered = 1 WHERE id = ?', [userId]);
    res.json({ success: true, message: 'Account deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to deactivate account' });
  }
});

router.post('/account/ip-bind', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { enabled } = req.body;
    const ip = req.ip || req.socket.remoteAddress || '';
    if (enabled) {
      await run('UPDATE users SET bindIp = ? WHERE id = ?', [ip, userId]);
    } else {
      await run('UPDATE users SET bindIp = NULL WHERE id = ?', [ip, userId]);
    }
    res.json({ success: true, data: { ipBinding: !!enabled, ip: enabled ? ip : null } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update IP binding' });
  }
});

// ============================================================
// GLOBAL SEARCH
// ============================================================

router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q = '', limit = '10' } = req.query;
    const searchTerm = `%${q}%`;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));

    const books = await queryAll(
      'SELECT id, title, author, coverUrl, \'book\' as type FROM books WHERE isActive = 1 AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?) LIMIT ?',
      [searchTerm, searchTerm, searchTerm, limitNum]
    );

    const students = await queryAll(
      "SELECT id, username as name, email, 'student' as type FROM users WHERE role = 'student' AND (username LIKE ? OR email LIKE ?) LIMIT ?",
      [searchTerm, searchTerm, limitNum]
    );

    const schools = await queryAll(
      "SELECT id, name, 'school' as type FROM schools WHERE isActive = 1 AND name LIKE ? LIMIT ?",
      [searchTerm, limitNum]
    );

    res.json({
      success: true,
      data: { books, students, schools },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

// ============================================================
// ROLE SWITCH
// ============================================================

router.post('/role-switch', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { targetRole } = req.body;

    if (!['student', 'admin'].includes(targetRole)) {
      res.status(400).json({ success: false, error: 'Invalid target role' });
      return;
    }

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (user.role !== 'super_admin' && user.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Only admins can switch roles' });
      return;
    }

    const payload: JwtPayload = {
      userId: user.id as string,
      email: user.email as string,
      role: targetRole,
      schoolId: user.schoolId as string,
    };

    const token = generateToken(payload);

    res.json({
      success: true,
      data: {
        role: targetRole,
        token,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to switch role' });
  }
});

// ============================================================
// IC WHITELIST
// ============================================================

router.get('/ic-whitelist', async (req: Request, res: Response): Promise<void> => {
  try {
    const { schoolId } = req.query;

    let sql = 'SELECT ic.*, s.name as schoolName FROM ic_whitelist ic JOIN schools s ON ic.schoolId = s.id';
    const params: unknown[] = [];

    if (schoolId) {
      sql += ' WHERE ic.schoolId = ?';
      params.push(schoolId);
    }

    sql += ' ORDER BY ic.createdAt DESC';
    const entries = await queryAll(sql, params);

    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch IC whitelist' });
  }
});

router.post('/ic-whitelist', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { icNumber, schoolId } = req.body;
    if (!icNumber || !schoolId) {
      res.status(400).json({ success: false, error: 'IC number and schoolId are required' });
      return;
    }

    const existing = await queryOne('SELECT id FROM ic_whitelist WHERE icNumber = ?', [icNumber]);
    if (existing) {
      res.status(409).json({ success: false, error: 'IC number already in whitelist' });
      return;
    }

    const id = uuidv4();
    await run('INSERT INTO ic_whitelist (id, icNumber, schoolId) VALUES (?, ?, ?)', [id, icNumber, schoolId]);

    const entry = await queryOne(
      'SELECT ic.*, s.name as schoolName FROM ic_whitelist ic JOIN schools s ON ic.schoolId = s.id WHERE ic.id = ?',
      [id]
    );

    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add IC whitelist entry' });
  }
});

router.delete('/ic-whitelist/:id', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await queryOne('SELECT id FROM ic_whitelist WHERE id = ?', [req.params.id]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'IC whitelist entry not found' });
      return;
    }

    await run('DELETE FROM ic_whitelist WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'IC whitelist entry deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete IC whitelist entry' });
  }
});

// ============================================================
// BOOKS CRUD
// ============================================================

router.get('/books', async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', pageSize = '20', search, categoryId, language, format } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * pageSizeNum;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (search) {
      whereClause += ' AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (categoryId) {
      whereClause += ' AND b.categoryId = ?';
      params.push(categoryId);
    }
    if (language) {
      whereClause += ' AND b.language = ?';
      params.push(language);
    }
    if (format) {
      whereClause += ' AND b.fileType = ?';
      params.push(format);
    }

    const countResult = await queryOne(
      `SELECT COUNT(*) as total FROM books b ${whereClause}`,
      params
    );
    const total = countResult ? (countResult.total as number) : 0;

    const books = await queryAll(
      `SELECT b.*, c.name as categoryName
       FROM books b
       LEFT JOIN book_categories c ON b.categoryId = c.id
       ${whereClause}
       ORDER BY b.createdAt DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSizeNum, offset]
    );

    res.json({
      success: true,
      data: {
        data: books,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch books' });
  }
});

router.get('/books/categories', async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await queryAll('SELECT * FROM book_categories ORDER BY sortOrder ASC');
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

router.post('/books', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, author, isbn, publisher, description, categoryId, language, fileType, coverUrl, fileUrl, difficulty, pageCount, copyright, publishDate } = req.body;

    if (!title || !author || !categoryId) {
      res.status(400).json({ success: false, error: 'Title, author and category are required' });
      return;
    }

    const id = uuidv4();
    await run(
      `INSERT INTO books (id, title, author, isbn, publisher, description, categoryId, language, fileType, coverUrl, fileUrl, difficulty, pageCount, copyright, publishDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, author, isbn || '', publisher || '', description || '', categoryId, language || 'zh', fileType || 'pdf', coverUrl || '', fileUrl || '', difficulty || 'intermediate', pageCount || 0, copyright || null, publishDate || null]
    );

    const book = await queryOne('SELECT * FROM books WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: book });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create book' });
  }
});

router.put('/books/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await queryOne('SELECT id FROM books WHERE id = ?', [req.params.id]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Book not found' });
      return;
    }

    const { title, author, isbn, publisher, description, categoryId, language, fileType, coverUrl, fileUrl, difficulty, pageCount, copyright, publishDate } = req.body;

    await run(
      `UPDATE books SET title=?, author=?, isbn=?, publisher=?, description=?, categoryId=?, language=?, fileType=?, coverUrl=?, fileUrl=?, difficulty=?, pageCount=?, copyright=?, publishDate=? WHERE id=?`,
      [title, author, isbn || '', publisher || '', description || '', categoryId, language || 'zh', fileType || 'pdf', coverUrl || '', fileUrl || '', difficulty || 'intermediate', pageCount || 0, copyright || null, publishDate || null, req.params.id]
    );

    const book = await queryOne('SELECT * FROM books WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: book });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update book' });
  }
});

router.delete('/books/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await queryOne('SELECT id FROM books WHERE id = ?', [req.params.id]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Book not found' });
      return;
    }

    await run('UPDATE books SET isActive = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Book deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete book' });
  }
});

// ============================================================
// AI CONFIG CRUD
// ============================================================

router.get('/ai-config', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const configs = await queryAll(
      `SELECT ac.*, u.username as updatedByName
       FROM ai_config ac
       LEFT JOIN users u ON ac.updatedBy = u.id
       ORDER BY ac.configKey ASC`
    );
    res.json({ success: true, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch AI config' });
  }
});

router.put('/ai-config/:key', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const { configValue, description } = req.body;

    if (configValue === undefined) {
      res.status(400).json({ success: false, error: 'configValue is required' });
      return;
    }

    const existing = await queryOne('SELECT id, configKey FROM ai_config WHERE configKey = ?', [key]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'AI config entry not found' });
      return;
    }

    const updates: string[] = ['configValue = ?'];
    const params: unknown[] = [configValue];

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    updates.push('updatedBy = ?');
    params.push(req.user!.userId);

    params.push(key);

    await run(
      `UPDATE ai_config SET ${updates.join(', ')} WHERE configKey = ?`,
      params
    );

    const updated = await queryOne(
      `SELECT ac.*, u.username as updatedByName
       FROM ai_config ac
       LEFT JOIN users u ON ac.updatedBy = u.id
       WHERE ac.configKey = ?`,
      [key]
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update AI config' });
  }
});

router.post('/ai-config', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { configKey, configValue, description } = req.body;

    if (!configKey || configValue === undefined) {
      res.status(400).json({ success: false, error: 'configKey and configValue are required' });
      return;
    }

    const existing = await queryOne('SELECT id FROM ai_config WHERE configKey = ?', [configKey]);
    if (existing) {
      res.status(409).json({ success: false, error: 'Config key already exists. Use PUT to update.' });
      return;
    }

    const id = uuidv4();
    await run(
      'INSERT INTO ai_config (id, configKey, configValue, description, updatedBy) VALUES (?, ?, ?, ?, ?)',
      [id, configKey, configValue, description || null, req.user!.userId]
    );

    const created = await queryOne(
      `SELECT ac.*, u.username as updatedByName
       FROM ai_config ac
       LEFT JOIN users u ON ac.updatedBy = u.id
       WHERE ac.id = ?`,
      [id]
    );

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create AI config entry' });
  }
});

router.delete('/ai-config/:key', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const existing = await queryOne('SELECT id, configKey FROM ai_config WHERE configKey = ?', [key]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'AI config entry not found' });
      return;
    }

    await run('DELETE FROM ai_config WHERE configKey = ?', [key]);
    res.json({ success: true, message: 'AI config entry deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete AI config entry' });
  }
});

// ============================================================
// EXPORT ENDPOINTS
// ============================================================

router.get('/export/student-report/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id;

    // Student info
    const student = await queryOne(
      `SELECT u.*, s.name as schoolName
       FROM users u
       LEFT JOIN schools s ON u.schoolId = s.id
       WHERE u.id = ? AND u.role = 'student'`,
      [studentId]
    );
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }
    const { password: _, ...studentInfo } = student;

    // Reading stats
    const readingStats = await queryOne(
      `SELECT
         COUNT(*) as totalBooks,
         COALESCE(SUM(CASE WHEN isCompleted = 1 THEN 1 ELSE 0 END), 0) as completedBooks,
         COALESCE(SUM(currentPage), 0) as totalPagesRead
       FROM reading_progress WHERE userId = ?`,
      [studentId]
    );
    const quizStats = await queryOne(
      'SELECT COUNT(*) as totalQuizzes, COALESCE(AVG(score), 0) as avgScore FROM quiz_results WHERE userId = ?',
      [studentId]
    );
    const sessionStats = await queryOne(
      'SELECT COUNT(*) as totalSessions, COALESCE(SUM(duration), 0) as totalMinutes FROM reading_sessions WHERE userId = ?',
      [studentId]
    );
    const highlightCount = (await queryOne(
      'SELECT COUNT(*) as count FROM highlights WHERE userId = ?',
      [studentId]
    ))?.count || 0;
    const noteCount = (await queryOne(
      'SELECT COUNT(*) as count FROM notes WHERE userId = ?',
      [studentId]
    ))?.count || 0;
    const pointsEarned = (await queryOne(
      'SELECT COALESCE(SUM(points), 0) as total FROM points WHERE userId = ?',
      [studentId]
    ))?.total || 0;

    // Reading history
    const readingHistory = await queryAll(
      `SELECT rp.*, b.title as bookTitle, b.author as bookAuthor, b.coverUrl as bookCover
       FROM reading_progress rp
       JOIN books b ON rp.bookId = b.id
       WHERE rp.userId = ?
       ORDER BY rp.lastReadAt DESC`,
      [studentId]
    );

    // Quiz results
    const quizResults = await queryAll(
      `SELECT qr.*, b.title as bookTitle, b.author as bookAuthor
       FROM quiz_results qr
       JOIN books b ON qr.bookId = b.id
       WHERE qr.userId = ?
       ORDER BY qr.completedAt DESC`,
      [studentId]
    );

    // Reading sessions
    const readingSessions = await queryAll(
      `SELECT rs.*, b.title as bookTitle
       FROM reading_sessions rs
       JOIN books b ON rs.bookId = b.id
       WHERE rs.userId = ?
       ORDER BY rs.startedAt DESC`,
      [studentId]
    );

    // Highlights
    const highlights = await queryAll(
      `SELECT h.*, b.title as bookTitle
       FROM highlights h
       JOIN books b ON h.bookId = b.id
       WHERE h.userId = ?
       ORDER BY h.createdAt DESC`,
      [studentId]
    );

    // Notes
    const notes = await queryAll(
      `SELECT n.*, b.title as bookTitle
       FROM notes n
       JOIN books b ON n.bookId = b.id
       WHERE n.userId = ?
       ORDER BY n.updatedAt DESC`,
      [studentId]
    );

    // Achievements
    const achievements = await queryAll(
      `SELECT ua.*, a.name as achievementName, a.description as achievementDesc, a.icon, a.category, a.rarity, a.points as achievementPoints
       FROM user_achievements ua
       JOIN achievements a ON ua.achievementId = a.id
       WHERE ua.userId = ?
       ORDER BY ua.unlockedAt DESC`,
      [studentId]
    );

    // Badges
    const badges = await queryAll(
      `SELECT ub.*, b.name as badgeName, b.description as badgeDesc, b.icon, b.category, b.rarity
       FROM user_badges ub
       JOIN badges b ON ub.badgeId = b.id
       WHERE ub.userId = ?
       ORDER BY ub.unlockedAt DESC`,
      [studentId]
    );

    // Points
    const points = await queryAll(
      'SELECT * FROM points WHERE userId = ? ORDER BY createdAt DESC',
      [studentId]
    );

    res.json({
      success: true,
      data: {
        student: studentInfo,
        stats: {
          ...readingStats,
          totalQuizzes: quizStats?.totalQuizzes || 0,
          avgQuizScore: quizStats?.avgScore || 0,
          totalSessions: sessionStats?.totalSessions || 0,
          totalReadingMinutes: sessionStats?.totalMinutes || 0,
          totalHighlights: highlightCount,
          totalNotes: noteCount,
          totalPointsEarned: pointsEarned,
        },
        readingHistory,
        quizResults,
        readingSessions,
        highlights,
        notes,
        achievements,
        badges,
        points,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate student report' });
  }
});

router.get('/export/school-report/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.params.id;

    const school = await queryOne('SELECT * FROM schools WHERE id = ?', [schoolId]);
    if (!school) {
      res.status(404).json({ success: false, error: 'School not found' });
      return;
    }

    // All students in the school (non-deregistered)
    const students = await queryAll(
      `SELECT id, username, email, grade, points, level, preferredLanguage, createdAt, updatedAt
       FROM users
       WHERE schoolId = ? AND role = 'student' AND isDeregistered = 0
       ORDER BY createdAt ASC`,
      [schoolId]
    );

    // For each student, get their stats
    const studentReports = [];
    for (const s of students) {
      const readingStats = await queryOne(
        `SELECT COUNT(*) as totalBooks, COALESCE(SUM(CASE WHEN isCompleted = 1 THEN 1 ELSE 0 END), 0) as completedBooks
         FROM reading_progress WHERE userId = ?`,
        [s.id]
      );
      const quizStats = await queryOne(
        'SELECT COUNT(*) as totalQuizzes, COALESCE(AVG(score), 0) as avgScore FROM quiz_results WHERE userId = ?',
        [s.id]
      );
      const sessionStats = await queryOne(
        'SELECT COALESCE(SUM(duration), 0) as totalMinutes FROM reading_sessions WHERE userId = ?',
        [s.id]
      );
      const pointsEarned = (await queryOne(
        'SELECT COALESCE(SUM(points), 0) as total FROM points WHERE userId = ?',
        [s.id]
      ))?.total || 0;

      studentReports.push({
        studentId: s.id,
        username: s.username,
        email: s.email,
        grade: s.grade,
        level: s.level,
        totalBooks: readingStats?.totalBooks || 0,
        completedBooks: readingStats?.completedBooks || 0,
        totalQuizzes: quizStats?.totalQuizzes || 0,
        avgQuizScore: quizStats?.avgScore || 0,
        totalReadingMinutes: sessionStats?.totalMinutes || 0,
        totalPoints: pointsEarned,
      });
    }

    // Aggregate school stats
    const totalCompletedBooks = studentReports.reduce((sum, r) => sum + (r.completedBooks as number), 0);
    const totalReadingMinutes = studentReports.reduce((sum, r) => sum + (r.totalReadingMinutes as number), 0);
    const totalPoints = studentReports.reduce((sum, r) => sum + (r.totalPoints as number), 0);
    const avgQuizScore = studentReports.length > 0
      ? studentReports.reduce((sum, r) => sum + (r.avgQuizScore as number), 0) / studentReports.length
      : 0;

    res.json({
      success: true,
      data: {
        school,
        students: studentReports,
        aggregates: {
          totalStudents: studentReports.length,
          totalCompletedBooks,
          totalReadingMinutes,
          totalPoints,
          avgQuizScore: Math.round(avgQuizScore * 100) / 100,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate school report' });
  }
});

router.get('/export/students-report', async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentIds } = req.query;

    if (!studentIds) {
      res.status(400).json({ success: false, error: 'studentIds query param is required (comma-separated)' });
      return;
    }

    const ids = (studentIds as string).split(',').map(id => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      res.status(400).json({ success: false, error: 'No valid student IDs provided' });
      return;
    }

    const placeholders = ids.map(() => '?').join(',');
    const students = await queryAll(
      `SELECT u.*, s.name as schoolName
       FROM users u
       LEFT JOIN schools s ON u.schoolId = s.id
       WHERE u.id IN (${placeholders}) AND u.role = 'student'`,
      [...ids]
    );

    const reports = [];
    for (const student of students) {
      const { password: _, ...studentInfo } = student;

      const readingStats = await queryOne(
        `SELECT COUNT(*) as totalBooks, COALESCE(SUM(CASE WHEN isCompleted = 1 THEN 1 ELSE 0 END), 0) as completedBooks
         FROM reading_progress WHERE userId = ?`,
        [student.id]
      );
      const quizStats = await queryOne(
        'SELECT COUNT(*) as totalQuizzes, COALESCE(AVG(score), 0) as avgScore FROM quiz_results WHERE userId = ?',
        [student.id]
      );
      const sessionStats = await queryOne(
        'SELECT COUNT(*) as totalSessions, COALESCE(SUM(duration), 0) as totalMinutes FROM reading_sessions WHERE userId = ?',
        [student.id]
      );
      const pointsEarned = (await queryOne(
        'SELECT COALESCE(SUM(points), 0) as total FROM points WHERE userId = ?',
        [student.id]
      ))?.total || 0;

      reports.push({
        student: studentInfo,
        stats: {
          totalBooks: readingStats?.totalBooks || 0,
          completedBooks: readingStats?.completedBooks || 0,
          totalQuizzes: quizStats?.totalQuizzes || 0,
          avgQuizScore: quizStats?.avgScore || 0,
          totalSessions: sessionStats?.totalSessions || 0,
          totalReadingMinutes: sessionStats?.totalMinutes || 0,
          totalPointsEarned: pointsEarned,
        },
      });
    }

    // Combined aggregates
    const totalStudents = reports.length;
    const totalCompletedBooks = reports.reduce((sum, r) => sum + (r.stats.completedBooks as number), 0);
    const totalReadingMinutes = reports.reduce((sum, r) => sum + (r.stats.totalReadingMinutes as number), 0);
    const totalPoints = reports.reduce((sum, r) => sum + (r.stats.totalPointsEarned as number), 0);
    const avgQuizScore = totalStudents > 0
      ? reports.reduce((sum, r) => sum + (r.stats.avgQuizScore as number), 0) / totalStudents
      : 0;

    res.json({
      success: true,
      data: {
        students: reports,
        aggregates: {
          totalStudents,
          totalCompletedBooks,
          totalReadingMinutes,
          totalPoints,
          avgQuizScore: Math.round(avgQuizScore * 100) / 100,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate students report' });
  }
});

export default router;
