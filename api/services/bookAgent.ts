import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { queryAll, queryOne, safeJsonParse } from '../db/database.js';

const AI_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const AI_BASE_URL = 'https://api.deepseek.com/v1';

// ──── Tools ────

const searchBooksTool = tool(
  async ({ query }: { query: string }) => {
    const term = `%${query}%`;
    const books = await queryAll(
      `SELECT b.id, b.title, b.author, b.coverUrl, b.description, b.rating, b.pageCount, b.difficulty, b.readCount,
              c.name as categoryName, c.icon as categoryIcon
       FROM books b
       LEFT JOIN book_categories c ON b.categoryId = c.id
       WHERE b.isActive = 1 AND (b.title LIKE ? OR b.author LIKE ? OR b.description LIKE ? OR b.tags LIKE ?)
       ORDER BY b.rating DESC, b.readCount DESC
       LIMIT 10`,
      [term, term, term, term]
    );
    if (!books || books.length === 0) return '未找到匹配的书籍。';
    return JSON.stringify(books.map((b: any) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      category: b.categoryName || null,
      rating: b.rating || 0,
      pageCount: b.pageCount || 0,
      difficulty: b.difficulty || 'intermediate',
      description: (b.description || '').slice(0, 200),
      readCount: b.readCount || 0,
      coverUrl: b.coverUrl || null,
    })));
  },
  {
    name: 'search_books',
    description: '根据关键词搜索图书馆中的书籍。传入搜索关键词，返回匹配的书籍列表（标题、作者、分类、评分等）。用于用户想找特定主题/类型的书。',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词，例如 "科幻"、"历史"、"小猫"、"Harry Potter" 等' },
      },
      required: ['query'],
    },
  }
);

const getPopularBooksTool = tool(
  async ({ limit }: { limit?: number }) => {
    const count = Math.min(limit || 5, 10);
    const books = await queryAll(
      `SELECT b.id, b.title, b.author, b.coverUrl, b.description, b.rating, b.pageCount, b.difficulty, b.readCount,
              c.name as categoryName
       FROM books b
       LEFT JOIN book_categories c ON b.categoryId = c.id
       WHERE b.isActive = 1
       ORDER BY b.readCount DESC, b.rating DESC
       LIMIT ?`,
      [count]
    );
    return JSON.stringify(books.map((b: any) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      category: b.categoryName || null,
      rating: b.rating || 0,
      pageCount: b.pageCount || 0,
      difficulty: b.difficulty || 'intermediate',
      description: (b.description || '').slice(0, 200),
      readCount: b.readCount || 0,
      coverUrl: b.coverUrl || null,
    })));
  },
  {
    name: 'get_popular_books',
    description: '获取图书馆中最热门的书籍（按阅读量排序）。用于用户想看最受欢迎的书、热门推荐等。',
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回数量，默认5本，最多10本' },
      },
    },
  }
);

const getCategoriesTool = tool(
  async () => {
    const categories = await queryAll(
      'SELECT id, name, icon, color, description FROM book_categories ORDER BY name'
    );
    return JSON.stringify(categories || []);
  },
  {
    name: 'get_categories',
    description: '获取图书馆中所有书籍分类/类别列表。用于用户想知道有哪些类型的书，或按分类浏览。',
  }
);

const getBooksByCategoryTool = tool(
  async ({ categoryName, limit }: { categoryName: string; limit?: number }) => {
    const count = Math.min(limit || 5, 10);
    const books = await queryAll(
      `SELECT b.id, b.title, b.author, b.coverUrl, b.description, b.rating, b.pageCount, b.difficulty, b.readCount,
              c.name as categoryName
       FROM books b
       LEFT JOIN book_categories c ON b.categoryId = c.id
       WHERE b.isActive = 1 AND (c.name LIKE ? OR c.id = ?)
       ORDER BY b.rating DESC, b.readCount DESC
       LIMIT ?`,
      [`%${categoryName}%`, categoryName, count]
    );
    if (!books || books.length === 0) return `未找到分类 "${categoryName}" 中的书籍。`;
    return JSON.stringify(books.map((b: any) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      category: b.categoryName || null,
      rating: b.rating || 0,
      pageCount: b.pageCount || 0,
      difficulty: b.difficulty || 'intermediate',
      description: (b.description || '').slice(0, 200),
      readCount: b.readCount || 0,
      coverUrl: b.coverUrl || null,
    })));
  },
  {
    name: 'get_books_by_category',
    description: '获取特定分类中的书籍。传入分类名称或ID，返回该分类下的书籍列表。用于用户想看某个分类的书。',
    schema: {
      type: 'object',
      properties: {
        categoryName: { type: 'string', description: '分类名称或ID，例如 "科幻"、"历史"、"文学" 等' },
        limit: { type: 'number', description: '返回数量，默认5本，最多10本' },
      },
      required: ['categoryName'],
    },
  }
);

