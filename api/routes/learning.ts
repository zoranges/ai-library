import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';
import { awardHighlightOrNote } from '../services/pointsService.js';

const router = Router();

router.get('/favorites', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { page = '1', pageSize = '12' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * pageSizeNum;

    const countResult = await queryOne(
      'SELECT COUNT(*) as total FROM favorites WHERE userId = ?',
      [userId]
    );
    const total = countResult ? (countResult.total as number) : 0;

    const favorites = await queryAll(
      `SELECT f.*, b.title, b.author, b.coverUrl, b.description, b.pageCount, b.language, b.difficulty, b.rating, b.categoryId,
              c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor
       FROM favorites f
       JOIN books b ON f.bookId = b.id
       LEFT JOIN book_categories c ON b.categoryId = c.id
       WHERE f.userId = ?
       ORDER BY f.createdAt DESC
       LIMIT ? OFFSET ?`,
      [userId, pageSizeNum, offset]
    );

    const formatted = favorites.map(f => ({
      id: f.id,
      userId: f.userId,
      bookId: f.bookId,
      createdAt: f.createdAt,
      book: {
        id: f.bookId,
        title: f.title,
        author: f.author,
        coverUrl: f.coverUrl,
        description: f.description,
        pageCount: f.pageCount,
        language: f.language,
        difficulty: f.difficulty,
        rating: f.rating,
        categoryId: f.categoryId,
        category: f.categoryName ? {
          id: f.categoryId,
          name: f.categoryName,
          icon: f.categoryIcon,
          color: f.categoryColor,
        } : null,
      },
    }));

    res.json({
      success: true,
      data: {
        data: formatted,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch favorites' });
  }
});

router.post('/favorites', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { bookId } = req.body;

    if (!bookId) {
      res.status(400).json({ success: false, error: 'bookId is required' });
      return;
    }

    const existing = await queryOne('SELECT id FROM favorites WHERE userId = ? AND bookId = ?', [userId, bookId]);
    if (existing) {
      res.status(409).json({ success: false, error: 'Already favorited' });
      return;
    }

    const id = uuidv4();
    await run('INSERT INTO favorites (id, userId, bookId) VALUES (?, ?, ?)', [id, userId, bookId]);
    await run('UPDATE books SET favoriteCount = favoriteCount + 1 WHERE id = ?', [bookId]);

    const favorite = await queryOne('SELECT * FROM favorites WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: favorite });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add favorite' });
  }
});

router.get('/favorites/check/:bookId', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const bookId = req.params.bookId;

    const existing = await queryOne('SELECT id FROM favorites WHERE userId = ? AND bookId = ?', [userId, bookId]);
    res.json({ success: true, data: { isFavorite: !!existing } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to check favorite' });
  }
});

router.delete('/favorites/:bookId', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const bookId = req.params.bookId;

    const existing = await queryOne('SELECT id FROM favorites WHERE userId = ? AND bookId = ?', [userId, bookId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Favorite not found' });
      return;
    }

    await run('DELETE FROM favorites WHERE userId = ? AND bookId = ?', [userId, bookId]);
    await run('UPDATE books SET favoriteCount = GREATEST(0, favoriteCount - 1) WHERE id = ?', [bookId]);

    res.json({ success: true, message: 'Favorite removed' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove favorite' });
  }
});

router.get('/highlights', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { bookId } = req.query;

    let sql = `SELECT h.*, b.title as bookTitle
               FROM highlights h
               JOIN books b ON h.bookId = b.id
               WHERE h.userId = ?`;
    const params: unknown[] = [userId];

    if (bookId) {
      sql += ' AND h.bookId = ?';
      params.push(bookId);
    }

    sql += ' ORDER BY h.createdAt DESC';
    const highlights = await queryAll(sql, params);

    res.json({ success: true, data: highlights });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch highlights' });
  }
});

router.post('/highlights', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { bookId, text, color, page, note, startOffset } = req.body;

    if (!bookId || !text || page === undefined) {
      res.status(400).json({ success: false, error: 'bookId, text, and page are required' });
      return;
    }

    const id = uuidv4();
    await run(
      'INSERT INTO highlights (id, userId, bookId, text, color, page, note, start_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, userId, bookId, text, color || '#FFEB3B', page, note || null, typeof startOffset === 'number' ? startOffset : null]
    );

    const highlight = await queryOne('SELECT * FROM highlights WHERE id = ?', [id]);
    awardHighlightOrNote(userId);
    res.status(201).json({ success: true, data: highlight });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create highlight' });
  }
});

router.put('/highlights/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const highlightId = req.params.id;
    const { text, color, note } = req.body;

    const existing = await queryOne('SELECT id FROM highlights WHERE id = ? AND userId = ?', [highlightId, userId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Highlight not found' });
      return;
    }

    if (text) await run('UPDATE highlights SET text = ? WHERE id = ?', [text, highlightId]);
    if (color) await run('UPDATE highlights SET color = ? WHERE id = ?', [color, highlightId]);
    if (note !== undefined) await run('UPDATE highlights SET note = ? WHERE id = ?', [note, highlightId]);

    const updated = await queryOne('SELECT * FROM highlights WHERE id = ?', [highlightId]);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update highlight' });
  }
});

