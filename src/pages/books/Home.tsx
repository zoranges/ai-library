import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, ChevronRight, Star, Sparkles,
  BookMarked, Layers, GraduationCap, Zap, Target, Globe,
} from 'lucide-react';
import BookCover from '@/components/BookCover';
import FloatingAiAssistant from '@/components/FloatingAiAssistant';
import { useBookStore } from '@/stores/bookStore';

const QUICK_LINKS = [
  { icon: Zap, labelKey: 'home.featuredBooks', descKey: 'home.recentlyRead', color: 'bg-blue-50 text-blue-600', iconBg: 'bg-blue-100', to: '/books' },
  { icon: Globe, labelKey: 'home.eResources', descKey: 'home.heroSubtitle', color: 'bg-purple-50 text-purple-600', iconBg: 'bg-purple-100', to: '/books' },
  { icon: Target, labelKey: 'nav.achievements', descKey: 'home.achievementsHint', color: 'bg-rose-50 text-rose-600', iconBg: 'bg-rose-100', to: '/profile/achievements' },
  { icon: Layers, labelKey: 'nav.discover', descKey: 'home.popularBooks', color: 'bg-green-50 text-green-600', iconBg: 'bg-green-100', to: '/books' },
  { icon: BookMarked, labelKey: 'nav.favorites', descKey: 'nav.favorites', color: 'bg-orange-50 text-orange-600', iconBg: 'bg-orange-100', to: '/profile/favorites' },
  { icon: GraduationCap, labelKey: 'nav.achievements', descKey: 'profile.achievements', color: 'bg-teal-50 text-teal-600', iconBg: 'bg-teal-100', to: '/leaderboard' },
];

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { books, fetchBooks, setFilters } = useBookStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBooks();
  }, []);

  const popularBooks = [...books].sort((a, b) => b.readCount - a.readCount).slice(0, 4);
  const featuredBooks = books.slice(0, 6);
  const newBooks = [...books].sort((a, b) => new Date(b.publishDate || 0).getTime() - new Date(a.publishDate || 0).getTime()).slice(0, 6);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setFilters({ search: searchQuery.trim() });
    }
    navigate('/books');
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* ===== HERO BANNER + POPULAR PANEL ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 lg:p-8 max-w-[1600px] mx-auto">
        {/* Hero Banner */}
        <div className="lg:col-span-2 relative rounded-2xl overflow-hidden min-h-[380px] sm:min-h-[440px]">
          <img
            src="/hero-banner.png"
            alt="Hero Banner"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, rgba(21,101,192,0.85) 0%, rgba(21,101,192,0.5) 50%, rgba(21,101,192,0.2) 100%)' }}
          />

          <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8">
            <div>
              <p className="text-white/70 text-xs font-semibold tracking-[0.2em] uppercase mb-2">
                {t('home.poweredBy', 'AI-Powered Digital Reading')}
              </p>
              <h1 className="text-white mb-2">
                <span className="text-xl sm:text-2xl font-semibold block leading-snug">
                  {t('home.splashSubtitle', 'Discover amazing stories')}
                </span>
                <span className="text-3xl sm:text-4xl lg:text-5xl font-black block leading-tight">
                  {t('home.heroTitle', 'AI Digital Library')}
                </span>
              </h1>
              <p className="text-white/80 text-sm leading-relaxed max-w-lg">
                {t('home.heroSubtitle', 'Read, learn, and grow with AI-powered reading assistance')}
              </p>
              <div className="flex items-center gap-3 mt-5">
                <div className="h-px w-8 bg-white/30" />
                <span className="text-white/60 text-xs font-medium tracking-wide italic">
                  Discover. Learn. Succeed.
                </span>
                <div className="h-px w-8 bg-white/30" />
              </div>
            </div>

            {/* Search bar */}
            <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg pl-4 pr-4 py-2.5 max-w-md">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder={t('home.searchPlaceholder', 'Search books, authors, or keywords...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none bg-transparent py-1"
              />
              <button
                onClick={handleSearch}
                className="bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors shrink-0"
              >
                {t('common.search', 'Search')}
              </button>
            </div>
          </div>
        </div>

        {/* Popular Books Side Panel */}
        <div className="bg-gradient-to-br from-[#FFF8E7] to-[#FFECB3] rounded-2xl shadow-xl overflow-hidden border-2 border-[#FFD54F] flex flex-col">
          <div className="bg-gradient-to-r from-[#FF6B6B] via-[#FF8E53] to-[#FFD93D] px-5 py-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-12 h-12 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-md">
                  <Sparkles className="h-5 w-5 text-[#FF6B6B]" />
                </div>
                <div>
                  <p className="text-white/90 text-xs font-medium">Hot Picks!</p>
                  <p className="text-white font-bold text-lg">{t('home.popularBooks', 'Popular Books')}</p>
                </div>
              </div>
              <Link
                to="/books"
                className="text-white/90 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                {t('home.allBooks', 'See All')} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="p-4 space-y-2 flex-1">
            {popularBooks.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-white/60 rounded-xl animate-pulse">
                    <div className="w-12 h-16 rounded-lg bg-gray-200 shrink-0" />
                    <div className="flex-1">
                      <div className="h-3 bg-gray-200 rounded mb-1" />
                      <div className="h-2 bg-gray-200 rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              popularBooks.map((book, index) => {
                const colors = [
                  'bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200',
                  'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200',
                  'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200',
                ];
                const color = colors[index % colors.length];

                return (
                  <Link
                    key={book.id}
                    to={`/books/${book.id}`}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl ${color} border-2 transition-all duration-300 hover:shadow-lg hover:-translate-x-1 hover:scale-[1.02] group cursor-pointer`}
                  >
                    <div className="relative w-12 h-16 rounded-lg overflow-hidden shadow-md shrink-0 group-hover:shadow-xl transition-shadow">
                      <BookCover book={book} className="w-full h-full" iconClassName="w-5 h-5 text-text-tertiary/30" />
                      <div className="absolute bottom-1 right-1">
                        <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                      </div>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-bold text-gray-800 line-clamp-1 group-hover:text-[#FF6B6B] transition-colors">
                        {book.title}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {book.category?.name || 'General'}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-2.5 w-2.5 ${i < Math.round(book.rating || 4) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400 ml-1">{book.rating || '4.0'}</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center group-hover:bg-[#FF6B6B] group-hover:text-white transition-all duration-300 shrink-0">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <div className="px-4 pb-4">
            <div className="flex items-center justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${i === 0 ? 'bg-[#FF6B6B] w-4' : 'bg-gray-300'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 lg:px-8">

        {/* ===== FEATURED BOOKS ===== */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-accent rounded-full" />
              <h2 className="text-lg font-extrabold text-text-primary">
                {t('home.featuredBooks', 'Featured Books')}
              </h2>
            </div>
            <Link
              to="/books"
              className="flex items-center gap-1 text-sm text-accent hover:text-accent-hover font-semibold"
            >
              {t('home.allBooks', 'View All')} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
            {featuredBooks.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="skeleton aspect-[3/4] rounded-xl" />
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              ))
            ) : (
              featuredBooks.map((book) => (
                <Link key={book.id} to={`/books/${book.id}`} className="group flex flex-col">
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1 mb-2.5 bg-bg-tertiary">
                    <BookCover book={book} className="w-full h-full" iconClassName="w-8 h-8 text-text-tertiary/30" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    <div className="absolute top-1.5 right-1.5 bg-accent/90 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Sparkles className="h-2 w-2" />
                      AI
                    </div>
                  </div>
                  <p className="text-xs font-bold text-text-primary leading-tight line-clamp-2 mb-0.5 group-hover:text-accent transition-colors">
                    {book.title}
                  </p>
                  <p className="text-[10px] text-text-tertiary line-clamp-1 mb-1">
                    {book.category?.name || 'General'}
                  </p>
                  {book.rating > 0 && (
                    <div className="flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-[10px] text-text-tertiary">{book.rating}</span>
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        </section>

        {/* ===== QUICK LINKS ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          {QUICK_LINKS.map((link, i) => (
            <Link
              key={i}
              to={link.to}
              className="flex items-start gap-3 p-4 rounded-xl border border-border hover:shadow-lg transition-all text-left group hover:border-accent/30 hover:bg-accent/[0.02]"
            >
              <div className={`h-10 w-10 rounded-xl ${link.iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
                <link.icon className={`h-5 w-5 ${link.color.split(' ')[1]}`} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-xs text-text-primary leading-tight">{t(link.labelKey, link.labelKey)}</p>
                <p className="text-[10px] text-text-tertiary mt-0.5 line-clamp-2 leading-tight">{t(link.descKey, '')}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* ===== NEW ARRIVALS / POPULAR ===== */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-accent rounded-full" />
              <h2 className="text-lg font-extrabold text-text-primary">
                {t('home.popularBooks', 'Popular Books')}
              </h2>
            </div>
            <Link
              to="/books"
              className="flex items-center gap-1 text-sm text-accent hover:text-accent-hover font-semibold"
            >
              {t('home.allBooks', 'View All')} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
            {newBooks.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="skeleton aspect-[3/4] rounded-xl" />
                  <div className="skeleton h-3 w-3/4 rounded" />
                </div>
              ))
            ) : (
              newBooks.map((book) => (
                <Link key={book.id} to={`/books/${book.id}`} className="group flex flex-col">
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1 mb-2.5 bg-bg-tertiary">
                    <BookCover book={book} className="w-full h-full" iconClassName="w-8 h-8 text-text-tertiary/30" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </div>
                  <p className="text-xs font-bold text-text-primary leading-tight line-clamp-2 mb-0.5 group-hover:text-accent transition-colors">
                    {book.title}
                  </p>
                  <p className="text-[10px] text-text-tertiary line-clamp-1 mb-1">{book.author || 'General'}</p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border bg-surface py-5 px-6 mt-8">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-tertiary">
          <p>{t('common.copyright', '© 2025 AI Digital Library System. All rights reserved.')}</p>
          <div className="flex gap-4">
            <span className="hover:text-accent transition-colors cursor-pointer">{t('common.privacyPolicy', 'Privacy Policy')}</span>
            <span className="hover:text-accent transition-colors cursor-pointer">{t('common.termsOfUse', 'Terms of Use')}</span>
            <span className="hover:text-accent transition-colors cursor-pointer">{t('common.help', 'Help')}</span>
            <span className="hover:text-accent transition-colors cursor-pointer">{t('common.contactUs', 'Contact Us')}</span>
          </div>
        </div>
      </footer>

      {/* Floating AI Assistant */}
      <FloatingAiAssistant />
    </div>
  );
}
