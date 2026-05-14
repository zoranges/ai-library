import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { queryAll, queryOne, run } from '../db/database.js';
import { verifyToken, requireRole, generateToken, type JwtPayload } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);
router.use(requireRole('admin', 'super_admin'));

router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const totalStudents = queryOne('SELECT COUNT(*) as count FROM users WHERE role = ?')?.count || 0;
    const totalStudentsResult = queryOne('SELECT COUNT(*) as count FROM users WHERE role = ?', ['student']);
    const totalBooks = queryOne('SELECT COUNT(*) as count FROM books WHERE isActive = 1')?.count || 0;
    const totalSchools = queryOne('SELECT COUNT(*) as count FROM schools WHERE isActive = 1')?.count || 0;
    const activeReaders = queryOne(
      "SELECT COUNT(DISTINCT userId) as count FROM reading_sessions WHERE startedAt >= datetime('now', '-7 days')"
    )?.count || 0;
    const booksThisMonth = queryOne(
      "SELECT COUNT(*) as count FROM reading_progress WHERE isCompleted = 1 AND startedAt >= datetime('now', '-30 days')"
    )?.count || 0;
    const avgQuiz = queryOne('SELECT COALESCE(AVG(score), 0) as avg FROM quiz_results')?.avg || 0;

    const topSchools = queryAll(
      `SELECT s.*, COUNT(u.id) as activeStudents
       FROM schools s
       LEFT JOIN users u ON s.id = u.schoolId AND u.role = 'student'
       WHERE s.isActive = 1
       GROUP BY s.id
       ORDER BY activeStudents DESC
       LIMIT 5`
    );

    const recentActivities = queryAll(
      `SELECT rp.id, rp.userId, u.username, 'reading' as type,
              'completed a book' as description, rp.startedAt as createdAt
       FROM reading_progress rp
       JOIN users u ON rp.userId = u.id
       WHERE rp.isCompleted = 1
       ORDER BY rp.startedAt DESC LIMIT 5`
    );

    const readingTrend: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const result = queryOne(
        'SELECT COUNT(*) as count FROM reading_sessions WHERE DATE(startedAt) = ?',
        [dateStr]
      );
      readingTrend.push({ date: dateStr, count: (result?.count as number) || 0 });
    }

    res.json({
      success: true,
      data: {
        totalStudents: totalStudentsResult?.count || 0,
        totalBooks,
        totalSchools,
        activeReaders,
        booksReadThisMonth: booksThisMonth,
        averageQuizScore: Math.round(avgQuiz as number),
        topSchools,
        recentActivities,
        readingTrend,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

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

    const countResult = queryOne(countSql, params);
    const total = countResult ? (countResult.total as number) : 0;

    dataSql += ` ORDER BY createdAt DESC LIMIT ${pageSizeNum} OFFSET ${offset}`;
    const schools = queryAll(dataSql, params);

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
    const { name, address, contactPhone, contactEmail } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'School name is required' });
      return;
    }

    const id = uuidv4();
    run(
      'INSERT INTO schools (id, name, address, contactPhone, contactEmail) VALUES (?, ?, ?, ?, ?)',
      [id, name, address || null, contactPhone || null, contactEmail || null]
    );

    const school = queryOne('SELECT * FROM schools WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: school });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create school' });
  }
});

router.put('/schools/:id', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.params.id;
    const { name, address, contactPhone, contactEmail, isActive } = req.body;

    const existing = queryOne('SELECT id FROM schools WHERE id = ?', [schoolId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'School not found' });
      return;
    }

    if (name) run('UPDATE schools SET name = ? WHERE id = ?', [name, schoolId]);
    if (address !== undefined) run('UPDATE schools SET address = ? WHERE id = ?', [address, schoolId]);
    if (contactPhone !== undefined) run('UPDATE schools SET contactPhone = ? WHERE id = ?', [contactPhone, schoolId]);
    if (contactEmail !== undefined) run('UPDATE schools SET contactEmail = ? WHERE id = ?', [contactEmail, schoolId]);
    if (isActive !== undefined) run('UPDATE schools SET isActive = ? WHERE id = ?', [isActive ? 1 : 0, schoolId]);

    const updated = queryOne('SELECT * FROM schools WHERE id = ?', [schoolId]);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update school' });
  }
});

router.delete('/schools/:id', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const schoolId = req.params.id;
    const existing = queryOne('SELECT id FROM schools WHERE id = ?', [schoolId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'School not found' });
      return;
    }

    run('UPDATE schools SET isActive = 0 WHERE id = ?', [schoolId]);
    res.json({ success: true, message: 'School deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete school' });
  }
});