router.delete('/highlights/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const highlightId = req.params.id;

    const existing = await queryOne('SELECT id FROM highlights WHERE id = ? AND userId = ?', [highlightId, userId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Highlight not found' });
      return;
    }

    await run('DELETE FROM highlights WHERE id = ?', [highlightId]);
    res.json({ success: true, message: 'Highlight deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete highlight' });
  }
});

router.get('/notes', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { bookId, page = '1', pageSize = '12' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * pageSizeNum;

    let countSql = 'SELECT COUNT(*) as total FROM notes WHERE userId = ?';
    let dataSql = `SELECT n.*, b.title as bookTitle, b.author as bookAuthor, b.coverUrl as bookCoverUrl
                   FROM notes n
                   JOIN books b ON n.bookId = b.id
                   WHERE n.userId = ?`;
    const countParams: unknown[] = [userId];
    const dataParams: unknown[] = [userId];

    if (bookId) {
      countSql += ' AND n.bookId = ?';
      dataSql += ' AND n.bookId = ?';
      countParams.push(bookId);
      dataParams.push(bookId);
    }

    const countResult = await queryOne(countSql, countParams);
    const total = countResult ? (countResult.total as number) : 0;

    dataSql += ` ORDER BY n.updatedAt DESC LIMIT ? OFFSET ?`;
    const notes = await queryAll(dataSql, [...dataParams, pageSizeNum, offset]);

    const formatted = notes.map(n => ({
      ...n,
      book: {
        id: n.bookId,
        title: n.bookTitle,
        author: n.bookAuthor,
        coverUrl: n.bookCoverUrl,
      },
    }));

    res.json({
      success: true,
      data: {
        data: formatted,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch notes' });
  }
});

router.post('/notes', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { bookId, title, content, page, isPublic } = req.body;

    if (!bookId || !title || !content) {
      res.status(400).json({ success: false, error: 'bookId, title, and content are required' });
      return;
    }

    const id = uuidv4();
    await run(
      'INSERT INTO notes (id, userId, bookId, title, content, page, isPublic) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, userId, bookId, title, content, page || null, isPublic ? 1 : 0]
    );

    const note = await queryOne('SELECT * FROM notes WHERE id = ?', [id]);
    awardHighlightOrNote(userId);
    res.status(201).json({ success: true, data: note });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create note' });
  }
});

router.put('/notes/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const noteId = req.params.id;
    const { title, content, page, isPublic } = req.body;

    const existing = await queryOne('SELECT id FROM notes WHERE id = ? AND userId = ?', [noteId, userId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Note not found' });
      return;
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (title) await run('UPDATE notes SET title = ?, updatedAt = ? WHERE id = ?', [title, now, noteId]);
    if (content) await run('UPDATE notes SET content = ?, updatedAt = ? WHERE id = ?', [content, now, noteId]);
    if (page !== undefined) await run('UPDATE notes SET page = ?, updatedAt = ? WHERE id = ?', [page, now, noteId]);
    if (isPublic !== undefined) await run('UPDATE notes SET isPublic = ?, updatedAt = ? WHERE id = ?', [isPublic ? 1 : 0, now, noteId]);

    const updated = await queryOne('SELECT * FROM notes WHERE id = ?', [noteId]);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update note' });
  }
});

router.delete('/notes/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const noteId = req.params.id;

    const existing = await queryOne('SELECT id FROM notes WHERE id = ? AND userId = ?', [noteId, userId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Note not found' });
      return;
    }

    await run('DELETE FROM notes WHERE id = ?', [noteId]);
    res.json({ success: true, message: 'Note deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete note' });
  }
});

// Bookmarks
router.get('/bookmarks', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { bookId } = req.query;

    let sql = `SELECT bk.*, b.title as bookTitle
               FROM bookmarks bk
               JOIN books b ON bk.bookId = b.id
               WHERE bk.userId = ?`;
    const params: unknown[] = [userId];

    if (bookId) {
      sql += ' AND bk.bookId = ?';
      params.push(bookId);
    }

    sql += ' ORDER BY bk.createdAt DESC';
    const bookmarks = await queryAll(sql, params);
    res.json({ success: true, data: bookmarks });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch bookmarks' });
  }
});

router.post('/bookmarks', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { bookId, cfi, label, page } = req.body;

    if (!bookId || !cfi) {
      res.status(400).json({ success: false, error: 'bookId and cfi are required' });
      return;
    }

    const id = uuidv4();
    await run(
      'INSERT INTO bookmarks (id, userId, bookId, cfi, label, page) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, bookId, cfi, label || null, page || 0]
    );

    const bookmark = await queryOne('SELECT * FROM bookmarks WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: bookmark });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create bookmark' });
  }
});

router.delete('/bookmarks/:id', verifyToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const bookmarkId = req.params.id;

    const existing = await queryOne('SELECT id FROM bookmarks WHERE id = ? AND userId = ?', [bookmarkId, userId]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Bookmark not found' });
      return;
    }

    await run('DELETE FROM bookmarks WHERE id = ?', [bookmarkId]);
    res.json({ success: true, message: 'Bookmark deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete bookmark' });
  }
});

export default router;
