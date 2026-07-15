import { Router, type Request, type Response, type NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { queryAll, queryOne, run, safeJsonParse } from '../db/database.js';
import { verifyToken, requireRole, generateToken, type JwtPayload } from '../middleware/auth.js';
import { generateCoverFromBook, extractEpubMetadata, generateCoverFromBookBuffer } from '../services/bookMetadata.js';
import { getStorageProvider, resolveFileUrl, resolveBookUrls, resolveBookListUrls, buildKey, keyFromLegacyPath, isLegacyPath } from '../services/storage/index.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

router.use(verifyToken);
router.use(requireRole('admin', 'super_admin', 'teacher'));

// ============================================================
// DASHBOARD
// ============================================================

router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const { dateRange = '60', schoolId: querySchoolId } = req.query;
    const days = Math.min(365, Math.max(1, parseInt(dateRange as string) || 60));
    const user = req.user!;
    const isSuperAdmin = user.role === 'super_admin';
    const schoolId = (isSuperAdmin && querySchoolId) ? querySchoolId : user.schoolId;

    // Build school filter for non-super-admin users
    const schoolFilter = isSuperAdmin && !querySchoolId ? '' : ' AND u.schoolId = ?';
    const schoolFilterRs = isSuperAdmin && !querySchoolId ? '' : ' AND rs.userId IN (SELECT id FROM users WHERE schoolId = ?)';
    const schoolFilterRp = isSuperAdmin && !querySchoolId ? '' : ' AND rp.userId IN (SELECT id FROM users WHERE schoolId = ?)';
    const schoolFilterQr = isSuperAdmin && !querySchoolId ? '' : ' AND qr.userId IN (SELECT id FROM users WHERE schoolId = ?)';
    const schoolParams = isSuperAdmin && !querySchoolId ? [] : [schoolId];

    // Core stat cards
    const totalStudentsResult = await queryOne(
      `SELECT COUNT(*) as count FROM users u WHERE u.role = 'student'${schoolFilter}`,
      schoolParams
    );
    const totalBooks = (await queryOne('SELECT COUNT(*) as count FROM books WHERE isActive = 1'))?.count || 0;
    const totalSchools = isSuperAdmin
      ? ((await queryOne('SELECT COUNT(*) as count FROM schools WHERE isActive = 1'))?.count || 0)
      : 1;
    const totalAdmins = (await queryOne(
      `SELECT COUNT(*) as count FROM admins a JOIN users u ON a.userId = u.id WHERE a.isActive = 1${isSuperAdmin ? '' : ' AND u.schoolId = ?'}`,
      isSuperAdmin ? [] : [schoolId]
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
                COALESCE(ROUND(COUNT(DISTINCT CASE WHEN rs.id IS NOT NULL AND rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN u.id END) * 100.0 / NULLIF(COUNT(DISTINCT u.id), 0)), 0) as usageRate,
                COUNT(DISTINCT CASE WHEN rp2.isCompleted = 1 THEN rp2.id END) as completions,
                COALESCE(SUM(rs2.duration), 0) as totalReadingMinutes
         FROM schools s
         LEFT JOIN users u ON s.id = u.schoolId AND u.role = 'student'
         LEFT JOIN reading_sessions rs ON u.id = rs.userId
         LEFT JOIN reading_sessions rs2 ON u.id = rs2.userId AND rs2.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
         LEFT JOIN reading_progress rp2 ON u.id = rp2.userId AND rp2.isCompleted = 1
         WHERE s.isActive = 1
         GROUP BY s.id, s.name
         ORDER BY studentCount DESC
         LIMIT 10`,
        [days, days]
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

    // Reading by hour of day (0–23)
    const readingByHour = await queryAll(
      `SELECT HOUR(rs.startedAt) as hour, COUNT(*) as sessions
       FROM reading_sessions rs
       WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)${schoolFilterRs}
       GROUP BY HOUR(rs.startedAt)
       ORDER BY hour`,
      [...schoolParams, days]
    );

    // Reading by day of week (MySQL DAYOFWEEK: 1=Sun, 2=Mon, ..., 7=Sat)
    const readingByDayOfWeek = await queryAll(
      `SELECT DAYOFWEEK(rs.startedAt) as dayOfWeek, COUNT(*) as sessions,
              COUNT(DISTINCT rp.id) as completions
       FROM reading_sessions rs
       LEFT JOIN reading_progress rp ON rs.userId = rp.userId
         AND rp.isCompleted = 1 AND DATE(rp.lastReadAt) = DATE(rs.startedAt)
       WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)${schoolFilterRs}
       GROUP BY DAYOFWEEK(rs.startedAt)
       ORDER BY dayOfWeek`,
      [...schoolParams, days]
    );

    // Previous period KPIs for trend comparison
    const prevSessions = (await queryOne(
      `SELECT COUNT(*) as count FROM reading_sessions rs
       WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND rs.startedAt < DATE_SUB(NOW(), INTERVAL ? DAY)${schoolFilterRs}`,
      [...schoolParams, days * 2, days]
    ))?.count || 0;

    const prevActiveUsers = (await queryOne(
      `SELECT COUNT(DISTINCT rs.userId) as count FROM reading_sessions rs
       WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND rs.startedAt < DATE_SUB(NOW(), INTERVAL ? DAY)${schoolFilterRs}`,
      [...schoolParams, days * 2, days]
    ))?.count || 0;

    const prevMinutes = (await queryOne(
      `SELECT COALESCE(SUM(rs.duration), 0) as total FROM reading_sessions rs
       WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND rs.startedAt < DATE_SUB(NOW(), INTERVAL ? DAY)${schoolFilterRs}`,
      [...schoolParams, days * 2, days]
    ))?.total || 0;

    const prevCompletions = (await queryOne(
      `SELECT COUNT(*) as count FROM reading_progress rp
       WHERE rp.isCompleted = 1
         AND rp.lastReadAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND rp.lastReadAt < DATE_SUB(NOW(), INTERVAL ? DAY)${schoolFilterRp}`,
      [...schoolParams, days * 2, days]
    ))?.count || 0;

    // Top 5 books by read count
    const topBooks = await queryAll(
      'SELECT id, title, author, coverUrl, readCount FROM books WHERE isActive = 1 ORDER BY readCount DESC LIMIT 5'
    );

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
        readingByHour,
        readingByDayOfWeek,
        previousPeriod: {
          readingSessionsCount: prevSessions,
          activeUsers: prevActiveUsers,
          totalReadingMinutes: prevMinutes,
          completions: prevCompletions,
        },
        topBooks,
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
    const { page = '1', pageSize = '20', search, country, state, district } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * pageSizeNum;
    const user = req.user!;
    const isSuperAdmin = user.role === 'super_admin';

    // Non-super admins can only see their own school
    if (!isSuperAdmin) {
      const school = await queryOne('SELECT * FROM schools WHERE id = ? AND isActive = 1', [user.schoolId]);
      if (!school) {
        res.json({ success: true, data: { data: [], total: 0, page: 1, pageSize: Number(pageSizeNum) } });
        return;
      }
      // Get student count
      const studentCount = (await queryOne("SELECT COUNT(*) as count FROM users WHERE schoolId = ? AND role = 'student' AND isDeregistered = 0", [user.schoolId]))?.count || 0;
      res.json({ success: true, data: { data: [{ ...school, studentCount }], total: 1, page: 1, pageSize: Number(pageSizeNum) } });
      return;
    }

    let countSql = 'SELECT COUNT(*) as total FROM schools WHERE isActive = 1';
    let dataSql = 'SELECT * FROM schools WHERE isActive = 1';
    const params: unknown[] = [];

    if (search) {
      countSql += ' AND name LIKE ?';
      dataSql += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }
    if (country) {
      countSql += ' AND country = ?';
      dataSql += ' AND country = ?';
      params.push(country);
    }
    if (state) {
      countSql += ' AND state = ?';
      dataSql += ' AND state = ?';
      params.push(state);
    }
    if (district) {
      countSql += ' AND district = ?';
      dataSql += ' AND district = ?';
      params.push(district);
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
    const { name, address, district, state, country, contactPhone, contactEmail, adminEmail, adminPassword } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'School name is required' });
      return;
    }

    const id = uuidv4();
    await run(
      'INSERT INTO schools (id, name, address, district, state, country, contactPhone, contactEmail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, address || null, district || null, state || null, country || null, contactPhone || null, contactEmail || null]
    );

    // Auto-create school admin if contactEmail or adminEmail is provided
    let adminCredentials = null;
    const adminUserEmail = adminEmail || contactEmail;
    if (adminUserEmail) {
      const username = name.replace(/[^a-zA-Z0-9一-鿿؀-ۿ஀-௿]/g, '_').substring(0, 30) + '_admin';
      const password = adminPassword || Math.random().toString(36).slice(-10) + 'A1!';
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      const adminId = uuidv4();

      await run(
        'INSERT INTO users (id, username, email, password, schoolId, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, username, adminUserEmail, hashedPassword, id, 'admin', 'active']
      );

      await run(
        'INSERT INTO admins (id, userId, schoolId, role, permissions) VALUES (?, ?, ?, ?, ?)',
        [adminId, userId, id, 'admin', JSON.stringify(['read', 'write', 'manage_students'])]
      );

      adminCredentials = { username, email: adminUserEmail, password };
    }

    const school = await queryOne('SELECT * FROM schools WHERE id = ?', [id]);
    res.status(201).json({
      success: true,
      data: { ...school, admin: adminCredentials },
    });
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

router.delete('/schools/:id/hard', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.params.id;
    const school = await queryOne('SELECT id, name FROM schools WHERE id = ?', [schoolId]);
    if (!school) {
      res.status(404).json({ success: false, error: 'School not found' });
      return;
    }

    // Delete all students and their associated data
    const students = await queryAll('SELECT id FROM users WHERE schoolId = ?', [schoolId]);
    for (const s of students as any[]) {
      const sid = s.id;
      await run('DELETE FROM bookmarks WHERE userId = ?', [sid]);
      await run('DELETE FROM favorites WHERE userId = ?', [sid]);
      await run('DELETE FROM highlights WHERE userId = ?', [sid]);
      await run('DELETE FROM notes WHERE userId = ?', [sid]);
      await run('DELETE FROM reading_progress WHERE userId = ?', [sid]);
      await run('DELETE FROM reading_sessions WHERE userId = ?', [sid]);
      await run('DELETE FROM quiz_results WHERE userId = ?', [sid]);
      await run('DELETE FROM login_sessions WHERE userId = ?', [sid]);
      await run('DELETE FROM user_achievements WHERE userId = ?', [sid]);
      await run('DELETE FROM user_badges WHERE userId = ?', [sid]);
      await run('DELETE FROM points WHERE userId = ?', [sid]);
      await run('DELETE FROM pets WHERE userId = ?', [sid]);
      await run('DELETE FROM password_reset_tokens WHERE userId = ?', [sid]);
    }
    await run('DELETE FROM users WHERE schoolId = ?', [schoolId]);

    // Delete admins, whitelist, and school
    await run('DELETE FROM admins WHERE schoolId = ?', [schoolId]);
    await run('DELETE FROM ic_whitelist WHERE schoolId = ?', [schoolId]);
    await run('DELETE FROM schools WHERE id = ?', [schoolId]);

    res.locals.auditDetails = `Hard deleted school: ${(school as any).name} (id: ${schoolId})`;
    res.json({ success: true, message: 'School permanently deleted' });
  } catch (error) {
    console.error('Hard delete school error:', error);
    res.status(500).json({ success: false, error: 'Failed to permanently delete school' });
  }
});

// ============================================================
// SCHOOL ANALYTICS (rich dashboard for a single school)
// ============================================================

router.get('/schools/:id/analytics', async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.params.id;
    const { dateRange = '30' } = req.query;
    const days = Math.min(365, Math.max(1, parseInt(dateRange as string) || 30));

    // School info
    const school = await queryOne('SELECT * FROM schools WHERE id = ?', [schoolId]);
    if (!school) {
      res.status(404).json({ success: false, error: 'School not found' });
      return;
    }

    // Students in this school
    const totalStudents = (await queryOne(
      "SELECT COUNT(*) as count FROM users WHERE schoolId = ? AND role = 'student' AND isDeregistered = 0",
      [schoolId]
    ))?.count || 0;

    // Active readers (students who read in period)
    const activeReaders = (await queryOne(
      `SELECT COUNT(DISTINCT rs.userId) as count
       FROM reading_sessions rs
       JOIN users u ON rs.userId = u.id
       WHERE u.schoolId = ? AND rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [schoolId, days]
    ))?.count || 0;

    // Total sessions
    const totalSessions = (await queryOne(
      `SELECT COUNT(*) as count FROM reading_sessions rs
       JOIN users u ON rs.userId = u.id
       WHERE u.schoolId = ? AND rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [schoolId, days]
    ))?.count || 0;

    // Total completions
    const totalCompletions = (await queryOne(
      `SELECT COUNT(*) as count FROM reading_progress rp
       JOIN users u ON rp.userId = u.id
       WHERE u.schoolId = ? AND rp.isCompleted = 1 AND rp.lastReadAt >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [schoolId, days]
    ))?.count || 0;

    // Total reading minutes
    const totalReadingMinutes = (await queryOne(
      `SELECT COALESCE(SUM(rs.duration), 0) as total FROM reading_sessions rs
       JOIN users u ON rs.userId = u.id
       WHERE u.schoolId = ? AND rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [schoolId, days]
    ))?.total || 0;

    // Average quiz score
    const avgQuizScore = (await queryOne(
      `SELECT COALESCE(AVG(qr.score), 0) as avg FROM quiz_results qr
       JOIN users u ON qr.userId = u.id
       WHERE u.schoolId = ?`,
      [schoolId]
    ))?.avg || 0;

    // Reading trend by day
    const readingTrend: { date: string; sessions: number; completions: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const sessions = (await queryOne(
        `SELECT COUNT(*) as count FROM reading_sessions rs JOIN users u ON rs.userId = u.id
         WHERE u.schoolId = ? AND DATE(rs.startedAt) = ?`,
        [schoolId, dateStr]
      ))?.count || 0;
      const completions = (await queryOne(
        `SELECT COUNT(*) as count FROM reading_progress rp JOIN users u ON rp.userId = u.id
         WHERE u.schoolId = ? AND rp.isCompleted = 1 AND DATE(rp.lastReadAt) = ?`,
        [schoolId, dateStr]
      ))?.count || 0;
      readingTrend.push({ date: dateStr, sessions: sessions as number, completions: completions as number });
    }

    // Reading by hour
    const readingByHour = await queryAll(
      `SELECT HOUR(rs.startedAt) as hour, COUNT(*) as sessions
       FROM reading_sessions rs JOIN users u ON rs.userId = u.id
       WHERE u.schoolId = ? AND rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY HOUR(rs.startedAt) ORDER BY hour`,
      [schoolId, days]
    );

    // Reading by day of week
    const readingByDayOfWeek = await queryAll(
      `SELECT DAYOFWEEK(rs.startedAt) as dayOfWeek, COUNT(*) as sessions
       FROM reading_sessions rs JOIN users u ON rs.userId = u.id
       WHERE u.schoolId = ? AND rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DAYOFWEEK(rs.startedAt) ORDER BY dayOfWeek`,
      [schoolId, days]
    );

    // Top books in this school
    const topBooks = await queryAll(
      `SELECT b.id, b.title, b.author, b.coverUrl, COUNT(rp.id) as readCount
       FROM reading_progress rp
       JOIN books b ON rp.bookId = b.id
       JOIN users u ON rp.userId = u.id
       WHERE u.schoolId = ? AND rp.lastReadAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY b.id
       ORDER BY readCount DESC
       LIMIT 10`,
      [schoolId, days]
    );

    // Top students in this school
    const topStudents = await queryAll(
      `SELECT u.id, u.username, u.avatar, u.points, u.level,
              COUNT(DISTINCT rp.id) as booksRead,
              COUNT(DISTINCT rp2.id) as completedBooks,
              COALESCE(SUM(rs.duration), 0) as totalMinutes
       FROM users u
       LEFT JOIN reading_progress rp ON u.id = rp.userId
       LEFT JOIN reading_progress rp2 ON u.id = rp2.userId AND rp2.isCompleted = 1
       LEFT JOIN reading_sessions rs ON u.id = rs.userId AND rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
       WHERE u.schoolId = ? AND u.role = 'student' AND u.isDeregistered = 0
       GROUP BY u.id
       ORDER BY totalMinutes DESC
       LIMIT 10`,
      [schoolId, days]
    );

    // Category distribution for this school
    const categoryDistribution = await queryAll(
      `SELECT bc.name, COUNT(DISTINCT rp.bookId) as count
       FROM book_categories bc
       LEFT JOIN books b ON bc.id = b.categoryId AND b.isActive = 1
       LEFT JOIN reading_progress rp ON b.id = rp.bookId
       LEFT JOIN users u ON rp.userId = u.id AND u.schoolId = ?
       WHERE u.id IS NOT NULL
       GROUP BY bc.id, bc.name
       ORDER BY count DESC
       LIMIT 6`,
      [schoolId]
    );

    // Grade distribution (students by grade)
    const gradeDistribution = await queryAll(
      `SELECT COALESCE(grade, 'Unknown') as grade, COUNT(*) as count
       FROM users
       WHERE schoolId = ? AND role = 'student' AND isDeregistered = 0
       GROUP BY grade
       ORDER BY count DESC`,
      [schoolId]
    );

    // Activity rate (students who read / total students)
    const activityRate = Number(totalStudents) > 0
      ? Math.round((Number(activeReaders) / Number(totalStudents)) * 100) : 0;

    // Completion rate
    const completionRate = Number(totalStudents) > 0
      ? Math.round((Number(totalCompletions) / Number(totalStudents))) : 0;

    // Teacher count
    const teacherCount = (await queryOne(
      "SELECT COUNT(*) as count FROM users WHERE schoolId = ? AND role = 'teacher' AND isDeregistered = 0",
      [schoolId]
    ))?.count || 0;

    res.json({
      success: true,
      data: {
        school,
        summary: {
          totalStudents,
          activeReaders,
          activityRate,
          totalSessions,
          totalCompletions,
          completionRate,
          totalReadingMinutes,
          avgQuizScore: Math.round(avgQuizScore as number),
          teacherCount,
        },
        readingTrend,
        readingByHour,
        readingByDayOfWeek,
        topBooks,
        topStudents,
        categoryDistribution,
        gradeDistribution,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch school analytics' });
  }
});

// ============================================================
// STUDENTS
// ============================================================

router.get('/students', async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', pageSize = '20', search, schoolId, country, state, district, isDeregistered, regDateFrom, regDateTo } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * pageSizeNum;
    const user = req.user!;
    const isSuperAdmin = user.role === 'super_admin';
    const effectiveSchoolId = !isSuperAdmin ? user.schoolId : (schoolId as string || null);

    let countSql = "SELECT COUNT(*) as total FROM users u LEFT JOIN schools s ON u.schoolId = s.id WHERE u.role = 'student'";
    let dataSql = `SELECT u.*, s.name as schoolName, s.state as schoolState, s.district as schoolDistrict, s.country as schoolCountry
                   FROM users u
                   LEFT JOIN schools s ON u.schoolId = s.id
                   WHERE u.role = 'student'`;
    const countParams: unknown[] = [];
    const dataParams: unknown[] = [];

    if (effectiveSchoolId) {
      countSql += ' AND u.schoolId = ?';
      dataSql += ' AND u.schoolId = ?';
      countParams.push(effectiveSchoolId);
      dataParams.push(effectiveSchoolId);
    }

    if (search) {
      countSql += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      dataSql += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm);
      dataParams.push(searchTerm, searchTerm);
    }

    if (country) {
      countSql += ' AND s.country = ?';
      dataSql += ' AND s.country = ?';
      countParams.push(country);
      dataParams.push(country);
    }

    if (state) {
      countSql += ' AND s.state = ?';
      dataSql += ' AND s.state = ?';
      countParams.push(state);
      dataParams.push(state);
    }

    if (district) {
      countSql += ' AND s.district = ?';
      dataSql += ' AND s.district = ?';
      countParams.push(district);
      dataParams.push(district);
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

    if (regDateFrom) {
      countSql += ' AND DATE(u.createdAt) >= ?';
      dataSql += ' AND DATE(u.createdAt) >= ?';
      countParams.push(regDateFrom);
      dataParams.push(regDateFrom);
    }

    if (regDateTo) {
      countSql += ' AND DATE(u.createdAt) <= ?';
      dataSql += ' AND DATE(u.createdAt) <= ?';
      countParams.push(regDateTo);
      dataParams.push(regDateTo);
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
    let historySql = `SELECT rp.*, b.title as bookTitle, b.author as bookAuthor, b.coverUrl as bookCover,
      b.isbn as bookIsbn, b.publisher as bookPublisher, b.publishDate as bookPublishDate,
      b.language as bookLanguage, b.pageCount as bookPageCount, b.fileType as bookType,
      c.name as categoryName
      FROM reading_progress rp
      JOIN books b ON rp.bookId = b.id
      LEFT JOIN book_categories c ON b.categoryId = c.id
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

    // Daily activity for heatmap (last 365 days)
    const dailyActivity = await queryAll(
      `SELECT DATE(startedAt) as date, COALESCE(SUM(duration), 0) as totalMinutes
       FROM reading_sessions
       WHERE userId = ? AND startedAt >= DATE_SUB(CURDATE(), INTERVAL 210 DAY)
       GROUP BY DATE(startedAt)
       ORDER BY date`,
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
        dailyActivity,
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

router.delete('/students/:id/hard', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id;
    const student = await queryOne("SELECT id, username, email, icNumber, schoolId FROM users WHERE id = ? AND role = 'student'", [studentId]);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    // Delete all associated data in FK order
    await run('DELETE FROM bookmarks WHERE userId = ?', [studentId]);
    await run('DELETE FROM favorites WHERE userId = ?', [studentId]);
    await run('DELETE FROM highlights WHERE userId = ?', [studentId]);
    await run('DELETE FROM notes WHERE userId = ?', [studentId]);
    await run('DELETE FROM reading_progress WHERE userId = ?', [studentId]);
    await run('DELETE FROM reading_sessions WHERE userId = ?', [studentId]);
    await run('DELETE FROM quiz_results WHERE userId = ?', [studentId]);
    await run('DELETE FROM login_sessions WHERE userId = ?', [studentId]);
    await run('DELETE FROM user_achievements WHERE userId = ?', [studentId]);
    await run('DELETE FROM user_badges WHERE userId = ?', [studentId]);
    await run('DELETE FROM points WHERE userId = ?', [studentId]);
    await run('DELETE FROM pets WHERE userId = ?', [studentId]);
    await run('DELETE FROM password_reset_tokens WHERE userId = ?', [studentId]);

    // Delete the user
    await run('DELETE FROM users WHERE id = ?', [studentId]);

    res.locals.auditDetails = `Hard deleted student: ${student.username} (IC: ${student.icNumber}, email: ${student.email}, schoolId: ${student.schoolId})`;

    res.json({ success: true, message: 'Student permanently deleted' });
  } catch (error) {
    console.error('Hard delete student error:', error);
    res.status(500).json({ success: false, error: 'Failed to permanently delete student' });
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
    const user = req.user!;
    const isSuperAdmin = user.role === 'super_admin';
    const effectiveSchoolId = !isSuperAdmin ? user.schoolId : (schoolId as string || null);

    let countSql = "SELECT COUNT(*) as total FROM users u WHERE u.role = 'teacher'";
    let dataSql = `SELECT u.*, s.name as schoolName
                   FROM users u
                   LEFT JOIN schools s ON u.schoolId = s.id
                   WHERE u.role = 'teacher'`;
    const countParams: unknown[] = [];
    const dataParams: unknown[] = [];

    if (effectiveSchoolId) {
      countSql += ' AND u.schoolId = ?';
      dataSql += ' AND u.schoolId = ?';
      countParams.push(effectiveSchoolId);
      dataParams.push(effectiveSchoolId);
    }

    if (search) {
      countSql += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      dataSql += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      const term = `%${search}%`;
      countParams.push(term, term);
      dataParams.push(term, term);
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

    const existing = await queryOne("SELECT id FROM users WHERE email = ? AND role = 'teacher'", [email]);
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
    const { username, email, password, schoolId, permissions, role: requestedRole } = req.body;
    if (!username || !email || !password || !schoolId) {
      res.status(400).json({ success: false, error: 'Username, email, password, and schoolId are required' });
      return;
    }

    const existing = await queryOne(
      "SELECT id FROM users WHERE email = ? AND role IN ('admin', 'super_admin')",
      [email]
    );
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    const role = requestedRole === 'super_admin' ? 'super_admin' : 'admin';

    // Only one super_admin allowed
    if (role === 'super_admin') {
      const superAdminExists = await queryOne(
        "SELECT id FROM admins WHERE role = 'super_admin' AND isActive = 1"
      );
      if (superAdminExists) {
        res.status(409).json({ success: false, error: 'Super admin already exists. Only one super admin is allowed.' });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const adminId = uuidv4();

    // Super admin needs a valid schoolId for FK, but isn't tied to a specific school
    await run(
      'INSERT INTO users (id, username, email, password, schoolId, role) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, username, email, hashedPassword, schoolId, role]
    );

    await run(
      'INSERT INTO admins (id, userId, schoolId, role, permissions) VALUES (?, ?, ?, ?, ?)',
      [adminId, userId, schoolId, role, JSON.stringify(permissions || (role === 'super_admin' ? ['all'] : ['read', 'write']))]
    );

    const admin = await queryOne(
      `SELECT a.*, u.username, u.email, s.name as schoolName
       FROM admins a
       JOIN users u ON a.userId = u.id
       LEFT JOIN schools s ON a.schoolId = s.id
       WHERE a.id = ?`,
      [adminId]
    );

    const formatted = {
      ...admin,
      permissions: safeJsonParse(admin.permissions, []),
      user: {
        id: admin.userId,
        username: admin.username,
        email: admin.email,
        avatar: admin.avatar,
      },
      school: admin.schoolName ? {
        id: admin.schoolId,
        name: admin.schoolName,
      } : null,
    };

    res.status(201).json({ success: true, data: formatted });
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
    const { period = '7d', country, state, district, schoolId } = req.query;
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
      conditions.push('u.schoolId = ?');
      uConditions.push('u.schoolId = ?');
    } else if (schoolId) {
      conditions.push('u.schoolId = ?');
      uConditions.push('u.schoolId = ?');
    }

    if (country) {
      conditions.push('s.country = ?');
    }
    if (state) {
      conditions.push('s.state = ?');
    }
    if (district) {
      conditions.push('s.district = ?');
    }

    const userFilterClause = uConditions.length > 0 ? `WHERE ${uConditions.join(' AND ')}` : '';

    // Build params array
    const buildParams = (base: unknown[] = []) => {
      const p = [...base];
      if (isSuperAdmin && schoolId) p.push(schoolId);
      else if (!isSuperAdmin) p.push(user.schoolId);
      if (country) p.push(country);
      if (state) p.push(state);
      if (district) p.push(district);
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

    // Reading by hour of day
    const readingByHour = await queryAll(
      `SELECT HOUR(rs.startedAt) as hour, COUNT(*) as sessions
       FROM reading_sessions rs
       WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)${sessionSchoolFilter}
       GROUP BY HOUR(rs.startedAt)`,
      [days, ...sessionSchoolParam]
    );

    // Reading by day of week
    const readingByDayOfWeek = await queryAll(
      `SELECT DAYOFWEEK(rs.startedAt) as dayOfWeek, COUNT(*) as sessions,
              COUNT(DISTINCT rp.id) as completions
       FROM reading_sessions rs
       LEFT JOIN reading_progress rp ON rs.userId = rp.userId
         AND rp.isCompleted = 1 AND DATE(rp.lastReadAt) = DATE(rs.startedAt)
       WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)${sessionSchoolFilter}
       GROUP BY DAYOFWEEK(rs.startedAt)`,
      [days, ...sessionSchoolParam]
    );

    // Previous period KPIs for trend comparison
    const sessionSchoolFilterPrev = sessionSchoolFilter;
    const prevSessions = (await queryOne(
      `SELECT COUNT(*) as count FROM reading_sessions rs
       WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND rs.startedAt < DATE_SUB(NOW(), INTERVAL ? DAY)${sessionSchoolFilterPrev}`,
      [days * 2, days, ...sessionSchoolParam]
    ))?.count || 0;
    const prevMinutes = (await queryOne(
      `SELECT COALESCE(SUM(rs.duration), 0) as total FROM reading_sessions rs
       WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND rs.startedAt < DATE_SUB(NOW(), INTERVAL ? DAY)${sessionSchoolFilterPrev}`,
      [days * 2, days, ...sessionSchoolParam]
    ))?.total || 0;
    const prevActiveUsers = (await queryOne(
      `SELECT COUNT(DISTINCT rs.userId) as count FROM reading_sessions rs
       WHERE rs.startedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND rs.startedAt < DATE_SUB(NOW(), INTERVAL ? DAY)${sessionSchoolFilterPrev}`,
      [days * 2, days, ...sessionSchoolParam]
    ))?.count || 0;
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
    if (district) {
      schoolFilterSql += ' AND s.district = ?';
      sParams.push(district);
    }
    if (country) {
      schoolFilterSql += ' AND s.country = ?';
      sParams.push(country);
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
        readingByHour,
        readingByDayOfWeek,
        previousPeriod: {
          readingSessionsCount: prevSessions,
          activeUsers: prevActiveUsers,
          totalReadingMinutes: prevMinutes,
        },
        topBooks,
        schoolStats,
      },
    });
  } catch (error) {
    console.error('Statistics error:', error);
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

    const resolvedBooks = await resolveBookListUrls(books as any[]);

    res.json({
      success: true,
      data: { books: resolvedBooks, students, schools },
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
    const { targetRole, schoolId: targetSchoolId } = req.body;

    if (!['student', 'admin'].includes(targetRole)) {
      res.status(400).json({ success: false, error: 'Invalid target role' });
      return;
    }

    // Only super_admin (by JWT token role) can switch
    if (req.user!.role !== 'super_admin') {
      res.status(403).json({ success: false, error: 'Only super admin can switch roles' });
      return;
    }

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Determine the effective schoolId
    let effectiveSchoolId = user.schoolId as string;

    if (targetRole === 'admin' && targetSchoolId) {
      // Verify the target school exists
      const school = await queryOne('SELECT id, name FROM schools WHERE id = ?', [targetSchoolId]);
      if (!school) {
        res.status(400).json({ success: false, error: 'Target school not found' });
        return;
      }
      effectiveSchoolId = targetSchoolId;
    }

    const payload: JwtPayload = {
      userId: user.id as string,
      email: user.email as string,
      role: targetRole,
      schoolId: effectiveSchoolId,
    };

    const token = generateToken(payload);

    res.json({
      success: true,
      data: {
        role: targetRole,
        schoolId: effectiveSchoolId,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: targetRole,
          schoolId: effectiveSchoolId,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to switch role' });
  }
});

// ============================================================
// REGISTRATION APPROVAL
// ============================================================

router.get('/pending-registrations', async (req: Request, res: Response): Promise<void> => {
  try {
    const { schoolId } = req.query;
    const user = (req as any).user;

    let sql = `SELECT u.id, u.username, u.email, u.icNumber, u.grade, u.createdAt, s.name as schoolName, s.state as schoolState
               FROM users u JOIN schools s ON u.schoolId = s.id
               WHERE u.status = 'pending' AND u.isDeregistered = 0`;
    const params: unknown[] = [];

    // School admin can only see their own school's pending registrations
    if (user?.role === 'admin' || schoolId) {
      sql += ' AND u.schoolId = ?';
      params.push(schoolId || user?.schoolId);
    }

    sql += ' ORDER BY u.createdAt DESC';
    const registrations = await queryAll(sql, params);
    res.json({ success: true, data: registrations });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch pending registrations' });
  }
});

router.post('/approve-registration/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.id;
    const user = await queryOne("SELECT * FROM users WHERE id = ? AND status = 'pending'", [userId]);
    if (!user) {
      res.status(404).json({ success: false, error: 'Pending registration not found' });
      return;
    }

    // School admin can only approve for their own school
    if ((req as any).user?.role === 'admin' && user.schoolId !== (req as any).user?.schoolId) {
      res.status(403).json({ success: false, error: 'You can only approve registrations for your own school' });
      return;
    }

    await run("UPDATE users SET status = 'active' WHERE id = ?", [userId]);
    await run('UPDATE schools SET studentCount = studentCount + 1 WHERE id = ?', [user.schoolId]);

    res.json({ success: true, message: 'Registration approved' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to approve registration' });
  }
});

router.post('/reject-registration/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.id;
    const user = await queryOne("SELECT * FROM users WHERE id = ? AND status = 'pending'", [userId]);
    if (!user) {
      res.status(404).json({ success: false, error: 'Pending registration not found' });
      return;
    }

    if ((req as any).user?.role === 'admin' && user.schoolId !== (req as any).user?.schoolId) {
      res.status(403).json({ success: false, error: 'You can only reject registrations for your own school' });
      return;
    }

    await run("UPDATE users SET status = 'rejected' WHERE id = ?", [userId]);

    res.json({ success: true, message: 'Registration rejected' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reject registration' });
  }
});

// ============================================================
// IC WHITELIST
// ============================================================

router.get('/ic-whitelist', async (req: Request, res: Response): Promise<void> => {
  try {
    const { schoolId, search, page, pageSize, country, state, district } = req.query;
    const pageNum = Math.max(0, parseInt(page as string) || 0);
    const limit = Math.min(500, Math.max(1, parseInt(pageSize as string) || 100));

    let where = '';
    const params: unknown[] = [];

    if (country) {
      where += ' AND s.country = ?';
      params.push(country);
    }
    if (state) {
      where += ' AND s.state = ?';
      params.push(state);
    }
    if (district) {
      where += ' AND s.district = ?';
      params.push(district);
    }
    if (schoolId) {
      where += ' AND ic.schoolId = ?';
      params.push(schoolId);
    }
    if (search) {
      where += ' AND ic.icNumber LIKE ?';
      params.push(`%${search}%`);
    }

    // Total count
    const countResult = await queryOne(
      `SELECT COUNT(*) as total FROM ic_whitelist ic JOIN schools s ON ic.schoolId = s.id WHERE 1=1${where}`,
      params
    );
    const total = (countResult as any)?.total || 0;

    const entries = await queryAll(
      `SELECT ic.*, s.name as schoolName FROM ic_whitelist ic JOIN schools s ON ic.schoolId = s.id WHERE 1=1${where} ORDER BY ic.createdAt DESC LIMIT ? OFFSET ?`,
      [...params, limit, pageNum * limit]
    );

    res.json({ success: true, data: entries, total });
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

    const normalizedIc = icNumber.replace(/-/g, '');

    const existing = await queryOne('SELECT id FROM ic_whitelist WHERE REPLACE(icNumber, "-", "") = ?', [normalizedIc]);
    if (existing) {
      res.status(409).json({ success: false, error: 'IC number already in whitelist' });
      return;
    }

    const id = uuidv4();
    await run('INSERT INTO ic_whitelist (id, icNumber, schoolId) VALUES (?, ?, ?)', [id, normalizedIc, schoolId]);

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
    const existing = await queryOne('SELECT id, icNumber, schoolId FROM ic_whitelist WHERE id = ?', [req.params.id]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'IC whitelist entry not found' });
      return;
    }

    await run('DELETE FROM ic_whitelist WHERE id = ?', [req.params.id]);
    res.locals.auditDetails = `Deleted IC: ${existing.icNumber}, schoolId: ${existing.schoolId}`;
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

    let whereClause = 'WHERE b.isActive = 1';
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

    const resolvedBooks = await resolveBookListUrls(books as any[]);

    res.json({
      success: true,
      data: {
        data: resolvedBooks,
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

router.put('/books/batch-move', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookIds, categoryId } = req.body;
    if (!Array.isArray(bookIds) || bookIds.length === 0 || !categoryId) {
      res.status(400).json({ success: false, error: 'bookIds (non-empty array) and categoryId are required' });
      return;
    }
    const cat = await queryOne('SELECT id FROM book_categories WHERE id = ?', [categoryId]);
    if (!cat) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    const placeholders = bookIds.map(() => '?').join(',');
    await run(
      `UPDATE books SET categoryId = ? WHERE id IN (${placeholders})`,
      [categoryId, ...bookIds]
    );
    res.json({ success: true, data: { movedCount: bookIds.length } });
  } catch (error) {
    console.error('Failed to batch move books:', error);
    res.status(500).json({ success: false, error: 'Failed to move books' });
  }
});

router.get('/books/categories', async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await queryAll(
      `SELECT c.*, COUNT(b.id) as bookCount
       FROM book_categories c
       LEFT JOIN books b ON b.categoryId = c.id AND b.isActive = 1
       GROUP BY c.id
       ORDER BY c.sortOrder ASC`
    );
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

router.post('/books/categories', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, icon, color, parentId, sortOrder } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'Category name is required' });
      return;
    }
    const id = uuidv4();
    await run(
      'INSERT INTO book_categories (id, name, icon, color, parentId, sortOrder) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name.trim(), icon || '📚', color || '#6366f1', parentId || null, sortOrder || 0]
    );
    const created = await queryOne('SELECT * FROM book_categories WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Failed to create category:', error);
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
});

router.put('/books/categories/reorder', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, direction } = req.body;
    if (!id || !direction || !['up', 'down'].includes(direction)) {
      res.status(400).json({ success: false, error: 'Invalid reorder request' });
      return;
    }

    const current = await queryOne<{ id: string; sortOrder: number }>(
      'SELECT id, sortOrder FROM book_categories WHERE id = ?', [id]
    );
    if (!current) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }

    const operator = direction === 'up' ? '<' : '>';
    const orderDir = direction === 'up' ? 'DESC' : 'ASC';
    const adjacent = await queryOne<{ id: string; sortOrder: number }>(
      `SELECT id, sortOrder FROM book_categories WHERE sortOrder ${operator} ? ORDER BY sortOrder ${orderDir} LIMIT 1`,
      [current.sortOrder]
    );

    if (!adjacent) {
      res.json({ success: true, data: null });
      return;
    }

    await run('UPDATE book_categories SET sortOrder = ? WHERE id = ?', [adjacent.sortOrder, current.id]);
    await run('UPDATE book_categories SET sortOrder = ? WHERE id = ?', [current.sortOrder, adjacent.id]);

    res.json({ success: true, data: { swapped: true } });
  } catch (error) {
    console.error('Failed to reorder categories:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder categories' });
  }
});