const ALL_TOOLS = [searchBooksTool, getPopularBooksTool, getCategoriesTool, getBooksByCategoryTool];

// ──── System Prompt ────

const AGENT_SYSTEM_PROMPT = `你是一个友好的AI阅读助手小精灵，在图书馆首页帮助用户发现好书。

你的能力：
- 你可以使用工具搜索图书馆中的书籍
- 你可以查看热门书籍
- 你可以浏览书籍分类
- 你可以根据用户兴趣推荐合适的书籍

规则：
1. 当用户表达阅读兴趣时，主动使用工具搜索匹配的书籍
2. 如果没有明确的关键词，先推荐热门书籍或询问用户偏好
3. 根据搜索结果，选2-3本最合适的书进行个性化推荐
4. 每本书的推荐要简短有力（1-2句话），说明为什么适合用户
5. 如果用户问其他问题（非找书），直接用自己的知识回答，无需使用工具
6. 用热情、活泼的语气回复，鼓励用户开始阅读

重要：用户看不到工具返回的原始数据，你必须基于返回结果进行自然语言的推荐。`;

// ──── Agent ────

interface AgentResult {
  message: string;
  books: Array<{
    id: string;
    title: string;
    author: string;
    coverUrl: string | null;
    description: string;
    rating: number;
    pageCount: number;
    difficulty: string;
    category: { name: string } | null;
  }>;
}

export async function runBookAgent(userMessage: string): Promise<AgentResult> {
  const model = new ChatOpenAI({
    modelName: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 2048,
    configuration: {
      baseURL: AI_BASE_URL,
      apiKey: AI_API_KEY,
    },
  });

  const modelWithTools = model.bindTools(ALL_TOOLS);

  const messages: Array<{ role: string; content: string; tool_calls?: any; tool_call_id?: string }> = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  const MAX_ITERATIONS = 5;
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const response = await modelWithTools.invoke(messages as any);

    // Check if model wants to call tools
    const toolCalls = (response as any).tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: response.content as string || '',
        tool_calls: toolCalls,
      } as any);

      // Execute each tool call
      for (const tc of toolCalls) {
        const toolName = tc.name;
        const toolArgs = tc.args || {};

        let toolResult: string;
        try {
          const targetTool = ALL_TOOLS.find(t => t.name === toolName);
          if (targetTool) {
            toolResult = await (targetTool as any).invoke(toolArgs);
          } else {
            toolResult = `Error: Unknown tool "${toolName}"`;
          }
        } catch (err: any) {
          toolResult = `Error: ${err.message || 'Tool execution failed'}`;
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolResult,
        } as any);
      }
    } else {
      // Final response
      const finalContent = response.content as string || '';

      // Parse the last tool result for books
      let books: any[] = [];
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i] as any;
        if (msg.role === 'tool' && msg.content) {
          try {
            const parsed = JSON.parse(msg.content);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
              books = parsed;
              break;
            }
          } catch { /* not JSON or not book array */ }
        }
      }

      // Deduplicate books by id
      const seen = new Set<string>();
      const uniqueBooks = books.filter((b: any) => {
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      });

      return {
        message: finalContent,
        books: uniqueBooks.slice(0, 5).map((b: any) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          coverUrl: b.coverUrl || null,
          description: b.description || '',
          rating: b.rating || 0,
          pageCount: b.pageCount || 0,
          difficulty: b.difficulty || 'intermediate',
          category: b.category ? { name: b.category } : null,
        })),
      };
    }
  }

  // Max iterations reached - get final response
  const finalResponse = await modelWithTools.invoke(messages as any);
  return {
    message: finalResponse.content as string || '抱歉，我在查找书籍时遇到了一些困难。请尝试使用其他关键词。',
    books: [],
  };
}
