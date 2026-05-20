import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Sparkles, Search, Star, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import BookCover from '@/components/BookCover';
import FloatingAiAssistant from '@/components/FloatingAiAssistant';
import GameOverlay from '@/components/GameOverlay';
import BreadRain from '@/components/BreadRain';
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
  const { t } = useTranslation();
  const { books, categories, fetchBooks, fetchCategories, setFilters } = useBookStore();
  const [activeTab, setActiveTab] = useState('featured');
  const [showGame, setShowGame] = useState(false);
  const [showBreadRain, setShowBreadRain] = useState(false);
  const [showZhangChen, setShowZhangChen] = useState(false);
  const [secretInput, setSecretInput] = useState('');
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

  const featuredBooks = books.slice(0, 5);
  const popularBooks = [...books].sort((a, b) => b.readCount - a.readCount).slice(0, 5);

  return (
    <div>
      {/* Hero section */}
      <section
        className="relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: 'url(/banner.png)' }}
      >
        <div className="absolute inset-0 bg-black/25" />
        <div className="relative px-6 lg:px-10 py-8 sm:py-10">
          <div className="max-w-lg animate-fade-in">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[11px] font-semibold text-white/80 mb-3">
              <Sparkles className="w-3 h-3" strokeWidth={2} />
              {t('home.poweredBy', 'AI-Powered Digital Reading')}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white font-heading leading-[1.15] tracking-tight">
              {t('home.heroTitle')}
            </h1>
            <p className="mt-2 text-base text-white/65 leading-relaxed max-w-md">
              {t('home.heroSubtitle')}
            </p>

            <div className="mt-4 max-w-md">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder={t('home.searchPlaceholder')}
                  value={secretInput}
                  onChange={(e) => {
                    setSecretInput(e.target.value);
                    if (e.target.value === '我不爱学习') {
                      setShowGame(true);
                      setSecretInput('');
                    } else if (e.target.value === '我饿了') {
                      setShowBreadRain(true);
                      setSecretInput('');
                    } else if (e.target.value === '张晨') {
                      setShowZhangChen(true);
                      setSecretInput('');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value;
                      if (val === '我不爱学习') {
                        setShowGame(true);
                        setSecretInput('');
                      } else if (val === '我饿了') {
                        setShowBreadRain(true);
                        setSecretInput('');
                      } else if (val === '张晨') {
                        setShowZhangChen(true);
                        setSecretInput('');
                      } else {
                        setFilters({ search: val || undefined });
                        navigate('/books');
                      }
                    }
                  }}
                  className="w-full h-12 bg-white/[0.08] border border-white/10 rounded-xl pl-10 pr-4 text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/15 focus:bg-white/[0.12] transition-all"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {HERO_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => handleCategoryClick(cat.value)}
                  className="px-3 py-1.5 text-xs font-medium text-white/65 bg-white/[0.06] rounded-full hover:bg-white/[0.14] hover:text-white transition-all border border-white/[0.06]"
                >
                  {cat.value === '' ? t('common.all') : cat.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => navigate('/books')}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2 bg-white text-accent font-bold text-[14px] rounded-xl hover:bg-white/95 transition-all shadow-lg shadow-black/10"
            >
              {t('home.allBooks')}
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>
        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0 translate-y-px text-bg-secondary">
          <svg viewBox="0 0 1440 40" fill="currentColor" preserveAspectRatio="none" className="w-full h-8 sm:h-10">
            <path d="M0,20 C120,35 240,5 360,20 C480,35 600,5 720,20 C840,35 960,5 1080,20 C1200,35 1320,5 1440,20 L1440,40 L0,40 Z" />
          </svg>
        </div>
        {/* Floating cartoon characters on the wave */}
        <div className="absolute bottom-0 left-0 right-0 h-10 sm:h-12 pointer-events-none z-10 overflow-hidden">
          <span className="absolute text-lg sm:text-2xl animate-[slide-wave_3s_ease-in-out_infinite]" style={{ left: '8%', bottom: '2px' }}>⭐</span>
          <span className="absolute text-base sm:text-xl animate-[slide-wave_3.5s_ease-in-out_0.4s_infinite]" style={{ left: '22%', bottom: '1px' }}>⭐</span>
          <span className="absolute text-lg sm:text-2xl animate-[slide-wave_2.8s_ease-in-out_0.8s_infinite]" style={{ left: '38%', bottom: '3px' }}>⭐</span>
          <span className="absolute text-sm sm:text-lg animate-[slide-wave_4s_ease-in-out_1.2s_infinite]" style={{ left: '55%', bottom: '1px' }}>⭐</span>
          <span className="absolute text-base sm:text-xl animate-[slide-wave_3.2s_ease-in-out_1.6s_infinite]" style={{ left: '70%', bottom: '2px' }}>⭐</span>
          <span className="absolute text-lg sm:text-2xl animate-[slide-wave_3.6s_ease-in-out_0.6s_infinite]" style={{ left: '85%', bottom: '1px' }}>⭐</span>
        </div>
      </section>

      {/* Tab navigation */}
      <div className="sticky top-12 z-30 border-b border-border/60 bg-surface/80 backdrop-blur-md">
        <div className="px-6 lg:px-8 flex gap-0 overflow-x-auto scrollbar-hide">
          {HOME_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all',
                activeTab === tab.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary hover:border-border'
              )}
            >
              {tab.key === 'achievements' && (
                <Star className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" strokeWidth={1.5} />
              )}
              {tab.key === 'featured' && t('home.featuredBooks')}
              {tab.key === 'popular' && t('home.popularBooks')}
              {tab.key === 'recent' && t('home.recentlyRead')}
              {tab.key === 'achievements' && t('nav.achievements')}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="px-6 lg:px-8 py-6">
        {(activeTab === 'featured' || activeTab === 'popular') && (
          <>
            {/* === Featured Books — prominent strip with tinted background === */}
            <section className="mb-8 -mx-6 lg:-mx-8 px-6 lg:px-8 py-8 bg-accent/[0.03] border-y border-accent/8">
              <div className="flex items-end justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-1 rounded-full bg-accent" />
                  <div>
                    <h2 className="text-lg font-extrabold text-text-primary tracking-tight">
                      {activeTab === 'featured' ? t('home.featuredBooks') : t('home.popularBooks')}
                    </h2>
                    <p className="text-[13px] text-text-tertiary mt-0.5">{t('home.heroSubtitle')}</p>
                  </div>
                </div>
                <Link
                  to="/books"
                  className="flex items-center gap-1 text-[13px] font-semibold text-accent hover:text-accent-hover transition-colors shrink-0"
                >
                  {t('home.allBooks')} <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
                {(activeTab === 'featured' ? featuredBooks : popularBooks).map((book, idx) => (
                  <Link key={book.id} to={`/books/${book.id}`} className="group">
                    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-bg-tertiary book-3d relative ring-1 ring-accent/10">
                      <BookCover book={book} className="w-full h-full" iconClassName="w-8 h-8 text-text-tertiary/30" />
                      <div className="absolute top-2 left-2">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-accent text-white text-[10px] font-bold rounded-md shadow-sm">
                          <Sparkles className="w-2.5 h-2.5" strokeWidth={2.5} />
                          {t('home.featured', 'Featured')}
                        </span>
                      </div>
                    </div>
                    <h3 className="mt-2.5 text-sm font-semibold text-text-primary line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                      {book.title}
                    </h3>
                    <p className="text-[12px] text-text-tertiary mt-1">{book.author || t('books.general', 'General')}</p>
                  </Link>
                ))}
                {featuredBooks.length === 0 && (
                  <div className="grid grid-cols-5 gap-5 col-span-full">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i}>
                        <div className="skeleton aspect-[3/4] rounded-xl" />
                        <div className="skeleton h-3.5 w-3/4 mt-2 rounded" />
                        <div className="skeleton h-3 w-1/2 mt-1 rounded" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* === Popular Books — ranked list === */}
            <section className="mb-8">
              <div className="flex items-end justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-1 rounded-full bg-amber-400/60" />
                  <div>
                    <h2 className="text-lg font-extrabold text-text-primary tracking-tight">
                      {activeTab === 'featured' ? t('home.popularBooks') : t('home.featuredBooks')}
                    </h2>
                    <p className="text-[13px] text-text-tertiary mt-0.5">{t('leaderboard.byBooks')}</p>
                  </div>
                </div>
                <Link
                  to="/books"
                  className="flex items-center gap-1 text-[13px] font-semibold text-accent hover:text-accent-hover transition-colors shrink-0"
                >
                  {t('home.allBooks')} <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
                {(activeTab === 'popular' ? featuredBooks : popularBooks).map((book, idx) => (
                  <Link key={book.id} to={`/books/${book.id}`} className="group">
                    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-bg-tertiary book-3d relative">
                      <BookCover book={book} className="w-full h-full" iconClassName="w-8 h-8 text-text-tertiary/30" />
                      <div className="absolute top-2 left-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-extrabold shadow-sm">
                          {idx + 1}
                        </span>
                      </div>
                    </div>
                    <h3 className="mt-2.5 text-sm font-semibold text-text-primary line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                      {book.title}
                    </h3>
                    <p className="text-[12px] text-text-tertiary mt-1">{book.author || t('books.general', 'General')}</p>
                  </Link>
                ))}
                {(activeTab === 'popular' ? featuredBooks : popularBooks).length === 0 && (
                  <div className="grid grid-cols-5 gap-5 col-span-full">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i}>
                        <div className="skeleton aspect-[3/4] rounded-xl" />
                        <div className="skeleton h-3.5 w-3/4 mt-2 rounded" />
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
          <section className="py-10 text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-bg-tertiary flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-text-tertiary/40" strokeWidth={1} />
            </div>
            <h3 className="text-xl font-extrabold text-text-primary mb-2">{t('home.recentlyRead')}</h3>
            <p className="text-[13px] text-text-tertiary mb-6">{t('home.startReading')}</p>
            <button
              onClick={() => navigate('/books')}
              className="px-5 py-2.5 bg-accent text-white text-[13px] font-semibold rounded-xl hover:bg-accent-hover transition-colors shadow-sm"
            >
              {t('home.allBooks')}
            </button>
          </section>
        )}

        {activeTab === 'achievements' && (
          <section className="py-10 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent/8 flex items-center justify-center">
              <Star className="w-8 h-8 text-accent" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-extrabold text-text-primary mb-2">{t('nav.achievements')}</h3>
            <p className="text-[13px] text-text-tertiary mb-6">{t('home.achievementsHint', 'Track your reading achievements')}</p>
            <button
              onClick={() => navigate('/profile/achievements')}
              className="px-5 py-2.5 bg-accent text-white text-[13px] font-semibold rounded-xl hover:bg-accent-hover transition-colors shadow-sm"
            >
              {t('home.viewAchievements', 'View Achievements')}
            </button>
          </section>
        )}
      </div>

      <FloatingAiAssistant />
      {showGame && <GameOverlay onClose={() => setShowGame(false)} />}
      {showBreadRain && <BreadRain onDone={() => setShowBreadRain(false)} />}
      {showZhangChen && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center" onClick={() => setShowZhangChen(false)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-surface rounded-2xl shadow-3 p-8 max-w-sm mx-4 text-center animate-[scale-in_0.3s_ease-out] z-10" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl mb-4">😅</div>
            <h2 className="text-xl font-extrabold text-text-primary mb-2">提示</h2>
            <p className="text-text-secondary leading-relaxed">本系统不支持查找颜值过高的人</p>
            <button
              onClick={() => setShowZhangChen(false)}
              className="mt-5 px-6 py-2 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent-hover transition-colors"
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
