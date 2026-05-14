import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { Search, BookOpen, User, LogOut, Heart, Trophy, Settings, Menu, X, ChevronDown, Moon, Sun, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'ms', label: 'MS' },
  { code: 'zh', label: 'ZH' },
  { code: 'ta', label: 'TA' },
];

const NAV_LINKS = [
  { to: '/', label: '🏠 首页' },
  { to: '/books', label: '📚 书库' },
  { to: '/leaderboard', label: '🏆 排行' },
];

export default function FrontendLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLang, setActiveLang] = useState('en');
  const { user, isAuthenticated, fetchMe, logout } = useAuthStore();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchMe();
    }
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    setLangMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/books?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  function handleLogout() {
    logout();
    setUserMenuOpen(false);
    navigate('/');
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-secondary">
      <header className="sticky top-0 z-40 border-b-[3px] border-border" style={{ background: 'oklch(1.0 0.01 95 / 0.92)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2 shrink-0 group">
                <span className="text-2xl group-hover:animate-wiggle">🌟</span>
                <span className="text-[16px] font-black text-text-primary font-heading tracking-tight">AI 小书屋</span>
              </Link>
              <nav className="hidden md:flex items-center gap-0.5">
                {NAV_LINKS.map((link) => {
                  const isActive = location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to));
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={cn(
                        'px-3 py-1.5 text-[13px] font-bold rounded-xl transition-all duration-200',
                        isActive
                          ? 'text-white bg-accent cartoon-shadow'
                          : 'text-text-secondary hover:text-accent hover:bg-accent/10'
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="hidden md:flex items-center gap-3 flex-1 max-w-xs mx-6">
              <form onSubmit={handleSearch} className="w-full relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="搜索图书..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-bg-tertiary/70 border-[3px] border-border rounded-2xl pl-8 pr-3 py-1.5 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent focus:bg-bg-primary transition-all duration-200"
                />
              </form>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/60 transition-colors duration-150"
              >
                {isDark ? <Sun className="h-4 w-4" strokeWidth={1.5} /> : <Moon className="h-4 w-4" strokeWidth={1.5} />}
              </button>

              <div className="relative" ref={langMenuRef}>
                <button
                  onClick={() => setLangMenuOpen(!langMenuOpen)}
                  className="flex items-center gap-0.5 px-2 py-1.5 rounded-md text-[12px] font-medium text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/60 transition-colors duration-150 font-mono"
                >
                  {activeLang}
                  <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
                </button>
                {langMenuOpen && (
                  <div className="absolute right-0 mt-1 w-20 bg-bg-primary border border-border rounded-lg shadow-dropdown animate-scale-in overflow-hidden z-50">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => { setActiveLang(lang.code); setLangMenuOpen(false); }}
                        className={cn(
                          'w-full px-3 py-1.5 text-[12px] text-left font-mono transition-colors duration-100',
                          activeLang === lang.code ? 'bg-accent/8 text-accent font-medium' : 'text-text-secondary hover:bg-bg-tertiary'
                        )}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isAuthenticated ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 py-1 pl-1 pr-2 rounded-md hover:bg-bg-tertiary/60 transition-colors duration-150"
                  >
                    <div className="h-7 w-7 bg-accent/10 rounded-full flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                    </div>
                    <span className="hidden sm:block text-[13px] font-medium text-text-primary max-w-[100px] truncate">
                      {user?.username}
                    </span>
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-1.5 w-52 bg-bg-primary border border-border rounded-xl shadow-dropdown animate-scale-in overflow-hidden z-50">
                      <div className="px-3 py-2.5 border-b border-border">
                        <p className="text-[13px] font-medium text-text-primary">{user?.username}</p>
                        <p className="text-[11px] text-text-tertiary mt-0.5">{user?.email}</p>
                      </div>
                      <div className="py-1">
                        {(user?.role === 'super_admin' || user?.role === 'school_admin' || user?.role === 'admin') && (
                          <Link to="/admin" className="flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-accent hover:bg-accent/5 transition-colors duration-100">
                            <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />管理后台
                          </Link>
                        )}
                        <Link to="/profile" className="flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors duration-100">
                          <User className="h-3.5 w-3.5" strokeWidth={1.5} />我的主页
                        </Link>
                        <Link to="/profile/favorites" className="flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors duration-100">
                          <Heart className="h-3.5 w-3.5" strokeWidth={1.5} />我的收藏
                        </Link>
                        <Link to="/profile/achievements" className="flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors duration-100">
                          <Trophy className="h-3.5 w-3.5" strokeWidth={1.5} />我的成就
                        </Link>
                        <Link to="/profile/settings" className="flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors duration-100">
                          <Settings className="h-3.5 w-3.5" strokeWidth={1.5} />设置
                        </Link>
                      </div>
                      <div className="border-t border-border py-1">
                        <button onClick={handleLogout} className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[13px] text-error hover:bg-error/5 transition-colors duration-100">
                          <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />退出登录
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-1.5">
                  <Link to="/login" className="px-3 py-1.5 text-[13px] font-bold text-text-secondary hover:text-accent rounded-xl hover:bg-accent/10 transition-all duration-200">
                    登录
                  </Link>
                  <Link to="/register" className="cartoon-btn px-4 py-1.5 text-[13px] font-bold text-white bg-accent rounded-xl cartoon-shadow hover:bg-accent-hover transition-all duration-200">
                    注册
                  </Link>
                </div>
              )}

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/60 transition-colors duration-150"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-bg-primary shadow-xl animate-slide-in-right flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-border">
              <span className="text-[15px] font-semibold text-text-primary font-heading">Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <form onSubmit={handleSearch} className="relative mb-4">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="搜索图书..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-bg-tertiary/70 border-0 rounded-lg pl-8 pr-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </form>
              <nav className="space-y-0.5">
                {NAV_LINKS.map((link) => {
                  const isActive = location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to));
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'block px-3 py-2 text-[13px] font-medium rounded-lg transition-colors duration-100',
                        isActive ? 'text-text-primary bg-bg-tertiary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/60'
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="px-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">Language</p>
                <div className="flex gap-1 px-3">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { setActiveLang(lang.code); }}
                      className={cn(
                        'flex-1 py-1.5 text-[12px] font-mono font-medium rounded-md transition-colors duration-100',
                        activeLang === lang.code ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-tertiary'
                      )}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {!isAuthenticated && (
              <div className="px-4 py-4 border-t border-border space-y-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center px-4 py-2 text-[13px] font-medium text-text-secondary border border-border rounded-lg hover:bg-bg-tertiary transition-colors">
                  登录
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center px-4 py-2 text-[13px] font-medium text-white bg-accent rounded-lg hover:bg-accent-dark transition-colors">
                  注册
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-[18px] w-[18px] text-accent" strokeWidth={1.5} />
                <span className="text-[15px] font-extrabold text-text-primary font-heading tracking-tight">🌟 AI 小书屋</span>
              </div>
              <p className="text-[13px] text-text-tertiary leading-relaxed max-w-xs">AI 驱动的智能阅读平台，让阅读更有趣、更高效。</p>
            </div>
            <div>
              <h4 className="text-[12px] font-bold text-text-primary uppercase tracking-wider mb-3">探索</h4>
              <div className="space-y-2">
                <Link to="/books" className="block text-[13px] text-text-tertiary hover:text-accent transition-colors duration-150">📚 书库</Link>
                <Link to="/leaderboard" className="block text-[13px] text-text-tertiary hover:text-accent transition-colors duration-150">🏆 排行榜</Link>
              </div>
            </div>
            <div>
              <h4 className="text-[12px] font-bold text-text-primary uppercase tracking-wider mb-3">我的</h4>
              <div className="space-y-2">
                <Link to="/profile" className="block text-[13px] text-text-tertiary hover:text-accent transition-colors duration-150">🏠 主页</Link>
                <Link to="/profile/favorites" className="block text-[13px] text-text-tertiary hover:text-accent transition-colors duration-150">❤️ 收藏</Link>
                <Link to="/profile/achievements" className="block text-[13px] text-text-tertiary hover:text-accent transition-colors duration-150">⭐ 成就</Link>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-[11px] text-text-tertiary">&copy; 2025 AI 小书屋. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
