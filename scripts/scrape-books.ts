import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BASE = 'http://202.106.125.14:8888';
const UPLOADS = path.join(__dirname, '..', 'uploads', 'covers');
const POOL = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ai_library',
  charset: 'utf8mb4',
});

const CATEGORIES = [
  { id: '975ef839-c5f6-425b-b31e-c0ad126dd0b6', name: '阳光故事' },
  { id: '4a0eabd5-6300-4ca6-ae60-70163a99cf9a', name: '文化传承' },
  { id: '30d8ac99-a236-4cde-9f10-e42c900f092c', name: '科普绘本' },
  { id: '54656e58-fca3-458b-8ac9-e3d9b1539b10', name: '双语绘本' },
];

async function fetchHtml(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  const raw = await resp.arrayBuffer();
  return new TextDecoder('utf-8').decode(raw);
}

interface SubCategory {
  id: string;
  name: string;
  categoryId: string;
}

interface BookData {
  id: string;
  title: string;
  coverImg: string;
  videoUrl: string;
  description: string;
  subCategoryId: string;
  subCategoryName: string;
  categoryId: string;
  categoryName: string;
}

// Extract subcategories from category page
async function scrapeSubCategories(catId: string, catName: string): Promise<SubCategory[]> {
  console.log(`\n=== Category: ${catName} ===`);
  const html = await fetchHtml(`${BASE}/Home/List/${catId}`);

  // Match: <h3 class="tle ...">NAME</h3> ... /Pbook/List/ID
  const sections = html.split('class="wel-box"');
  const subs: SubCategory[] = [];

  for (const section of sections) {
    const nameMatch = section.match(/<h3 class="tle[^"]*"[^>]*>([^<]+)</);
    const idMatch = section.match(/\/Pbook\/List\/([a-f0-9-]+)/);
    if (nameMatch && idMatch) {
      const name = nameMatch[1].trim();
      if (name && name !== '相关资源') {
        console.log(`  Subcategory: ${name}`);
        subs.push({ id: idMatch[1], name, categoryId: catId });
      }
    }
  }
  return subs;
}

// Extract books from a subcategory list page (handles pagination)
async function scrapeBooksFromSub(sub: SubCategory): Promise<BookData[]> {
  const booksMap = new Map<string, BookData>();
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${BASE}/Pbook/List/${sub.id}?p=${page}`;
    console.log(`  Fetching page ${page}: ${url}`);
    const html = await fetchHtml(url);

    // Parse book cards. Structure:
    // <a class="img" href="/Pbook/Detail/UUID?g=SUBID"><img src="COVER"></a>
    // ... <a class="text_name" href="/Pbook/Detail/UUID?g=SUBID">TITLE</a>

    const imgBlocks = html.split('class="img"');
    for (let i = 1; i < imgBlocks.length; i++) {
      const block = imgBlocks[i];
      const idMatch = block.match(/\/Pbook\/Detail\/([a-f0-9-]+)/);
      const imgMatch = block.match(/src="([^"]+\.(jpg|png))"/i);
      if (idMatch && imgMatch) {
        const id = idMatch[1];
        if (!booksMap.has(id)) {
          booksMap.set(id, {
            id,
            title: '',
            coverImg: imgMatch[1],
            videoUrl: '',
            description: '',
            subCategoryId: sub.id,
            subCategoryName: sub.name,
            categoryId: sub.categoryId,
            categoryName: '',
          });
        }
      }
    }

    // Parse titles from text_name links
    const textBlocks = html.split('class="text_name"');
    for (let i = 1; i < textBlocks.length; i++) {
      const block = textBlocks[i];
      const idMatch = block.match(/\/Pbook\/Detail\/([a-f0-9-]+)/);
      const titleMatch = block.match(/>([^<]+)</);
      if (idMatch && titleMatch) {
        const id = idMatch[1];
        const title = titleMatch[1].trim();
        if (booksMap.has(id)) {
          booksMap.get(id)!.title = title;
        }
      }
    }

    // Check for next page
    const hasNextPage = html.includes('?p=' + (page + 1));
    hasMore = hasNextPage;
    page++;
    if (page > 20) break; // Safety limit
    if (hasMore) await new Promise(r => setTimeout(r, 300));
  }

  const books = Array.from(booksMap.values()).filter(b => b.title);
  console.log(`  Found ${books.length} books (${booksMap.size} total cards)`);
  return books;
}

// Get full book detail
async function scrapeBookDetail(book: BookData): Promise<BookData> {
  try {
    const html = await fetchHtml(`${BASE}/Pbook/Detail/${book.id}`);

    // Title from detail page
    const titleMatch = html.match(/<span>([^<]+)<\/span>\s*<\/h3>/);
    if (titleMatch) book.title = titleMatch[1].trim();

    // Description
    const descMatch = html.match(/<p>\s*([\s\S]*?)\s*<\/p>/);
    if (descMatch) {
      const desc = descMatch[1].replace(/<[^>]+>/g, '').trim();
      if (desc && desc.length > 10) book.description = desc;
    }

    // Video URL (MP4)
    const vidMatch = html.match(/src="(\/huiben_video\/[^"]+\.mp4)"/);
    if (vidMatch) book.videoUrl = vidMatch[1];

    // Poster/cover from video tag
    if (!book.coverImg || book.coverImg.includes('temp')) {
      const posterMatch = html.match(/poster="([^"]+\.(jpg|png))"/i);
      if (posterMatch) book.coverImg = posterMatch[1];
    }

    // Breadcrumb for category name
    const breadMatch = html.match(/<a href="\/Home\/List\/([^"]+)"[^>]*>([^<]+)<\/a>/);
    if (breadMatch) {
      book.categoryName = breadMatch[2].trim();
      const found = CATEGORIES.find(c => c.name === book.categoryName);
      if (found) book.categoryId = found.id;
    }

  } catch (e) {
    console.error(`  Error on detail ${book.id}:`, e);
  }
  return book;
}

async function insertIntoDB(book: BookData, subCatDbId: string): Promise<void> {
  const conn = await POOL.getConnection();
  try {
    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM books WHERE id = ?', [book.id]
    );
    if (existing.length > 0) {
      console.log(`  [SKIP] ${book.title}`);
      return;
    }

    await conn.execute(
      `INSERT INTO books (id, title, author, coverUrl, description, categoryId, publisher,
        pageCount, language, difficulty, fileUrl, fileType, tags, readCount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        book.id,
        book.title,
        '中少绘本',
        book.coverImg || '',
        book.description || '',
        subCatDbId,
        '中国少年儿童出版社',
        book.videoUrl ? 1 : 10,
        'zh',
        'beginner',
        book.videoUrl || '',
        book.videoUrl ? 'video' : 'unknown',
        JSON.stringify([book.categoryName, book.subCategoryName].filter(Boolean)),
        0,
      ]
    );
    console.log(`  [OK] ${book.title}`);
  } finally {
    conn.release();
  }
}

