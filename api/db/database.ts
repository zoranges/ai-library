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
        password VARCHAR(255) NOT NULL,
        avatar TEXT,
        schoolId VARCHAR(36) NOT NULL,
        grade VARCHAR(50),
        role VARCHAR(50) NOT NULL DEFAULT 'student',
        points INT DEFAULT 0,
        level INT DEFAULT 1,
        icNumber VARCHAR(50),
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

    await seedData(conn);
    initialized = true;
    console.log('Database initialized successfully');
  } finally {
    conn.release();
  }
}

async function seedData(conn: PoolConnection) {
  const [rows] = await conn.execute<RowDataPacket[]>('SELECT COUNT(*) as cnt FROM users');
  if ((rows[0] as any).cnt > 0) return;

  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const studentHashedPassword = await bcrypt.hash('student123', 10);

  await conn.execute(
    `INSERT INTO schools (id, name, address, contactPhone, contactEmail) VALUES
     ('school-001', '阳光小学', '北京市海淀区中关村大街1号', '010-12345678', 'info@sunshine.edu.cn'),
     ('school-002', '星辰中学', '上海市浦东新区世纪大道100号', '021-87654321', 'info@star.edu.cn'),
     ('school-003', '未来学校', '深圳市南山区科技园路88号', '0755-11223344', 'info@future.edu.cn')`
  );

  await conn.execute(
    `INSERT INTO users (id, username, email, password, schoolId, role, points, level) VALUES
     ('user-super-admin', '超级管理员', 'admin@ailibrary.com', ?, 'school-001', 'super_admin', 0, 1),
     ('user-student-001', '张小明', 'student1@ailibrary.com', ?, 'school-001', 'student', 0, 1),
     ('user-student-002', '李思思', 'student2@ailibrary.com', ?, 'school-002', 'student', 0, 1),
     ('user-student-003', 'Ahmad', 'student3@ailibrary.com', ?, 'school-003', 'student', 0, 1)`,
    [hashedPassword, studentHashedPassword, studentHashedPassword, studentHashedPassword]
  );

  await conn.execute(
    `INSERT INTO admins (id, userId, schoolId, role, permissions) VALUES
     ('admin-001', 'user-super-admin', 'school-001', 'super_admin', '["all"]')`
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
