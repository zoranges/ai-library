import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileArchive, X, BookOpen, FileText, Image, FolderArchive, AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ProgressBar from '@/components/ui/ProgressBar';
import type { Stage } from '@/components/ui/ProgressBar';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5271' : '';

interface BookEntry {
  id: string;
  fileName: string;
  format: string;
  fileSize: number;
  coverFileName: string | null;
  suggestedCategory: string;
  extractedMetadata: { title?: string; author?: string };
  aiMetadata?: {
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
  };
  import: boolean;
  userEdits?: Record<string, string>;
}

interface SkippedItem {
  fileName: string;
  title: string;
  reason: string;
}

const STAGES: Stage[] = [
  { key: 'extract', label: '解压扫描' },
  { key: 'analyze', label: 'AI 分析' },
  { key: 'ready', label: '审核确认' },
  { key: 'import', label: '导入完成' },
];

const LANGUAGES = ['zh', 'en', 'ms', 'ta'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

export default function BatchUpload() {
  const { t } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState({ stage: '', current: 0, total: 0, message: '' });
  const [books, setBooks] = useState<BookEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; skippedItems?: SkippedItem[] } | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [skippedItems, setSkippedItems] = useState<SkippedItem[]>([]);

  // Poll for status
  useEffect(() => {
    if (!batchId || status === 'ready' || status === 'done' || status === 'error') return;

    const timer = setInterval(async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_BASE}/api/admin/batch/status/${batchId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data;
        setStatus(data.status);
        setProgress(data.progress);
        setErrors(data.errors || []);
        setSkippedItems(data.skippedItems || []);
        if (data.books) {
          setBooks(data.books);
        }
      } catch {}
    }, 1500);

    return () => clearInterval(timer);
  }, [batchId, status]);

  function handleFileSelect(f: File | undefined) {
    setFormatError(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.zip')) {
      setFormatError(t('admin.batchUploadInvalidFormat', '仅支持 .zip 格式的压缩文件'));
      return;
    }
    setFile(f);
  }

  function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setErrors([]);

    const token = localStorage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300 || !json.success) {
          throw new Error(json.error || 'Upload failed');
        }
        setBatchId(json.data.batchId);
        setStatus(json.data.status);
        setProgress({ stage: 'extract', current: 0, total: 0, message: '正在解压...' });
      } catch (err: any) {
        setErrors([err.message]);
      } finally {
        setUploading(false);
      }
    });

    xhr.addEventListener('error', () => {
      setErrors(['网络错误，上传失败']);
      setUploading(false);
    });

    xhr.addEventListener('abort', () => {
      setUploading(false);
    });

    xhr.open('POST', `${API_BASE}/api/admin/batch/upload`);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  }

  function updateBookEdit(id: string, field: string, value: string) {
    setBooks(prev =>
      prev.map(b =>
        b.id === id
          ? { ...b, userEdits: { ...b.userEdits, [field]: value } }
          : b
      )
    );
  }

  function toggleBookImport(id: string) {
    setBooks(prev =>
      prev.map(b => (b.id === id ? { ...b, import: !b.import } : b))
    );
  }

  function getBookMeta(book: BookEntry, field: string): string {
    if (book.userEdits?.[field] !== undefined) return book.userEdits[field];
    const ai = book.aiMetadata as any;
    if (ai?.[field] !== undefined) return String(ai[field]);
    if (field === 'title') return book.fileName.replace(/\.[^.]+$/, '');
    return '';
  }

  async function handleImport() {
    const toImport = books.filter(b => b.import);
    if (toImport.length === 0) return;

    setImporting(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE}/api/admin/batch/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          batchId,
          books: toImport.map(b => ({
            id: b.id,
            fileName: b.fileName,
            format: b.format,
            coverFileName: b.coverFileName,
            aiMetadata: b.aiMetadata,
            userEdits: b.userEdits,
            import: true,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Import failed');
      }

      setResult(json.data);
      setSkippedItems(json.data.skippedItems || []);
      setStatus('done');
    } catch (err: any) {
      setErrors([err.message]);
    } finally {
      setImporting(false);
    }
  }

  function resetAll() {
    setFile(null);
    setBatchId(null);
    setStatus('');
    setBooks([]);
    setErrors([]);
    setFormatError(null);
    setSkippedItems([]);
    setResult(null);
    setProgress({ stage: '', current: 0, total: 0, message: '' });
  }

  const isProcessing = status && status !== 'ready' && status !== 'done' && status !== 'error';
  const importCount = books.filter(b => b.import).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary font-heading">
            {t('admin.batchUpload', '批量上传')}
          </h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            {t('admin.batchUploadDesc', '上传 ZIP 压缩包，AI 自动分析并批量导入图书')}
          </p>
        </div>
      </div>

      {/* Errors */}
      {(errors.length > 0 || formatError) && (
        <div className="p-4 bg-error/5 border border-error/15 rounded-xl space-y-1">
          {formatError && (
            <p className="text-[13px] text-error flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {formatError}
            </p>
          )}
          {errors.map((e, i) => (
            <p key={i} className="text-[13px] text-error">{e}</p>
          ))}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="p-6 bg-success/5 border border-success/15 rounded-xl text-center">
          <p className="text-base font-bold text-success">
            {t('admin.batchUploadSuccess', { imported: result.imported, skipped: result.skipped })}
          </p>
          <p className="text-sm text-text-secondary mt-1">
            {result.imported > 0 && `${t('admin.importedCount', 'Imported')}: ${result.imported}`}
            {result.skipped > 0 && `  ·  ${t('admin.skippedCount', 'Skipped')}: ${result.skipped}`}
          </p>
          {skippedItems.length > 0 && (
            <div className="mt-4 p-3 bg-warning/5 border border-warning/15 rounded-lg text-left">
              <p className="text-xs font-semibold text-warning mb-2">
                {t('admin.batchUploadSkippedTitle', 'Skipped items')}:
              </p>
              <ul className="space-y-1">
                {skippedItems.map((item, i) => (
                  <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-warning mt-0.5 shrink-0" />
                    <span>
                      <span className="font-medium">{item.title}</span>
                      <span className="text-text-tertiary"> ({item.fileName})</span>
                      <span className="text-text-tertiary"> — {item.reason}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button variant="ghost" className="mt-3" onClick={resetAll}>
            {t('admin.batchUploadAgain', '再次上传')}
          </Button>
        </div>
      )}

      {/* Phase 1: Upload */}
      {!batchId && !result && (
        <div className="pro-card p-8 rounded-xl">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              file
                ? 'border-accent/40 bg-accent/5'
                : 'border-border hover:border-accent/30 hover:bg-bg-tertiary'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileSelect(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <FileArchive className="h-10 w-10 text-accent" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-semibold text-text-primary">{file.name}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <button
                  className="p-1 rounded-full hover:bg-bg-tertiary text-text-tertiary"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="h-10 w-10 mx-auto mb-3 text-text-tertiary" strokeWidth={1.5} />
                <p className="text-sm text-text-secondary font-medium">
                  {t('admin.batchUploadDrop', '拖拽或点击选择 ZIP 文件')}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  {t('admin.batchUploadFormat', '支持 .zip 格式，内含 epub/pdf 图书和 jpg/png 封面')}
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
          </div>

          {/* Format guide */}
          {!file && (
            <div className="mt-5 p-4 bg-bg-tertiary/50 border border-border/50 rounded-xl">
              <p className="text-xs font-semibold text-text-secondary mb-2.5 flex items-center gap-1.5">
                <FolderArchive className="w-3.5 h-3.5" />
                {t('admin.batchUploadFormatGuide', '格式要求')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex items-start gap-2">
                  <FileText className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-text-primary">
                      {t('admin.batchUploadFormatBooks', '图书格式')}
                    </p>
                    <p className="text-[11px] text-text-tertiary">EPUB, PDF, MOBI, TXT</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Image className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-text-primary">
                      {t('admin.batchUploadFormatCovers', '封面格式')}
                    </p>
                    <p className="text-[11px] text-text-tertiary">JPG, JPEG, PNG, WebP, GIF</p>
                  </div>
                </div>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-border/30 flex items-start gap-1.5">
                <Image className="w-3.5 h-3.5 text-text-tertiary mt-0.5 shrink-0" />
                <p className="text-[11px] text-text-tertiary">
                  {t('admin.batchUploadFormatTip', '将图书和封面按文件夹归类，系统将自动识别分类名称')}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center mt-6 gap-3">
            {uploading ? (
              <div className="w-full max-w-xs">
                <div className="flex items-center justify-between text-xs text-text-secondary mb-1.5">
                  <span>上传中...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-bg-tertiary rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <Button onClick={handleUpload} disabled={!file}>
                {t('admin.batchUploadStart', '开始上传')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Phase 2: Processing */}
      {isProcessing && (
        <div className="pro-card p-8 rounded-xl">
          <ProgressBar
            stages={STAGES}
            activeStage={progress.stage}
            current={progress.current}
            total={progress.total}
            message={progress.message}
          />
        </div>
      )}

      {/* Phase 3: Review & Import */}
      {status === 'ready' && books.length > 0 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              共 {books.length} 本图书，已选 <span className="font-bold text-accent">{importCount}</span> 本待导入
            </p>
            <Button onClick={handleImport} loading={importing} disabled={importCount === 0}>
              开始导入
            </Button>
          </div>

          {/* Books table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 px-3 text-xs font-medium text-text-tertiary w-8">#</th>
                  <th className="py-2 px-3 text-xs font-medium text-text-tertiary">书名</th>
                  <th className="py-2 px-3 text-xs font-medium text-text-tertiary">作者</th>
                  <th className="py-2 px-3 text-xs font-medium text-text-tertiary w-28">分类</th>
                  <th className="py-2 px-3 text-xs font-medium text-text-tertiary w-20">语言</th>
                  <th className="py-2 px-3 text-xs font-medium text-text-tertiary w-20">难度</th>
                  <th className="py-2 px-3 text-xs font-medium text-text-tertiary w-16">导入</th>
                </tr>
              </thead>
              <tbody>
                {books.map((book, i) => {
                  const title = getBookMeta(book, 'title');
                  const author = getBookMeta(book, 'author');
                  const categoryName = getBookMeta(book, 'categoryName');
                  const language = getBookMeta(book, 'language');
                  const difficulty = getBookMeta(book, 'difficulty');

                  return (
                    <tr
                      key={book.id}
                      className={`border-b border-border/50 hover:bg-bg-tertiary/50 transition-colors ${
                        !book.import ? 'opacity-40' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-text-tertiary text-xs">{i + 1}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                          <div className="min-w-0">
                            <Input
                              className="h-7 text-xs"
                              value={title}
                              onChange={(e) => updateBookEdit(book.id, 'title', e.target.value)}
                            />
                            <span className="text-[10px] text-text-tertiary">{book.fileName} · {book.format}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          className="h-7 text-xs w-28"
                          value={author}
                          onChange={(e) => updateBookEdit(book.id, 'author', e.target.value)}
                          placeholder="作者"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          className="h-7 text-xs w-24"
                          value={categoryName}
                          onChange={(e) => updateBookEdit(book.id, 'categoryName', e.target.value)}
                          placeholder="分类"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          className="h-7 text-xs bg-surface border border-border rounded-md px-2 w-16"
                          value={language}
                          onChange={(e) => updateBookEdit(book.id, 'language', e.target.value)}
                        >
                          <option value="">-</option>
                          {LANGUAGES.map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <select
                          className="h-7 text-xs bg-surface border border-border rounded-md px-2 w-20"
                          value={difficulty}
                          onChange={(e) => updateBookEdit(book.id, 'difficulty', e.target.value)}
                        >
                          {DIFFICULTIES.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={book.import}
                          onChange={() => toggleBookImport(book.id)}
                          className="w-4 h-4 accent-accent"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Importing progress */}
      {status === 'importing' && (
        <div className="pro-card p-8 rounded-xl">
          <ProgressBar
            stages={[{ key: 'import', label: '导入' }]}
            activeStage="import"
            current={progress.current}
            total={progress.total}
            message={progress.message}
          />
        </div>
      )}
    </div>
  );
}
