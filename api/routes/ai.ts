import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run, safeJsonParse } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';
import { checkAndUnlockAchievements } from '../services/achievementChecker.js';
import { runBookAgent } from '../services/bookAgent.js';
import { awardAiInteraction, awardBookCompletionWithQuiz } from '../services/pointsService.js';

const router = Router();

const AI_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const AI_BASE_URL = 'https://api.deepseek.com/v1';

async function getAIModel(): Promise<string> {
  try {
    const config = await queryOne("SELECT model FROM ai_config WHERE `key` = 'default_model'");
    if (config?.model) return config.model as string;
  } catch {
    // fallback to default
  }
  return 'deepseek-chat';
}

const SYSTEM_PROMPT = `你是一个专业的AI阅读助手，帮助用户理解书籍内容。你的能力包括：
1. 解释书中的段落、概念和难懂内容
2. 定义生词和术语，提供音标、词性、释义、例句、同义词
3. 翻译文本（中英互译）
4. 回答关于书籍的问题
5. 生成阅读理解测验题
6. 根据用户兴趣推荐书籍——当用户想找书时，你会收到相关书籍列表，请根据列表为用户做个性化推荐

请用清晰、准确、友好的方式回答。如果涉及书籍内容，请结合上下文给出深入分析。
推荐书籍时，简要介绍每本书的亮点和推荐理由，引导用户点击查看详情。`;

const HOMEPAGE_PROMPT = `你是一个友好的AI阅读助手小精灵，在图书馆首页帮助用户发现好书。你的特点：
- 热情、活泼、鼓励用户阅读
- 当用户表达阅读兴趣（如想看某类书、某个主题），你会收到匹配的书籍列表
- 根据匹配的书籍，个性化推荐2-3本最合适的，简要说明每本书为什么适合用户
- 如果没有完全匹配的书，诚实地告诉用户并建议尝试其他关键词
- 回答简短精炼，每本书推荐不超过2句话`;

