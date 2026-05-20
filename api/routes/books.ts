import { Router, type Request, type Response } from 'express';
import { queryAll, queryOne, run, safeJsonParse } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.get('/', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      pageSize = '12',
      search,
      categoryId,
      difficulty,
      language,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * pageSizeNum;

    let whereClause = 'WHERE b.isActive = 1';
    const params: unknown[] = [];

    if (search) {
      whereClause += ' AND (b.title LIKE ? OR b.author LIKE ? OR b.tags LIKE ? OR b.isbn LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (categoryId) {
      whereClause += ' AND b.categoryId = ?';
      params.push(categoryId);
    }
    if (difficulty) {
      whereClause += ' AND b.difficulty = ?';
      params.push(difficulty);
    }
    if (language) {
      whereClause += ' AND b.language = ?';
      params.push(language);
    }

    const validSortColumns = ['title', 'author', 'rating', 'readCount', 'createdAt', 'favoriteCount'];
    const sortColumn = validSortColumns.includes(sortBy as string) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const countResult = await queryOne(
      `SELECT COUNT(*) as total FROM books b ${whereClause}`,
      params
    );
    const total = countResult ? (countResult.total as number) : 0;

    const books = await queryAll(
      `SELECT b.*, c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor
       FROM books b
       LEFT JOIN book_categories c ON b.categoryId = c.id
       ${whereClause}
       ORDER BY b.${sortColumn} ${order}
       LIMIT ? OFFSET ?`,
      [...params, pageSizeNum, offset]
    );

    const formattedBooks = books.map(book => ({
      ...book,
      tags: safeJsonParse(book.tags, []),
      category: book.categoryName ? {
        id: book.categoryId,
        name: book.categoryName,
        icon: book.categoryIcon,
        color: book.categoryColor,
      } : null,
    }));

    res.json({
      success: true,
      data: {
        data: formattedBooks,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch books' });
  }
});

router.get('/categories', verifyToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await queryAll(
      `SELECT c.*, COUNT(b.id) as realBookCount
       FROM book_categories c
       LEFT JOIN books b ON b.categoryId = c.id AND b.isActive = 1
       GROUP BY c.id
       ORDER BY c.sortOrder ASC`
    );
    const formatted = categories.map(c => {
      const { realBookCount, ...rest } = c;
      return { ...rest, bookCount: realBookCount };
    });
    res.json({ success: true, data: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

router.get('/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const book = await queryOne(
      `SELECT b.*, c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor
       FROM books b
       LEFT JOIN book_categories c ON b.categoryId = c.id
       WHERE b.id = ?`,
      [req.params.id]
    );

    if (!book) {
      res.status(404).json({ success: false, error: 'Book not found' });
      return;
    }

    const formattedBook = {
      ...book,
      tags: safeJsonParse(book.tags, []),
      category: book.categoryName ? {
        id: book.categoryId,
        name: book.categoryName,
        icon: book.categoryIcon,
        color: book.categoryColor,
      } : null,
    };

    res.json({ success: true, data: formattedBook });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch book' });
  }
});

router.post('/:id/favorite', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const bookId = req.params.id;
    const userId = req.user!.userId;

    const existing = await queryOne('SELECT id FROM favorites WHERE userId = ? AND bookId = ?', [userId, bookId]);
    if (existing) {
      res.status(409).json({ success: false, error: 'Already favorited' });
      return;
    }

    const { v4: uuidv4 } = await import('uuid');
    await run('INSERT INTO favorites (id, userId, bookId) VALUES (?, ?, ?)', [uuidv4(), userId, bookId]);
    await run('UPDATE books SET favoriteCount = favoriteCount + 1 WHERE id = ?', [bookId]);

    res.status(201).json({ success: true, message: 'Book favorited' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to favorite book' });
  }
});

router.delete('/:id/favorite', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const bookId = req.params.id;
    const userId = req.user!.userId;

    const existing = await queryOne('SELECT id FROM favorites WHERE userId = ? AND bookId = ?', [userId, bookId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Favorite not found' });
      return;
    }

    await run('DELETE FROM favorites WHERE userId = ? AND bookId = ?', [userId, bookId]);
    await run('UPDATE books SET favoriteCount = MAX(0, favoriteCount - 1) WHERE id = ?', [bookId]);

    res.json({ success: true, message: 'Favorite removed' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove favorite' });
  }
});

router.get('/:id/recommendations', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const bookId = req.params.id;
    const book = await queryOne('SELECT categoryId FROM books WHERE id = ?', [bookId]);
    if (!book) {
      res.status(404).json({ success: false, error: 'Book not found' });
      return;
    }

    const recommendations = await queryAll(
      `SELECT b.*, c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor
       FROM books b
       LEFT JOIN book_categories c ON b.categoryId = c.id
       WHERE b.categoryId = ? AND b.id != ? AND b.isActive = 1
       ORDER BY b.rating DESC
       LIMIT 6`,
      [book.categoryId, bookId]
    );

    const formatted = recommendations.map(b => ({
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
    res.status(500).json({ success: false, error: 'Failed to fetch recommendations' });
  }
});

export default router;
