import { queryOne, run } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { calculateStreak } from './achievementChecker.js';

async function getTodayPoints(userId: string, type: string): Promise<number> {
  const row = await queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(points), 0) as total FROM points
     WHERE userId = ? AND type = ? AND DATE(createdAt) = CURDATE()`,
    [userId, type]
  );
  return row?.total || 0;
}

async function hasReceivedToday(userId: string, type: string): Promise<boolean> {
  const row = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM points
     WHERE userId = ? AND type = ? AND DATE(createdAt) = CURDATE()`,
    [userId, type]
  );
  return (row?.count || 0) > 0;
}

async function awardPoints(
  userId: string, points: number, type: string, description: string, referenceId?: string
): Promise<boolean> {
  await run('UPDATE users SET points = points + ? WHERE id = ?', [points, userId]);
  await run(
    'INSERT INTO points (id, userId, points, type, description, referenceId) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), userId, points, type, description, referenceId || null]
  );
  return true;
}

/** +5 once per day — call from reading session/progress endpoints */
export async function awardDailyReading(userId: string): Promise<boolean> {
  if (await hasReceivedToday(userId, 'daily_reading')) return false;
  return awardPoints(userId, 5, 'daily_reading', 'Daily reading reward');
}

/** +20 when streak hits exactly 7 days (awarded at most once per streak) */
export async function awardStreakBonus(userId: string): Promise<boolean> {
  const streak = await calculateStreak(userId);
  if (streak < 7) return false;

  // Check if already awarded within this streak window (last 7 days)
  const row = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM points
     WHERE userId = ? AND type = 'streak_bonus' AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [userId]
  );
  if ((row?.count || 0) > 0) return false;

  return awardPoints(userId, 20, 'streak_bonus', `${streak}-day reading streak bonus`);
}

/** +5 bonus for effective reading session: ≥15 min (900s) and at least 1 page flipped */
export async function awardEffectiveReading(
  userId: string, durationSec: number, startPage: number, endPage: number
): Promise<boolean> {
  if (durationSec < 900) return false;
  if (endPage <= startPage) return false; // no page flips — AFK detected
  if (await hasReceivedToday(userId, 'effective_reading')) return false;
  return awardPoints(userId, 5, 'effective_reading', `Effective reading: ${Math.round(durationSec / 60)} min`);
}

/** +15 when completing a book AND answering the quiz (called from quiz submit) */
export async function awardBookCompletionWithQuiz(userId: string, bookId: string): Promise<boolean> {
  // Check book is completed
  const progress = await queryOne<{ isCompleted: number }>(
    'SELECT isCompleted FROM reading_progress WHERE userId = ? AND bookId = ?',
    [userId, bookId]
  );
  if (!progress || progress.isCompleted !== 1) return false;

  // Check quiz was answered
  const quiz = await queryOne<{ id: string }>(
    'SELECT id FROM quiz_results WHERE userId = ? AND bookId = ?',
    [userId, bookId]
  );
  if (!quiz) return false;

  // Prevent double award
  const already = await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM points WHERE userId = ? AND type = ? AND referenceId = ?',
    [userId, 'book_quiz', bookId]
  );
  if ((already?.count || 0) > 0) return false;

  return awardPoints(userId, 15, 'book_quiz', 'Completed book and quiz', bookId);
}

/** Up to +8 points per day for AI chat interactions */
export async function awardAiInteraction(userId: string): Promise<boolean> {
  const todayTotal = await getTodayPoints(userId, 'ai_interaction');
  if (todayTotal >= 8) return false;
  return awardPoints(userId, 1, 'ai_interaction', 'AI reading companion interaction');
}

/** Up to +10 points per day for highlights and notes */
export async function awardHighlightOrNote(userId: string): Promise<boolean> {
  const todayTotal = await getTodayPoints(userId, 'highlight_note');
  if (todayTotal >= 10) return false;
  return awardPoints(userId, 1, 'highlight_note', 'Highlight or note created');
}
