import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { BookOpen, Heart, Play, Star, Calendar, Building2, Hash, ChevronLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useBookStore } from '@/stores/bookStore';
import { useReadingStore } from '@/stores/readingStore';
import { favoriteApi } from '@/utils/api';

const COVER_HUES = [
  { bg: 'bg-blue-50 dark:bg-blue-950/40', accent: 'bg-blue-200 dark:bg-blue-800' },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/40', accent: 'bg-emerald-200 dark:bg-emerald-800' },
  { bg: 'bg-amber-50 dark:bg-amber-950/40', accent: 'bg-amber-200 dark:bg-amber-800' },
  { bg: 'bg-rose-50 dark:bg-rose-950/40', accent: 'bg-rose-200 dark:bg-rose-800' },
  { bg: 'bg-violet-50 dark:bg-violet-950/40', accent: 'bg-violet-200 dark:bg-violet-800' },
];

const LANG_DOT: Record<string, string> = {
  en: 'bg-blue-400',
  zh: 'bg-red-400',
  ms: 'bg-emerald-400',
  ta: 'bg-amber-400',
};

const LANG_LABEL: Record<string, string> = {
  en: '英语',
  zh: '中文',
  ms: '马来语',
  ta: '泰米尔语',
};

function getDifficultyLabel(d: string) {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'error' }> = {
    beginner: { label: '入门', variant: 'success' },
    intermediate: { label: '进阶', variant: 'warning' },
    advanced: { label: '高级', variant: 'error' },
  };
  return map[d] || { label: d, variant: 'default' as const };
}

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentBook: book, books, fetchBookById, fetchBooks } = useBookStore();
  const { currentProgress, fetchProgress } = useReadingStore();
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchBookById(id);
      fetchProgress(id);
      favoriteApi.checkFavorite(id).then((res) => {
        const data = res.data as any;
        setIsFavorite(data?.isFavorite ?? false);
      }).catch(() => {
        setIsFavorite(false);
      });
    }
  }, [id]);

  useEffect(() => {
    if (books.length === 0) fetchBooks();
  }, []);

  async function toggleFavorite() {
    if (!id) return;
    setFavLoading(true);
    try {
      if (isFavorite) {
        await favoriteApi.removeFavorite(id);
      } else {
        await favoriteApi.addFavorite(id);
      }
      setIsFavorite(!isFavorite);
    } catch {
      void 0;
    } finally {
      setFavLoading(false);
    }
  }

  if (!book) {
    return (
      <div className="page-container flex items-center justify-center min-h-[50vh]">
        <div className="skeleton w-full max-w-4xl h-96 rounded-card" />
      </div>
    );
  }

  const diff = getDifficultyLabel(book.difficulty);
  const progressPct = currentProgress?.percentage ?? 0;
  const relatedBooks = books.filter((b) => b.categoryId === book.categoryId && b.id !== book.id).slice(0, 6);
  const hue = COVER_HUES[0];

  return (
    <div className="page-container">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[13px] text-text-tertiary hover:text-accent mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />返回
      </button>

      <div className="flex flex-col lg:flex-row gap-8 animate-fade-in">
        <div className="shrink-0">
          <div className={`w-52 h-72 rounded-xl ${hue.bg} flex items-center justify-center shadow-card`}>
            <div className={`w-20 h-28 rounded-lg ${hue.accent}/30 flex items-center justify-center`}>
              <BookOpen className="w-8 h-8 text-text-tertiary/40" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <Badge variant={diff.variant} size="sm">{diff.label}</Badge>
            <Badge variant="accent" size="sm">{book.fileType === 'epub' ? 'EPUB' : 'PDF'}</Badge>
            <Badge variant="outline" size="sm">
              <span className={`w-1.5 h-1.5 rounded-full ${LANG_DOT[book.language] || 'bg-gray-400'} mr-1`} />
              {LANG_LABEL[book.language] || book.language}
            </Badge>
          </div>

          <h1 className="text-[28px] font-bold text-text-primary font-heading leading-tight">{book.title}</h1>
          <p className="text-[14px] text-text-secondary mt-2">作者：{book.author}</p>

          <div className="flex items-center gap-4 mt-3 text-[12px] text-text-tertiary">
            {book.isbn && <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" strokeWidth={1.5} />{book.isbn}</span>}
            {book.publisher && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" strokeWidth={1.5} />{book.publisher}</span>}
            {book.publishDate && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />{book.publishDate}</span>}
          </div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-warning fill-warning" strokeWidth={1.5} />
              <span className="text-[13px] font-medium text-text-primary font-mono">{book.rating.toFixed(1)}</span>
              <span className="text-[11px] text-text-tertiary">({book.ratingCount})</span>
            </div>
            <span className="text-[11px] text-text-tertiary font-mono">{book.readCount} 次阅读</span>
            <span className="text-[11px] text-text-tertiary font-mono">{book.pageCount} 页</span>
          </div>

          {progressPct > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-text-secondary">阅读进度</span>
                <span className="text-accent font-medium font-mono">{progressPct}%</span>
              </div>
              <div className="w-full h-1 bg-bg-tertiary rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 mt-6">
            <Link to={`/read/${book.id}`}>
              <Button size="lg" icon={<Play className="w-4 h-4" strokeWidth={1.5} />} className="h-11 rounded-xl">
                {progressPct > 0 ? '继续阅读' : '开始阅读'}
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              icon={<Heart className={`w-4 h-4 ${isFavorite ? 'fill-error text-error' : ''}`} strokeWidth={1.5} />}
              onClick={toggleFavorite}
              loading={favLoading}
              className="h-11 rounded-xl"
            >
              {isFavorite ? '已收藏' : '加入收藏'}
            </Button>
          </div>
        </div>
      </div>

      {book.description && (
        <div className="mt-8 bg-bg-primary rounded-xl border border-border p-5">
          <h3 className="text-[13px] font-semibold text-text-primary mb-2">📖 关于这本书</h3>
          <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-line max-w-2xl">{book.description}</p>
        </div>
      )}

      {book.tags && book.tags.length > 0 && (
        <div className="mt-5 flex items-center gap-1.5 flex-wrap">
          {book.tags.map((tag) => (
            <Badge key={tag} variant="default" size="sm">{tag}</Badge>
          ))}
        </div>
      )}

      {relatedBooks.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[15px] font-bold text-text-primary font-heading mb-4">📚 相关推荐</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {relatedBooks.map((rb, idx) => {
              const rh = COVER_HUES[idx % COVER_HUES.length];
              return (
                <Link key={rb.id} to={`/books/${rb.id}`} className="shrink-0 w-36 group">
                  <div className="bg-bg-primary rounded-xl border border-border overflow-hidden hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
                    <div className={`h-28 ${rh.bg} flex items-center justify-center`}>
                      <BookOpen className="w-5 h-5 text-text-tertiary/40" strokeWidth={1.5} />
                    </div>
                    <div className="p-2.5">
                      <h3 className="text-[12px] font-semibold text-text-primary line-clamp-1 group-hover:text-accent transition-colors">{rb.title}</h3>
                      <p className="text-[10px] text-text-tertiary mt-0.5">{rb.author}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
