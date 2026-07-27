import { queryAll, queryOne, run } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

interface ConditionRule {
  type: string;
  threshold: number;
  unit: string;
}

function parseCondition(condition: string): ConditionRule {
  // Numeric pattern: type-N-unit (e.g. "complete-10-books", "read-600-minutes", "streak-7-days")
  const m = condition.match(/^([a-z]+)-(\d+)-([a-z]+)$/);
  if (m) {
    return { type: m[1], threshold: parseInt(m[2]), unit: m[3] };
  }
  // Special: quiz-perfect-score
  if (condition === 'quiz-perfect-score') {
    return { type: 'quiz-perfect', threshold: 100, unit: 'score' };
  }
  return { type: 'unknown', threshold: 0, unit: '' };
}

export async function calculateStreak(userId: string): Promise<number> {
  const rows = await queryAll<{ date: string }>(
    `SELECT DISTINCT DATE(lastReadAt) as date
     FROM reading_progress
     WHERE userId = ? AND lastReadAt IS NOT NULL
     ORDER BY date DESC
     LIMIT 100`,
    [userId]
  );

  if (!rows || rows.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDate = new Date(rows[0].date);
  firstDate.setHours(0, 0, 0, 0);

  // Streak must be active (today or yesterday)
  const diffFromToday = Math.floor((today.getTime() - firstDate.getTime()) / 86400000);
  if (diffFromToday > 1) return 0;

  let streak = 1;
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].date);
    const curr = new Date(rows[i].date);
    const diff = Math.floor((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export async function calculateLongestStreak(userId: string): Promise<number> {
  const rows = await queryAll<{ date: string }>(
    `SELECT DISTINCT DATE(lastReadAt) as date
     FROM reading_progress
     WHERE userId = ? AND lastReadAt IS NOT NULL
     ORDER BY date ASC`,
    [userId]
  );

  if (!rows || rows.length === 0) return 0;

  let longest = 0;
  let current = 1;

  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].date);
    const curr = new Date(rows[i].date);
    const diff = Math.floor((curr.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) {
      current++;
    } else {
      if (current > longest) longest = current;
      current = 1;
    }
  }
  if (current > longest) longest = current;

  return longest;
}

async function evaluateCondition(userId: string, condition: string): Promise<boolean> {
  const rule = parseCondition(condition);

  switch (rule.type) {
    case 'complete': {
      const row = await queryOne(
        'SELECT COUNT(*) as count FROM reading_progress WHERE userId = ? AND isCompleted = 1',
        [userId]
      );
      return (Number(row?.count) || 0) >= rule.threshold;
    }

    case 'read': {
      const needed = rule.threshold * 60;
      const row = await queryOne<{ total: number }>(
        'SELECT COALESCE(SUM(duration), 0) as total FROM reading_sessions WHERE userId = ?',
        [userId]
      );
      return (row?.total || 0) >= needed;
    }

    case 'quiz-perfect': {
      const row = await queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM quiz_results WHERE userId = ? AND score = 100',
        [userId]
      );
      return (row?.count || 0) > 0;
    }

    case 'streak': {
      const streak = await calculateStreak(userId);
      return streak >= rule.threshold;
    }

    default:
      return false;
  }
}

interface AchievementRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  condition: string;
  points: number;
  rarity: string;
  periodType?: string;
}

export async function checkAndUnlockAchievements(
  userId: string,
  category?: string
): Promise<{ unlocked: string[] }> {
  const unlocked: string[] = [];

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const yearStart = `${now.getFullYear()}-01-01`;

  let sql = `
    SELECT a.* FROM achievements a
    WHERE a.id NOT IN (
      SELECT ua.achievementId FROM user_achievements ua
      WHERE ua.userId = ?
      AND (
        a.periodType = 'permanent'
        OR (a.periodType = 'monthly' AND ua.unlockedAt >= ?)
        OR (a.periodType = 'yearly' AND ua.unlockedAt >= ?)
      )
    )
  `;
  const params: unknown[] = [userId, monthStart, yearStart];

  if (category) {
    sql += ' AND a.category = ?';
    params.push(category);
  }

  const pending = await queryAll<AchievementRow>(sql, params);
  if (!pending || pending.length === 0) return { unlocked };

  for (const ach of pending) {
    try {
      const earned = await evaluateCondition(userId, ach.condition as string);
      if (earned) {
        const id = uuidv4();
        await run(
          'INSERT INTO user_achievements (id, userId, achievementId) VALUES (?, ?, ?)',
          [id, userId, ach.id]
        );
        await run(
          'UPDATE users SET points = points + ?, totalPoints = totalPoints + ?, monthlyPoints = monthlyPoints + ?, yearlyPoints = yearlyPoints + ? WHERE id = ?',
          [ach.points, ach.points, ach.points, ach.points, userId]
        );
        await run(
          'INSERT INTO points (id, userId, points, type, description, referenceId) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), userId, ach.points, 'achievement', `Achievement unlocked: ${ach.name}`, ach.id]
        );
        unlocked.push(ach.name);
      }
    } catch {
      // Skip duplicates (unique constraint) or other errors silently
    }
  }

  return { unlocked };
}