async function callAI(messages: Array<{ role: string; content: string }>, options?: { temperature?: number; max_tokens?: number }): Promise<string> {
  const model = await getAIModel();

  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 2048,
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

const STOP_WORDS = new Set([
  '我', '想', '要', '看', '读', '找', '有', '没有', '什么', '一本', '一些', '关于',
  '的', '吗', '呢', '吧', '啊', '哦', '嗯', '可以', '能', '帮', '推荐', '介绍',
  'the', 'a', 'an', 'i', 'want', 'to', 'read', 'find', 'book', 'books', 'about',
  'for', 'me', 'can', 'you', 'please', 'help', 'recommend', 'some', 'any', 'is', 'are',
]);

function extractKeywords(message: string): string[] {
  // Split by common separators
  const tokens = message
    .replace(/[，。！？、；：""''（）【】《》\s,.!?;:'"()\[\]{}]+/g, ' ')
    .split(' ')
    .map(t => t.trim())
    .filter(t => t.length >= 1 && !STOP_WORDS.has(t.toLowerCase()));

  // Deduplicate, preserve order
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of tokens) {
    const lower = t.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(t);
    }
  }
  return result.slice(0, 8);
}

async function searchBooks(keywords: string[]): Promise<any[]> {
  if (!keywords.length) return [];

  const conditions = keywords.map(() => '(b.title LIKE ? OR b.author LIKE ? OR b.description LIKE ? OR b.tags LIKE ?)');
  const sql = `SELECT b.id, b.title, b.author, b.coverUrl, b.description, b.rating, b.pageCount, b.difficulty,
                      c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor
               FROM books b
               LEFT JOIN book_categories c ON b.categoryId = c.id
               WHERE b.isActive = 1 AND (${conditions.join(' OR ')})
               ORDER BY b.rating DESC, b.readCount DESC
               LIMIT 10`;

  const params: string[] = [];
  for (const kw of keywords) {
    const term = `%${kw}%`;
    params.push(term, term, term, term);
  }

  try {
    const books = await queryAll(sql, params);
    return (books || []).map((b: any) => ({
      ...b,
      tags: safeJsonParse(b.tags, []),
      category: b.categoryName ? {
        id: b.categoryId,
        name: b.categoryName,
        icon: b.categoryIcon,
        color: b.categoryColor,
      } : null,
    }));
  } catch {
    return [];
  }
}

function formatBooksForPrompt(books: any[]): string {
  return books.map((b, i) =>
    `${i + 1}. 《${b.title}》 — ${b.author} | 分类: ${b.category?.name || '未分类'} | 难度: ${b.difficulty} | 评分: ${b.rating || '暂无'} | ${b.description ? b.description.slice(0, 120) : ''}`
  ).join('\n');
}
router.post('/chat', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { message, bookId, page, pageText } = req.body;

    if (!message) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    let contextInfo = '';
    let matchedBooks: any[] = [];

    if (bookId) {
      const book = await queryOne('SELECT title, author, description FROM books WHERE id = ?', [bookId]);
      if (book) {
        contextInfo = `\n\n当前阅读的书籍信息：\n书名：《${book.title}》\n作者：${book.author}\n简介：${book.description}`;
        if (page) contextInfo += `\n当前页码：第${page}页`;
      }
    } else {
      // Homepage / no book context: use LangChain ReAct agent for smart book discovery
      try {
        const agentResult = await runBookAgent(message);
        awardAiInteraction(userId);
        res.json({
          success: true,
          data: {
            id: uuidv4(),
            role: 'assistant',
            content: agentResult.message,
            timestamp: new Date().toISOString(),
            metadata: {
              bookId: null,
              page: null,
              type: 'chat',
              books: agentResult.books,
            },
          },
        });
        return;
      } catch (agentErr: any) {
        console.error('Book agent error, falling back to keyword search:', agentErr.message);
        // Fallback to keyword search
        const keywords = extractKeywords(message);
        if (keywords.length > 0) {
          matchedBooks = await searchBooks(keywords);
          if (matchedBooks.length > 0) {
            contextInfo = `\n\n## 以下是图书馆中与用户查询匹配的书籍（请根据此列表推荐）：\n${formatBooksForPrompt(matchedBooks)}`;
          } else {
            contextInfo = '\n\n（用户正在图书馆首页寻找书籍，但目前数据库中未找到匹配的结果。请友好地建议用户尝试其他关键词，或推荐一些热门分类。）';
          }
        } else {
          contextInfo = '\n\n（用户正在图书馆首页。如果用户询问书籍推荐但没有明确关键词，请询问他们的兴趣或推荐几个热门分类。）';
        }
      }
    }

    if (pageText && pageText.trim()) {
      contextInfo += `\n\n当前页面的文本内容：\n${pageText}`;
    }

    const systemPrompt = bookId ? SYSTEM_PROMPT + contextInfo : HOMEPAGE_PROMPT + contextInfo;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    const reply = await callAI(messages);

    const respData: any = {
      id: uuidv4(),
      role: 'assistant',
      content: reply,
      timestamp: new Date().toISOString(),
      metadata: {
        bookId: bookId || null,
        page: page || null,
        type: 'chat',
      },
    };

    if (matchedBooks.length > 0) {
      respData.metadata.books = matchedBooks.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        coverUrl: b.coverUrl,
        description: b.description,
        rating: b.rating,
        pageCount: b.pageCount,
        difficulty: b.difficulty,
        category: b.category,
      }));
    }

    awardAiInteraction(userId);

    res.json({
      success: true,
      data: respData,
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ success: false, error: 'AI chat failed' });
  }
});

router.post('/explain', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, bookId, page } = req.body;

    if (!text) {
      res.status(400).json({ success: false, error: 'Text to explain is required' });
      return;
    }

    let bookContext = '';
    if (bookId) {
      const book = await queryOne('SELECT title, author FROM books WHERE id = ?', [bookId]);
      if (book) {
        bookContext = `\n当前阅读的书籍：《${book.title}》（${book.author}著）`;
        if (page) bookContext += `，第${page}页`;
      }
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + bookContext },
      { role: 'user', content: `请详细解释以下文本的含义，从字面意思、深层含义、写作手法、与全文联系等角度分析：\n\n"${text}"` },
    ];

    const explanation = await callAI(messages);

    res.json({
      success: true,
      data: {
        explanation,
        text,
        bookId: bookId || null,
        page: page || null,
      },
    });
  } catch (error) {
    console.error('AI explain error:', error);
    res.status(500).json({ success: false, error: 'AI explain failed' });
  }
});

