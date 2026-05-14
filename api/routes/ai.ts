import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

const DEEPSEEK_API_KEY = 'sk-49e43c667ec943878a7b9b75c61b3284';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_MODEL = 'deepseek-v4-pro';

const SYSTEM_PROMPT = `你是一个专业的AI阅读助手，帮助用户理解书籍内容。你的能力包括：
1. 解释书中的段落、概念和难懂内容
2. 定义生词和术语，提供音标、词性、释义、例句、同义词
3. 翻译文本（中英互译）
4. 回答关于书籍的问题
5. 生成阅读理解测验题

请用清晰、准确、友好的方式回答。如果涉及书籍内容，请结合上下文给出深入分析。`;

async function callDeepSeek(messages: Array<{ role: string; content: string }>, options?: { temperature?: number; max_tokens?: number }): Promise<string> {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 2048,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('DeepSeek API error:', response.status, errText);
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

router.post('/chat', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, bookId, page, pageText } = req.body;

    if (!message) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    let contextInfo = '';
    if (bookId) {
      const book = queryOne('SELECT title, author, description FROM books WHERE id = ?', [bookId]);
      if (book) {
        contextInfo = `\n\n当前阅读的书籍信息：\n书名：《${book.title}》\n作者：${book.author}\n简介：${book.description}`;
        if (page) contextInfo += `\n当前页码：第${page}页`;
      }
    }

    if (pageText && pageText.trim()) {
      contextInfo += `\n\n当前页面的文本内容：\n${pageText}`;
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + contextInfo },
      { role: 'user', content: message },
    ];

    const reply = await callDeepSeek(messages);

    res.json({
      success: true,
      data: {
        id: uuidv4(),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
        metadata: {
          bookId: bookId || null,
          page: page || null,
          type: 'chat',
        },
      },
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
      const book = queryOne('SELECT title, author FROM books WHERE id = ?', [bookId]);
      if (book) {
        bookContext = `\n当前阅读的书籍：《${book.title}》（${book.author}著）`;
        if (page) bookContext += `，第${page}页`;
      }
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + bookContext },
      { role: 'user', content: `请详细解释以下文本的含义，从字面意思、深层含义、写作手法、与全文联系等角度分析：\n\n"${text}"` },
    ];

    const explanation = await callDeepSeek(messages);

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
      const book = queryOne('SELECT title, author FROM books WHERE id = ?', [bookId]);
      if (book) {
        bookContext = `\n当前阅读的书籍：《${book.title}》（${book.author}著）`;
      }
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + bookContext },
      { role: 'user', content: `请定义以下词语/术语，提供音标（英文词）或拼音（中文词）、词性、所有释义（含例句）、同义词和反义词。请用JSON格式返回：\n\n"${word}"\n\n返回格式示例：\n{"word":"...","phonetic":"...","pinyin":"...","partOfSpeech":"...","definitions":[{"meaning":"...","example":"..."}],"synonyms":["..."],"antonyms":["..."]}` },
    ];

    const result = await callDeepSeek(messages, { temperature: 0.3 });

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
      const book = queryOne('SELECT title, author FROM books WHERE id = ?', [bookId]);
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

    const translatedText = await callDeepSeek(messages, { temperature: 0.3 });

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

router.post('/quiz/generate', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { bookId, count = 5, difficulty } = req.body;

    if (!bookId) {
      res.status(400).json({ success: false, error: 'bookId is required' });
      return;
    }

    const book = queryOne('SELECT title, author, description FROM books WHERE id = ?', [bookId]);
    if (!book) {
      res.status(404).json({ success: false, error: 'Book not found' });
      return;
    }

    const numQuestions = Math.min(10, Math.max(1, count));
    const diffLabel = difficulty === 'easy' ? '简单' : difficulty === 'hard' ? '困难' : '中等';

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `请为《${book.title}》（${book.author}著）生成${numQuestions}道${diffLabel}难度的阅读理解选择题。\n\n书籍简介：${book.description}\n\n请用JSON格式返回，格式如下：\n{"questions":[{"question":"题目","options":["选项A","选项B","选项C","选项D"],"correctAnswer":0,"explanation":"解析"}]}\n\n要求：\n1. 每题4个选项，correctAnswer为正确选项的索引（0-3）\n2. 题目应涵盖书籍的主题、人物、情节、写作手法等方面\n3. 解析要详细` },
    ];

    const result = await callDeepSeek(messages, { temperature: 0.5 });

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
    const { bookId, answers, timeSpent } = req.body;

    if (!bookId || !answers || !Array.isArray(answers)) {
      res.status(400).json({ success: false, error: 'bookId and answers array are required' });
      return;
    }

    const correctAnswers = answers.filter((a: number) => a === 0 || a === 1 || a === 2).length;
    const totalQuestions = answers.length;
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

    const userId = req.user!.userId;
    const resultId = uuidv4();

    run(
      'INSERT INTO quiz_results (id, userId, bookId, score, totalQuestions, correctAnswers, timeSpent, answers) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [resultId, userId, bookId, score, totalQuestions, correctAnswers, timeSpent || 0, JSON.stringify(answers)]
    );

    const pointsEarned = Math.floor(score / 10) * 2;
    if (pointsEarned > 0) {
      run('UPDATE users SET points = points + ? WHERE id = ?', [pointsEarned, userId]);
      run(
        'INSERT INTO points (id, userId, points, type, description, referenceId) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, pointsEarned, 'quiz', `Quiz completed with score ${score}%`, resultId]
      );
    }

    res.json({
      success: true,
      data: {
        id: resultId,
        userId,
        bookId,
        score,
        totalQuestions,
        correctAnswers,
        timeSpent: timeSpent || 0,
        answers,
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
    const results = queryAll(sql, params);

    const formatted = results.map(r => ({
      ...r,
      answers: JSON.parse((r.answers as string) || '[]'),
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
    const books = queryAll(sql, params);

    const formatted = books.map(b => ({
      ...b,
      tags: JSON.parse((b.tags as string) || '[]'),
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

export default router;
