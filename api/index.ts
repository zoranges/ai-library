import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDatabase } from './db/database.js';
import app from './app.js';

let initialized = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!initialized) {
    await initDatabase();
    initialized = true;
  }
  return app(req, res);
}
