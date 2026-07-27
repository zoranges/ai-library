import { run } from '../db/database.js';

let lastMonthKey = '';
let lastYearKey = '';

function getMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getYearKey(): string {
  return `${new Date().getFullYear()}`;
}

/** Reset monthly/yearly points for all users when period changes. Runs every hour. */
async function checkAndReset(): Promise<void> {
  const currentMonthKey = getMonthKey();
  const currentYearKey = getYearKey();

  if (!lastMonthKey) {
    lastMonthKey = currentMonthKey;
    lastYearKey = currentYearKey;
    return;
  }

  if (currentMonthKey !== lastMonthKey) {
    console.log(`[ScoreReset] Resetting monthly points (${lastMonthKey} → ${currentMonthKey})`);
    await run("UPDATE users SET monthlyPoints = 0, lastMonthlyReset = ''");
    lastMonthKey = currentMonthKey;
  }

  if (currentYearKey !== lastYearKey) {
    console.log(`[ScoreReset] Resetting yearly points (${lastYearKey} → ${currentYearKey})`);
    await run("UPDATE users SET yearlyPoints = 0, lastYearlyReset = ''");
    lastYearKey = currentYearKey;
  }
}

export function startScoreResetScheduler(): void {
  lastMonthKey = getMonthKey();
  lastYearKey = getYearKey();
  setInterval(checkAndReset, 3600000); // Every hour
}