router.post('/define', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { word, bookId } = req.body;

    if (!word) {
      res.status(400).json({ error: 'Word is required' });
      return;
    }

    let bookContext = '';
    if (bookId) {
      const book = await queryOne('SELECT title, author FROM books WHERE id = ?', [bookId]);
      if (book) {
        bookContext = `\n当前阅读的书籍：《${book.title}》（${book.author}著）`;
      }
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + bookContext },
      { role: 'user', content: `请定义以下词语/术语，提供音标（英文词）或拼音（中文词）、词性、所有释义（含例句）、同义词和反义词。请用JSON格式返回：\n\n"${word}"\n\n返回格式示例：\n{"word":"...","phonetic":"...","pinyin":"...","partOfSpeech":"...","definitions":[{"meaning":"...","example":"..."}],"synonyms":["..."],"antonyms":["..."]}` },
    ];

    const result = await callAI(messages, { temperature: 0.3 });

    let definition;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      definition = jsonMatch ? JSON.parse(jsonMatch[0]) : { word, definitions: [{ meaning: result }] };
    } catch {
      definition = { word, definitions: [{ meaning: result }] };
    }

    res.json({
      success: true,
      data: definition,
    });
  } catch (error) {
    console.error('AI define error:', error);
    res.status(500).json({ success: false, error: 'AI define failed' });
  }
});

router.post('/translate', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, bookId, page } = req.body;

    if (!text) {
      res.status(400).json({ success: false, error: 'Text is required' });
      return;
    }

    let bookContext = '';
    if (bookId) {
      const book = await queryOne('SELECT title, author FROM books WHERE id = ?', [bookId]);
      if (book) {
        bookContext = `\n当前阅读的书籍：《${book.title}》（${book.author}著）`;
      }
    }

    const isEnglish = /^[a-zA-Z]/.test(text.trim());
    const targetLang = isEnglish ? '中文' : '英文';

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + bookContext },
      { role: 'user', content: `请将以下文本翻译成${targetLang}，要求翻译准确、流畅、自然，保留原文的风格和语气：\n\n"${text}"` },
    ];

    const translatedText = await callAI(messages, { temperature: 0.3 });

    res.json({
      success: true,
      data: {
        originalText: text,
        translatedText,
        from: isEnglish ? 'en' : 'zh',
        to: isEnglish ? 'zh' : 'en',
      },
    });
  } catch (error) {
    console.error('AI translate error:', error);
    res.status(500).json({ success: false, error: 'AI translate failed' });
  }
});

