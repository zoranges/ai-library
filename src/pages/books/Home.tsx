import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, BookOpen, Heart, ChevronRight, ChevronLeft, BookMarked } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import { useBookStore } from '@/stores/bookStore';

const CATEGORIES = [
  { id: 'en-picture', name: '🎨 英语绘本', icon: BookOpen, count: 124, featured: true },
  { id: 'zh-stories', name: '📖 中文故事', icon: BookOpen, count: 89 },
  { id: 'ms-reading', name: '🌏 马来语阅读', icon: BookOpen, count: 76 },
  { id: 'science', name: '🔬 科学探索', icon: BookOpen, count: 52 },
  { id: 'history', name: '🏛️ 历史文化', icon: BookOpen, count: 41 },
  { id: 'art', name: '🎨 艺术创意', icon: BookOpen, count: 33 },
];

const LANGUAGE_CHIPS = [
  { value: '', label: '全部' },
  { value: 'en', label: 'EN' },
  { value: 'ms', label: 'MS' },
  { value: 'zh', label: 'ZH' },
  { value: 'ta', label: 'TA' },
];

const SORT_OPTIONS = [
  { value: 'title', label: '书名 A-Z' },
  { value: 'createdAt', label: '最新上架' },
  { value: 'readCount', label: '最受欢迎' },
];

const CARD_SHADOWS = [
  'cartoon-shadow',
  'cartoon-shadow-blue',
  'cartoon-shadow-green',
  'cartoon-shadow-purple',
];

const COVER_HUES = [
  { bg: 'bg-blue-50 dark:bg-blue-950/40', accent: 'bg-blue-200 dark:bg-blue-800' },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/40', accent: 'bg-emerald-200 dark:bg-emerald-800' },
  { bg: 'bg-amber-50 dark:bg-amber-950/40', accent: 'bg-amber-200 dark:bg-amber-800' },
  { bg: 'bg-rose-50 dark:bg-rose-950/40', accent: 'bg-rose-200 dark:bg-rose-800' },
  { bg: 'bg-violet-50 dark:bg-violet-950/40', accent: 'bg-violet-200 dark:bg-violet-800' },
  { bg: 'bg-cyan-50 dark:bg-cyan-950/40', accent: 'bg-cyan-200 dark:bg-cyan-800' },
];

const LANG_DOT: Record<string, string> = {
  en: 'bg-blue-400',
  zh: 'bg-red-400',
  ms: 'bg-emerald-400',
  ta: 'bg-amber-400',
};

