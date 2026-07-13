import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { queryOne, run, queryAll } from '../db/database.js';
import { verifyToken, generateToken, generateRefreshToken, type JwtPayload } from '../middleware/auth.js';
import { sendResetPasswordEmail } from '../services/emailService.js';
import { getStorageProvider, resolveUserAvatar, resolveFileUrl, buildKey, keyFromLegacyPath } from '../services/storage/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, icNumber, password } = req.body;
    if (!password || (!email && !icNumber)) {
      res.status(400).json({ success: false, error: 'Email/IC number and password are required' });
      return;
    }

    let user;
    if (icNumber) {
      user = await queryOne('SELECT * FROM users WHERE REPLACE(icNumber, "-", "") = REPLACE(?, "-", "")', [icNumber]);
    } else {
      const users = await queryAll('SELECT * FROM users WHERE email = ?', [email]);
      if (users.length === 1) {
        user = users[0];
      } else if (users.length > 1) {
        // Same email for admin+student: try matching password against each
        for (const u of users) {
          const valid = await bcrypt.compare(password, (u as any).password as string);
          if (valid) { user = u; break; }
        }
      }
    }

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password as string);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Check registration status for students
    if (user.role === 'student' && user.status === 'rejected') {
      res.status(403).json({ success: false, error: 'Your registration has been rejected by the school administrator' });
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
      username: (user as any).username as string,
    };

    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Track login session
    const clientIp = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const sessionId = uuidv4();

    await run('UPDATE login_sessions SET isCurrent = 0 WHERE userId = ?', [user.id]);

    await run(
      'INSERT INTO login_sessions (id, userId, ipAddress, userAgent, lastActiveAt, isCurrent) VALUES (?, ?, ?, ?, NOW(), ?)',
      [sessionId, user.id, clientIp, userAgent.substring(0, 500), 1]
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
  } catch (error: any) {
    console.error('Login error:', error?.message || error, error?.stack);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Google OAuth login — verify ID token from frontend, find or create user, return JWT
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential, icNumber, schoolId } = req.body;
    if (!credential) {
      res.status(400).json({ success: false, error: 'Missing Google credential' });
      return;
    }

    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ success: false, error: 'Invalid Google token' });
      return;
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name || email.split('@')[0];
    const avatar = payload.picture || null;

    // Find existing user by googleId, or by email with student role
    let user = await queryOne<Record<string, unknown>>(
      'SELECT * FROM users WHERE googleId = ? OR (email = ? AND role = ?)',
      [googleId, email, 'student']
    );

    if (!user) {
      // New Google user — must provide IC number + school to register
      if (!icNumber || !schoolId) {
        res.status(403).json({
          success: false,
          error: 'Please complete registration with your IC number and school.',
          code: 'GOOGLE_NEEDS_REGISTRATION',
          data: { email, name, avatar },
        });
        return;
      }

      // Normalize IC number
      const normalizedIc = icNumber.replace(/-/g, '');

      // Validate school
      const school = await queryOne('SELECT id FROM schools WHERE id = ? AND isActive = 1', [schoolId]);
      if (!school) {
        res.status(400).json({ success: false, error: 'Invalid or inactive school' });
        return;
      }

      // Check duplicate IC (handle both dashed and non-dashed legacy data)
      const dupIc = await queryOne('SELECT id FROM users WHERE REPLACE(icNumber, "-", "") = ?', [normalizedIc]);
      if (dupIc) {
        res.status(409).json({ success: false, error: 'IC number already registered' });
        return;
      }

      // Check IC whitelist for this school (handle both dashed and non-dashed legacy data)
      const whitelist = await queryOne(
        'SELECT * FROM ic_whitelist WHERE REPLACE(icNumber, "-", "") = ? AND schoolId = ?',
        [normalizedIc, schoolId]
      );
      if (!whitelist) {
        res.status(400).json({ success: false, error: 'IC number not found in school whitelist' });
        return;
      }

      // Create user with active status
      const userId = uuidv4();
      await run(
        'INSERT INTO users (id, username, email, password, googleId, googleAvatar, schoolId, role, icNumber, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, name, email, null, googleId, avatar, schoolId, 'student', normalizedIc, 'active']
      );
      user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    } else if (!user.googleId) {
      // Link Google account to existing email-matched user
      await run('UPDATE users SET googleId = ?, googleAvatar = ? WHERE id = ?', [googleId, avatar, user.id]);
      user = { ...user, googleId, googleAvatar: avatar };
    }

    // Check if user is blocked/deregistered
    if ((user as any).isDeregistered === 1) {
      res.status(403).json({ success: false, error: 'Account has been deactivated. Please contact your school administrator.' });
      return;
    }

    const payload_jwt: JwtPayload = {
      userId: user.id as string,
      email: user.email as string,
      role: user.role as string,
      schoolId: user.schoolId as string,
      username: (user as any).username as string,
    };

    const token = generateToken(payload_jwt);
    const refreshToken = generateRefreshToken(payload_jwt);

    // Track login session
    const clientIp = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const sessionId = uuidv4();
    await run('UPDATE login_sessions SET isCurrent = 0 WHERE userId = ?', [user.id]);
    await run(
      'INSERT INTO login_sessions (id, userId, ipAddress, userAgent, lastActiveAt, isCurrent) VALUES (?, ?, ?, ?, NOW(), ?)',
      [sessionId, user.id, clientIp, userAgent.substring(0, 500), 1]
    );

    const { password: _, ...userWithoutPassword } = user as any;
    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token,
        refreshToken,
      },
    });
  } catch (error: any) {
    console.error('Google login error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Google login failed' });
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
    // Normalize IC number: strip dashes for consistent storage and lookup
    const normalizedIc = icNumber.replace(/-/g, '');

    if (!username || !email || !password || !schoolId || !icNumber) {
      res.status(400).json({ success: false, error: 'Username, email, IC number, password, and schoolId are required' });
      return;
    }

    // Check duplicate by email+role (allow same email for admin)
    const userRole = req.body.role === 'teacher' ? 'teacher' : 'student';
    const existingEmail = await queryOne('SELECT id FROM users WHERE email = ? AND role = ?', [email, userRole]);
    if (existingEmail) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    // Check duplicate by IC number (handle both dashed and non-dashed legacy data)
    const existingIc = await queryOne('SELECT id FROM users WHERE REPLACE(icNumber, "-", "") = ?', [normalizedIc]);
    if (existingIc) {
      res.status(409).json({ success: false, error: 'IC number already registered' });
      return;
    }

    // Check IC whitelist (handle both dashed and non-dashed legacy data)
    const icEntry = await queryOne('SELECT * FROM ic_whitelist WHERE REPLACE(icNumber, "-", "") = ? AND schoolId = ?', [normalizedIc, schoolId]);
    if (!icEntry) {
      res.status(400).json({ success: false, error: 'IC number not found in school whitelist' });
      return;
    }

    const school = await queryOne('SELECT id FROM schools WHERE id = ? AND isActive = 1', [schoolId]);
    if (!school) {
      res.status(400).json({ success: false, error: 'Invalid or inactive school' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await run(
      'INSERT INTO users (id, username, email, password, schoolId, grade, role, icNumber, status, preferredLanguage, phone, guardianName, guardianPhone, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, username, email, hashedPassword, schoolId, grade || null, userRole, normalizedIc, 'active', preferredLanguage || null, phone || null, guardianName || null, guardianPhone || null, address || null]
    );

    res.status(201).json({
      success: true,
      message: 'Registration submitted. Please wait for the school administrator to approve your account.',
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

    const users = await queryAll('SELECT id, email, role FROM users WHERE email = ?', [email]);
    let user;
    if (users.length === 1) {
      user = users[0];
    } else if (users.length > 1) {
      user = users.find((u: any) => u.password) || users[0];
    }

    if (!user) {
      res.status(404).json({ success: false, error: 'No account found with this email address.' });
      return;
    }

    const token = uuidv4();

    await run(
      'INSERT INTO password_reset_tokens (id, userId, token, expiresAt, used) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), ?)',
      [uuidv4(), user.id, token, 0]
    );

    const resetLink = `${process.env.SITE_URL || 'https://library.630381.com'}/reset-password?token=${token}`;
    const sent = await sendResetPasswordEmail(user.email as string, resetLink);

    res.status(200).json({
      success: true,
      message: sent
        ? 'A password reset link has been sent to your email.'
        : 'SMTP not configured. Token generated.',
      data: sent ? undefined : { token },
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

    // Use the role from the JWT token (allows role-switch to take effect)
    const effectiveRole = req.user!.role || user.role;
    const effectiveSchoolId = req.user!.schoolId || user.schoolId;

    const achievements = await queryAll(
      'SELECT ua.*, a.name as achievementName, a.description as achievementDesc, a.icon, a.category, a.points, a.rarity FROM user_achievements ua JOIN achievements a ON ua.achievementId = a.id WHERE ua.userId = ?',
      [req.user!.userId]
    );

    const badges = await queryAll(
      'SELECT ub.*, b.name as badgeName, b.description as badgeDesc, b.icon, b.category, b.rarity FROM user_badges ub JOIN badges b ON ub.badgeId = b.id WHERE ub.userId = ?',
      [req.user!.userId]
    );

    const resolvedUser = await resolveUserAvatar(userWithoutPassword as any);

    res.json({
      success: true,
      data: {
        ...resolvedUser,
        role: effectiveRole,
        schoolId: effectiveSchoolId,
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

    const fields: string[] = [];
    const values: any[] = [];

    if (username !== undefined) { fields.push('username = ?'); values.push(username); }
    if (avatar !== undefined) { fields.push('avatar = ?'); values.push(avatar); }
    if (grade !== undefined) { fields.push('grade = ?'); values.push(grade); }
    if (preferredLanguage !== undefined) { fields.push('preferredLanguage = ?'); values.push(preferredLanguage); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
    if (guardianName !== undefined) { fields.push('guardianName = ?'); values.push(guardianName); }
    if (guardianPhone !== undefined) { fields.push('guardianPhone = ?'); values.push(guardianPhone); }
    if (address !== undefined) { fields.push('address = ?'); values.push(address); }

    if (fields.length > 0) {
      values.push(userId);
      await run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    const { password: _, ...userWithoutPassword } = user!;
    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// Multer config for avatar upload (memory storage → OSS/disk via StorageProvider)
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

router.post('/avatar', verifyToken, avatarUpload.single('avatar'), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const storage = getStorageProvider();
    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `${uuidv4()}${ext}`;
    const key = buildKey('avatars', filename);

    await storage.upload(key, req.file.buffer, req.file.mimetype);

    // Delete old avatar if it exists
    const user = await queryOne<{ avatar: string | null }>('SELECT avatar FROM users WHERE id = ?', [userId]);
    const oldKey = keyFromLegacyPath(user?.avatar || '');
    if (oldKey) {
      storage.delete(oldKey).catch(() => {});
    }

    // Store the raw key in DB (not /uploads/... path)
    await run('UPDATE users SET avatar = ? WHERE id = ?', [key, userId]);

    const resolvedUrl = await resolveFileUrl(key);
    res.json({ success: true, data: { avatar: resolvedUrl } });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload avatar' });
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
      username: (user as any).username as string,
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
