import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Heart, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import BookCover from '@/components/BookCover';
import { useBookStore } from '@/stores/bookStore';
import { favoriteApi } from '@/utils/api';
import type { BookFilter } from '@/types';

const LANGUAGE_CHIPS = [
  { value: '', label: 'All' },
  { value: 'en', label: 'EN' },
  { value: 'ms', label: 'MS' },
  { value: 'zh', label: 'ZH' },
  { value: 'ta', label: 'TA' },
];

const DIFFICULTY_CHIPS = [
  { value: '', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const LANG_DOT: Record<string, string> = {
  en: 'bg-blue-400',
  zh: 'bg-red-400',
  ms: 'bg-emerald-400',
  ta: 'bg-amber-400',
};

const DIFFICULTY_COLOR: Record<string, { dot: string; variant: 'success' | 'warning' | 'error' }> = {
  beginner: { dot: 'bg-emerald-400', variant: 'success' },
  intermediate: { dot: 'bg-amber-400', variant: 'warning' },
  advanced: { dot: 'bg-red-400', variant: 'error' },
};

export default function Books() {
  const { t } = useTranslation();
  const { books, categories, pagination, filters, isLoading, fetchBooks, fetchCategories, setFilters, setPage } = useBookStore();
  const [searchQuery, setSearchQuery] = useState(filters.search || '');
  const [showFilters, setShowFilters] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favLoadingIds, setFavLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCategories();
    fetchBooks();
  }, [filters, pagination.page]);

  useEffect(() => {
    if (books.length === 0) return;
    const ids = books.map((b) => b.id);
    Promise.allSettled(ids.map((id) => favoriteApi.checkFavorite(id)))
      .then((results) => {
        const favSet = new Set<string>();
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            const data = (r.value.data as any);
            if (data?.isFavorite) favSet.add(ids[i]);
          }
        });
        setFavoriteIds(favSet);
      });
  }, [books]);

  async function handleToggleFavorite(bookId: string, e: React.MouseEvent) {
    e.preventDefault();
    setFavLoadingIds((prev) => new Set(prev).add(bookId));

    const wasFavorited = favoriteIds.has(bookId);

    // Optimistic update: toggle immediately, revert on failure
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      wasFavorited ? next.delete(bookId) : next.add(bookId);
      return next;
    });

    try {
      if (wasFavorited) {
        await favoriteApi.removeFavorite(bookId);
      } else {
        await favoriteApi.addFavorite(bookId);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      // Revert on failure
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        wasFavorited ? next.add(bookId) : next.delete(bookId);
        return next;
      });
    } finally {
      setFavLoadingIds((prev) => { const next = new Set(prev); next.delete(bookId); return next; });
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters({ search: searchQuery || undefined });
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('books.bookList')}</h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            {pagination.total} {t('books.booksCount')}
            {filters.categoryId && categories.find(c => c.id === filters.categoryId) && (
              <span> &middot; {categories.find(c => c.id === filters.categoryId)!.name}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-lg hover:bg-bg-tertiary transition-colors"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t('books.filters')}
        </button>
      </div>

      {/* Search + Filter toolbar */}
      <div className="bg-surface rounded-xl border border-border p-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-3 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
            <input
              type="text"
              placeholder={t('home.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 bg-bg-tertiary/50 border border-border rounded-lg pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent focus:bg-bg-primary transition-all duration-150"
            />
          </div>
          <Button type="submit" className="h-10 rounded-lg shrink-0">{t('common.search')}</Button>
        </form>

        <div className={showFilters ? 'block space-y-3' : 'hidden lg:block'}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Language */}
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider shrink-0">{t('books.language')}</span>
              <div className="flex gap-1">
                {LANGUAGE_CHIPS.map((chip) => (
                  <button
                    key={chip.value}
                    onClick={() => setFilters({ language: chip.value || undefined })}
                    className={`px-3 py-2 text-[14px] font-semibold rounded-lg transition-all duration-150 ${
                      (filters.language || '') === chip.value
                        ? 'bg-accent text-white shadow-1'
                        : 'bg-bg-tertiary/50 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
                    }`}
                  >
                    {chip.value === '' ? t('common.all') : chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-px h-5 bg-border hidden lg:block" />

            {/* Difficulty */}
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider shrink-0">{t('books.difficulty')}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setFilters({ difficulty: undefined as any })}
                  className={`px-3 py-2 text-[14px] font-semibold rounded-lg transition-all duration-150 ${
                    !filters.difficulty
                      ? 'bg-accent text-white shadow-1'
                      : 'bg-bg-tertiary/50 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
                  }`}
                >
                  {t('common.all')}
                </button>
                {DIFFICULTY_CHIPS.filter(chip => chip.value !== '').map((chip) => (
                  <button
                    key={chip.value}
                    onClick={() => setFilters({ difficulty: (chip.value) as any })}
                    className={`px-3 py-2 text-[14px] font-semibold rounded-lg transition-all duration-150 ${
                      filters.difficulty === chip.value
                        ? 'bg-accent text-white shadow-1'
                        : 'bg-bg-tertiary/50 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
                    }`}
                  >
                    {chip.value === 'beginner' ? t('books.beginner') : chip.value === 'intermediate' ? t('books.intermediate') : t('books.advanced')}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-px h-5 bg-border hidden lg:block" />

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider shrink-0">{t('books.sortBy')}</span>
              <Select
                options={[
                  { value: 'createdAt', label: t('books.newest') },
                  { value: 'readCount', label: t('books.mostPopular') },
                  { value: 'title', label: t('books.titleAZ') },
                  { value: 'rating', label: t('books.topRated') },
                ]}
                value={filters.sortBy || 'createdAt'}
                onChange={(value) => {
                  const sortMap: Record<string, { sortBy: BookFilter['sortBy']; sortOrder: 'asc' | 'desc' }> = {
                    createdAt: { sortBy: 'createdAt', sortOrder: 'desc' },
                    readCount: { sortBy: 'readCount', sortOrder: 'desc' },
                    title: { sortBy: 'title', sortOrder: 'asc' },
                    rating: { sortBy: 'rating', sortOrder: 'desc' },
                  };
                  const sort = sortMap[value];
                  if (sort) setFilters(sort);
                }}
                className="w-36 h-9"
              />
            </div>
          </div>

          {/* Category chips */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider shrink-0">{t('books.category')}</span>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setFilters({ categoryId: undefined })}
                  className={`px-3 py-2 text-[14px] font-semibold rounded-lg transition-all duration-150 ${
                    !filters.categoryId
                      ? 'bg-accent text-white shadow-1'
                      : 'bg-bg-tertiary/50 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
                  }`}
                >
                  {t('common.all')}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilters({ categoryId: cat.id })}
                    className={`px-3 py-2 text-[14px] font-semibold rounded-lg transition-all duration-150 ${
                      filters.categoryId === cat.id
                        ? 'bg-accent text-white shadow-1'
                        : 'bg-bg-tertiary/50 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Book grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-xl" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4 opacity-30">
            <BookCover book={{ id: '' }} className="w-20 h-28 mx-auto rounded-lg" iconClassName="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-1">{t('books.noBooksFound')}</h3>
          <p className="text-sm text-text-tertiary">{t('books.noBooksHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          {books.map((book) => (
            <Link key={book.id} to={`/books/${book.id}`} className="group">
              <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-1 group-hover:shadow-2 group-hover:-translate-y-0.5 transition-all duration-200 h-full flex flex-col">
                <div className="h-44 relative overflow-hidden shrink-0 book-3d">
                  <BookCover book={book} className="w-full h-full" iconClassName="w-6 h-6 text-text-tertiary/40" />
                  <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                  <button
                    onClick={(e) => handleToggleFavorite(book.id, e)}
                    disabled={favLoadingIds.has(book.id)}
                    className={`absolute bottom-2 right-2 p-1.5 rounded-full bg-white/70 hover:bg-white hover:scale-110 transition-all duration-150 backdrop-blur-sm shadow-1 ${favLoadingIds.has(book.id) ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {favLoadingIds.has(book.id) ? (
                      <div className="w-3.5 h-3.5 border rounded-full animate-spin border-gray-300 border-t-accent" />
                    ) : (
                      <Heart
                        className={`w-3.5 h-3.5 ${favoriteIds.has(book.id) ? 'fill-error text-error' : 'text-text-tertiary'}`}
                        strokeWidth={1.5}
                      />
                    )}
                  </button>
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="text-[13px] font-semibold text-text-primary line-clamp-2 leading-snug group-hover:text-accent transition-colors">{book.title}</h3>
                  <p className="text-[11px] text-text-tertiary mt-1">{book.author}</p>
                  <div className="flex items-center gap-1.5 mt-auto pt-2">
                    <Badge variant="accent" size="sm">{book.fileType === 'epub' ? 'EPUB' : 'PDF'}</Badge>
                    <span className={`w-2 h-2 rounded-full ${LANG_DOT[book.language] || 'bg-gray-400'}`} />
                    <span className="text-[10px] text-text-tertiary font-mono">{book.language.toUpperCase()}</span>
                    {book.difficulty && (
                      <>
                        <span className="text-[10px] text-text-tertiary">&middot;</span>
                        <span className={`w-2 h-2 rounded-full ${DIFFICULTY_COLOR[book.difficulty]?.dot || 'bg-gray-400'}`} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <button
            disabled={pagination.page <= 1}
            onClick={() => setPage(pagination.page - 1)}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>

          {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
            const total = pagination.totalPages;
            let page: number;
            if (total <= 7) {
              page = i + 1;
            } else if (pagination.page <= 4) {
              page = i + 1;
            } else if (pagination.page >= total - 3) {
              page = total - 6 + i;
            } else {
              page = pagination.page - 3 + i;
            }
            return (
              <button
                key={page}
                onClick={() => setPage(page)}
                className={`min-w-[2rem] h-8 px-2 rounded-lg text-[13px] font-semibold transition-all duration-150 ${
                  page === pagination.page
                    ? 'bg-accent text-white shadow-1'
                    : 'text-text-secondary hover:bg-bg-tertiary'
                }`}
              >
                {page}
              </button>
            );
          })}

          {pagination.totalPages > 7 && pagination.page < pagination.totalPages - 3 && (
            <>
              <span className="text-text-tertiary text-[13px]">...</span>
              <button
                onClick={() => setPage(pagination.totalPages)}
                className="min-w-[2rem] h-8 px-2 rounded-lg text-[13px] font-semibold text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                {pagination.totalPages}
              </button>
            </>
          )}

          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage(pagination.page + 1)}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
