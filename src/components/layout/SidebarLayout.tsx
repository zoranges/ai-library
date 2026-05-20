import { useState, useEffect } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, User, LogOut, Menu, X, Bell, Moon, Sun, Shield,
  Home, BookMarked, Trophy, ChevronLeft, ChevronRight,
  Sparkles, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: any;
}

export default function SidebarLayout() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const mainNav: NavItem[] = [
    { key: 'home', label: t('nav.home'), path: '/', icon: Home },
    { key: 'library', label: t('nav.books'), path: '/books', icon: BookMarked },
    { key: 'leaderboard', label: t('nav.leaderboard'), path: '/leaderboard', icon: Trophy },
  ];

  const secondaryNav: NavItem[] = [
    { key: 'profile', label: t('nav.profile'), path: '/profile', icon: User },
    { key: 'achievements', label: t('nav.achievements'), path: '/profile/achievements', icon: Sparkles },
    { key: 'settings', label: t('nav.settings'), path: '/profile', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <Link to="/" className="flex items-center gap-3 px-4 py-4 border-b border-border/60">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center shrink-0 shadow-sm shadow-accent/20">
          <BookOpen className="h-5 w-5 text-white" strokeWidth={2} />
        </div>
        {!collapsed && (
          <span className="text-base font-extrabold text-text-primary tracking-tight whitespace-nowrap">AI Library</span>
        )}
      </Link>

      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5">
        <div>
          {!collapsed && (
            <p className="px-3 mb-1.5 text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Menu</p>
          )}
          <div className="space-y-0.5">
            {mainNav.map((item) => {
              const active = isActive(item.path, item.key);
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 text-[14px] font-medium rounded-lg transition-all duration-150',
                    active
                      ? 'text-accent bg-accent/8 font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className={cn('h-5 w-5 shrink-0', active && 'text-accent')} strokeWidth={active ? 2 : 1.5} />
                  {!collapsed && <span>{item.label}</span>}
                  {active && !collapsed && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {isAuthenticated && (
          <div>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[11px] font-bold text-text-tertiary uppercase tracking-widest">Account</p>
            )}
            <div className="space-y-0.5">
              {secondaryNav.map((item) => {
                const active = isActive(item.path, item.key);
                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 text-[14px] font-medium rounded-lg transition-all duration-150',
                      active
                        ? 'text-accent bg-accent/8 font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className={cn('h-5 w-5 shrink-0', active && 'text-accent')} strokeWidth={active ? 2 : 1.5} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}

              {(user?.role === 'super_admin' || user?.role === 'admin') && (
                <Link
                  to="/admin"
                  className="flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-text-secondary hover:text-accent hover:bg-accent/5 rounded-lg transition-all duration-150"
                  title={collapsed ? t('nav.admin') : undefined}
                >
                  <Shield className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                  {!collapsed && <span>{t('nav.admin')}</span>}
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-border/60 p-2.5">
        {isAuthenticated ? (
          <div className="space-y-1">
            <Link
              to="/profile"
              className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-bg-tertiary transition-colors group"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent/20 to-blue-500/20 flex items-center justify-center shrink-0 ring-1 ring-accent/10">
                <span className="text-xs font-bold text-accent">
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text-primary truncate leading-tight">{user?.username}</p>
                  <p className="text-[11px] text-text-tertiary leading-tight">{t('nav.viewProfile')}</p>
                </div>
              )}
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-2.5 py-2 w-full text-[13px] text-text-tertiary hover:text-error hover:bg-error/5 rounded-lg transition-colors"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
              {!collapsed && <span>{t('nav.logout')}</span>}
            </button>
          </div>
        ) : (
          <div className="space-y-1.5 px-1">
            <Link
              to="/login"
              className="block px-3 py-2 text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors text-center"
            >
              {t('auth.login')}
            </Link>
            <Link
              to="/register"
              className="block px-3 py-2 text-[13px] font-semibold text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors text-center shadow-sm"
            >
              {t('auth.register')}
            </Link>
          </div>
        )}
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center h-9 border-t border-border/60 text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary transition-colors"
        title={collapsed ? t('common.expandAll', 'Expand') : t('common.collapse', 'Collapse')}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} /> : <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-bg-secondary">
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 bg-surface border-r border-border/60 transition-all duration-200',
          collapsed ? 'w-16' : 'w-[248px]'
        )}
        style={{ boxShadow: collapsed ? 'none' : '1px 0 20px rgba(0,0,0,0.03)' }}
      >
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-surface border-r border-border animate-slide-in-left z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className={cn('flex-1 flex flex-col min-w-0', collapsed ? 'lg:ml-16' : 'lg:ml-[248px]')}>
        <header className="sticky top-0 z-30 h-12 bg-surface/80 backdrop-blur-md border-b border-border/60">
          <div className="h-full flex items-center gap-3 px-4 lg:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>

            <span className="text-[11px] text-text-tertiary font-medium hidden sm:block tracking-wide uppercase select-none">
              {isActive('/', 'home') && t('nav.home')}
              {location.pathname.startsWith('/books') && t('nav.library')}
              {isActive('/leaderboard', 'leaderboard') && t('nav.leaderboard')}
              {location.pathname.startsWith('/profile') && t('nav.profile')}
              {location.pathname.startsWith('/quiz') && t('quiz.title')}
            </span>

            <div className="flex-1" />

            <div className="flex items-center gap-0.5">
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                title={isDark ? t('common.lightMode') : t('common.darkMode')}
              >
                {isDark ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.5} /> : <Moon className="h-[18px] w-[18px]" strokeWidth={1.5} />}
              </button>

              <LanguageSwitcher />

              <button className="relative p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
                <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-error rounded-full ring-2 ring-surface/80" />
              </button>
            </div>

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

        <footer className="border-t border-border/60 bg-surface/50 shrink-0">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center">
                  <BookOpen className="h-3 w-3 text-white" strokeWidth={2} />
                </div>
                <span className="text-[13px] font-bold text-text-primary tracking-tight">AI Library</span>
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