router.put('/books/categories/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await queryOne('SELECT id FROM book_categories WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    const { name, icon, color, parentId, sortOrder } = req.body;
    if (name !== undefined && !name.trim()) {
      res.status(400).json({ success: false, error: 'Category name cannot be empty' });
      return;
    }
    const updates: string[] = [];
    const params: unknown[] = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
    if (icon !== undefined) { updates.push('icon = ?'); params.push(icon); }
    if (color !== undefined) { updates.push('color = ?'); params.push(color); }
    if (parentId !== undefined) { updates.push('parentId = ?'); params.push(parentId); }
    if (sortOrder !== undefined) { updates.push('sortOrder = ?'); params.push(sortOrder); }
    if (updates.length === 0) {
      res.status(400).json({ success: false, error: 'No fields to update' });
      return;
    }
    params.push(id);
    await run(`UPDATE book_categories SET ${updates.join(', ')} WHERE id = ?`, params);
    const updated = await queryOne('SELECT * FROM book_categories WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Failed to update category:', error);
    res.status(500).json({ success: false, error: 'Failed to update category' });
  }
});

router.delete('/books/categories/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await queryOne('SELECT id FROM book_categories WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    const bookCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM books WHERE categoryId = ? AND isActive = 1', [id]
    );
    if (bookCount && Number(bookCount.count) > 0) {
      res.status(409).json({
        success: false,
        error: `Cannot delete category: ${bookCount.count} book(s) are using this category. Reassign them first.`,
      });
      return;
    }
    // Reassign any inactive books to another category to satisfy FK constraint
    const fallback = await queryOne<{ id: string }>(
      'SELECT id FROM book_categories WHERE id != ? ORDER BY sortOrder ASC LIMIT 1', [id]
    );
    if (fallback) {
      await run('UPDATE books SET categoryId = ? WHERE categoryId = ? AND isActive = 0', [fallback.id, id]);
    }
    await run('DELETE FROM book_categories WHERE id = ?', [id]);
    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Failed to delete category:', error);
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
});

