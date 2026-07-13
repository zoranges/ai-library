import mysql, { type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ai_library',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});

let initialized = false;

export async function initDatabase(): Promise<void> {
  if (initialized) return;

  const conn = await pool.getConnection();
  try {
    await conn.execute(`SET NAMES utf8mb4`);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS schools (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        district VARCHAR(255),
        state VARCHAR(255),
        country VARCHAR(255) DEFAULT 'Malaysia',
        contactPhone VARCHAR(50),
        contactEmail VARCHAR(255),
        studentCount INT DEFAULT 0,
        bookCount INT DEFAULT 0,
        isActive TINYINT(1) DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ic_whitelist (
        id VARCHAR(36) PRIMARY KEY,
        icNumber VARCHAR(50) NOT NULL UNIQUE,
        schoolId VARCHAR(36) NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (schoolId) REFERENCES schools(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NULL,
        googleId VARCHAR(255) NULL UNIQUE,
        googleAvatar TEXT NULL,
        avatar TEXT,
        schoolId VARCHAR(36) NOT NULL,
        grade VARCHAR(50),
        role VARCHAR(50) NOT NULL DEFAULT 'student',
        points INT DEFAULT 0,
        level INT DEFAULT 1,
        icNumber VARCHAR(50),
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        preferredLanguage VARCHAR(10) DEFAULT 'en',
        phone VARCHAR(50),
        guardianName VARCHAR(255),
        guardianPhone VARCHAR(50),
        address TEXT,
        isDeregistered TINYINT(1) DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (schoolId) REFERENCES schools(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL UNIQUE,
        schoolId VARCHAR(36) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'admin',
        permissions JSON DEFAULT ('[]'),
        isActive TINYINT(1) DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (schoolId) REFERENCES schools(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expiresAt DATETIME NOT NULL,
        used TINYINT(1) DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ai_config (
        id VARCHAR(36) PRIMARY KEY,
        configKey VARCHAR(100) NOT NULL UNIQUE,
        configValue TEXT NOT NULL,
        description VARCHAR(500),
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updatedBy VARCHAR(36),
        FOREIGN KEY (updatedBy) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS system_config (
        id VARCHAR(36) PRIMARY KEY,
        configKey VARCHAR(100) NOT NULL UNIQUE,
        configValue TEXT NOT NULL,
        description VARCHAR(500),
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updatedBy VARCHAR(36),
        FOREIGN KEY (updatedBy) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS book_categories (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(10),
        color VARCHAR(10),
        bookCount INT DEFAULT 0,
        parentId VARCHAR(36),
        sortOrder INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS books (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        author VARCHAR(255) NOT NULL,
        isbn VARCHAR(50),
        coverUrl TEXT,
        description TEXT,
        categoryId VARCHAR(36) NOT NULL,
        publisher VARCHAR(255),
        publishDate VARCHAR(50),
        pageCount INT NOT NULL DEFAULT 0,
        language VARCHAR(10) NOT NULL DEFAULT 'zh',
        difficulty VARCHAR(50) NOT NULL DEFAULT 'intermediate',
        rating DOUBLE DEFAULT 0,
        ratingCount INT DEFAULT 0,
        readCount INT DEFAULT 0,
        favoriteCount INT DEFAULT 0,
        tags JSON DEFAULT ('[]'),
        fileUrl TEXT,
        fileType VARCHAR(50),
        textContent LONGTEXT,
        isActive TINYINT(1) DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (categoryId) REFERENCES book_categories(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS reading_progress (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        bookId VARCHAR(36) NOT NULL,
        currentPage INT DEFAULT 0,
        totalPages INT NOT NULL,
        percentage DOUBLE DEFAULT 0,
        lastReadAt DATETIME,
        lastPosition TEXT,
        isCompleted TINYINT(1) DEFAULT 0,
        completedAt DATETIME,
        startedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_book (userId, bookId),
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (bookId) REFERENCES books(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS reading_sessions (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        bookId VARCHAR(36) NOT NULL,
        startPage INT NOT NULL,
        endPage INT NOT NULL,
        duration INT NOT NULL DEFAULT 0,
        startedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        endedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (bookId) REFERENCES books(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS favorites (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        bookId VARCHAR(36) NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_book_fav (userId, bookId),
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (bookId) REFERENCES books(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS highlights (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        bookId VARCHAR(36) NOT NULL,
        text TEXT NOT NULL,
        color VARCHAR(10) NOT NULL DEFAULT '#FFEB3B',
        page INT NOT NULL,
        note TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (bookId) REFERENCES books(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Migration: add start_offset column for precise highlight positioning
    try {
      await conn.execute(`ALTER TABLE highlights ADD COLUMN start_offset INT DEFAULT NULL`);
    } catch { /* column may already exist */ }

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        bookId VARCHAR(36) NOT NULL,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        page INT,
        isPublic TINYINT(1) DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (bookId) REFERENCES books(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS quiz_results (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        bookId VARCHAR(36) NOT NULL,
        score DOUBLE NOT NULL,
        totalQuestions INT NOT NULL,
        correctAnswers INT NOT NULL,
        timeSpent INT NOT NULL DEFAULT 0,
        answers JSON DEFAULT ('[]'),
        completedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_book_quiz (userId, bookId),
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (bookId) REFERENCES books(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS achievements (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        icon VARCHAR(10) NOT NULL,
        category VARCHAR(50) NOT NULL,
        \`condition\` VARCHAR(255) NOT NULL,
        points INT NOT NULL DEFAULT 0,
        rarity VARCHAR(50) NOT NULL DEFAULT 'common'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        achievementId VARCHAR(36) NOT NULL,
        unlockedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        isNotified TINYINT(1) DEFAULT 0,
        UNIQUE KEY unique_user_achievement (userId, achievementId),
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (achievementId) REFERENCES achievements(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS badges (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        icon VARCHAR(10) NOT NULL,
        category VARCHAR(50) NOT NULL,
        rarity VARCHAR(50) NOT NULL DEFAULT 'common'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        badgeId VARCHAR(36) NOT NULL,
        isEquipped TINYINT(1) DEFAULT 0,
        unlockedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_badge (userId, badgeId),
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (badgeId) REFERENCES badges(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS points (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        points INT NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        referenceId VARCHAR(36),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS login_sessions (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        ipAddress VARCHAR(50),
        userAgent VARCHAR(500),
        lastActiveAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        isCurrent TINYINT(1) DEFAULT 1,
        FOREIGN KEY (userId) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Add bindIp column if not exists
    try {
      await conn.execute("ALTER TABLE users ADD COLUMN bindIp VARCHAR(50) NULL");
    } catch { /* column already exists */ }

    // Add copyright column to books if not exists
    try {
      await conn.execute("ALTER TABLE books ADD COLUMN copyright TEXT NULL");
    } catch { /* column already exists */ }

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        bookId VARCHAR(36) NOT NULL,
        cfi VARCHAR(500) NOT NULL,
        label VARCHAR(255),
        page INT DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (bookId) REFERENCES books(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36),
        username VARCHAR(255),
        userRole VARCHAR(50),
        schoolId VARCHAR(36),
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100),
        resourceId VARCHAR(36),
        method VARCHAR(10),
        path VARCHAR(500),
        requestBody JSON,
        responseStatus INT,
        ipAddress VARCHAR(50),
        userAgent VARCHAR(500),
        duration INT,
        details TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ol_userId (userId),
        INDEX idx_ol_action (action),
        INDEX idx_ol_resource (resource),
        INDEX idx_ol_createdAt (createdAt),
        INDEX idx_ol_responseStatus (responseStatus)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await migrateExistingTables(conn);
    await seedData(conn);
    initialized = true;
    console.log('Database initialized successfully');
  } finally {
    conn.release();
  }
}

async function migrateExistingTables(conn: PoolConnection) {
  // Add googleId, googleAvatar columns for Google OAuth support
  try {
    await conn.execute('ALTER TABLE users ADD COLUMN googleId VARCHAR(255) NULL UNIQUE');
  } catch { /* column already exists */ }
  try {
    await conn.execute('ALTER TABLE users ADD COLUMN googleAvatar TEXT NULL');
  } catch { /* column already exists */ }
  try {
    await conn.execute("ALTER TABLE users MODIFY password VARCHAR(255) NULL");
  } catch { /* already nullable */ }
  try {
    await conn.execute("ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'");
  } catch { /* column already exists */ }
}

async function seedData(conn: PoolConnection) {
  const [rows] = await conn.execute<RowDataPacket[]>('SELECT COUNT(*) as cnt FROM users');
  if ((rows[0] as any).cnt > 0) return;

  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const studentHashedPassword = await bcrypt.hash('student123', 10);
  const teacherHashedPassword = await bcrypt.hash('teacher123', 10);
  const schoolAdminHashedPassword = await bcrypt.hash('schooladmin123', 10);

  await conn.execute(
    `INSERT INTO schools (id, name, address, district, state, country, contactPhone, contactEmail) VALUES
     ('school-001', '阳光小学', '北京市海淀区中关村大街1号', 'Haidian', 'Kuala Lumpur', 'Malaysia', '010-12345678', 'info@sunshine.edu.cn'),
     ('school-002', '星辰中学', '上海市浦东新区世纪大道100号', 'Pudong', 'Selangor', 'Malaysia', '021-87654321', 'info@star.edu.cn'),
     ('school-003', '未来学校', '深圳市南山区科技园路88号', 'Nanshan', 'Penang', 'Malaysia', '0755-11223344', 'info@future.edu.cn')`
  );

  await conn.execute(
    `INSERT INTO users (id, username, email, password, schoolId, role, points, level, preferredLanguage) VALUES
     ('user-super-admin', '超级管理员', 'admin@ailibrary.com', ?, 'school-001', 'super_admin', 0, 1, 'zh'),
     ('user-student-001', '张小明', 'student1@ailibrary.com', ?, 'school-001', 'student', 0, 1, 'zh'),
     ('user-student-002', '李思思', 'student2@ailibrary.com', ?, 'school-002', 'student', 0, 1, 'en'),
     ('user-student-003', 'Ahmad', 'student3@ailibrary.com', ?, 'school-003', 'student', 0, 1, 'ms'),
     ('user-teacher-001', '陈老师', 'teacher1@ailibrary.com', ?, 'school-001', 'teacher', 0, 1, 'zh'),
     ('user-school-admin', '李校长', 'schooladmin@ailibrary.com', ?, 'school-001', 'admin', 0, 1, 'zh')`,
    [hashedPassword, studentHashedPassword, studentHashedPassword, studentHashedPassword, teacherHashedPassword, schoolAdminHashedPassword]
  );

  await conn.execute(
    `INSERT INTO admins (id, userId, schoolId, role, permissions) VALUES
     ('admin-001', 'user-super-admin', 'school-001', 'super_admin', '["all"]'),
     ('admin-002', 'user-school-admin', 'school-001', 'school_admin', '["students","books","reading","quiz"]')`
  );

  // Seed default AI config
  await conn.execute(
    `INSERT INTO ai_config (id, configKey, configValue, description) VALUES
     ('ai-config-001', 'model', 'deepseek-chat', 'AI model used for chat/completion'),
     ('ai-config-002', 'temperature', '0.7', 'Response creativity (0-1)'),
     ('ai-config-003', 'max_tokens', '2000', 'Maximum response length'),
     ('ai-config-004', 'system_prompt_zh', '你是一个儿童友好的AI阅读助手，请使用简单易懂的中文回答，适合小学生理解。', 'System prompt for Chinese'),
     ('ai-config-005', 'system_prompt_en', 'You are a child-friendly AI reading assistant. Use simple, easy-to-understand English suitable for primary school students.', 'System prompt for English'),
     ('ai-config-006', 'system_prompt_ms', 'Anda adalah pembantu membaca AI yang mesra kanak-kanak. Gunakan bahasa Melayu yang mudah difahami.', 'System prompt for Malay'),
     ('ai-config-007', 'default_language', 'zh', 'Default AI response language'),
     ('ai-config-008', 'ains_url', 'https://delima.moe-dl.edu.my', 'Delima AINS platform URL for reading report integration')`
  );

  // Seed default system config
  await conn.execute(
    `INSERT INTO system_config (id, configKey, configValue, description) VALUES
     ('sys-config-001', 'login_page_image', '/普通用户登录.jpg', '普通用户登录页背景图'),
     ('sys-config-002', 'register_page_image', '/首页拿督新.png', '注册用户登录页背景图'),
     ('sys-config-003', 'admin_login_page_image', '/首页拿督新.png', '管理员登录页背景图'),
     ('sys-config-004', 'splash_page_image', '/启动页的拿督.png', '启动页背景图')`
  );

  // Seed default achievements
  await conn.execute(
    `INSERT IGNORE INTO achievements (id, name, description, icon, category, \`condition\`, points, rarity) VALUES
     ('ach-001', 'First Book', 'Complete reading your first book', '📖', 'reading', 'complete-1-book', 10, 'common'),
     ('ach-002', 'Book Collector', 'Complete reading 5 books', '📚', 'reading', 'complete-5-books', 25, 'common'),
     ('ach-003', 'Bibliophile', 'Complete reading 10 books', '📚', 'reading', 'complete-10-books', 50, 'rare'),
     ('ach-004', 'Library Master', 'Complete reading 25 books', '🏛️', 'reading', 'complete-25-books', 100, 'epic'),
     ('ach-005', 'Grand Scholar', 'Complete reading 50 books', '🎓', 'reading', 'complete-50-books', 200, 'legendary'),
     ('ach-006', 'Getting Started', 'Read for 100 minutes total', '⏱️', 'reading', 'read-100-minutes', 10, 'common'),
     ('ach-007', 'Marathon Reader', 'Read for 600 minutes total', '🏃', 'reading', 'read-600-minutes', 30, 'rare'),
     ('ach-008', 'Dedicated Reader', 'Read for 3000 minutes total', '💪', 'reading', 'read-3000-minutes', 100, 'epic'),
     ('ach-009', 'Quiz Master', 'Score 100% on a quiz', '🏆', 'quiz', 'quiz-perfect-score', 20, 'epic'),
     ('ach-010', 'Warming Up', 'Read for 3 consecutive days', '🔥', 'streak', 'streak-3-days', 10, 'common'),
     ('ach-011', 'On Fire', 'Read for 7 consecutive days', '🔥', 'streak', 'streak-7-days', 25, 'rare'),
     ('ach-012', 'Unstoppable', 'Read for 30 consecutive days', '⚡', 'streak', 'streak-30-days', 100, 'epic')`
  );

  // Seed default badges
  await conn.execute(
    `INSERT IGNORE INTO badges (id, name, description, icon, category, rarity) VALUES
     ('badge-001', 'Book Worm', 'An avid reader who loves books', '🐛', 'reading', 'common'),
     ('badge-002', 'Long Reader', 'Spent many hours reading', '⏳', 'reading', 'rare'),
     ('badge-003', 'Active Reader', 'Reads every day consistently', '⚡', 'reading', 'epic')`
  );

  console.log('Seed data inserted successfully');
}

export async function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function run(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await pool.query<ResultSetHeader>(sql, params);
  return result;
}

export async function getConnection() {
  return pool.getConnection();
}

export function safeJsonParse<T = unknown>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value as T;
}

export { pool };
