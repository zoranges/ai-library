import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run, queryAll } from '../db/database.js';
import { verifyToken, generateToken, generateRefreshToken, type JwtPayload } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password as string);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const payload: JwtPayload = {
      userId: user.id as string,
      email: user.email as string,
      role: user.role as string,
      schoolId: user.schoolId as string,
    };

    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token,
        refreshToken,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, schoolId, grade, icNumber } = req.body;
    if (!username || !email || !password || !schoolId) {
      res.status(400).json({ success: false, error: 'Username, email, password, and schoolId are required' });
      return;
    }

    const existingUser = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    if (icNumber) {
      const icEntry = queryOne('SELECT * FROM ic_whitelist WHERE icNumber = ? AND schoolId = ?', [icNumber, schoolId]);
      if (!icEntry) {
        res.status(400).json({ success: false, error: 'IC number not found in school whitelist' });
        return;
      }
    }

    const school = queryOne('SELECT id FROM schools WHERE id = ? AND isActive = 1', [schoolId]);
    if (!school) {
      res.status(400).json({ success: false, error: 'Invalid or inactive school' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    run(
      'INSERT INTO users (id, username, email, password, schoolId, grade, role, icNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, username, email, hashedPassword, schoolId, grade || null, 'student', icNumber || null]
    );

    run('UPDATE schools SET studentCount = studentCount + 1 WHERE id = ?', [schoolId]);

    const payload: JwtPayload = {
      userId,
      email,
      role: 'student',
      schoolId,
    };

    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const user = queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    const { password: _, ...userWithoutPassword } = user!;

    res.status(201).json({
      success: true,
      data: {
        user: userWithoutPassword,
        token,
        refreshToken,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

router.get('/me', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = queryOne('SELECT * FROM users WHERE id = ?', [req.user!.userId]);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const { password: _, ...userWithoutPassword } = user;

    const achievements = queryAll(
      'SELECT ua.*, a.name as achievementName, a.description as achievementDesc, a.icon, a.category, a.points, a.rarity FROM user_achievements ua JOIN achievements a ON ua.achievementId = a.id WHERE ua.userId = ?',
      [req.user!.userId]
    );

    const badges = queryAll(
      'SELECT ub.*, b.name as badgeName, b.description as badgeDesc, b.icon, b.category, b.rarity FROM user_badges ub JOIN badges b ON ub.badgeId = b.id WHERE ub.userId = ?',
      [req.user!.userId]
    );

    res.json({
      success: true,
      data: {
        ...userWithoutPassword,
        achievements,
        badges,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get user info' });
  }
});

router.put('/profile', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { username, avatar, grade } = req.body;

    if (username) run('UPDATE users SET username = ? WHERE id = ?', [username, userId]);
    if (avatar) run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, userId]);
    if (grade) run('UPDATE users SET grade = ? WHERE id = ?', [grade, userId]);

    const user = queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    const { password: _, ...userWithoutPassword } = user!;
    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

router.put('/password', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: 'Current password and new password are required' });
      return;
    }

    const user = queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.password as string);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update password' });
  }
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: 'Refresh token is required' });
      return;
    }

    const jwt = await import('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, 'ai-library-secret-key-2024') as JwtPayload;

    const user = queryOne('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    const payload: JwtPayload = {
      userId: user.id as string,
      email: user.email as string,
      role: user.role as string,
      schoolId: user.schoolId as string,
    };

    const newToken = generateToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
  }
});

export default router;