async function main() {
  console.log('=== 中少绘本 Scraper ===\n');

  if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

  let totalBooks = 0;
  const target = CATEGORIES.slice(1); // Skip already-scraped first category

  for (const cat of target) {
    // Insert category
    const c = await POOL.getConnection();
    try {
      await c.execute(
        `INSERT IGNORE INTO book_categories (id, name, icon, parentId) VALUES (?, ?, ?, ?)`,
        [cat.id, cat.name, '📚', null]
      );
    } finally { c.release(); }

    const subs = await scrapeSubCategories(cat.id, cat.name);

    // If no subcategories, the category itself contains books directly
    if (subs.length === 0) {
      subs.push({ id: cat.id, name: cat.name, categoryId: cat.id });
    }

    for (const sub of subs) {
      // Insert subcategory
      const c2 = await POOL.getConnection();
      try {
        await c2.execute(
          `INSERT IGNORE INTO book_categories (id, name, icon, parentId) VALUES (?, ?, ?, ?)`,
          [sub.id, sub.name, '📖', cat.id]
        );
      } finally { c2.release(); }

      const books = await scrapeBooksFromSub(sub);

      for (let i = 0; i < books.length; i++) {
        await new Promise(r => setTimeout(r, 200));

        const detail = await scrapeBookDetail(books[i]);
        const idx = `${i + 1}/${books.length}`;
        process.stdout.write(`  [${idx}] ${detail.title.substring(0, 40)}`);

        // Download cover
        if (detail.coverImg && detail.coverImg.startsWith('/')) {
          const ext = path.extname(detail.coverImg).split('?')[0] || '.jpg';
          const dest = path.join(UPLOADS, `${detail.id}${ext}`);
          try {
            const resp = await fetch(`${BASE}${detail.coverImg}`);
            if (resp.ok) {
              fs.writeFileSync(dest, Buffer.from(await resp.arrayBuffer()));
              detail.coverImg = `/uploads/covers/${detail.id}${ext}`;
              process.stdout.write(' [cover]');
            }
          } catch { /* ignore */ }
        }

        await insertIntoDB(detail, sub.id);
        totalBooks++;
      }
    }
  }

  console.log(`\n=== Done: ${totalBooks} books ===`);
  await POOL.end();
}

main().catch(e => { console.error(e); process.exit(1); });
