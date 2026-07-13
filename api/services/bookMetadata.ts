import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';

export interface ScannedBook {
  id: string;
  fileName: string;
  format: string;
  filePath: string;
  coverFileName: string | null;
  coverPath: string | null;
  suggestedCategory: string;
  extractedMetadata: {
    title?: string;
    author?: string;
    language?: string;
  };
  fileSize: number;
}

const BOOK_EXTENSIONS = ['.epub', '.pdf', '.mobi', '.txt'];
const COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

function isBookFile(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return BOOK_EXTENSIONS.includes(ext);
}

function isCoverFile(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return COVER_EXTENSIONS.includes(ext);
}

function getFormat(name: string): string {
  return path.extname(name).toLowerCase().replace('.', '');
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

export function extractEpubMetadata(zipBuffer: Buffer): { title?: string; author?: string } {
  try {
    const epub = new AdmZip(zipBuffer);
    const containerEntry = epub.getEntry('META-INF/container.xml');
    if (!containerEntry) return {};

    const containerXml = containerEntry.getData().toString('utf-8');
    const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!rootfileMatch) return {};

    const opfPath = rootfileMatch[1];
    const opfEntry = epub.getEntry(opfPath);
    if (!opfEntry) return {};

    const opfXml = opfEntry.getData().toString('utf-8');

    const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
    const creatorMatch = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);

    return {
      title: titleMatch?.[1]?.trim(),
      author: creatorMatch?.[1]?.trim(),
    };
  } catch {
    return {};
  }
}

export function extractAndScan(zipBuffer: Buffer): { books: ScannedBook[]; errors: string[] } {
  const errors: string[] = [];
  let zip: AdmZip;

  try {
    zip = new AdmZip(zipBuffer);
  } catch (err: any) {
    return { books: [], errors: [`Failed to open ZIP: ${err.message}`] };
  }

  const entries = zip.getEntries();
  if (entries.length === 0) {
    return { books: [], errors: ['ZIP file is empty'] };
  }

  // Group entries by directory
  const dirMap = new Map<string, { books: AdmZip.IZipEntry[]; covers: AdmZip.IZipEntry[] }>();
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName;
    const dir = path.dirname(name);
    const base = path.basename(name);

    if (!dirMap.has(dir)) {
      dirMap.set(dir, { books: [], covers: [] });
    }

    const group = dirMap.get(dir)!;
    if (isBookFile(base)) {
      group.books.push(entry);
    } else if (isCoverFile(base)) {
      group.covers.push(entry);
    }
  }

  const books: ScannedBook[] = [];

  for (const [dir, group] of dirMap) {
    if (group.books.length === 0) continue;

    const categoryName = dir === '.' ? '' : path.basename(dir);

    for (const bookEntry of group.books) {
      const bookBase = path.basename(bookEntry.entryName);
      const bookNameNoExt = stripExt(bookBase);
      const bookData = bookEntry.getData();

      // Match cover: strategy 1 - same name
      let coverEntry: AdmZip.IZipEntry | null = null;

      for (const cover of group.covers) {
        const coverBase = path.basename(cover.entryName);
        const coverNameNoExt = stripExt(coverBase);

        if (coverNameNoExt.toLowerCase() === bookNameNoExt.toLowerCase()) {
          coverEntry = cover;
          break;
        }
      }

      // Strategy 2 - "cover" prefixed or first image
      if (!coverEntry && group.covers.length > 0) {
        coverEntry = group.covers.find(c =>
          /^cover/i.test(stripExt(path.basename(c.entryName)))
        ) || group.covers[0];
      }

      // Extract epub metadata
      let extractedMetadata: { title?: string; author?: string } = {};
      if (bookBase.toLowerCase().endsWith('.epub')) {
        extractedMetadata = extractEpubMetadata(bookData);
      }

      books.push({
        id: uuidv4(),
        fileName: bookBase,
        format: getFormat(bookBase),
        filePath: bookEntry.entryName,
        coverFileName: coverEntry ? path.basename(coverEntry.entryName) : null,
        coverPath: coverEntry ? coverEntry.entryName : null,
        suggestedCategory: categoryName,
        extractedMetadata,
        fileSize: bookEntry.header.size,
      });
    }
  }

  if (books.length === 0) {
    errors.push('No supported book files (.epub, .pdf, .mobi, .txt) found in the ZIP');
  }

  return { books, errors };
}

export function getBookBuffer(zipBuffer: Buffer, entryPath: string): Buffer | null {
  try {
    const zip = new AdmZip(zipBuffer);
    const entry = zip.getEntry(entryPath);
    return entry ? entry.getData() : null;
  } catch {
    return null;
  }
}