function getQuizPrompt(language: string, difficulty: string | undefined, title: string, author: string, description: string, count: number) {
  const diffLabels: Record<string, [string, string, string]> = {
    ms: ['Mudah', 'Sederhana', 'Sukar'],
    en: ['Easy', 'Medium', 'Hard'],
    zh: ['简单', '中等', '困难'],
  };

  const idx = difficulty === 'easy' ? 0 : difficulty === 'hard' ? 2 : 1;

  // Match language by prefix
  const langKey = Object.keys(diffLabels).find(k => language.toLowerCase().startsWith(k)) || 'en';
  const label = diffLabels[langKey][idx];

  const prompts: Record<string, string> = {
    ms: `Sila hasilkan ${count} soalan pemahaman bacaan aneka pilihan bertahap "${label}" untuk buku "${title}" (karya ${author}).\n\nSinopsis buku: ${description}\n\nSila berikan jawapan dalam format JSON seperti berikut:\n{"questions":[{"question":"Soalan","options":["Pilihan A","Pilihan B","Pilihan C","Pilihan D"],"correctAnswer":0,"explanation":"Penjelasan"}]}\n\nSyarat:\n1. Setiap soalan ada 4 pilihan, correctAnswer adalah indeks jawapan betul (0-3)\n2. Soalan harus merangkumi tema, watak, plot dan teknik penulisan buku\n3. Penjelasan harus terperinci`,
    en: `Generate ${count} multiple-choice reading comprehension questions at "${label}" difficulty for the book "${title}" by ${author}.\n\nBook description: ${description}\n\nReturn the result in JSON format:\n{"questions":[{"question":"Question text","options":["Option A","Option B","Option C","Option D"],"correctAnswer":0,"explanation":"Explanation"}]}\n\nRequirements:\n1. Each question has 4 options, correctAnswer is the index of the correct answer (0-3)\n2. Questions should cover themes, characters, plot, and writing techniques\n3. Explanations should be detailed`,
    zh: `请为《${title}》（${author}著）生成${count}道"${label}"难度的阅读理解选择题。\n\n书籍简介：${description}\n\n请用JSON格式返回，格式如下：\n{"questions":[{"question":"题目","options":["选项A","选项B","选项C","选项D"],"correctAnswer":0,"explanation":"解析"}]}\n\n要求：\n1. 每题4个选项，correctAnswer为正确选项的索引（0-3）\n2. 题目应涵盖书籍的主题、人物、情节、写作手法等方面\n3. 解析要详细`,
  };

  return { prompt: prompts[langKey] || prompts.en, diffLabel: label };
}

router.post('/quiz/generate', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookId, count = 5, difficulty } = req.body;

    if (!bookId) {
      res.status(400).json({ success: false, error: 'bookId is required' });
      return;
    }

    const book = await queryOne('SELECT title, author, description, language FROM books WHERE id = ?', [bookId]);
    if (!book) {
      res.status(404).json({ success: false, error: 'Book not found' });
      return;
    }

    const numQuestions = Math.min(10, Math.max(1, count));
    const bookLang = (book.language as string) || 'zh';
    const { prompt: quizPrompt, diffLabel: diffText } = getQuizPrompt(bookLang, difficulty, book.title as string, book.author as string, book.description as string, numQuestions);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: quizPrompt },
    ];

    const result = await callAI(messages, { temperature: 0.5 });

    let quizData;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      quizData = jsonMatch ? JSON.parse(jsonMatch[0]) : { questions: [] };
    } catch {
      quizData = { questions: [] };
    }

    const quizId = uuidv4();
    const questions = (quizData.questions || []).slice(0, numQuestions).map((q: any, i: number) => ({
      id: uuidv4(),
      quizId,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      order: i + 1,
    }));

    res.json({
      success: true,
      data: {
        quizId,
        bookId,
        bookTitle: book.title,
        questions,
        totalQuestions: questions.length,
      },
    });
  } catch (error) {
    console.error('Quiz generation error:', error);
    res.status(500).json({ success: false, error: 'Quiz generation failed' });
  }
});

router.post('/quiz/submit', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookId, answers, questions, timeSpent } = req.body;

    if (!bookId || !answers || !Array.isArray(answers) || !questions || !Array.isArray(questions)) {
      res.status(400).json({ success: false, error: 'bookId, answers array, and questions array are required' });
      return;
    }

    const userId = req.user!.userId;

    // Deduplication: check if quiz already completed for this user+book
    const existingResult = await queryOne(
      'SELECT id FROM quiz_results WHERE userId = ? AND bookId = ?',
      [userId, bookId]
    );
    if (existingResult) {
      res.status(400).json({ success: false, error: 'Quiz already completed for this book' });
      return;
    }

    const totalQuestions = questions.length;
    const correctCount = answers.filter(
      (a: number, i: number) => a === questions[i].correctAnswer
    ).length;
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    // Points: +15 for completing book + answering quiz
    let pointsEarned = 0;

    const resultId = uuidv4();

    await run(
      'INSERT INTO quiz_results (id, userId, bookId, score, totalQuestions, correctAnswers, timeSpent, answers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [resultId, userId, bookId, score, totalQuestions, correctCount, timeSpent || 0, JSON.stringify(answers)]
    );

    const awardedCompletion = await awardBookCompletionWithQuiz(userId, bookId);
    if (awardedCompletion) pointsEarned = 15;
    // Check achievements
    checkAndUnlockAchievements(userId).then(r => {
      if (r.unlocked.length > 0) console.log(`User ${userId} unlocked: ${r.unlocked.join(', ')}`);
    });

    res.json({
      success: true,
      data: {
        id: resultId,
        userId,
        bookId,
        score,
        totalQuestions,
        correctAnswers: correctCount,
        timeSpent: timeSpent || 0,
        answers,
        pointsEarned,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Quiz submission failed' });
  }
});

