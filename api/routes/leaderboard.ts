import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.get('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      type = 'points',
      period = 'all',
      region,
      regionId,
      schoolId,
      district,
      state,
      country,
      limit = '20',
    } = req.query;

    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));

    // Determine primary order by column based on type
    let primaryOrderBy: string;
    switch (type) {
      case 'books':
        primaryOrderBy = 'completedBooks';
        break;
      case 'quizzes':
        primaryOrderBy = 'quizCount';
        break;
      case 'streak':
        primaryOrderBy = 'u.level';
        break;
      case 'readingTime':
        primaryOrderBy = 'totalReadingMinutes';
        break;
      case 'points':
      default:
        primaryOrderBy = 'periodPoints';
        break;
    }

    // Build period date filters (values are server-computed, safe from SQL injection)
    let dateFilterClause = '';       // for reading_progress.completedAt and quiz_results.completedAt
    let pointsDateFilterClause = ''; // for points.createdAt
    let sessionsDateFilterClause = ''; // for reading_sessions

    const now = new Date();
    if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      dateFilterClause = ` AND completedAt >= '${monthStart}'`;
      pointsDateFilterClause = ` AND createdAt >= '${monthStart}'`;
      sessionsDateFilterClause = ` AND startedAt >= '${monthStart}'`;
    } else if (period === 'year') {
      const yearStart = new Date(now.getFullYear(), 0, 1)
        .toISOString()
        .split('T')[0];
      dateFilterClause = ` AND completedAt >= '${yearStart}'`;
      pointsDateFilterClause = ` AND createdAt >= '${yearStart}'`;
      sessionsDateFilterClause = ` AND startedAt >= '${yearStart}'`;
    }

    // Build subqueries with optional period filters
    const booksSubquery = `SELECT userId, COUNT(*) as count FROM reading_progress WHERE isCompleted = 1${dateFilterClause} GROUP BY userId`;
    const quizSubquery = `SELECT userId, COUNT(*) as count FROM quiz_results WHERE 1=1${dateFilterClause} GROUP BY userId`;
    const pointsSubquery = `SELECT userId, SUM(points) as points FROM points WHERE 1=1${pointsDateFilterClause} GROUP BY userId`;
    const readingTimeSubquery = `SELECT userId, COALESCE(SUM(duration), 0) as totalMinutes FROM reading_sessions WHERE 1=1${sessionsDateFilterClause} GROUP BY userId`;

    // Main leaderboard query with school district/state/country joined in
    let sql = `SELECT u.id as userId, u.username, u.schoolId, u.points, u.level, u.avatar,
                      s.name as schoolName, s.district, s.state, s.country,
                      COALESCE(cb.count, 0) as completedBooks,
                      COALESCE(qc.count, 0) as quizCount,
                      COALESCE(pp.points, 0) as periodPoints,
                      COALESCE(rt.totalMinutes, 0) as totalReadingMinutes
               FROM users u
               LEFT JOIN schools s ON u.schoolId = s.id
               LEFT JOIN (${booksSubquery}) cb ON u.id = cb.userId
               LEFT JOIN (${quizSubquery}) qc ON u.id = qc.userId
               LEFT JOIN (${pointsSubquery}) pp ON u.id = pp.userId
               LEFT JOIN (${readingTimeSubquery}) rt ON u.id = rt.userId
               WHERE u.role = 'student'`;

    const params: unknown[] = [];

    // Apply region + regionId filter
    if (region && regionId) {
      switch (region) {
        case 'school':
          sql += ' AND u.schoolId = ?';
          params.push(regionId);
          break;
        case 'district':
          sql += ' AND s.district = ?';
          params.push(regionId);
          break;
        case 'state':
          sql += ' AND s.state = ?';
          params.push(regionId);
          break;
        case 'country':
          sql += ' AND s.country = ?';
          params.push(regionId);
          break;
      }
    }

    // Apply direct filter params
    if (schoolId) {
      sql += ' AND u.schoolId = ?';
      params.push(schoolId);
    }
    if (district) {
      sql += ' AND s.district = ?';
      params.push(district);
    }
    if (state) {
      sql += ' AND s.state = ?';
      params.push(state);
    }
    if (country) {
      sql += ' AND s.country = ?';
      params.push(country);
    }

    // Tiebreaker ordering: primary metric DESC, then books read DESC, then quiz count DESC
    sql += ` ORDER BY ${primaryOrderBy} DESC, completedBooks DESC, quizCount DESC LIMIT ?`;
    params.push(limitNum);

    const entries = await queryAll(sql, params);

    const leaderboard = entries.map((entry: any, index: number) => ({
      rank: index + 1,
      userId: entry.userId,
      username: entry.username,
      schoolId: entry.schoolId,
      school: entry.schoolName
        ? {
            id: entry.schoolId,
            name: entry.schoolName,
            district: entry.district || '',
            state: entry.state || '',
            country: entry.country || '',
          }
        : null,
      points: entry.points || 0,
      booksRead: entry.completedBooks || 0,
      quizzesCompleted: entry.quizCount || 0,
      readingTime: entry.totalReadingMinutes || 0,
      streak: 0,
      level: entry.level || 1,
      avatar: entry.avatar,
    }));

    res.json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

