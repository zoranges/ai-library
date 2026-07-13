import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/database.js';

export interface LogEntry {
  userId?: string;
  username?: string;
  userRole?: string;
  schoolId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  method?: string;
  path?: string;
  requestBody?: unknown;
  responseStatus?: number;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  details?: string;
}

export function writeLog(entry: LogEntry): void {
  const id = uuidv4();
  const sql = `INSERT INTO operation_logs (id, userId, username, userRole, schoolId, action, resource, resourceId, method, path, requestBody, responseStatus, ipAddress, userAgent, duration, details)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params: (string | number | null)[] = [
    id,
    entry.userId || null,
    entry.username || null,
    entry.userRole || null,
    entry.schoolId || null,
    entry.action,
    entry.resource || null,
    entry.resourceId || null,
    entry.method || null,
    entry.path || null,
    entry.requestBody ? JSON.stringify(entry.requestBody) : null,
    entry.responseStatus ?? null,
    entry.ipAddress || null,
    entry.userAgent || null,
    entry.duration ?? null,
    entry.details || null,
  ];

  pool.execute(sql, params).catch((err) => {
    console.error('Failed to write operation log:', err);
  });
}

export interface LogFilter {
  page?: number;
  pageSize?: number;
  userId?: string;
  action?: string;
  resource?: string;
  method?: string;
  path?: string;
  responseStatus?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export async function queryLogs(filters: LogFilter = {}) {
  const page = Math.max(0, filters.page || 0);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
  const conditions: string[] = [];
  const params: (string | number | null)[] = [];

  if (filters.userId) {
    conditions.push('ol.userId = ?');
    params.push(filters.userId);
  }
  if (filters.action) {
    conditions.push('ol.action = ?');
    params.push(filters.action);
  }
  if (filters.resource) {
    conditions.push('ol.resource = ?');
    params.push(filters.resource);
  }
  if (filters.method) {
    conditions.push('ol.method = ?');
    params.push(filters.method);
  }
  if (filters.path) {
    conditions.push('ol.path LIKE ?');
    params.push(`%${filters.path}%`);
  }
  if (filters.responseStatus !== undefined) {
    conditions.push('ol.responseStatus = ?');
    params.push(filters.responseStatus);
  }
  if (filters.startDate) {
    conditions.push('ol.createdAt >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('ol.createdAt <= ?');
    params.push(filters.endDate + ' 23:59:59');
  }
  if (filters.search) {
    conditions.push('(ol.username LIKE ? OR ol.path LIKE ? OR ol.details LIKE ? OR ol.action LIKE ?)');
    const s = `%${filters.search}%`;
    params.push(s, s, s, s);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM operation_logs ol ${where}`;
  const [countRow] = await pool.query(countSql, params) as any[];
  const total = countRow[0]?.total || 0;

  const dataSql = `SELECT ol.* FROM operation_logs ol ${where} ORDER BY ol.createdAt DESC LIMIT ? OFFSET ?`;
  const [rows] = await pool.query(dataSql, [...params, pageSize, page * pageSize]) as any[];

  return { data: rows, total, page, pageSize };
}

export async function getLogStats() {
  const [actionRows] = await pool.query(
    `SELECT action, COUNT(*) as count FROM operation_logs WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY action ORDER BY count DESC LIMIT 20`
  ) as any[];
  const [dailyRows] = await pool.query(
    `SELECT DATE(createdAt) as date, COUNT(*) as count FROM operation_logs WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY DATE(createdAt) ORDER BY date`
  ) as any[];
  const [methodRows] = await pool.query(
    `SELECT method, COUNT(*) as count FROM operation_logs WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY method`
  ) as any[];
  const [statusRows] = await pool.query(
    `SELECT responseStatus, COUNT(*) as count FROM operation_logs WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY responseStatus ORDER BY responseStatus`
  ) as any[];
  const [totalRow] = await pool.query(`SELECT COUNT(*) as total FROM operation_logs`) as any[];

  return {
    total: totalRow[0]?.total || 0,
    topActions: actionRows,
    dailyCounts: dailyRows,
    methodDistribution: methodRows,
    statusDistribution: statusRows,
  };
}

export async function cleanOldLogs(retentionDays: number = 90): Promise<number> {
  const [result] = await pool.query(
    `DELETE FROM operation_logs WHERE createdAt < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [retentionDays]
  ) as any;
  return result.affectedRows || 0;
}
