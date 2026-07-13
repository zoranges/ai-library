import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Download, Trash2, RefreshCw, ChevronDown, ChevronRight, Eye, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { adminApi } from '@/utils/api';

const PAGE_SIZE = 30;

export default function OperationLogs() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actions, setActions] = useState<string[]>([]);

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Export
  const [exporting, setExporting] = useState(false);

  const fetchActions = useCallback(async () => {
    try {
      const res: any = await adminApi.getLogActions();
      setActions(res.data || []);
    } catch {}
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res: any = await adminApi.getLogs({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        action: actionFilter || undefined,
        method: methodFilter || undefined,
        responseStatus: statusFilter ? parseInt(statusFilter) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setLogs(res.data || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, methodFilter, statusFilter, startDate, endDate]);

  useEffect(() => { fetchActions(); }, [fetchActions]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(0); }, [search, actionFilter, methodFilter, statusFilter, startDate, endDate]);

  async function handleExport(format: 'json' | 'csv') {
    setExporting(true);
    try {
      const res: any = await adminApi.exportLogs({
        format,
        search: search || undefined,
        action: actionFilter || undefined,
        method: methodFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (format === 'csv') {
        // CSV is returned as text
        const blob = new Blob(['﻿' + (typeof res === 'string' ? res : JSON.stringify(res))], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `operation_logs_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(res.data || res, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `operation_logs_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const statusBadge = (status: number) => {
    if (status >= 200 && status < 300) {
      return <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">{status}</span>;
    }
    if (status >= 400 && status < 500) {
      return <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">{status}</span>;
    }
    if (status >= 500) {
      return <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">{status}</span>;
    }
    return <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">{status}</span>;
  };

  const methodBadge = (method: string | undefined) => {
    if (!method) return null;
    const colors: Record<string, string> = {
      GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
      POST: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
      PUT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
      DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono ${colors[method] || 'bg-slate-100 text-slate-600'}`}>
        {method}
      </span>
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{t('admin.operationLogs', '操作日志')}</h2>
          <p className="text-[13px] text-text-tertiary mt-0.5">{t('admin.operationLogsDesc', '查看系统中所有操作的详细记录')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            {t('common.refresh', '刷新')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')} disabled={exporting}>
            <Download className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
            JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={exporting}>
            <Download className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
            CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
            <Input
              className="pl-8 h-8 text-[13px]"
              placeholder={t('common.search', '搜索') + '...'}
              value={search}
              onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
            />
          </div>
          <select
            className="h-8 rounded-md border border-border bg-surface px-2.5 text-[13px] text-text-primary outline-none focus:ring-2 focus:ring-accent/20"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="">{t('admin.allActions', '所有操作')}</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-border bg-surface px-2.5 text-[13px] text-text-primary outline-none focus:ring-2 focus:ring-accent/20"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="">{t('admin.allMethods', '所有方法')}</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          <select
            className="h-8 rounded-md border border-border bg-surface px-2.5 text-[13px] text-text-primary outline-none focus:ring-2 focus:ring-accent/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t('admin.allStatus', '所有状态')}</option>
            <option value="200">200 OK</option>
            <option value="201">201 Created</option>
            <option value="400">400 Bad Request</option>
            <option value="401">401 Unauthorized</option>
            <option value="403">403 Forbidden</option>
            <option value="500">500 Server Error</option>
          </select>
          <input
            type="date"
            className="h-8 rounded-md border border-border bg-surface px-2.5 text-[13px] text-text-primary outline-none focus:ring-2 focus:ring-accent/20"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title={t('common.startDate', '开始日期')}
          />
          <input
            type="date"
            className="h-8 rounded-md border border-border bg-surface px-2.5 text-[13px] text-text-primary outline-none focus:ring-2 focus:ring-accent/20"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title={t('common.endDate', '结束日期')}
          />
          {(search || actionFilter || methodFilter || statusFilter || startDate || endDate) && (
            <button
              className="text-[12px] text-accent hover:underline"
              onClick={() => {
                setSearch('');
                setActionFilter('');
                setMethodFilter('');
                setStatusFilter('');
                setStartDate('');
                setEndDate('');
              }}
            >
              <X className="h-3 w-3 inline mr-0.5" strokeWidth={1.5} />
              {t('common.clear', '清除')}
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {error && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-[13px]">
            {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50">
                <th className="text-left px-4 py-2.5 font-medium text-text-tertiary w-8"></th>
                <th className="text-left px-4 py-2.5 font-medium text-text-tertiary">{t('admin.time', '时间')}</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-tertiary">{t('admin.action', '操作')}</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-tertiary">{t('admin.user', '用户')}</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-tertiary">{t('admin.method', '方法')}</th>
                <th className="text-left px-4 py-2.5 font-medium text-text-tertiary">{t('admin.path', '路径')}</th>
                <th className="text-center px-4 py-2.5 font-medium text-text-tertiary">{t('admin.status', '状态')}</th>
                <th className="text-center px-4 py-2.5 font-medium text-text-tertiary">{t('admin.duration', '耗时')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-text-tertiary">
                    <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" strokeWidth={1.5} />
                    {t('common.loading', '加载中...')}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-text-tertiary">
                    <Eye className="h-5 w-5 mx-auto mb-2 opacity-40" strokeWidth={1.5} />
                    {t('common.noData', '无数据')}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      className="border-b border-border hover:bg-surface-raised/30 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="px-4 py-2.5">
                        {expandedId === log.id ? (
                          <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap font-mono text-[12px]">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-text-primary font-medium text-[12px]">{log.action}</span>
                        {log.resource && (
                          <span className="text-text-tertiary text-[11px] ml-1">({log.resource})</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">
                        {log.userId ? (
                          <div>
                            <div className="text-[12px]">{log.username || '-'}</div>
                            <div className="text-[10px] text-text-tertiary">{log.userRole}</div>
                          </div>
                        ) : (
                          <span className="text-text-tertiary text-[11px]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">{methodBadge(log.method)}</td>
                      <td className="px-4 py-2.5 text-text-secondary font-mono text-[11px] max-w-[200px] truncate" title={log.path}>
                        {log.path || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-center">{statusBadge(log.responseStatus)}</td>
                      <td className="px-4 py-2.5 text-center text-text-tertiary font-mono text-[12px]">
                        {log.duration != null ? `${log.duration}ms` : '-'}
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr key={`${log.id}-detail`} className="bg-surface-raised/20">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[12px]">
                            {log.ipAddress && (
                              <div>
                                <span className="text-text-tertiary">IP: </span>
                                <span className="text-text-primary font-mono">{log.ipAddress}</span>
                              </div>
                            )}
                            {log.userAgent && (
                              <div className="col-span-2 lg:col-span-3">
                                <span className="text-text-tertiary">UA: </span>
                                <span className="text-text-primary font-mono text-[11px] break-all">{log.userAgent}</span>
                              </div>
                            )}
                            {log.requestBody && (
                              <div className="col-span-full">
                                <span className="text-text-tertiary">Request Body: </span>
                                <pre className="mt-1 p-2 rounded bg-surface border border-border text-[11px] font-mono text-text-secondary overflow-x-auto max-h-40">
                                  {JSON.stringify(log.requestBody, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.details && (
                              <div className="col-span-full">
                                <span className="text-text-tertiary">Details: </span>
                                <span className="text-text-primary">{log.details}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
            <span className="text-[12px] text-text-tertiary">
              {t('common.total', '共')} {total} {t('common.records', '条')}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(0)}
              >
                {'<<'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                {'<'}
              </Button>
              <span className="text-[12px] text-text-secondary px-2">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                {'>'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(totalPages - 1)}
              >
                {'>>'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
