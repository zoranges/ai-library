import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Heart, Play, Star, Calendar, Building2, Hash, ChevronLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import BookCover from '@/components/BookCover';
import { useBookStore } from '@/stores/bookStore';
import { useReadingStore } from '@/stores/readingStore';
import { favoriteApi } from '@/utils/api';

const LANG_DOT: Record<string, string> = {
  en: 'bg-blue-400',
  zh: 'bg-red-400',
  ms: 'bg-emerald-400',
  ta: 'bg-amber-400',
};

export default function BookDetail() {
  const { t } = useTranslation();
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

  const langLabelMap: Record<string, string> = {
    en: t('lang.en'),
    zh: t('lang.zh'),
    ms: t('lang.ms'),
    ta: t('lang.ta'),
  };

  const difficultyMap: Record<string, { label: string; variant: 'success' | 'warning' | 'error' }> = {
    beginner: { label: t('books.beginner'), variant: 'success' },
    intermediate: { label: t('books.intermediate'), variant: 'warning' },
    advanced: { label: t('books.advanced'), variant: 'error' },
  };

  function getDifficultyLabel(d: string) {
    return difficultyMap[d] || { label: d, variant: 'default' as const };
  }

  if (!book) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] px-4">
        <div className="skeleton w-full max-w-4xl h-96" />
      </div>
    );
  }

  const diff = getDifficultyLabel(book.difficulty);
  const progressPct = currentProgress?.percentage ?? 0;
  const relatedBooks = books.filter((b) => b.categoryId === book.categoryId && b.id !== book.id).slice(0, 6);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-text-tertiary hover:text-accent mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" strokeWidth={1.5} /> {t('common.back')}
      </button>

      <div className="flex flex-col lg:flex-row gap-8 animate-fade-in">
        <div className="shrink-0">
          <div className="w-52 h-72 rounded-xl overflow-hidden shadow-1 relative">
            <BookCover book={book} className="w-full h-full" iconClassName="w-8 h-8 text-text-tertiary/40" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <Badge variant={diff.variant} size="sm">{diff.label}</Badge>
            <Badge variant="accent" size="sm">{book.fileType === 'epub' ? 'EPUB' : 'PDF'}</Badge>
            <Badge variant="outline" size="sm">
              <span className={`w-1.5 h-1.5 rounded-full ${LANG_DOT[book.language] || 'bg-gray-400'} mr-1`} />
              {langLabelMap[book.language] || book.language}
            </Badge>
          </div>

          <h1 className="text-2xl font-extrabold text-text-primary font-heading leading-tight">{book.title}</h1>
          <p className="text-sm text-text-secondary mt-2">{book.author}</p>

          <div className="flex items-center gap-4 mt-3 text-xs text-text-tertiary">
            {book.isbn && <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" strokeWidth={1.5} />{book.isbn}</span>}
            {book.publisher && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" strokeWidth={1.5} />{book.publisher}</span>}
            {book.publishDate && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />{book.publishDate}</span>}
          </div>

          {book.copyright && (
            <div className="mt-3 px-3 py-2 bg-warning/5 border border-warning/15 rounded-lg text-[11px] text-warning/80 leading-relaxed">{book.copyright}</div>
          )}

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-warning fill-warning" strokeWidth={1.5} />
              <span className="text-[13px] font-medium text-text-primary font-mono">{book.rating.toFixed(1)}</span>
              <span className="text-[11px] text-text-tertiary">({book.ratingCount})</span>
            </div>
            <span className="text-[11px] text-text-tertiary font-mono">{book.readCount} {t('books.readCount')}</span>
            <span className="text-[11px] text-text-tertiary font-mono">{book.pageCount} {t('books.pages')}</span>
          </div>

          {progressPct > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-text-secondary">{t('reader.readingProgress')}</span>
                <span className="text-accent font-medium font-mono">{progressPct}%</span>
              </div>
              <div className="w-full h-1 bg-bg-tertiary rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 mt-6">
            <Link to={`/read/${book.id}`}>
              <Button size="lg" icon={<Play className="w-4 h-4" strokeWidth={1.5} />} className="h-11 rounded-lg">
                {progressPct > 0 ? t('home.continueReading') : t('books.startReading')}
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              icon={<Heart className={`w-4 h-4 ${isFavorite ? 'fill-error text-error' : ''}`} strokeWidth={1.5} />}
              onClick={toggleFavorite}
              loading={favLoading}
              className="h-11 rounded-lg"
            >
              {isFavorite ? t('books.removeFromFavorites') : t('books.addToFavorites')}
            </Button>
          </div>
        </div>
      </div>

      {book.description && (
        <div className="mt-8 bg-bg-primary rounded-xl border border-border p-5">
          <h3 className="text-sm font-bold text-text-primary mb-2">{t('books.description')}</h3>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line max-w-2xl">{book.description}</p>
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
        <section className="mt-12">
          <h2 className="text-base font-extrabold text-text-primary font-heading mb-4">{t('books.relatedBooks')}</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {relatedBooks.map((rb) => (
              <Link key={rb.id} to={`/books/${rb.id}`} className="shrink-0 w-36 group">
                <div className="bg-bg-primary rounded-xl border border-border overflow-hidden shadow-1 group-hover:shadow-2 group-hover:-translate-y-0.5 transition-all duration-200">
                  <div className="h-28">
                    <BookCover book={rb} className="w-full h-full" iconClassName="w-5 h-5 text-text-tertiary/40" />
                  </div>
                  <div className="p-2.5">
                    <h3 className="text-xs font-semibold text-text-primary line-clamp-1 group-hover:text-accent transition-colors">{rb.title}</h3>
                    <p className="text-[10px] text-text-tertiary mt-0.5">{rb.author}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