export function generateCoverFromBook(bookPath: string, outputPath: string): string | null {
  const ext = path.extname(bookPath).toLowerCase();

  if (ext === '.pdf') {
    return generateCoverFromPdf(bookPath, outputPath);
  }
  if (ext === '.epub') {
    return generateCoverFromEpub(bookPath, outputPath);
  }
  return null;
}

/**
 * Generate a cover image from a book Buffer (for in-memory upload flows).
 * Writes to a temp file, calls generateCoverFromBook, reads result back as Buffer.
 */
export function generateCoverFromBookBuffer(
  bookBuffer: Buffer,
  bookFormat: 'pdf' | 'epub',
): Buffer | null {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cover-gen-'));
  const tmpBookPath = path.join(tmpDir, `book.${bookFormat}`);
  const outPath = path.join(tmpDir, 'cover.jpg');
  try {
    fs.writeFileSync(tmpBookPath, bookBuffer);
    const result = generateCoverFromBook(tmpBookPath, outPath);
    if (result && fs.existsSync(outPath)) {
      return fs.readFileSync(outPath);
    }
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function generateCoverFromPdf(bookPath: string, outputPath: string): string | null {
  try {
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    const prefix = path.basename(outputPath, path.extname(outputPath));
    execSync(
      `pdftoppm -f 1 -l 1 -jpeg -scale-to 800 -singlefile "${bookPath}" "${path.join(outputDir, prefix)}"`,
      { timeout: 30000 }
    );

    const expectedOutput = path.join(outputDir, `${prefix}.jpg`);
    if (fs.existsSync(expectedOutput)) {
      if (expectedOutput !== outputPath) {
        fs.renameSync(expectedOutput, outputPath);
      }
      return outputPath;
    }

    const altOutput = path.join(outputDir, `${prefix}-1.jpg`);
    if (fs.existsSync(altOutput)) {
      fs.renameSync(altOutput, outputPath);
      return outputPath;
    }

    return null;
  } catch {
    return null;
  }
}

function generateCoverFromEpub(bookPath: string, outputPath: string): string | null {
  try {
    const epub = new AdmZip(bookPath);

    const containerEntry = epub.getEntry('META-INF/container.xml');
    if (!containerEntry) return null;
    const containerXml = containerEntry.getData().toString('utf-8');
    const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!rootfileMatch) return null;

    const opfPath = rootfileMatch[1];
    const opfEntry = epub.getEntry(opfPath);
    if (!opfEntry) return null;
    const opfXml = opfEntry.getData().toString('utf-8');

    const opfDir = path.dirname(opfPath);

    // Strategy 1: Find cover via <meta name="cover" content="id"/>
    const coverIdMatch = opfXml.match(/<meta\s[^>]*name="cover"[^>]*content="([^"]+)"[^>]*\/?>/i);
    if (coverIdMatch) {
      const coverId = coverIdMatch[1];
      const itemRegex = new RegExp(
        `<item\\s[^>]*id="${coverId}"[^>]*href="([^"]+)"[^>]*\\/?>` +
        '|<item\\s[^>]*href="([^"]+)"[^>]*id="' + coverId + '"[^>]*\\/?>',
        'i'
      );
      const itemMatch = opfXml.match(itemRegex);
      if (itemMatch) {
        const href = (itemMatch[1] || itemMatch[2]).replace(/%20/g, ' ');
        const imagePath = path.normalize(path.join(opfDir, href));
        const imgEntry = epub.getEntry(imagePath);
        if (imgEntry) {
          const imgData = imgEntry.getData();
          const outputDir = path.dirname(outputPath);
          fs.mkdirSync(outputDir, { recursive: true });
          fs.writeFileSync(outputPath, imgData);
          return outputPath;
        }
      }
    }

    // Strategy 2: Find first image in OPF manifest
    const itemRegex = /<item\s[^>]*href="([^"]+)"[^>]*media-type="image\/(?:jpeg|png|jpg|webp)"[^>]*\/?>/gi;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(opfXml)) !== null) {
      const href = itemMatch[1].replace(/%20/g, ' ');
      const imagePath = path.normalize(path.join(opfDir, href));
      const imgEntry = epub.getEntry(imagePath);
      if (imgEntry) {
        const imgData = imgEntry.getData();
        const outputDir = path.dirname(outputPath);
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(outputPath, imgData);
        return outputPath;
      }
    }

    return null;
  } catch {
    return null;
  }
}