router.get('/achievements', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const achievements = await queryAll('SELECT * FROM achievements ORDER BY points DESC');

    const userId = req.user!.userId;
    const userAchievements = await queryAll(
      'SELECT achievementId FROM user_achievements WHERE userId = ?',
      [userId]
    );
    const unlockedIds = new Set(userAchievements.map(ua => ua.achievementId));

    const formatted = achievements.map(a => ({
      ...a,
      unlocked: unlockedIds.has(a.id as string),
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch achievements' });
  }
});

router.post('/achievements/:id/unlock', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const achievementId = req.params.id;

    const achievement = await queryOne('SELECT * FROM achievements WHERE id = ?', [achievementId]);
    if (!achievement) {
      res.status(404).json({ success: false, error: 'Achievement not found' });
      return;
    }

    const existing = await queryOne('SELECT id FROM user_achievements WHERE userId = ? AND achievementId = ?', [userId, achievementId]);
    if (existing) {
      res.status(409).json({ success: false, error: 'Achievement already unlocked' });
      return;
    }

    await run('INSERT INTO user_achievements (id, userId, achievementId) VALUES (?, ?, ?)', [uuidv4(), userId, achievementId]);
    await run('UPDATE users SET points = points + ? WHERE id = ?', [achievement.points, userId]);
    await run(
      'INSERT INTO points (id, userId, points, type, description, referenceId) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), userId, achievement.points, 'achievement', `Unlocked achievement: ${achievement.name}`, achievementId]
    );

    res.status(201).json({ success: true, data: { achievementId, unlocked: true, points: achievement.points } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to unlock achievement' });
  }
});

router.get('/badges', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const badges = await queryAll('SELECT * FROM badges');

    const userId = req.user!.userId;
    const userBadges = await queryAll(
      'SELECT badgeId, isEquipped FROM user_badges WHERE userId = ?',
      [userId]
    );
    const badgeMap = new Map(userBadges.map(ub => [ub.badgeId, ub.isEquipped]));

    const formatted = badges.map(b => ({
      ...b,
      unlocked: badgeMap.has(b.id as string),
      isEquipped: badgeMap.get(b.id as string) === 1,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch badges' });
  }
});

router.post('/badges/:id/equip', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const badgeId = req.params.id;

    const userBadge = await queryOne('SELECT id FROM user_badges WHERE userId = ? AND badgeId = ?', [userId, badgeId]);
    if (!userBadge) {
      res.status(404).json({ success: false, error: 'Badge not owned' });
      return;
    }

    await run('UPDATE user_badges SET isEquipped = 0 WHERE userId = ?', [userId]);
    await run('UPDATE user_badges SET isEquipped = 1 WHERE userId = ? AND badgeId = ?', [userId, badgeId]);

    res.json({ success: true, data: { badgeId, isEquipped: true } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to equip badge' });
  }
});

router.get('/points', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { page = '1', pageSize = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * pageSizeNum;

    const countResult = await queryOne('SELECT COUNT(*) as total FROM points WHERE userId = ?', [userId]);
    const total = countResult ? (countResult.total as number) : 0;

    const points = await queryAll(
      `SELECT * FROM points WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [userId, pageSizeNum, offset]
    );

    res.json({
      success: true,
      data: {
        data: points,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch points' });
  }
});

export default router;