router.post('/books', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, author, isbn, publisher, description, categoryId, language, fileType, coverUrl, fileUrl, difficulty, pageCount, copyright, publishDate } = req.body;

    if (!title || !author || !categoryId) {
      res.status(400).json({ success: false, error: 'Title, author and category are required' });
      return;
    }

    const duplicate = await queryOne<{ id: string; title: string }>(
      'SELECT id, title FROM books WHERE title = ? AND author = ? AND isActive = 1 LIMIT 1',
      [title, author]
    );
    if (duplicate) {
      res.status(409).json({ success: false, error: `"${title}" by ${author} already exists in library`, data: { existingId: duplicate.id } });
      return;
    }

    const id = uuidv4();
    let finalCoverUrl = coverUrl || '';
    let finalFileType = fileType || 'pdf';

    // No cover provided — try to generate from book file
    if (!finalCoverUrl && fileUrl) {
      const bookAbsPath = path.join(__dirname, '..', '..', fileUrl);
      if (fs.existsSync(bookAbsPath)) {
        const ext = path.extname(fileUrl).toLowerCase().replace('.', '');
        finalFileType = ext || finalFileType;

        const coversDir = path.join(__dirname, '..', '..', 'uploads', 'covers');
        fs.mkdirSync(coversDir, { recursive: true });
        const result = generateCoverFromBook(bookAbsPath, path.join(coversDir, `${id}.jpg`));
        if (result) {
          finalCoverUrl = `/uploads/covers/${id}.jpg`;
        }
      }
    }

    await run(
      `INSERT INTO books (id, title, author, isbn, publisher, description, categoryId, language, fileType, coverUrl, fileUrl, difficulty, pageCount, copyright, publishDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, author, isbn || '', publisher || '', description || '', categoryId, language || 'zh', finalFileType, finalCoverUrl, fileUrl || '', difficulty || 'intermediate', pageCount || 0, copyright || null, publishDate || null]
    );

    const book = await queryOne('SELECT * FROM books WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: book });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create book' });
  }
});

// ── Multer for single book upload (memory storage → OSS/disk via StorageProvider) ──
const singleBookUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'cover') {
      const ext = path.extname(file.originalname).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Cover must be an image file (.jpg, .png, .webp, .gif)'));
      }
      return;
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.epub', '.pdf', '.mobi', '.txt'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .epub, .pdf, .mobi, .txt files are allowed'));
    }
  },
});

const singleBookUploadFields = singleBookUpload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]);

function singleBookUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  const startLen = parseInt(req.headers['content-length'] || '0', 10);
  singleBookUploadFields(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, error: `File too large. Maximum size is 200MB. (${err.message})` });
        }
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    // Log warning if content-length was large but no file parsed
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (!files?.['file'] && startLen > 0) {
      console.warn(`[UPLOAD] Request with Content-Length ${startLen} bytes had no book file after multer parsing. Headers:`, req.headers['content-type']);
    }
    next();
  });
}

// ── POST /books/upload ──
router.post('/books/upload', requireRole('admin', 'super_admin'), singleBookUploadMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const bookFile = files?.['file']?.[0];
    if (!bookFile) {
      res.status(400).json({ success: false, error: 'No book file provided' });
      return;
    }

    const storage = getStorageProvider();
    const fileExt = path.extname(bookFile.originalname).toLowerCase();
    const fileType = fileExt.replace('.', '');
    const bookId = uuidv4();
    const bookKey = buildKey('books', `${bookId}${fileExt}`);

    // Extract EPUB metadata from buffer
    let extractedMeta: { title?: string; author?: string } = {};
    if (fileType === 'epub') {
      try {
        extractedMeta = extractEpubMetadata(bookFile.buffer);
      } catch { /* ignore */ }
    }

    const {
      title = extractedMeta.title || path.basename(bookFile.originalname, fileExt),
      author = extractedMeta.author || '',
      isbn = '',
      publisher = '',
      description = '',
      categoryId,
      language = 'zh',
      difficulty = 'intermediate',
      pageCount = '0',
      copyright = '',
      publishDate = '',
    } = req.body;

    if (!categoryId) {
      res.status(400).json({ success: false, error: 'Category is required' });
      return;
    }

    const coverFile = files?.['cover']?.[0];

    const duplicate = await queryOne<{ id: string; title: string }>(
      'SELECT id, title FROM books WHERE title = ? AND author = ? AND isActive = 1 LIMIT 1',
      [title, author]
    );
    if (duplicate) {
      res.status(409).json({ success: false, error: `"${title}" by ${author} already exists in library`, data: { existingId: duplicate.id } });
      return;
    }

    // Upload book file to storage
    await storage.upload(bookKey, bookFile.buffer, bookFile.mimetype);

    // Handle cover: uploaded file or auto-generate
    let coverKey = '';
    let coverSource = 'none';
    if (coverFile) {
      const coverExt = path.extname(coverFile.originalname);
      coverKey = buildKey('covers', `${uuidv4()}${coverExt}`);
      await storage.upload(coverKey, coverFile.buffer, coverFile.mimetype);
      coverSource = 'uploaded';
    } else {
      const coverBuffer = generateCoverFromBookBuffer(bookFile.buffer, fileType as 'pdf' | 'epub');
      if (coverBuffer) {
        coverKey = buildKey('covers', `${bookId}.jpg`);
        await storage.upload(coverKey, coverBuffer, 'image/jpeg');
        coverSource = 'generated';
      }
    }

    await run(
      `INSERT INTO books (id, title, author, isbn, publisher, description, categoryId, language, fileType, coverUrl, fileUrl, difficulty, pageCount, copyright, publishDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookId, title, author, isbn, publisher, description, categoryId, language, fileType, coverKey, bookKey, difficulty, parseInt(pageCount) || 0, copyright, publishDate]
    );

    const book = await queryOne('SELECT * FROM books WHERE id = ?', [bookId]);
    const resolved = book ? await resolveBookUrls(book as any) : book;
    res.locals.auditDetails = {
      bookId,
      bookTitle: title,
      fileName: bookFile.originalname,
      fileSize: bookFile.size,
      fileType,
      cover: coverSource,
    };
    res.status(201).json({ success: true, data: resolved });
  } catch (err: any) {
    console.error('Book upload error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to upload book' });
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

    let finalCoverUrl = coverUrl || '';
    let finalFileType = fileType || 'pdf';

    // No cover provided — try to generate from book file
    if (!finalCoverUrl && fileUrl) {
      const bookAbsPath = path.join(__dirname, '..', '..', fileUrl);
      if (fs.existsSync(bookAbsPath)) {
        const ext = path.extname(fileUrl).toLowerCase().replace('.', '');
        finalFileType = ext || finalFileType;

        const coversDir = path.join(__dirname, '..', '..', 'uploads', 'covers');
        fs.mkdirSync(coversDir, { recursive: true });
        const result = generateCoverFromBook(bookAbsPath, path.join(coversDir, `${req.params.id}.jpg`));
        if (result) {
          finalCoverUrl = `/uploads/covers/${req.params.id}.jpg`;
        }
      }
    }

    await run(
      `UPDATE books SET title=?, author=?, isbn=?, publisher=?, description=?, categoryId=?, language=?, fileType=?, coverUrl=?, fileUrl=?, difficulty=?, pageCount=?, copyright=?, publishDate=? WHERE id=?`,
      [title, author, isbn || '', publisher || '', description || '', categoryId, language || 'zh', finalFileType, finalCoverUrl, fileUrl || '', difficulty || 'intermediate', pageCount || 0, copyright || null, publishDate || null, req.params.id]
    );

    const book = await queryOne('SELECT * FROM books WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: book });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update book' });
  }
});

