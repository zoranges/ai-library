import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User, LogOut, Menu, Globe, ChevronDown, Sun, Moon, Bell,
  Home, BookMarked, Trophy, Sparkles, Heart,
  ChevronRight, Settings, Target, Camera, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';

const LANGS = [
  { code: 'en', label: 'English', flag: 'GB' },
  { code: 'ms', label: 'Bahasa Melayu', flag: 'MY' },
  { code: 'zh', label: '中文', flag: 'CN' },
  { code: 'ta', label: 'தமிழ்', flag: 'IN' },
];

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: any;
  iconImage?: string;
}

export default function SidebarLayout() {
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showHeaderLangMenu, setShowHeaderLangMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const headerLangRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, fetchMe, logout } = useAuthStore();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string, key: string) => {
    if (key === 'home') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    if (isAuthenticated && !user) fetchMe();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerLangRef.current && !headerLangRef.current.contains(e.target as Node)) {
        setShowHeaderLangMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const mainNav: NavItem[] = [
    { key: 'home', label: t('nav.home'), path: '/', icon: Home, iconImage: '/nav-icons/home.png' },
    { key: 'library', label: t('nav.books'), path: '/books', icon: BookMarked, iconImage: '/nav-icons/library.png' },
    { key: 'favorites', label: t('nav.favorites'), path: '/profile/favorites', icon: Heart, iconImage: '/nav-icons/shoucang.png' },
    { key: 'notes', label: t('nav.notes'), path: '/profile/notes', icon: Sparkles, iconImage: '/nav-icons/biji.png' },
    { key: 'achievements', label: t('nav.achievements'), path: '/profile/achievements', icon: Trophy, iconImage: '/nav-icons/chengjiu.png' },
    { key: 'leaderboard', label: t('nav.leaderboard'), path: '/leaderboard', icon: Trophy, iconImage: '/nav-icons/gaoliang.png' },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-white/10 relative z-10 flex justify-center">
        <Link to="/">
          <img src="/logo.png" alt="AI Library" className="h-28 w-auto" />
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden px-3 space-y-1.5 relative z-10 sidebar-nav">
        {mainNav.map((item) => {
          const active = isActive(item.path, item.key);
          return (
            <Link
              key={item.key}
              to={item.path}
              className={cn(
                'flex items-center gap-4 h-[60px] text-[17px] transition-all duration-300 rounded-xl font-semibold tracking-wide',
                active
                  ? 'text-[#1E3A8A]'
                  : 'text-white hover:bg-white/10 hover:text-white/90',
                collapsed && 'justify-center px-0'
              )}
              style={active ? {
                background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(219,234,254,0.85) 50%, rgba(191,219,254,0.75) 100%)',
                border: '1.5px solid rgba(96,165,250,0.5)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.12), 0 0 0 3px rgba(59,130,246,0.12), 0 0 20px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
              } : undefined}
            >
              {item.iconImage ? (
                <img src={item.iconImage} alt="" className="h-[38px] w-[38px] shrink-0 object-contain" />
              ) : (
                <item.icon className={cn('h-5 w-5 shrink-0', active && 'text-[#2563EB]')} strokeWidth={1.5} />
              )}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* NILAM */}
      <div className="px-3 relative z-10">
        <a
          href="https://ains.moe.gov.my/login?returnUrl=/"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-4 h-[60px] text-[17px] transition-all duration-300 rounded-xl font-semibold tracking-wide',
            'text-white hover:bg-white/10 hover:text-white/90',
            collapsed && 'justify-center px-0'
          )}
        >
          <ExternalLink className="h-5 w-5 shrink-0" strokeWidth={1.5} />
          {!collapsed && <span className="truncate">NILAM</span>}
        </a>
      </div>

      {/* Bottom Controls */}
      <div className="border-t border-white/10 p-3 space-y-1 relative z-10">
        {/* Language Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white text-sm transition-colors"
          >
            <Globe className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left truncate">{t('nav.switchLang')}</span>
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
          </button>
          {showLangMenu && (
            <div className="absolute bottom-full left-0 mb-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 min-w-[150px]">
              {LANGS.map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => { i18n.changeLanguage(code); setShowLangMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-[#2563EB] transition-colors flex items-center gap-2 ${
                    i18n.language === code ? 'bg-blue-50 text-[#2563EB] font-semibold' : 'text-gray-700'
                  }`}
                >
                  <span className="text-xs font-bold w-6">{code.toUpperCase()}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white text-sm transition-colors"
        >
          {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          <span>{isDark ? t('common.lightMode') : t('common.darkMode')}</span>
        </button>
        <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white text-sm transition-colors relative">
          <Bell className="h-4 w-4 shrink-0" />
          <span>{t('common.notifications', 'Notifications')}</span>
          <span className="absolute right-2 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">3</span>
        </button>
      </div>

      {/* Footer - Logout */}
      <div className="border-t border-white/10 p-3 relative z-10">
        {isAuthenticated ? (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/15 text-white hover:bg-white/25 text-sm transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>{t('nav.logout')}</span>
          </button>
        ) : (
          <div className="space-y-1.5">
            <Link
              to="/login"
              className="block px-3 py-2 text-[13px] font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-center"
            >
              {t('auth.login')}
            </Link>
            <Link
              to="/register"
              className="block px-3 py-2 text-[13px] font-semibold text-white bg-white/15 rounded-lg hover:bg-white/25 transition-colors text-center"
            >
              {t('auth.register')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-bg-secondary">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 transition-all duration-200 overflow-hidden',
          collapsed ? 'w-20' : 'w-[250px]'
        )}
        style={{
          backgroundColor: '#1565C0',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside
            className="relative w-64 flex flex-col overflow-hidden animate-slide-in-left z-50"
            style={{ backgroundColor: '#1565C0' }}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className={cn('flex-1 flex flex-col min-w-0', collapsed ? 'lg:ml-20' : 'lg:ml-[250px]')}>
        {/* Top Header — Aliyun style */}
        <header className="sticky top-0 z-30 h-20 bg-white shadow-sm border-b border-gray-50">
          <div className="h-full flex items-center gap-3 px-4 lg:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>

            <span className="text-xs text-text-tertiary font-medium tracking-wide uppercase select-none">
              {isActive('/', 'home') && t('nav.home')}
              {location.pathname.startsWith('/books') && t('nav.library')}
              {isActive('/leaderboard', 'leaderboard') && t('nav.leaderboard')}
              {location.pathname.startsWith('/profile') && t('nav.profile')}
              {location.pathname.startsWith('/quiz') && 'Quiz'}
            </span>

            <div className="flex-1" />

            {/* Desktop header controls */}
            <div className="hidden lg:flex items-center gap-3">
              {/* Language Switcher */}
              <div className="relative" ref={headerLangRef}>
                <button
                  onClick={() => setShowHeaderLangMenu(!showHeaderLangMenu)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-gray-700 hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 hover:text-[#1565C0] text-sm font-medium transition-all duration-300 hover:shadow-sm"
                >
                  <Globe className="h-5 w-5 shrink-0" />
                  <span className="hidden sm:inline">{LANGS.find(l => l.code === i18n.language)?.code?.toUpperCase() || 'EN'}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${showHeaderLangMenu ? 'rotate-180' : ''}`} />
                </button>
                {showHeaderLangMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 min-w-[150px]">
                    {LANGS.map(({ code, label }) => (
                      <button
                        key={code}
                        onClick={() => { i18n.changeLanguage(code); setShowHeaderLangMenu(false); }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 hover:text-[#1565C0] transition-all duration-200 flex items-center gap-3 ${
                          i18n.language === code ? 'bg-gradient-to-r from-blue-50 to-cyan-50 text-[#1565C0] font-semibold' : 'text-gray-700'
                        }`}
                      >
                        <span className="text-xs font-bold w-7 bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-lg px-2 py-1 text-center">{code.toUpperCase()}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-gray-700 hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 hover:text-[#1565C0] text-sm font-medium transition-all duration-300 hover:shadow-sm"
              >
                {isDark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
              </button>

              {/* Notifications */}
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-gray-700 hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 hover:text-[#1565C0] text-sm font-medium transition-all duration-300 hover:shadow-sm relative">
                <Bell className="h-5 w-5 shrink-0" />
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg">3</span>
              </button>
            </div>

            {/* User Profile Dropdown */}
            {isAuthenticated && (
              <div className="relative hidden lg:block" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-2xl px-4 py-2.5 transition-all duration-300 hover:shadow-md"
                >
                  <img
                    src={user?.avatar || '/default-avatar.png'}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm"
                  />
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-bold text-gray-800 leading-tight">
                      {user?.username || t('common.student', 'Student')}
                    </p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-500 shrink-0 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 w-72 overflow-hidden">
                    <div className="p-5 flex flex-col items-center">
                      <div className="relative mb-3 group cursor-pointer">
                        <img
                          src={user?.avatar || '/default-avatar.png'}
                          alt=""
                          className="h-16 w-16 rounded-full object-cover ring-4 ring-blue-100 shrink-0"
                        />
                        <label className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <Camera className="h-5 w-5 text-white" />
                          <input type="file" accept="image/*" className="hidden" />
                        </label>
                      </div>
                      <p className="font-bold text-base text-[#1E293B] mb-0.5">
                        {user?.username || t('common.student', 'Student')}
                      </p>
                      <p className="text-sm text-gray-500 mb-3">
                        {user?.email || 'student@example.com'}
                      </p>
                      <div className="rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 px-3 py-1.5">
                        <p className="text-sm font-bold text-[#1E293B] font-mono tracking-wide text-center">
                          {(user as any)?.icNumber || (user?.id ? String(user.id).substring(0, 6) : '000000')}
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 py-1">
                      <Link
                        to="/profile/growth"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-[#1E293B] hover:bg-gray-50 transition-colors"
                      >
                        <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                          <Target className="h-4 w-4 text-rose-500" />
                        </div>
                        <span className="flex-1 text-left">{t('profile.readingGoals', 'Reading Goals')}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                      </Link>
                      <Link
                        to="/profile"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-[#1E293B] hover:bg-gray-50 transition-colors"
                      >
                        <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Settings className="h-4 w-4 text-gray-500" />
                        </div>
                        <span className="flex-1 text-left">{t('nav.profile', 'Manage')}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                      </Link>
                      <button
                        onClick={() => { handleLogout(); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                          <LogOut className="h-4 w-4 text-red-500" />
                        </div>
                        <span className="flex-1 text-left">{t('nav.logout', 'Sign Out')}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-red-300" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile profile link */}
            {isAuthenticated && (
              <Link
                to="/profile"
                className="lg:hidden p-1 rounded-md hover:bg-bg-tertiary transition-colors"
              >
                <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                </div>
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60 bg-surface/50 shrink-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="AI Library" className="h-6 w-auto" />
              </div>
              <div className="flex items-center gap-5 text-[12px] text-text-tertiary">
                <Link to="/" className="hover:text-accent transition-colors">{t('nav.home')}</Link>
                <Link to="/books" className="hover:text-accent transition-colors">{t('nav.books')}</Link>
                <Link to="/leaderboard" className="hover:text-accent transition-colors">{t('nav.leaderboard')}</Link>
                <span className="hidden sm:inline">{t('common.copyright', '© 2025 AI Library. All rights reserved.')}</span>
              </div>
              <p className="text-[11px] text-text-tertiary sm:hidden">{t('common.copyright', '© 2025 AI Library. All rights reserved.')}</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
