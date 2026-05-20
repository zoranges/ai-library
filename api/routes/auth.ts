import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { queryOne, run, queryAll } from '../db/database.js';
import { verifyToken, generateToken, generateRefreshToken, type JwtPayload } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password as string);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    // Check IP binding
    if (user.bindIp) {
      const clientIp = req.ip || req.socket.remoteAddress || '';
      if (clientIp !== user.bindIp) {
        res.status(403).json({ success: false, error: 'Account is bound to a different IP address' });
        return;
      }
    }

    const payload: JwtPayload = {
      userId: user.id as string,
      email: user.email as string,
      role: user.role as string,
      schoolId: user.schoolId as string,
    };

    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Track login session
    const clientIp = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const sessionId = uuidv4();

    // Deactivate previous sessions
    await run('UPDATE login_sessions SET isCurrent = 0 WHERE userId = ?', [user.id]);

    await run(
      'INSERT INTO login_sessions (id, userId, ipAddress, userAgent, lastActiveAt, isCurrent) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, user.id, clientIp, userAgent.substring(0, 500), new Date().toISOString(), 1]
    );

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      success: true,
      data: {
        user: {
          ...userWithoutPassword,
          preferredLanguage: user.preferredLanguage,
          bindIp: user.bindIp,
        },
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
    const {
      username,
      email,
      password,
      schoolId,
      grade,
      icNumber,
      preferredLanguage,
      phone,
      guardianName,
      guardianPhone,
      address,
    } = req.body;
    if (!username || !email || !password || !schoolId) {
      res.status(400).json({ success: false, error: 'Username, email, password, and schoolId are required' });
      return;
    }

    const existingUser = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    if (icNumber) {
      const icEntry = await queryOne('SELECT * FROM ic_whitelist WHERE icNumber = ? AND schoolId = ?', [icNumber, schoolId]);
      if (!icEntry) {
        res.status(400).json({ success: false, error: 'IC number not found in school whitelist' });
        return;
      }
    }

    const school = await queryOne('SELECT id FROM schools WHERE id = ? AND isActive = 1', [schoolId]);
    if (!school) {
      res.status(400).json({ success: false, error: 'Invalid or inactive school' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    const userRole = req.body.role === 'teacher' ? 'teacher' : 'student';

    await run(
      'INSERT INTO users (id, username, email, password, schoolId, grade, role, icNumber, preferredLanguage, phone, guardianName, guardianPhone, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, username, email, hashedPassword, schoolId, grade || null, userRole, icNumber || null, preferredLanguage || null, phone || null, guardianName || null, guardianPhone || null, address || null]
    );

    await run('UPDATE schools SET studentCount = studentCount + 1 WHERE id = ?', [schoolId]);

    const payload: JwtPayload = {
      userId,
      email,
      role: userRole,
      schoolId,
    };

    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    const { password: _, ...userWithoutPassword } = user!;

    res.status(201).json({
      success: true,
      data: {
        user: {
          ...userWithoutPassword,
          preferredLanguage: user?.preferredLanguage || null,
        },
        token,
        refreshToken,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required' });
      return;
    }

    const user = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      res.status(200).json({ success: true, message: 'If the email exists, a reset token has been generated.' });
      return;
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour expiry

    await run(
      'INSERT INTO password_reset_tokens (id, userId, token, expiresAt, used) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), user.id, token, expiresAt, 0]
    );

    res.status(200).json({
      success: true,
      data: { token }, // In production, this would be emailed; returned here for development
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate reset token' });
  }
});

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ success: false, error: 'Token and new password are required' });
      return;
    }

    const resetToken = await queryOne(
      'SELECT id, userId, expiresAt, used FROM password_reset_tokens WHERE token = ?',
      [token]
    );

    if (!resetToken) {
      res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
      return;
    }

    if (resetToken.used) {
      res.status(400).json({ success: false, error: 'This reset token has already been used' });
      return;
    }

    if (new Date(resetToken.expiresAt as string) < new Date()) {
      res.status(400).json({ success: false, error: 'This reset token has expired' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, resetToken.userId]);
    await run('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [resetToken.id]);

    res.status(200).json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

router.post('/logout', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    await run('UPDATE login_sessions SET isCurrent = 0 WHERE userId = ?', [userId]);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch {
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  }
});

router.get('/me', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.user!.userId]);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const { password: _, ...userWithoutPassword } = user;

    const achievements = await queryAll(
      'SELECT ua.*, a.name as achievementName, a.description as achievementDesc, a.icon, a.category, a.points, a.rarity FROM user_achievements ua JOIN achievements a ON ua.achievementId = a.id WHERE ua.userId = ?',
      [req.user!.userId]
    );

    const badges = await queryAll(
      'SELECT ub.*, b.name as badgeName, b.description as badgeDesc, b.icon, b.category, b.rarity FROM user_badges ub JOIN badges b ON ub.badgeId = b.id WHERE ub.userId = ?',
      [req.user!.userId]
    );

    res.json({
      success: true,
      data: {
        ...userWithoutPassword,
        preferredLanguage: user.preferredLanguage,
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
    const { username, avatar, grade, preferredLanguage, phone, guardianName, guardianPhone, address } = req.body;

    if (username) await run('UPDATE users SET username = ? WHERE id = ?', [username, userId]);
    if (avatar) await run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, userId]);
    if (grade) await run('UPDATE users SET grade = ? WHERE id = ?', [grade, userId]);
    if (preferredLanguage !== undefined) await run('UPDATE users SET preferredLanguage = ? WHERE id = ?', [preferredLanguage, userId]);
    if (phone !== undefined) await run('UPDATE users SET phone = ? WHERE id = ?', [phone, userId]);
    if (guardianName !== undefined) await run('UPDATE users SET guardianName = ? WHERE id = ?', [guardianName, userId]);
    if (guardianPhone !== undefined) await run('UPDATE users SET guardianPhone = ? WHERE id = ?', [guardianPhone, userId]);
    if (address !== undefined) await run('UPDATE users SET address = ? WHERE id = ?', [address, userId]);

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
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

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
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
    await run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

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
    const JWT_SECRET = process.env.JWT_SECRET || 'ai-library-secret-key-2024';
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as JwtPayload;

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [decoded.userId]);
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