router.delete('/books/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await queryOne('SELECT id, title, fileUrl, coverUrl FROM books WHERE id = ?', [req.params.id]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Book not found' });
      return;
    }

    await run('UPDATE books SET isActive = 0 WHERE id = ?', [req.params.id]);

    // Clean up book file and cover from storage
    const book = existing as Record<string, unknown>;
    let cleanedFiles = 0;
    const storage = getStorageProvider();
    const keysToDelete: string[] = [];
    if (book.fileUrl && typeof book.fileUrl === 'string') {
      keysToDelete.push(book.fileUrl);
      cleanedFiles++;
    }
    if (book.coverUrl && typeof book.coverUrl === 'string') {
      keysToDelete.push(book.coverUrl);
      cleanedFiles++;
    }
    await storage.deleteMultiple(keysToDelete);

    res.locals.auditDetails = { deletedBookTitle: book.title, deletedBookId: req.params.id, cleanedFiles };
    res.json({ success: true, message: 'Book deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete book' });
  }
});

// ── Cover upload for existing books (memory storage → OSS/disk via StorageProvider) ──
const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Cover must be an image file (.jpg, .png, .webp, .gif)'));
    }
  },
});

router.put('/books/:id/cover', requireRole('admin', 'super_admin'), coverUpload.single('cover'), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await queryOne('SELECT id, title, coverUrl FROM books WHERE id = ?', [req.params.id]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Book not found' });
      return;
    }

    const coverFile = req.file;
    if (!coverFile) {
      res.status(400).json({ success: false, error: 'No cover file provided' });
      return;
    }

    const storage = getStorageProvider();
    const ext = path.extname(coverFile.originalname);
    const newCoverKey = buildKey('covers', `${uuidv4()}${ext}`);
    await storage.upload(newCoverKey, coverFile.buffer, coverFile.mimetype);

    // Delete old cover
    const oldCover = (existing as Record<string, unknown>).coverUrl as string | undefined;
    if (oldCover) {
      storage.delete(oldCover).catch(() => {});
    }

    await run('UPDATE books SET coverUrl = ? WHERE id = ?', [newCoverKey, req.params.id]);

    const resolvedUrl = await resolveFileUrl(newCoverKey);
    res.locals.auditDetails = { bookId: req.params.id, bookTitle: (existing as any).title, newCover: coverFile.originalname, oldCoverRemoved: !!oldCover };
    res.json({ success: true, data: { coverUrl: resolvedUrl } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update cover' });
  }
});

