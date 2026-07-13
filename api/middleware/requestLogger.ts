import { type Request, type Response, type NextFunction } from 'express';
import { writeLog } from '../services/logService.js';
import type { JwtPayload } from './auth.js';

const SENSITIVE_FIELDS = ['password', 'password_confirm', 'currentPassword', 'newPassword', 'token', 'refreshToken', 'credential', 'current_password', 'new_password'];

const SKIP_PATHS = new Set([
  '/api/health',
  '/api/public/config',
  '/api/public/schools',
]);

const SKIP_PREFIXES = ['/uploads', '/dist'];

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(sanitizeBody);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      sanitized[key] = '***';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeBody(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function resolveAction(method: string, path: string): string {
  // Replace UUID path segments and numeric IDs with :id placeholder
  const p = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/gi, '/:id$1').replace(/\/\d+(\/|$)/g, '/:id$1').replace(/\/:id$/, '/:id');

  // Auth
  if (p === '/api/auth/login') return 'LOGIN';
  if (p === '/api/auth/google') return 'GOOGLE_LOGIN';
  if (p === '/api/auth/register') return 'REGISTER';
  if (p === '/api/auth/logout') return 'LOGOUT';
  if (p === '/api/auth/forgot-password') return 'FORGOT_PASSWORD';
  if (p === '/api/auth/reset-password') return 'RESET_PASSWORD';
  if (p === '/api/auth/refresh') return 'REFRESH_TOKEN';

  // Admin
  if (p.startsWith('/api/admin/dashboard')) return 'VIEW_DASHBOARD';
  if (p.startsWith('/api/admin/statistics')) return 'VIEW_STATISTICS';
  if (p.startsWith('/api/admin/search')) return 'GLOBAL_SEARCH';
  if (p.startsWith('/api/admin/logs')) return 'VIEW_LOGS';
  if (p.startsWith('/api/admin/export')) return 'EXPORT_DATA';

  // Schools
  if (p === '/api/admin/schools' && method === 'GET') return 'LIST_SCHOOLS';
  if (p === '/api/admin/schools' && method === 'POST') return 'CREATE_SCHOOL';
  if (p === '/api/admin/schools/:id' && method === 'GET') return 'VIEW_SCHOOL';
  if (p === '/api/admin/schools/:id' && method === 'PUT') return 'UPDATE_SCHOOL';
  if (p === '/api/admin/schools/:id' && method === 'DELETE') return 'DELETE_SCHOOL';
  if (p === '/api/admin/schools/:id/analytics') return 'VIEW_SCHOOL_ANALYTICS';

  // Students
  if (p === '/api/admin/students' && method === 'GET') return 'LIST_STUDENTS';
  if (p === '/api/admin/students/:id' && method === 'GET') return 'VIEW_STUDENT';
  if (p === '/api/admin/students/:id' && method === 'PUT') return 'UPDATE_STUDENT';
  if (p === '/api/admin/students/:id' && method === 'DELETE') return 'DEREGISTER_STUDENT';
  if (p === '/api/admin/students/:id/reregister') return 'REREGISTER_STUDENT';
  if (p === '/api/admin/students/:id/report') return 'VIEW_STUDENT_REPORT';

  // Books
  if (p === '/api/admin/books' && method === 'GET') return 'LIST_BOOKS';
  if (p === '/api/admin/books' && method === 'POST') return 'CREATE_BOOK';
  if (p === '/api/admin/books/upload' && method === 'POST') return 'UPLOAD_BOOK';
  if (p === '/api/admin/books/:id' && method === 'PUT') return 'UPDATE_BOOK';
  if (p === '/api/admin/books/:id' && method === 'DELETE') return 'DELETE_BOOK';
  if (p === '/api/admin/books/:id/cover' && method === 'PUT') return 'UPDATE_COVER';
  if (p === '/api/admin/books/:id/cover' && method === 'DELETE') return 'REMOVE_COVER';
  if (p === '/api/admin/books/categories' && method === 'GET') return 'LIST_CATEGORIES';
  if (p === '/api/admin/books/categories' && method === 'POST') return 'CREATE_CATEGORY';
  if (p === '/api/admin/books/categories/:id' && method === 'PUT') return 'UPDATE_CATEGORY';
  if (p === '/api/admin/books/categories/:id' && method === 'DELETE') return 'DELETE_CATEGORY';
  if (p === '/api/admin/books/categories/reorder') return 'REORDER_CATEGORIES';

  // Admins
  if (p === '/api/admin/admins') return 'MANAGE_ADMINS';
  if (p === '/api/admin/admins/:id') return 'MANAGE_ADMINS';

  // Teachers
  if (p === '/api/admin/teachers') return 'MANAGE_TEACHERS';
  if (p === '/api/admin/teachers/:id') return 'MANAGE_TEACHERS';

  // Account
  if (p === '/api/admin/account' && method === 'PUT') return 'UPDATE_ACCOUNT';
  if (p === '/api/admin/account' && method === 'DELETE') return 'DELETE_ACCOUNT';
  if (p === '/api/admin/account/password') return 'CHANGE_PASSWORD';
  if (p === '/api/admin/account/avatar') return 'UPLOAD_AVATAR';
  if (p === '/api/admin/account/devices') return 'VIEW_DEVICES';
  if (p === '/api/admin/account/ip-bind') return 'TOGGLE_IP_BIND';

  // Auth user
  if (p === '/api/auth/me') return 'VIEW_PROFILE';
  if (p === '/api/auth/profile') return 'UPDATE_PROFILE';
  if (p === '/api/auth/avatar') return 'UPLOAD_AVATAR';
  if (p === '/api/auth/password') return 'CHANGE_PASSWORD';

  // AI config
  if (p.startsWith('/api/admin/ai-config')) return 'MANAGE_AI_CONFIG';

  // System config
  if (p.startsWith('/api/admin/system-config')) return 'MANAGE_SYSTEM_CONFIG';
  if (p.startsWith('/api/admin/system-settings')) return 'MANAGE_SYSTEM_SETTINGS';

  // IC whitelist
  if (p.startsWith('/api/admin/ic-whitelist')) return 'MANAGE_IC_WHITELIST';

  // Locations
  if (p.startsWith('/api/admin/locations')) return 'VIEW_LOCATIONS';

  // Role switch
  if (p === '/api/admin/role-switch') return 'ROLE_SWITCH';

  // Pending registrations
  if (p.startsWith('/api/admin/pending-registrations')) return 'MANAGE_REGISTRATIONS';
  if (p.startsWith('/api/admin/approve-registration')) return 'APPROVE_REGISTRATION';
  if (p.startsWith('/api/admin/reject-registration')) return 'REJECT_REGISTRATION';

  // Upload
  if (p === '/api/upload') return 'UPLOAD_FILE';

  // Batch upload
  if (p.startsWith('/api/admin/batch/upload') && method === 'POST') return 'BATCH_UPLOAD_FILE';
  if (p.startsWith('/api/admin/batch/import') && method === 'POST') return 'BATCH_IMPORT';
  if (p.startsWith('/api/admin/batch/status') && method === 'GET') return 'BATCH_STATUS';
  if (p.startsWith('/api/admin/batch')) return 'BATCH_UPLOAD';

  // Books (user-facing)
  if (p.startsWith('/api/books') && method === 'GET') return 'VIEW_BOOKS';
  if (p.startsWith('/api/books') && method === 'POST') return 'FAVORITE_BOOK';
  if (p.startsWith('/api/books') && method === 'DELETE') return 'UNFAVORITE_BOOK';

  // Reading
  if (p.startsWith('/api/reading/progress') && method === 'POST') return 'SAVE_PROGRESS';
  if (p.startsWith('/api/reading/progress') && method === 'GET') return 'VIEW_PROGRESS';
  if (p.startsWith('/api/reading/sessions') && method === 'POST') return 'CREATE_SESSION';
  if (p.startsWith('/api/reading/sessions') && method === 'GET') return 'VIEW_SESSIONS';
  if (p.startsWith('/api/reading/history')) return 'VIEW_HISTORY';
  if (p.startsWith('/api/reading/stats')) return 'VIEW_STATS';
  if (p.startsWith('/api/reading/report')) return 'VIEW_REPORT';
  if (p.startsWith('/api/reading/ains-bridge')) return 'AINS_BRIDGE';

  // Learning
  if (p.startsWith('/api/learning/favorites')) return 'MANAGE_FAVORITES';
  if (p.startsWith('/api/learning/highlights') && method === 'POST') return 'CREATE_HIGHLIGHT';
  if (p.startsWith('/api/learning/highlights') && method === 'PUT') return 'UPDATE_HIGHLIGHT';
  if (p.startsWith('/api/learning/highlights') && method === 'DELETE') return 'DELETE_HIGHLIGHT';
  if (p.startsWith('/api/learning/highlights') && method === 'GET') return 'VIEW_HIGHLIGHTS';
  if (p.startsWith('/api/learning/notes') && method === 'POST') return 'CREATE_NOTE';
  if (p.startsWith('/api/learning/notes') && method === 'PUT') return 'UPDATE_NOTE';
  if (p.startsWith('/api/learning/notes') && method === 'DELETE') return 'DELETE_NOTE';
  if (p.startsWith('/api/learning/notes') && method === 'GET') return 'VIEW_NOTES';
  if (p.startsWith('/api/learning/bookmarks') && method === 'POST') return 'CREATE_BOOKMARK';
  if (p.startsWith('/api/learning/bookmarks') && method === 'DELETE') return 'DELETE_BOOKMARK';
  if (p.startsWith('/api/learning/bookmarks') && method === 'GET') return 'VIEW_BOOKMARKS';

  // AI
  if (p === '/api/ai/chat') return 'AI_CHAT';
  if (p === '/api/ai/explain') return 'AI_EXPLAIN';
  if (p === '/api/ai/define') return 'AI_DEFINE';
  if (p === '/api/ai/translate') return 'AI_TRANSLATE';
  if (p === '/api/ai/quiz/generate') return 'GENERATE_QUIZ';
  if (p === '/api/ai/quiz/submit') return 'SUBMIT_QUIZ';
  if (p === '/api/ai/quiz/results') return 'VIEW_QUIZ_RESULTS';
  if (p === '/api/ai/search') return 'AI_SEARCH';
  if (p === '/api/ai/search-document') return 'SEARCH_DOCUMENT';

  // Leaderboard
  if (p.startsWith('/api/leaderboard/achievements')) return 'VIEW_ACHIEVEMENTS';
  if (p.startsWith('/api/leaderboard/badges')) return 'VIEW_BADGES';
  if (p.startsWith('/api/leaderboard/points')) return 'VIEW_POINTS';
  if (p.startsWith('/api/leaderboard/my-school')) return 'VIEW_MY_SCHOOL';
  if (p === '/api/leaderboard' || p === '/api/leaderboard/') return 'VIEW_LEADERBOARD';

  return `${method}:${p}`;
}

