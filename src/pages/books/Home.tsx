import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Sparkles, Search, Star } from 'lucide-react';
import BookCover from '@/components/BookCover';
import { useBookStore } from '@/stores/bookStore';

const HERO_CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Science', value: 'science' },
  { label: 'History', value: 'history' },
  { label: 'Literature', value: 'literature' },
  { label: 'Technology', value: 'technology' },
];

const HOME_TABS = [
  { key: 'featured', label: 'Featured Books' },
  { key: 'popular', label: 'Popular Books' },
  { key: 'recent', label: 'Recently Read' },
  { key: 'achievements', label: 'Achievements' },
];

export default function Home() {
  const { books, categories, fetchBooks, fetchCategories, setFilters, pagination } = useBookStore();
  const [activeTab, setActiveTab] = useState('featured');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
    fetchBooks();
  }, []);

  const handleCategoryClick = (value: string) => {
    if (value) {
      setFilters({ categoryId: undefined });
      navigate('/books');
    } else {
      navigate('/books');
    }
  };

  const featuredBooks = books.slice(0, 8);
  const popularBooks = [...books].sort((a, b) => b.readCount - a.readCount).slice(0, 8);

  return (
    <div>
      {/* Hero section */}
      <section className="hero-gradient relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-xl animate-fade-in">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-heading leading-[1.15] tracking-tight">
              Welcome to Your AI Library
            </h1>
            <p className="mt-3 text-lg text-white/70 font-medium">
              Discover. Learn. Succeed.
            </p>
            <p className="mt-4 text-sm text-white/55 leading-relaxed max-w-md">
              Explore thousands of books and resources powered by AI, for every student.
            </p>

            {/* Category filter pills */}
            <div className="mt-6 flex items-center gap-2 flex-wrap">
              {HERO_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => handleCategoryClick(cat.value)}
                  className="px-4 py-1.5 text-sm font-medium text-white/80 bg-white/10 rounded-full hover:bg-white/20 hover:text-white transition-colors border border-white/10"
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search bar */}
            <div className="mt-4 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Search books, authors, keywords..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setFilters({ search: (e.target as HTMLInputElement).value || undefined });
                      navigate('/books');
                    }
                  }}
                  className="w-full h-11 bg-white/10 border border-white/15 rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/25 focus:border-white/25 transition-all"
                />
              </div>
            </div>

            <button
              onClick={() => navigate('/books')}
              className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-white text-accent font-semibold text-sm rounded-lg hover:bg-white/95 transition-colors shadow-lg"
            >
              Browse Library
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </section>

      {/* Tab navigation */}
      <div className="sticky top-14 z-40 border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-0 overflow-x-auto scrollbar-hide">
          {HOME_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
              }`}
            >
              {tab.key === 'achievements' && (
                <Star className="inline-block w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
              )}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {(activeTab === 'featured' || activeTab === 'popular') && (
          <>
            {/* Book row */}
            <section className="py-8">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-text-primary">
                    {activeTab === 'featured' ? 'Featured Books' : 'Popular Books'}
                  </h2>
                  <p className="text-sm text-text-tertiary mt-0.5">
                    Discover, learn, and grow with AI-enhanced books
                  </p>
                </div>
                <Link
                  to="/books"
                  className="flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover transition-colors shrink-0"
                >
                  View All <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                </Link>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 scrollbar-hide">
                {(activeTab === 'featured' ? featuredBooks : popularBooks).map((book) => (
                  <Link
                    key={book.id}
                    to={`/books/${book.id}`}
                    className="shrink-0 w-40 group"
                  >
                    <div className="aspect-[3/4] rounded-lg overflow-hidden bg-bg-tertiary shadow-1 group-hover:shadow-2 transition-all duration-200 relative">
                      <BookCover book={book} className="w-full h-full" iconClassName="w-6 h-6 text-text-tertiary/30" />
                      <div className="absolute top-2 left-2">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-accent text-white text-[10px] font-semibold rounded">
                          <Sparkles className="w-2.5 h-2.5" strokeWidth={2} />
                          AI
                        </span>
                      </div>
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-text-primary line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                      {book.title}
                    </h3>
                    <p className="text-xs text-text-tertiary mt-0.5">General</p>
                  </Link>
                ))}
                {featuredBooks.length === 0 && (
                  <div className="flex gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="shrink-0 w-40">
                        <div className="skeleton aspect-[3/4] rounded-lg" />
                        <div className="skeleton h-4 w-3/4 mt-2 rounded" />
                        <div className="skeleton h-3 w-1/2 mt-1 rounded" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Show the other book row too */}
            <section className="pb-8">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-text-primary">
                    {activeTab === 'featured' ? 'Popular Books' : 'Featured Books'}
                  </h2>
                  <p className="text-sm text-text-tertiary mt-0.5">
                    Discover, learn, and grow with AI-enhanced books
                  </p>
                </div>
                <Link
                  to="/books"
                  className="flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover transition-colors shrink-0"
                >
                  View All <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                </Link>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 scrollbar-hide">
                {(activeTab === 'popular' ? featuredBooks : popularBooks).map((book) => (
                  <Link
                    key={book.id}
                    to={`/books/${book.id}`}
                    className="shrink-0 w-40 group"
                  >
                    <div className="aspect-[3/4] rounded-lg overflow-hidden bg-bg-tertiary shadow-1 group-hover:shadow-2 transition-all duration-200 relative">
                      <BookCover book={book} className="w-full h-full" iconClassName="w-6 h-6 text-text-tertiary/30" />
                      <div className="absolute top-2 left-2">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-accent text-white text-[10px] font-semibold rounded">
                          <Sparkles className="w-2.5 h-2.5" strokeWidth={2} />
                          AI
                        </span>
                      </div>
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-text-primary line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                      {book.title}
                    </h3>
                    <p className="text-xs text-text-tertiary mt-0.5">General</p>
                  </Link>
                ))}
                {(activeTab === 'popular' ? featuredBooks : popularBooks).length === 0 && (
                  <div className="flex gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="shrink-0 w-40">
                        <div className="skeleton aspect-[3/4] rounded-lg" />
                        <div className="skeleton h-4 w-3/4 mt-2 rounded" />
                        <div className="skeleton h-3 w-1/2 mt-1 rounded" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === 'recent' && (
          <section className="py-12 text-center">
            <div className="text-6xl mb-4 opacity-30">
              <BookCover book={{ id: '' }} className="w-20 h-28 mx-auto rounded-lg" iconClassName="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-1">No recent reading</h3>
            <p className="text-sm text-text-tertiary mb-6">Start reading a book to see it here.</p>
            <button
              onClick={() => navigate('/books')}
              className="px-5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors shadow-1"
            >
              Browse Library
            </button>
          </section>
        )}

        {activeTab === 'achievements' && (
          <section className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
              <Star className="w-8 h-8 text-accent" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-1">Achievements</h3>
            <p className="text-sm text-text-tertiary mb-6">Complete reading goals to earn achievements and badges.</p>
            <button
              onClick={() => navigate('/profile/achievements')}
              className="px-5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors shadow-1"
            >
              View Achievements
            </button>
          </section>
        )}
      </div>

      {/* AI Reading Assistant section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mb-8">
        <div className="bg-gradient-to-br from-accent/5 to-brand-100/30 rounded-xl border border-accent/10 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-white" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-text-primary">AI Reading Assistant</h2>
              <p className="text-sm text-text-secondary mt-1">
                Hello! I'm your AI reading assistant. I can help you with:
              </p>
              <ul className="mt-4 space-y-2 text-sm text-text-secondary">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  Find books
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  Summarise content
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  Explain in simple terms
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  Recommend reads
                </li>
              </ul>
              <button
                onClick={() => navigate('/books')}
                className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-accent text-white font-medium text-sm rounded-lg hover:bg-accent-hover transition-colors shadow-1"
              >
                <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                Start Chat
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