router.delete('/books/:id/cover', requireRole('admin', 'super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await queryOne('SELECT id, title, coverUrl FROM books WHERE id = ?', [req.params.id]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Book not found' });
      return;
    }

    const oldCover = (existing as Record<string, unknown>).coverUrl as string | undefined;
    if (oldCover) {
      const storage = getStorageProvider();
      storage.delete(oldCover).catch(() => {});
    }

    await run('UPDATE books SET coverUrl = ? WHERE id = ?', ['', req.params.id]);

    res.locals.auditDetails = { bookId: req.params.id, bookTitle: (existing as any).title, coverRemoved: true };
    res.json({ success: true, message: 'Cover removed' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to remove cover' });
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
// SYSTEM CONFIG CRUD
// ============================================================

router.get('/system-config', async (req: Request, res: Response): Promise<void> => {
  try {
    const configs = await queryAll(
      `SELECT sc.*, u.username as updatedByName
       FROM system_config sc
       LEFT JOIN users u ON sc.updatedBy = u.id
       ORDER BY sc.configKey ASC`
    );
    res.json({ success: true, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch system config' });
  }
});

router.put('/system-config', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { configs } = req.body;
    if (!configs || typeof configs !== 'object') {
      res.status(400).json({ success: false, error: 'configs object is required' });
      return;
    }

    for (const [key, value] of Object.entries(configs)) {
      const existing = await queryOne('SELECT id FROM system_config WHERE configKey = ?', [key]);
      if (existing) {
        await run(
          'UPDATE system_config SET configValue = ?, updatedBy = ? WHERE configKey = ?',
          [value as string, req.user!.userId, key]
        );
      }
    }

    const updated = await queryAll(
      `SELECT sc.*, u.username as updatedByName
       FROM system_config sc
       LEFT JOIN users u ON sc.updatedBy = u.id
       ORDER BY sc.configKey ASC`
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update system config' });
  }
});

// ============================================================
// LOCATIONS (dynamic hierarchy data)
// ============================================================

router.get('/locations/countries', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await queryAll('SELECT DISTINCT country as value, country as label FROM schools WHERE isActive = 1 AND country IS NOT NULL AND country != \'\' ORDER BY country ASC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch countries' });
  }
});