router.get('/quiz/results', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { bookId } = req.query;

    let sql = `SELECT qr.*, b.title as bookTitle, b.author as bookAuthor
               FROM quiz_results qr
               JOIN books b ON qr.bookId = b.id
               WHERE qr.userId = ?`;
    const params: unknown[] = [userId];

    if (bookId) {
      sql += ' AND qr.bookId = ?';
      params.push(bookId);
    }

    sql += ' ORDER BY qr.completedAt DESC';
    const results = await queryAll(sql, params);

    const formatted = results.map(r => ({
      ...r,
      answers: safeJsonParse(r.answers, []),
      book: {
        id: r.bookId,
        title: r.bookTitle,
        author: r.bookAuthor,
      },
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch quiz results' });
  }
});

router.post('/search', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { query: searchQuery, filters } = req.body;

    if (!searchQuery) {
      res.status(400).json({ success: false, error: 'Search query is required' });
      return;
    }

    let sql = `SELECT b.*, c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor
               FROM books b
               LEFT JOIN book_categories c ON b.categoryId = c.id
               WHERE b.isActive = 1 AND (b.title LIKE ? OR b.author LIKE ? OR b.tags LIKE ? OR b.description LIKE ?)`;
    const searchTerm = `%${searchQuery}%`;
    const params: unknown[] = [searchTerm, searchTerm, searchTerm, searchTerm];

    if (filters?.categoryId) {
      sql += ' AND b.categoryId = ?';
      params.push(filters.categoryId);
    }
    if (filters?.difficulty) {
      sql += ' AND b.difficulty = ?';
      params.push(filters.difficulty);
    }
    if (filters?.language) {
      sql += ' AND b.language = ?';
      params.push(filters.language);
    }

    sql += ' ORDER BY b.rating DESC LIMIT 20';
    const books = await queryAll(sql, params);

    const formatted = books.map(b => ({
      ...b,
      tags: safeJsonParse(b.tags, []),
      category: b.categoryName ? {
        id: b.categoryId,
        name: b.categoryName,
        icon: b.categoryIcon,
        color: b.categoryColor,
      } : null,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: 'AI search failed' });
  }
});

router.post('/search-document', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookId, query } = req.body;
    if (!bookId || !query) {
      res.status(400).json({ success: false, error: 'bookId and query are required' });
      return;
    }

    const book = await queryOne('SELECT title, textContent FROM books WHERE id = ?', [bookId]);
    if (!book || !book.textContent) {
      res.json({ success: true, data: { results: [] } });
      return;
    }

    const textContent = book.textContent as string;
    const pages = textContent.split(/\f/);
    const results: Array<{ page: number; text: string; context: string }> = [];
    const searchLower = query.toLowerCase();

    for (let i = 0; i < pages.length; i++) {
      const pageText = pages[i];
      if (!pageText) continue;
      const lowerPage = pageText.toLowerCase();
      let idx = 0;
      while ((idx = lowerPage.indexOf(searchLower, idx)) !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(pageText.length, idx + query.length + 40);
        const context = (start > 0 ? '...' : '') + pageText.substring(start, end).trim() + (end < pageText.length ? '...' : '');
        results.push({
          page: i + 1,
          text: pageText.substring(idx, idx + query.length),
          context,
        });
        idx += query.length;
        if (results.length >= 50) break;
      }
      if (results.length >= 50) break;
    }

    res.json({ success: true, data: { results } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Document search failed' });
  }
});

export default router;
