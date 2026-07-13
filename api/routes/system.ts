import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '../db/database.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { getStorageProvider, resolveFileUrl, buildKey } from '../services/storage/index.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// Public endpoint — no auth required
router.get('/public/config', async (_req: Request, res: Response): Promise<void> => {
  try {
    const configs = await queryAll('SELECT configKey, configValue FROM system_config');
    const result: Record<string, string> = {};
    const imgExpiry = parseInt(process.env.STORAGE_SIGNED_URL_EXPIRY_IMAGES || '86400', 10);

    for (const row of configs as any[]) {
      const val = row.configValue as string;
      // Resolve image values (end with image extension) to full URLs
      if (val && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(val)) {
        result[row.configKey] = (await resolveFileUrl(val, imgExpiry)) || val;
      } else {
        result[row.configKey] = val;
      }
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch public config' });
  }
});

// Public endpoint — list schools for registration page
router.get('/public/schools', async (req: Request, res: Response): Promise<void> => {
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

// File upload — admin only
router.post('/upload', verifyToken, requireRole('admin', 'super_admin'), upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }
    const storage = getStorageProvider();
    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `${uuidv4()}${ext}`;
    const key = buildKey('pages', filename);

    await storage.upload(key, req.file.buffer, req.file.mimetype);

    const url = await resolveFileUrl(key);
    res.json({ success: true, data: { url, filename: req.file.originalname, key } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Upload failed' });
  }
});

export default router;
