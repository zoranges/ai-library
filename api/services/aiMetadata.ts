import type { ScannedBook } from './bookMetadata.js';

const AI_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const AI_BASE_URL = 'https://api.deepseek.com/v1';

async function callAI(messages: Array<{ role: string; content: string }>, temperature = 0.3): Promise<string> {
  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('AI API error:', response.status, errText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export interface AIMetadata {
  title: string;
  author: string;
  description: string;
  categoryName: string;
  language: string;
  difficulty: string;
  publisher: string;
  isbn: string;
  pageCount: number;
  copyright: string;
  publishDate: string;
}

function fallbackMetadata(book: ScannedBook): AIMetadata {
  const nameNoExt = book.fileName.replace(/\.[^.]+$/, '');
  return {
    title: book.extractedMetadata.title || nameNoExt,
    author: book.extractedMetadata.author || '',
    description: '',
    categoryName: book.suggestedCategory || '',
    language: '',
    difficulty: 'intermediate',
    publisher: '',
    isbn: '',
    pageCount: 0,
    copyright: '',
    publishDate: '',
  };
}

function extractJson(content: string): Partial<AIMetadata> | null {
  // Try direct parse first
  try { return JSON.parse(content); } catch {}

  // Try to extract JSON block from markdown
  const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1]); } catch {}
  }

  // Try to find a JSON object in the string
  const objMatch = content.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }

  return null;
}

export async function analyzeBookMetadata(book: ScannedBook): Promise<AIMetadata> {
  const systemPrompt = `You are a professional library cataloging assistant. Given a book's filename and any extracted metadata, generate structured metadata for a children's/education library database.

Rules:
- Output ONLY a valid JSON object, no markdown, no explanation
- All string values should be in the book's original language (or English if unknown)
- Be concise but accurate
- If you cannot determine a field, use an empty string for strings, 0 for numbers`;

  const userPrompt = `Analyze this book and return metadata as JSON:

Filename: ${book.fileName}
Folder/Category: ${book.suggestedCategory || '(none)'}
Extracted title from file: ${book.extractedMetadata.title || '(not found)'}
Extracted author from file: ${book.extractedMetadata.author || '(not found)'}
File format: ${book.format}
File size: ${(book.fileSize / 1024).toFixed(1)} KB

Return JSON:
{
  "title": "Full book title",
  "author": "Author name",
  "description": "2-3 sentence description in the book's language",
  "categoryName": "Best matching category",
  "language": "zh" | "en" | "ms" | "ta" | "",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "publisher": "Publisher name or empty string",
  "isbn": "ISBN if known or empty string",
  "pageCount": 0,
  "copyright": "Copyright info or empty string",
  "publishDate": "YYYY or YYYY-MM-DD or empty string"
}`;

  try {
    const content = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 0.3);

    const parsed = extractJson(content);
    if (parsed) {
      return {
        title: parsed.title || fallbackMetadata(book).title,
        author: parsed.author || '',
        description: parsed.description || '',
        categoryName: parsed.categoryName || book.suggestedCategory || '',
        language: parsed.language || '',
        difficulty: parsed.difficulty || 'intermediate',
        publisher: parsed.publisher || '',
        isbn: parsed.isbn || '',
        pageCount: typeof parsed.pageCount === 'number' ? parsed.pageCount : 0,
        copyright: parsed.copyright || '',
        publishDate: parsed.publishDate || '',
      };
    }

    console.warn('AI returned unparseable content for', book.fileName, ':', content.slice(0, 200));
    return fallbackMetadata(book);
  } catch (err: any) {
    console.error('AI analysis failed for', book.fileName, ':', err.message);
    return fallbackMetadata(book);
  }
}