function resolveResource(path: string): string | undefined {
  const p = path.toLowerCase();
  if (p.includes('/admin/schools')) return 'schools';
  if (p.includes('/admin/students')) return 'students';
  if (p.includes('/admin/teachers')) return 'teachers';
  if (p.includes('/admin/admins')) return 'admins';
  if (p.includes('/admin/books/categories')) return 'categories';
  if (p.includes('/admin/books')) return 'books';
  if (p.includes('/admin/ic-whitelist')) return 'ic_whitelist';
  if (p.includes('/admin/ai-config')) return 'ai_config';
  if (p.includes('/admin/system-config')) return 'system_config';
  if (p.includes('/admin/account')) return 'account';
  if (p.includes('/admin/batch')) return 'batch_upload';
  if (p.includes('/reading')) return 'reading';
  if (p.includes('/learning')) return 'learning';
  if (p.includes('/ai/quiz')) return 'quiz';
  if (p.includes('/ai/')) return 'ai';
  if (p.includes('/books')) return 'books';
  if (p.includes('/leaderboard')) return 'leaderboard';
  if (p.includes('/auth')) return 'auth';
  return undefined;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path, ip, headers, originalUrl } = req;

  // Skip static and health
  if (SKIP_PATHS.has(path)) { next(); return; }
  for (const prefix of SKIP_PREFIXES) {
    if (path.startsWith(prefix)) { next(); return; }
  }

  // Capture original end to hook into response
  const originalEnd = res.end.bind(res);
  let body: Buffer[] = [];

  // Intercept response end
  (res as any).end = function (chunk: any, encoding?: any): any {
    if (chunk) body.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    return originalEnd(chunk, encoding);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    const user = req.user as JwtPayload | undefined;
    const action = resolveAction(method, path);
    const resource = resolveResource(path);
    const sanitizedBody = method !== 'GET' ? sanitizeBody(req.body) : undefined;

    // Build file metadata for upload requests
    let fileInfo: Record<string, unknown> | undefined;
    const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
    const file = (req as any).file as Express.Multer.File | undefined;
    if (files) {
      const summary: Record<string, Record<string, unknown>> = {};
      for (const [fieldName, fieldFiles] of Object.entries(files)) {
        if (fieldFiles && fieldFiles.length > 0) {
          summary[fieldName] = {
            name: fieldFiles[0].originalname,
            size: fieldFiles[0].size,
            type: fieldFiles[0].mimetype,
          };
        }
      }
      fileInfo = summary;
    } else if (file) {
      fileInfo = { name: file.originalname, size: file.size, type: file.mimetype };
    }

    // Merge auditDetails with file info
    let details: string | undefined;
    const auditDetails = res.locals?.auditDetails;
    if (auditDetails || fileInfo) {
      details = JSON.stringify({
        ...(fileInfo ? { files: fileInfo } : {}),
        ...(auditDetails && typeof auditDetails === 'object' ? auditDetails : {}),
      });
    }

    writeLog({
      userId: user?.userId,
      username: user?.username || user?.email,
      userRole: user?.role,
      schoolId: user?.schoolId,
      action,
      resource,
      method,
      path: originalUrl,
      requestBody: sanitizedBody,
      responseStatus: res.statusCode,
      ipAddress: ip || (headers['x-forwarded-for'] as string) || undefined,
      userAgent: headers['user-agent'] as string | undefined,
      duration,
      details,
    });
  });

  next();
}
