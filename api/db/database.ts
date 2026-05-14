import initSqlJs, { type Database } from 'sql.js';

let db: Database;

export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs();
  db = new SQL.Database();

  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      contactPhone TEXT,
      contactEmail TEXT,
      studentCount INTEGER DEFAULT 0,
      bookCount INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ic_whitelist (
      id TEXT PRIMARY KEY,
      icNumber TEXT NOT NULL UNIQUE,
      schoolId TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (schoolId) REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      avatar TEXT,
      schoolId TEXT NOT NULL,
      grade TEXT,
      role TEXT NOT NULL DEFAULT 'student',
      points INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      icNumber TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (schoolId) REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL UNIQUE,
      schoolId TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      permissions TEXT DEFAULT '[]',
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (schoolId) REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS book_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      bookCount INTEGER DEFAULT 0,
      parentId TEXT,
      sortOrder INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      isbn TEXT,
      coverUrl TEXT,
      description TEXT,
      categoryId TEXT NOT NULL,
      publisher TEXT,
      publishDate TEXT,
      pageCount INTEGER NOT NULL DEFAULT 0,
      language TEXT NOT NULL DEFAULT 'zh',
      difficulty TEXT NOT NULL DEFAULT 'intermediate',
      rating REAL DEFAULT 0,
      ratingCount INTEGER DEFAULT 0,
      readCount INTEGER DEFAULT 0,
      favoriteCount INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      fileUrl TEXT,
      fileType TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (categoryId) REFERENCES book_categories(id)
    );

    CREATE TABLE IF NOT EXISTS reading_progress (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      bookId TEXT NOT NULL,
      currentPage INTEGER DEFAULT 0,
      totalPages INTEGER NOT NULL,
      percentage REAL DEFAULT 0,
      lastReadAt TEXT,
      lastPosition TEXT,
      isCompleted INTEGER DEFAULT 0,
      startedAt TEXT DEFAULT (datetime('now')),
      UNIQUE(userId, bookId),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (bookId) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS reading_sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      bookId TEXT NOT NULL,
      startPage INTEGER NOT NULL,
      endPage INTEGER NOT NULL,
      duration INTEGER NOT NULL DEFAULT 0,
      startedAt TEXT DEFAULT (datetime('now')),
      endedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (bookId) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      bookId TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      UNIQUE(userId, bookId),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (bookId) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS highlights (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      bookId TEXT NOT NULL,
      text TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#FFEB3B',
      page INTEGER NOT NULL,
      note TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (bookId) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      bookId TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      page INTEGER,
      isPublic INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (bookId) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS quiz_results (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      bookId TEXT NOT NULL,
      score REAL NOT NULL,
      totalQuestions INTEGER NOT NULL,
      correctAnswers INTEGER NOT NULL,
      timeSpent INTEGER NOT NULL DEFAULT 0,
      answers TEXT DEFAULT '[]',
      completedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (bookId) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      category TEXT NOT NULL,
      condition TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      rarity TEXT NOT NULL DEFAULT 'common'
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      achievementId TEXT NOT NULL,
      unlockedAt TEXT DEFAULT (datetime('now')),
      isNotified INTEGER DEFAULT 0,
      UNIQUE(userId, achievementId),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (achievementId) REFERENCES achievements(id)
    );

    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      category TEXT NOT NULL,
      rarity TEXT NOT NULL DEFAULT 'common'
    );

    CREATE TABLE IF NOT EXISTS user_badges (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      badgeId TEXT NOT NULL,
      isEquipped INTEGER DEFAULT 0,
      unlockedAt TEXT DEFAULT (datetime('now')),
      UNIQUE(userId, badgeId),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (badgeId) REFERENCES badges(id)
    );

    CREATE TABLE IF NOT EXISTS points (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      points INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      referenceId TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    );
  `);

  try { db.exec("ALTER TABLE reading_progress ADD COLUMN lastPosition TEXT"); } catch {}

  await seedData();
  return db;
}

async function seedData() {
  const catCount = db.exec("SELECT COUNT(*) as cnt FROM book_categories");
  if (catCount[0] && catCount[0].values[0][0] > 0) return;

  const schools = [
    { id: 'school-001', name: '阳光小学', address: '北京市海淀区中关村大街1号', contactPhone: '010-12345678', contactEmail: 'info@sunshine.edu.cn' },
    { id: 'school-002', name: '星辰中学', address: '上海市浦东新区世纪大道100号', contactPhone: '021-87654321', contactEmail: 'info@star.edu.cn' },
    { id: 'school-003', name: '未来学校', address: '深圳市南山区科技园路88号', contactPhone: '0755-11223344', contactEmail: 'info@future.edu.cn' },
  ];
  for (const s of schools) {
    db.run(
      `INSERT INTO schools (id, name, address, contactPhone, contactEmail) VALUES (?, ?, ?, ?, ?)`,
      [s.id, s.name, s.address, s.contactPhone, s.contactEmail]
    );
  }

  const icEntries = [
    { id: 'ic-001', icNumber: '110101200501011234', schoolId: 'school-001' },
    { id: 'ic-002', icNumber: '310115200602021234', schoolId: 'school-002' },
    { id: 'ic-003', icNumber: '440305200703031234', schoolId: 'school-003' },
    { id: 'ic-004', icNumber: '110101200804041234', schoolId: 'school-001' },
    { id: 'ic-005', icNumber: '310115200905051234', schoolId: 'school-002' },
  ];
  for (const ic of icEntries) {
    db.run(
      `INSERT INTO ic_whitelist (id, icNumber, schoolId) VALUES (?, ?, ?)`,
      [ic.id, ic.icNumber, ic.schoolId]
    );
  }

  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const studentHashedPassword = await bcrypt.hash('student123', 10);
  db.run(
    `INSERT INTO users (id, username, email, password, schoolId, role, points, level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['user-super-admin', '超级管理员', 'admin@ailibrary.com', hashedPassword, 'school-001', 'super_admin', 0, 1]
  );
  db.run(
    `INSERT INTO users (id, username, email, password, schoolId, role, points, level, icNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['user-student-001', '张小明', 'student1@ailibrary.com', studentHashedPassword, 'school-001', 'student', 15, 3, '110101200804041234']
  );
  db.run(
    `INSERT INTO users (id, username, email, password, schoolId, role, points, level, icNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['user-student-002', '李思思', 'student2@ailibrary.com', studentHashedPassword, 'school-002', 'student', 8, 2, '310115200602021234']
  );
  db.run(
    `INSERT INTO users (id, username, email, password, schoolId, role, points, level, icNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['user-student-003', 'Ahmad', 'student3@ailibrary.com', studentHashedPassword, 'school-003', 'student', 5, 2, '440305200703031234']
  );
  db.run(
    `INSERT INTO admins (id, userId, schoolId, role, permissions) VALUES (?, ?, ?, ?, ?)`,
    ['admin-001', 'user-super-admin', 'school-001', 'super_admin', '["all"]']
  );

  const categories = [
    { id: 'cat-001', name: '文学经典', icon: '📚', color: '#E74C3C', sortOrder: 1 },
    { id: 'cat-002', name: '科普百科', icon: '🔬', color: '#3498DB', sortOrder: 2 },
    { id: 'cat-003', name: '历史人文', icon: '🏛️', color: '#F39C12', sortOrder: 3 },
    { id: 'cat-004', name: '英语阅读', icon: '🌍', color: '#2ECC71', sortOrder: 4 },
    { id: 'cat-005', name: '思维逻辑', icon: '🧩', color: '#9B59B6', sortOrder: 5 },
  ];
  for (const c of categories) {
    db.run(
      `INSERT INTO book_categories (id, name, icon, color, bookCount, sortOrder) VALUES (?, ?, ?, ?, ?, ?)`,
      [c.id, c.name, c.icon, c.color, 0, c.sortOrder]
    );
  }

  const achievements = [
    { id: 'ach-001', name: '初入书海', description: '完成第一本书的阅读', icon: '📖', category: 'reading', condition: 'complete_1_book', points: 10, rarity: 'common' },
    { id: 'ach-002', name: '博览群书', description: '累计阅读10本书', icon: '📚', category: 'reading', condition: 'complete_10_books', points: 50, rarity: 'rare' },
    { id: 'ach-003', name: '知识达人', description: '完成5次测验且平均分80以上', icon: '🏆', category: 'quiz', condition: 'quiz_avg_80_5', points: 30, rarity: 'rare' },
    { id: 'ach-004', name: '坚持不懈', description: '连续7天阅读', icon: '🔥', category: 'streak', condition: 'streak_7_days', points: 20, rarity: 'common' },
    { id: 'ach-005', name: '分享之星', description: '发布10条公开笔记', icon: '⭐', category: 'social', condition: 'public_notes_10', points: 25, rarity: 'rare' },
    { id: 'ach-006', name: '传奇读者', description: '累计阅读100本书', icon: '👑', category: 'special', condition: 'complete_100_books', points: 200, rarity: 'legendary' },
  ];
  for (const a of achievements) {
    db.run(
      `INSERT INTO achievements (id, name, description, icon, category, condition, points, rarity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.name, a.description, a.icon, a.category, a.condition, a.points, a.rarity]
    );
  }

  const badges = [
    { id: 'badge-001', name: '阅读新手', description: '开始阅读之旅', icon: '🌱', category: 'reading', rarity: 'common' },
    { id: 'badge-002', name: '科学探索者', description: '阅读5本科普类书籍', icon: '🔭', category: 'reading', rarity: 'rare' },
    { id: 'badge-003', name: '测验高手', description: '测验满分3次', icon: '💯', category: 'quiz', rarity: 'epic' },
    { id: 'badge-004', name: '连续阅读', description: '连续30天阅读', icon: '📅', category: 'streak', rarity: 'epic' },
    { id: 'badge-005', name: '文学大师', description: '阅读所有文学经典', icon: '✨', category: 'special', rarity: 'legendary' },
  ];
  for (const b of badges) {
    db.run(
      `INSERT INTO badges (id, name, description, icon, category, rarity) VALUES (?, ?, ?, ?, ?, ?)`,
      [b.id, b.name, b.description, b.icon, b.category, b.rarity]
    );
  }

  const books = [
    { id: 'book-001', title: '西游记', author: '吴承恩', isbn: '978-7-02-000220-3', coverUrl: '/covers/xiyouji.jpg', description: '中国古典四大名著之一，讲述唐僧师徒四人西天取经的故事。', categoryId: 'cat-001', publisher: '人民文学出版社', publishDate: '2004-01-01', pageCount: 980, language: 'zh', difficulty: 'intermediate', rating: 4.9, ratingCount: 12580, readCount: 8900, favoriteCount: 3200, tags: '["古典文学","神话","冒险"]' },
    { id: 'book-002', title: '小王子', author: '安托万·德·圣-埃克苏佩里', isbn: '978-7-02-004234-7', coverUrl: '/covers/xiaowangzi.jpg', description: '一部写给大人的童话，讲述小王子从自己的星球出发前往地球的过程中的各种历险。', categoryId: 'cat-001', publisher: '人民文学出版社', publishDate: '2003-08-01', pageCount: 97, language: 'zh', difficulty: 'beginner', rating: 4.8, ratingCount: 23450, readCount: 15600, favoriteCount: 5400, tags: '["童话","哲学","成长"]' },
    { id: 'book-003', title: '时间简史', author: '史蒂芬·霍金', isbn: '978-7-5357-1691-3', coverUrl: '/covers/shijianjianshi.jpg', description: '从大爆炸到黑洞，霍金用通俗语言解释宇宙的奥秘。', categoryId: 'cat-002', publisher: '湖南科学技术出版社', publishDate: '2010-04-01', pageCount: 212, language: 'zh', difficulty: 'advanced', rating: 4.7, ratingCount: 8920, readCount: 6700, favoriteCount: 2100, tags: '["物理学","宇宙","科学"]' },
    { id: 'book-004', title: '昆虫记', author: '让-亨利·法布尔', isbn: '978-7-5448-1234-5', coverUrl: '/covers/kunchongji.jpg', description: '描述昆虫生活的科普名著，被誉为"昆虫的史诗"。', categoryId: 'cat-002', publisher: '译林出版社', publishDate: '2011-06-01', pageCount: 456, language: 'zh', difficulty: 'beginner', rating: 4.6, ratingCount: 6780, readCount: 4500, favoriteCount: 1800, tags: '["昆虫","自然","科普"]' },
    { id: 'book-005', title: '上下五千年', author: '林汉达', isbn: '978-7-5324-5678-9', coverUrl: '/covers/shangxiawuqiannian.jpg', description: '以故事形式讲述中国五千年历史，是青少年了解中国历史的经典读物。', categoryId: 'cat-003', publisher: '少年儿童出版社', publishDate: '2002-01-01', pageCount: 890, language: 'zh', difficulty: 'intermediate', rating: 4.5, ratingCount: 5430, readCount: 3800, favoriteCount: 1200, tags: '["历史","中国","故事"]' },
    { id: 'book-006', title: 'The Little Prince', author: 'Antoine de Saint-Exupéry', isbn: '978-0-15-601219-5', coverUrl: '/covers/littleprince_en.jpg', description: 'A timeless tale of a prince who travels from planet to planet, learning about life and love.', categoryId: 'cat-004', publisher: 'Harcourt Brace', publishDate: '2000-05-01', pageCount: 96, language: 'en', difficulty: 'beginner', rating: 4.9, ratingCount: 45600, readCount: 23000, favoriteCount: 8900, tags: '["classic","philosophy","fairy tale"]' },
    { id: 'book-007', title: 'Harry Potter and the Philosopher\'s Stone', author: 'J.K. Rowling', isbn: '978-0-7475-3269-9', coverUrl: '/covers/harrypotter1.jpg', description: 'The first book in the Harry Potter series, where young Harry discovers he is a wizard.', categoryId: 'cat-004', publisher: 'Bloomsbury', publishDate: '1997-06-26', pageCount: 309, language: 'en', difficulty: 'intermediate', rating: 4.8, ratingCount: 67800, readCount: 45000, favoriteCount: 12000, tags: '["fantasy","magic","adventure"]' },
    { id: 'book-008', title: '数学之美', author: '吴军', isbn: '978-7-115-28261-5', coverUrl: '/covers/shuxuezhimei.jpg', description: '用通俗的语言介绍数学在信息技术中的应用，展示数学之美。', categoryId: 'cat-005', publisher: '人民邮电出版社', publishDate: '2012-05-01', pageCount: 304, language: 'zh', difficulty: 'advanced', rating: 4.7, ratingCount: 3450, readCount: 2800, favoriteCount: 980, tags: '["数学","科技","逻辑"]' },
    { id: 'book-009', title: '三国演义', author: '罗贯中', isbn: '978-7-02-000221-0', coverUrl: '/covers/sanguoyanyi.jpg', description: '中国古典四大名著之一，描写东汉末年到西晋初年的历史风云。', categoryId: 'cat-001', publisher: '人民文学出版社', publishDate: '2004-01-01', pageCount: 1200, language: 'zh', difficulty: 'advanced', rating: 4.8, ratingCount: 9870, readCount: 7200, favoriteCount: 2800, tags: '["古典文学","历史","战争"]' },
    { id: 'book-010', title: '万物简史', author: '比尔·布莱森', isbn: '978-7-5443-3456-7', coverUrl: '/covers/wanwujianshi.jpg', description: '一部有关现代科学发展史的科普名著，以幽默风趣的笔法讲述科学故事。', categoryId: 'cat-002', publisher: '接力出版社', publishDate: '2005-02-01', pageCount: 538, language: 'zh', difficulty: 'intermediate', rating: 4.6, ratingCount: 4560, readCount: 3200, favoriteCount: 1100, tags: '["科学","科普","历史"]' },
    { id: 'book-011', title: 'Charlotte\'s Web', author: 'E.B. White', isbn: '978-0-06-440055-8', coverUrl: '/covers/charlottesweb.jpg', description: 'A beloved children\'s novel about the friendship between a pig named Wilbur and a spider named Charlotte.', categoryId: 'cat-004', publisher: 'HarperCollins', publishDate: '1952-10-15', pageCount: 184, language: 'en', difficulty: 'beginner', rating: 4.7, ratingCount: 23400, readCount: 18000, favoriteCount: 6500, tags: '["children","friendship","animals"]' },
    { id: 'book-012', title: '逻辑思维训练', author: '李明', isbn: '978-7-301-23456-7', coverUrl: '/covers/luojisiwei.jpg', description: '通过趣味题目和案例培养逻辑思维能力，适合青少年阅读。', categoryId: 'cat-005', publisher: '北京大学出版社', publishDate: '2018-03-01', pageCount: 256, language: 'zh', difficulty: 'intermediate', rating: 4.4, ratingCount: 2100, readCount: 1600, favoriteCount: 560, tags: '["逻辑","思维","训练"]' },
    { id: 'book-013', title: 'Are You An Angel', author: 'Holly Webb', isbn: '978-1-84715-928-6', coverUrl: '', description: 'A heartwarming story about a young girl who discovers a tiny, injured angel in her garden and nurses it back to health.', categoryId: 'cat-004', publisher: 'Stripes Publishing', publishDate: '2016-03-01', pageCount: 128, language: 'en', difficulty: 'beginner', rating: 4.3, ratingCount: 340, readCount: 210, favoriteCount: 85, tags: '["children","fantasy","angels"]', fileUrl: '/uploads/books/Are You An Angel.epub', fileType: 'epub' },
    { id: 'book-014', title: 'Berhenti Wini Berhenti', author: 'Penerbitan Pelangi', isbn: '978-983-00-4567-2', coverUrl: '', description: 'Sebuah buku cerita kanak-kanak dalam bahasa Melayu yang mengajar tentang kesabaran dan keberanian.', categoryId: 'cat-003', publisher: 'Pelangi', publishDate: '2019-01-01', pageCount: 32, language: 'ms', difficulty: 'beginner', rating: 4.1, ratingCount: 120, readCount: 89, favoriteCount: 34, tags: '["kanak-kanak","cerita","Melayu"]', fileUrl: '/uploads/books/Berhenti Wini Berhenti.pdf', fileType: 'pdf' },
  ];
  for (const b of books) {
    db.run(
      `INSERT INTO books (id, title, author, isbn, coverUrl, description, categoryId, publisher, publishDate, pageCount, language, difficulty, rating, ratingCount, readCount, favoriteCount, tags, fileUrl, fileType, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [b.id, b.title, b.author, b.isbn, b.coverUrl, b.description, b.categoryId, b.publisher, b.publishDate, b.pageCount, b.language, b.difficulty, b.rating, b.ratingCount, b.readCount, b.favoriteCount, b.tags, (b as any).fileUrl || null, (b as any).fileType || null]
    );
  }

  for (const c of categories) {
    const count = books.filter(b => b.categoryId === c.id).length;
    db.run(`UPDATE book_categories SET bookCount = ? WHERE id = ?`, [count, c.id]);
  }
}

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function queryAll(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const database = getDb();
  const stmt = database.prepare(sql);
  stmt.bind(params as (string | number | null | Uint8Array)[]);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function queryOne(sql: string, params: unknown[] = []): Record<string, unknown> | null {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function run(sql: string, params: unknown[] = []): void {
  const database = getDb();
  database.run(sql, params as (string | number | null | Uint8Array)[]);
}