router.get('/locations/states', async (req: Request, res: Response): Promise<void> => {
  try {
    const { country } = req.query;
    let sql = 'SELECT DISTINCT state as value, state as label FROM schools WHERE isActive = 1 AND state IS NOT NULL AND state != \'\'';
    const params: string[] = [];
    if (country) { sql += ' AND country = ?'; params.push(country as string); }
    sql += ' ORDER BY state ASC';
    const rows = await queryAll(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch states' });
  }
});

router.get('/locations/districts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { state } = req.query;
    let sql = 'SELECT DISTINCT district as value, district as label FROM schools WHERE isActive = 1 AND district IS NOT NULL AND district != \'\'';
    const params: string[] = [];
    if (state) { sql += ' AND state = ?'; params.push(state as string); }
    sql += ' ORDER BY district ASC';
    const rows = await queryAll(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch districts' });
  }
});

router.get('/locations/schools', async (req: Request, res: Response): Promise<void> => {
  try {
    const { country, state, district } = req.query;
    let sql = 'SELECT id as value, name as label FROM schools WHERE isActive = 1';
    const params: string[] = [];
    if (country) { sql += ' AND country = ?'; params.push(country as string); }
    if (state) { sql += ' AND state = ?'; params.push(state as string); }
    if (district) { sql += ' AND district = ?'; params.push(district as string); }
    sql += ' ORDER BY name ASC';
    const rows = await queryAll(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch schools' });
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
      `SELECT rp.*, b.title as bookTitle, b.author as bookAuthor, b.coverUrl as bookCover,
       b.isbn as bookIsbn, b.publisher as bookPublisher, b.publishDate as bookPublishDate,
       b.language as bookLanguage, b.pageCount as bookPageCount, b.fileType as bookType,
       c.name as categoryName
       FROM reading_progress rp
       JOIN books b ON rp.bookId = b.id
       LEFT JOIN book_categories c ON b.categoryId = c.id
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

// ============================================================
// IC WHITELIST UPLOAD
// ============================================================

const whitelistUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});

router.post('/schools/:id/upload-whitelist', requireRole('super_admin'), whitelistUpload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.params.id;

    const school = await queryOne('SELECT id, name FROM schools WHERE id = ? AND isActive = 1', [schoolId]);
    if (!school) {
      res.status(404).json({ success: false, error: 'School not found' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    // Parse Excel
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

    if (rows.length < 2) {
      res.status(400).json({ success: false, error: 'Excel file is empty or has no data rows' });
      return;
    }

    // Skip header row, extract IC numbers (column index 3 = 4th column)
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 4) {
        skipped++;
        continue;
      }

      const icNumber = String(row[3]).trim().replace(/-/g, '');
      if (!icNumber || icNumber === 'undefined' || icNumber === 'null') {
        skipped++;
        continue;
      }

      try {
        // Check if IC already exists in whitelist (global unique)
        const existing = await queryOne('SELECT id, schoolId FROM ic_whitelist WHERE REPLACE(icNumber, "-", "") = ?', [icNumber]);
        if (existing) {
          skipped++;
          continue;
        }

        await run(
          'INSERT INTO ic_whitelist (id, icNumber, schoolId) VALUES (?, ?, ?)',
          [uuidv4(), icNumber, schoolId]
        );
        inserted++;
      } catch (err: any) {
        if (err.code === 'ER_DUP_ENTRY') {
          skipped++;
        } else {
          errors.push(`IC ${icNumber}: ${err.message}`);
        }
      }
    }

    res.json({
      success: true,
      data: {
        schoolId,
        schoolName: (school as any).name,
        total: rows.length - 1,
        inserted,
        skipped,
        errors: errors.slice(0, 10), // cap error messages
      },
    });
  } catch (error: any) {
    if (error.message === 'Only Excel files (.xlsx, .xls) are allowed') {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('Whitelist upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to process whitelist upload' });
  }
});


// IC Whitelist upload — school determined from Excel column 0 (School_code)
router.post('/ic-whitelist/upload', requireRole('super_admin'), whitelistUpload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

    if (rows.length < 2) {
      res.status(400).json({ success: false, error: 'Excel file is empty or has no data rows' });
      return;
    }

    const schoolCodeMap = new Map<string, string>();
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 4) {
        skipped++;
        continue;
      }

      const schoolCode = String(row[0] || '').trim();
      const icNumber = String(row[3] || '').trim().replace(/-/g, '');

      if (!schoolCode || !icNumber || icNumber === 'undefined' || icNumber === 'null') {
        skipped++;
        continue;
      }

      try {
        let schoolId = schoolCodeMap.get(schoolCode);
        if (!schoolId) {
          const school = await queryOne('SELECT id, name FROM schools WHERE id = ? AND isActive = 1', [schoolCode]);
          if (!school) {
            errors.push('School code "' + schoolCode + '" not found for IC ' + icNumber);
            skipped++;
            continue;
          }
          schoolId = (school as any).id;
          schoolCodeMap.set(schoolCode, schoolId);
        }

        const existing = await queryOne('SELECT id FROM ic_whitelist WHERE REPLACE(icNumber, "-", "") = ?', [icNumber]);
        if (existing) {
          skipped++;
          continue;
        }

        await run(
          'INSERT INTO ic_whitelist (id, icNumber, schoolId) VALUES (?, ?, ?)',
          [uuidv4(), icNumber, schoolId]
        );
        inserted++;
      } catch (err: any) {
        if (err.code === 'ER_DUP_ENTRY') {
          skipped++;
        } else {
          errors.push('IC ' + icNumber + ': ' + err.message);
        }
      }
    }

    res.json({
      success: true,
      data: {
        total: rows.length - 1,
        inserted,
        skipped,
        errors: errors.slice(0, 10),
      },
    });
  } catch (error: any) {
    if (error.message === 'Only Excel files (.xlsx, .xls) are allowed') {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('Whitelist upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to process whitelist upload' });
  }
});


// ============================================================
// OPERATION LOGS
// ============================================================

import { queryLogs, getLogStats, cleanOldLogs } from '../services/logService.js';

router.get('/logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, pageSize, userId, action, resource, method, path, responseStatus, search, startDate, endDate } = req.query;
    const result = await queryLogs({
      page: page ? parseInt(page as string) : 0,
      pageSize: pageSize ? parseInt(pageSize as string) : 20,
      userId: userId as string,
      action: action as string,
      resource: resource as string,
      method: method as string,
      path: path as string,
      responseStatus: responseStatus ? parseInt(responseStatus as string) : undefined,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Query logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to query logs' });
  }
});

router.get('/logs/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getLogStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Log stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get log stats' });
  }
});

router.get('/logs/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, action, resource, method, search } = req.query;
    const result = await queryLogs({
      page: 0,
      pageSize: 10000,
      action: action as string,
      resource: resource as string,
      method: method as string,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    const logs = (result.data as any[]).map((log) => ({
      id: log.id,
      username: log.username,
      userRole: log.userRole,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      method: log.method,
      path: log.path,
      responseStatus: log.responseStatus,
      ipAddress: log.ipAddress,
      duration: log.duration,
      details: log.details,
      createdAt: log.createdAt,
    }));

    if (req.query.format === 'csv') {
      const headers = ['ID', 'Username', 'Role', 'Action', 'Resource', 'Resource ID', 'Method', 'Path', 'Status', 'IP', 'Duration(ms)', 'Details', 'Created At'];
      const csvRows = [headers.join(',')];
      for (const log of logs) {
        csvRows.push([
          log.id,
          `"${(log.username || '').replace(/"/g, '""')}"`,
          log.userRole || '',
          log.action,
          log.resource || '',
          log.resourceId || '',
          log.method || '',
          `"${(log.path || '').replace(/"/g, '""')}"`,
          log.responseStatus || '',
          log.ipAddress || '',
          log.duration || '',
          `"${(log.details || '').replace(/"/g, '""')}"`,
          log.createdAt,
        ].join(','));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=operation_logs_${new Date().toISOString().slice(0, 10)}.csv`);
      res.send('﻿' + csvRows.join('\n'));
      return;
    }

    res.json({ success: true, data: logs, total: result.total });
  } catch (error: any) {
    console.error('Export logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to export logs' });
  }
});

router.post('/logs/cleanup', async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({ success: false, error: 'Only super admin can clean up logs' });
      return;
    }
    const { retentionDays } = req.body || {};
    const days = Math.max(7, Math.min(365, parseInt(String(retentionDays)) || 90));
    const deleted = await cleanOldLogs(days);
    res.json({ success: true, data: { deleted, retentionDays: days } });
  } catch (error: any) {
    console.error('Cleanup logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to clean up logs' });
  }
});

router.get('/logs/actions', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await (await import('../db/database.js')).pool.query(
      `SELECT DISTINCT action FROM operation_logs ORDER BY action`
    ) as any[];
    res.json({ success: true, data: rows.map((r: any) => r.action) });
  } catch (error: any) {
    console.error('Get log actions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get log actions' });
  }
});

export default router;