router.get('/students', async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', pageSize = '20', search, schoolId } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * pageSizeNum;

    let countSql = "SELECT COUNT(*) as total FROM users WHERE role = 'student'";
    let dataSql = `SELECT u.*, s.name as schoolName
                   FROM users u
                   LEFT JOIN schools s ON u.schoolId = s.id
                   WHERE u.role = 'student'`;
    const params: unknown[] = [];

    if (search) {
      countSql += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      dataSql += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const schoolFilter: unknown[] = [];
    if (schoolId) {
      countSql += ' AND u.schoolId = ?';
      dataSql += ' AND u.schoolId = ?';
      schoolFilter.push(schoolId);
    }

    const countResult = queryOne(countSql, [...params, ...schoolFilter]);
    const total = countResult ? (countResult.total as number) : 0;

    dataSql += ` ORDER BY u.createdAt DESC LIMIT ${pageSizeNum} OFFSET ${offset}`;
    const students = queryAll(dataSql, [...params, ...schoolFilter]);

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

router.get('/students/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const student = queryOne(
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

    const readingStats = queryOne(
      'SELECT COUNT(*) as totalBooks, COALESCE(SUM(CASE WHEN isCompleted = 1 THEN 1 ELSE 0 END), 0) as completedBooks FROM reading_progress WHERE userId = ?',
      [req.params.id]
    );
    const quizStats = queryOne(
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

router.put('/students/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id;
    const { username, grade, schoolId, isActive } = req.body;

    const existing = queryOne("SELECT id FROM users WHERE id = ? AND role = 'student'", [studentId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    if (username) run('UPDATE users SET username = ?, updatedAt = datetime("now") WHERE id = ?', [username, studentId]);
    if (grade !== undefined) run('UPDATE users SET grade = ?, updatedAt = datetime("now") WHERE id = ?', [grade, studentId]);
    if (schoolId) run('UPDATE users SET schoolId = ?, updatedAt = datetime("now") WHERE id = ?', [schoolId, studentId]);

    const updated = queryOne('SELECT * FROM users WHERE id = ?', [studentId]);
    const { password: _, ...studentWithoutPassword } = updated!;
    res.json({ success: true, data: studentWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update student' });
  }
});

router.delete('/students/:id', requireRole('super_admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id;
    const existing = queryOne("SELECT id FROM users WHERE id = ? AND role = 'student'", [studentId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    run('DELETE FROM reading_progress WHERE userId = ?', [studentId]);
    run('DELETE FROM reading_sessions WHERE userId = ?', [studentId]);
    run('DELETE FROM favorites WHERE userId = ?', [studentId]);
    run('DELETE FROM highlights WHERE userId = ?', [studentId]);
    run('DELETE FROM notes WHERE userId = ?', [studentId]);
    run('DELETE FROM quiz_results WHERE userId = ?', [studentId]);
    run('DELETE FROM user_achievements WHERE userId = ?', [studentId]);
    run('DELETE FROM user_badges WHERE userId = ?', [studentId]);
    run('DELETE FROM points WHERE userId = ?', [studentId]);
    run('DELETE FROM admins WHERE userId = ?', [studentId]);
    run('DELETE FROM users WHERE id = ?', [studentId]);

    res.json({ success: true, message: 'Student deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete student' });
  }
});

router.get('/admins', async (req: Request, res: Response): Promise<void> => {
  try {
    const admins = queryAll(
      `SELECT a.*, u.username, u.email, u.avatar, s.name as schoolName
       FROM admins a
       JOIN users u ON a.userId = u.id
       LEFT JOIN schools s ON a.schoolId = s.id
       WHERE a.isActive = 1
       ORDER BY a.createdAt DESC`
    );

    const formatted = admins.map(a => ({
      ...a,
      permissions: JSON.parse((a.permissions as string) || '[]'),
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

    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const adminId = uuidv4();

    run(
      'INSERT INTO users (id, username, email, password, schoolId, role) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, username, email, hashedPassword, schoolId, 'admin']
    );

    run(
      'INSERT INTO admins (id, userId, schoolId, role, permissions) VALUES (?, ?, ?, ?, ?)',
      [adminId, userId, schoolId, 'admin', JSON.stringify(permissions || ['read', 'write'])]
    );

    const admin = queryOne(
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

    const existing = queryOne('SELECT id FROM admins WHERE id = ?', [adminId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Admin not found' });
      return;
    }

    if (permissions) run('UPDATE admins SET permissions = ? WHERE id = ?', [JSON.stringify(permissions), adminId]);
    if (isActive !== undefined) run('UPDATE admins SET isActive = ? WHERE id = ?', [isActive ? 1 : 0, adminId]);
    if (schoolId) run('UPDATE admins SET schoolId = ? WHERE id = ?', [schoolId, adminId]);

    const updated = queryOne(
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
    const existing = queryOne('SELECT id, userId FROM admins WHERE id = ?', [adminId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Admin not found' });
      return;
    }

    run('UPDATE admins SET isActive = 0 WHERE id = ?', [adminId]);
    run("UPDATE users SET role = 'student' WHERE id = ?", [existing.userId]);

    res.json({ success: true, message: 'Admin removed' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove admin' });
  }
});

router.get('/statistics', async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = '7d' } = req.query;

    let days = 7;
    if (period === '30d') days = 30;
    else if (period === '90d') days = 90;

    const totalStudents = queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'student'")?.count || 0;
    const totalBooks = queryOne('SELECT COUNT(*) as count FROM books WHERE isActive = 1')?.count || 0;
    const totalReadingSessions = queryOne('SELECT COUNT(*) as count FROM reading_sessions')?.count || 0;
    const totalQuizResults = queryOne('SELECT COUNT(*) as count FROM quiz_results')?.count || 0;
    const avgQuizScore = queryOne('SELECT COALESCE(AVG(score), 0) as avg FROM quiz_results')?.avg || 0;
    const totalPoints = queryOne("SELECT COALESCE(SUM(points), 0) as total FROM points WHERE type = 'reading'")?.total || 0;

    const readingByDay: { date: string; sessions: number; completions: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const sessions = queryOne(
        'SELECT COUNT(*) as count FROM reading_sessions WHERE DATE(startedAt) = ?',
        [dateStr]
      )?.count || 0;
      const completions = queryOne(
        'SELECT COUNT(*) as count FROM reading_progress WHERE isCompleted = 1 AND DATE(lastReadAt) = ?',
        [dateStr]
      )?.count || 0;
      readingByDay.push({ date: dateStr, sessions: sessions as number, completions: completions as number });
    }

    const topBooks = queryAll(
      'SELECT id, title, author, readCount, favoriteCount, rating FROM books WHERE isActive = 1 ORDER BY readCount DESC LIMIT 10'
    );

    const schoolStats = queryAll(
      `SELECT s.id, s.name, s.studentCount,
              COUNT(DISTINCT rs.id) as totalSessions,
              COUNT(DISTINCT rp.id) as completedBooks
       FROM schools s
       LEFT JOIN users u ON s.id = u.schoolId AND u.role = 'student'
       LEFT JOIN reading_sessions rs ON u.id = rs.userId
       LEFT JOIN reading_progress rp ON u.id = rp.userId AND rp.isCompleted = 1
       WHERE s.isActive = 1
       GROUP BY s.id
       ORDER BY totalSessions DESC`
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

router.post('/role-switch', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { targetRole } = req.body;

    if (!['student', 'admin'].includes(targetRole)) {
      res.status(400).json({ success: false, error: 'Invalid target role' });
      return;
    }

    const user = queryOne('SELECT * FROM users WHERE id = ?', [userId]);
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
    const entries = queryAll(sql, params);

    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch IC whitelist' });
  }
});

router.post('/ic-whitelist', async (req: Request, res: Response): Promise<void> => {
  try {
    const { icNumber, schoolId } = req.body;
    if (!icNumber || !schoolId) {
      res.status(400).json({ success: false, error: 'IC number and schoolId are required' });
      return;
    }

    const existing = queryOne('SELECT id FROM ic_whitelist WHERE icNumber = ?', [icNumber]);
    if (existing) {
      res.status(409).json({ success: false, error: 'IC number already in whitelist' });
      return;
    }

    const id = uuidv4();
    run('INSERT INTO ic_whitelist (id, icNumber, schoolId) VALUES (?, ?, ?)', [id, icNumber, schoolId]);

    const entry = queryOne(
      'SELECT ic.*, s.name as schoolName FROM ic_whitelist ic JOIN schools s ON ic.schoolId = s.id WHERE ic.id = ?',
      [id]
    );

    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add IC whitelist entry' });
  }
});

router.delete('/ic-whitelist/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = queryOne('SELECT id FROM ic_whitelist WHERE id = ?', [req.params.id]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'IC whitelist entry not found' });
      return;
    }

    run('DELETE FROM ic_whitelist WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'IC whitelist entry deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete IC whitelist entry' });
  }
});

export default router;