export default function Home() {
  const { books, pagination, filters, isLoading, fetchBooks, fetchCategories, setFilters, setPage } = useBookStore();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [filters, pagination.page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters({ search: searchQuery });
  }

  function handleSort(value: string) {
    const sortMap: Record<string, { sortBy: 'title' | 'author' | 'rating' | 'readCount' | 'createdAt'; sortOrder: 'asc' | 'desc' }> = {
      title: { sortBy: 'title', sortOrder: 'asc' },
      createdAt: { sortBy: 'createdAt', sortOrder: 'desc' },
      readCount: { sortBy: 'readCount', sortOrder: 'desc' },
    };
    const sort = sortMap[value];
    if (sort) setFilters(sort);
  }

  return (
    <div>
      <section className="relative overflow-hidden wavy-border" style={{ background: 'linear-gradient(135deg, oklch(0.85 0.12 30), oklch(0.82 0.10 85), oklch(0.80 0.10 155), oklch(0.82 0.12 240))' }}>
        <div className="absolute top-8 left-12 text-4xl animate-float" style={{ animationDelay: '0s' }}>⭐</div>
        <div className="absolute top-16 right-20 text-3xl animate-float" style={{ animationDelay: '1s' }}>📚</div>
        <div className="absolute bottom-20 left-1/4 text-3xl animate-float" style={{ animationDelay: '0.5s' }}>🌈</div>
        <div className="absolute top-1/3 right-1/4 text-2xl animate-star" style={{ animationDelay: '0.3s' }}>✨</div>
        <div className="absolute bottom-24 right-12 text-3xl animate-float" style={{ animationDelay: '1.5s' }}>🦋</div>
        <div className="absolute top-6 left-1/3 text-2xl animate-star" style={{ animationDelay: '0.8s' }}>💫</div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-xl animate-bounce-in">
            <h1 className="text-4xl sm:text-5xl font-black text-white font-heading leading-[1.1] tracking-tight drop-shadow-lg">
              🌟 发现你的<br />下一本好书
            </h1>
            <p className="mt-4 text-[16px] text-white/80 leading-relaxed max-w-md font-semibold drop-shadow">
              和 AI 小助手一起探索精彩故事，在阅读中快乐成长！
            </p>
            <div className="mt-7">
              <button onClick={() => navigate('/books')} className="cartoon-btn inline-flex items-center gap-2 px-6 py-3 text-[15px] font-bold text-accent bg-white rounded-2xl cartoon-shadow hover:bg-white/95 transition-all duration-200">
                📚 浏览书库
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-1 relative z-10">
        <div className="bg-bg-primary rounded-xl border border-border shadow-card p-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Search books, authors, keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 bg-bg-tertiary/50 border-0 rounded-lg pl-10 pr-4 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all duration-150"
              />
            </div>
            <Button type="submit" className="h-11 rounded-lg shrink-0">Search</Button>
          </form>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
            <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider shrink-0">Language</span>
            <div className="flex gap-1">
              {LANGUAGE_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  onClick={() => setFilters({ language: chip.value || undefined })}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 ${
                    (filters.language || '') === chip.value
                      ? 'bg-accent text-white'
                      : 'bg-bg-tertiary/50 text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="ml-auto shrink-0">
              <Select
                options={SORT_OPTIONS}
                value={filters.sortBy === 'title' ? 'title' : filters.sortBy === 'readCount' ? 'readCount' : 'createdAt'}
                onChange={handleSort}
                fullWidth={false}
                className="w-32"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-extrabold text-text-primary font-heading">📚 分类探索</h2>
          <button className="text-[12px] text-accent hover:text-accent-dark flex items-center gap-0.5 transition-colors">
              查看全部 <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setFilters({ categoryId: cat.id })}
                className={`shrink-0 bg-bg-primary rounded-2xl border-[3px] border-border p-4 bubble-border hover:-translate-y-1 hover:rotate-[1deg] transition-all duration-200 text-left group ${
                  cat.featured ? 'w-52' : 'w-40'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 group-hover:scale-110 transition-all duration-200`}>
                  <Icon className="w-5 h-5 text-accent" strokeWidth={1.5} />
                </div>
                <h3 className={`text-[13px] font-semibold text-text-primary ${cat.featured ? '' : 'line-clamp-1'}`}>{cat.name}</h3>
                <p className="text-[11px] text-text-tertiary mt-0.5 font-mono">{cat.count} 本</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-extrabold text-text-primary font-heading">⭐ 为你推荐</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-64 rounded-xl" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-16">
            <BookMarked className="w-10 h-10 text-text-tertiary mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-[14px] text-text-tertiary">暂无图书</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {books.map((book, idx) => {
              const hue = COVER_HUES[idx % COVER_HUES.length];
              const shadow = CARD_SHADOWS[idx % CARD_SHADOWS.length];
              return (
                <Link key={book.id} to={`/books/${book.id}`} className="group">
                  <div className={`bg-bg-primary rounded-2xl border-[3px] border-border overflow-hidden ${shadow} hover:-translate-y-2 transition-all duration-200 hover:rotate-[-0.5deg]`}>
                    <div className={`h-36 ${hue.bg} flex items-center justify-center relative`}>
                      <div className={`w-16 h-20 rounded-lg ${hue.accent}/30 flex items-center justify-center`}>
                        <BookOpen className="w-6 h-6 text-text-tertiary/40" strokeWidth={1.5} />
                      </div>
                      <button
                        onClick={(e) => { e.preventDefault(); }}
                        className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-white/30 transition-colors"
                      >
                        <Heart className="w-3.5 h-3.5 text-text-tertiary/60" strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="p-3">
                      <h3 className="text-[13px] font-semibold text-text-primary line-clamp-1 group-hover:text-accent transition-colors">{book.title}</h3>
                      <p className="text-[11px] text-text-tertiary mt-0.5">{book.author}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Badge variant="accent" size="sm">{book.fileType === 'epub' ? 'EPUB' : 'PDF'}</Badge>
                        <span className={`w-2 h-2 rounded-full ${LANG_DOT[book.language] || 'bg-gray-400'}`} />
                        <span className="text-[10px] text-text-tertiary font-mono">{book.language.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 mt-10">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPage(pagination.page - 1)}
              className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
            {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => setPage(page)}
                  className={`w-8 h-8 rounded-md text-[13px] font-medium transition-colors duration-150 ${
                    page === pagination.page ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-tertiary'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(pagination.page + 1)}
              className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
