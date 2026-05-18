import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.get('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { type = 'points', schoolId, limit = '20' } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));

    let orderBy = 'u.points DESC';
    if (type === 'books') orderBy = 'completedBooks DESC';
    else if (type === 'quizzes') orderBy = 'quizCount DESC';
    else if (type === 'streak') orderBy = 'u.level DESC';

    let sql = `SELECT u.id as userId, u.username, u.schoolId, u.points, u.level, u.avatar,
                      s.name as schoolName,
                      COALESCE(cb.count, 0) as completedBooks,
                      COALESCE(qc.count, 0) as quizCount
               FROM users u
               LEFT JOIN schools s ON u.schoolId = s.id
               LEFT JOIN (SELECT userId, COUNT(*) as count FROM reading_progress WHERE isCompleted = 1 GROUP BY userId) cb ON u.id = cb.userId
               LEFT JOIN (SELECT userId, COUNT(*) as count FROM quiz_results GROUP BY userId) qc ON u.id = qc.userId
               WHERE u.role = 'student'`;

    const params: unknown[] = [];
    if (schoolId) {
      sql += ' AND u.schoolId = ?';
      params.push(schoolId);
    }

    sql += ` ORDER BY ${orderBy} LIMIT ?`;
    params.push(limitNum);

    const entries = await queryAll(sql, params);

    const leaderboard = entries.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      username: entry.username,
      schoolId: entry.schoolId,
      school: entry.schoolName ? {
        id: entry.schoolId,
        name: entry.schoolName,
      } : null,
      points: entry.points || 0,
      booksRead: entry.completedBooks || 0,
      quizzesCompleted: entry.quizCount || 0,
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
