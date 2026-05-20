import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, School, Users, BookOpen, BarChart3, Trophy,
  UserCog, ArrowLeftRight, ChevronRight, Menu, X, LogOut, Bell, Zap, Search, BookOpen as BookIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { adminApi } from '@/utils/api';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface SidebarItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

export default function AdminLayout() {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function doSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const res = await adminApi.search(q, 8);
      setSearchResults(res.data);
      setSearchOpen(true);
    } catch {} finally { setSearching(false); }
  }

  const isSuperAdmin = user?.role === 'super_admin';

  const sidebarItems: SidebarItem[] = useMemo(() => {
    const items: SidebarItem[] = [
      { key: 'dashboard', label: t('admin.dashboard'), icon: <LayoutDashboard className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin' },
      { key: 'schools', label: t('admin.schools'), icon: <School className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/schools' },
      { key: 'students', label: t('admin.students'), icon: <Users className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/students' },
      { key: 'books', label: t('admin.books'), icon: <BookOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/books' },
      { key: 'statistics', label: t('admin.statistics'), icon: <BarChart3 className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/statistics' },
      { key: 'leaderboard', label: t('admin.leaderboard'), icon: <Trophy className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/leaderboard' },
    ];
    if (isSuperAdmin) {
      items.push(
        { key: 'admins', label: t('admin.admins'), icon: <UserCog className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/admins' },
        { key: 'role-switch', label: t('admin.roleSwitch'), icon: <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/role-switch' },
        { key: 'ai-config', label: t('admin.aiConfig'), icon: <Zap className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/ai-config' },
      );
    }
    return items;
  }, [t, isSuperAdmin]);

  const labelMap: Record<string, string> = useMemo(() => ({
    admin: t('admin.backend', 'Admin Panel'),
    schools: t('admin.schools'),
    students: t('admin.students'),
    books: t('admin.books'),
    statistics: t('admin.statistics'),
    leaderboard: t('admin.leaderboard'),
    admins: t('admin.admins'),
    account: t('admin.account'),
    'role-switch': t('admin.roleSwitch'),
    new: t('common.new', 'New'),
    edit: t('common.edit'),
  }), [t]);

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; path: string }[] = [{ label: t('admin.backend', 'Admin Panel'), path: '/admin' }];
    const segments = location.pathname.split('/').filter(Boolean);
    let path = '';
    segments.forEach((seg, i) => {
      path += `/${seg}`;
      if (i > 0) {
        crumbs.push({ label: labelMap[seg] || seg, path });
      }
    });
    return crumbs;
  }, [location.pathname, labelMap, t]);

  const activeKey = sidebarItems.find((item) => location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path)))?.key || 'dashboard';

  function handleLogout() {
    logout();
    navigate('/admin/login');
  }

  return (
    <div className="min-h-screen flex bg-bg-secondary">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden transition-opacity duration-standard ease-out-quart"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-60 flex flex-col transition-transform duration-standard ease-out-quart lg:translate-x-0 lg:static',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: 'oklch(0.14 0.015 255)' }}
      >
        <div className="flex items-center gap-2.5 h-14 px-5 border-b border-white/[0.06] shrink-0">
          <div className="h-7 w-7 bg-accent rounded-md flex items-center justify-center">
            <BookIcon className="h-4 w-4 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[15px] font-semibold text-white font-heading tracking-tight">AI Library</span>
          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-white/[0.08] text-white/60 rounded">{t('admin.adminPanel', 'Admin')}</span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-1 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <div className="space-y-0.5">
            {sidebarItems.map((item) => {
              const isActive = activeKey === item.key;
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'relative flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded-md transition-all duration-micro ease-out-quart',
                    isActive
                      ? 'text-white bg-white/[0.08]'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-accent rounded-r-full" />
                  )}
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/[0.06] p-3 shrink-0">
          <Link
            to="/"
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-white/40 hover:text-white/70 rounded-md hover:bg-white/[0.04] transition-colors"
          >
            <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={1.5} />
            {t('admin.backToFrontend', 'Back to Frontend')}
          </Link>
        </div>

        <div className="border-t border-white/[0.06] p-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-white/[0.08] flex items-center justify-center text-white/60 text-xs font-medium">
              {user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white/80 truncate">{user?.username || t('admin.admins')}</p>
              <p className="text-[11px] text-white/35">{user?.role === 'super_admin' ? t('admin.superAdmin') : t('admin.schoolAdmin')}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              title={t('auth.logout')}
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-12 bg-bg-primary border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors"
            >
              <Menu className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <nav className="flex items-center gap-1 text-[13px]">
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.path} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-text-tertiary" strokeWidth={1.5} />}
                  {i === breadcrumbs.length - 1 ? (
                    <span className="text-text-primary font-medium">{crumb.label}</span>
                  ) : (
                    <Link to={crumb.path} className="text-text-tertiary hover:text-accent transition-colors">{crumb.label}</Link>
                  )}
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Global Search */}
            <div className="relative" ref={searchRef}>
              <div className="flex items-center gap-1.5 bg-surface-raised rounded-md px-2.5 py-1.5 text-[12px] w-48 transition-all focus-within:w-64 focus-within:ring-2 focus-within:ring-accent/20">
                <Search className="h-3.5 w-3.5 text-text-tertiary shrink-0" strokeWidth={1.5} />
                <input
                  className="bg-transparent border-none outline-none text-text-primary placeholder:text-text-tertiary w-full"
                  placeholder={t('common.search') + '...'}
                  value={searchQuery}
                  onChange={(e) => doSearch(e.target.value)}
                  onFocus={() => searchResults && setSearchOpen(true)}
                />
                {searching && <div className="w-3 h-3 border border-accent/30 border-t-accent rounded-full animate-spin shrink-0" />}
              </div>
              {searchOpen && searchResults && (
                <div className="absolute top-full mt-1 right-0 w-80 bg-surface border border-border rounded-lg shadow-2 z-50 max-h-80 overflow-y-auto">
                  {searchResults.books?.length > 0 && (
                    <div className="p-2">
                      <p className="text-[10px] font-medium text-text-tertiary uppercase px-2 py-1">{t('admin.books')}</p>
                      {searchResults.books.map((b: any) => (
                        <button key={b.id} className="w-full text-left px-2 py-1.5 rounded hover:bg-surface-raised text-[13px] text-text-primary flex items-center gap-2" onClick={() => { navigate(`/admin/books`); setSearchOpen(false); }}>
                          <BookOpen className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
                          <span className="truncate">{b.title}</span>
                          <span className="text-text-tertiary text-[11px] shrink-0">{b.author}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.students?.length > 0 && (
                    <div className="p-2 border-t border-border">
                      <p className="text-[10px] font-medium text-text-tertiary uppercase px-2 py-1">{t('admin.students')}</p>
                      {searchResults.students.map((s: any) => (
                        <button key={s.id} className="w-full text-left px-2 py-1.5 rounded hover:bg-surface-raised text-[13px] text-text-primary flex items-center gap-2" onClick={() => { navigate(`/admin/students`); setSearchOpen(false); }}>
                          <Users className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
                          <span className="truncate">{s.name}</span>
                          <span className="text-text-tertiary text-[11px] shrink-0">{s.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.schools?.length > 0 && (
                    <div className="p-2 border-t border-border">
                      <p className="text-[10px] font-medium text-text-tertiary uppercase px-2 py-1">{t('admin.schools')}</p>
                      {searchResults.schools.map((s: any) => (
                        <button key={s.id} className="w-full text-left px-2 py-1.5 rounded hover:bg-surface-raised text-[13px] text-text-primary flex items-center gap-2" onClick={() => { navigate(`/admin/schools`); setSearchOpen(false); }}>
                          <School className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
                          <span className="truncate">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {(!searchResults.books?.length && !searchResults.students?.length && !searchResults.schools?.length) && (
                    <p className="text-center py-4 text-text-tertiary text-[13px]">{t('common.noData')}</p>
                  )}
                </div>
              )}
            </div>

            {/* Language switcher */}
            <LanguageSwitcher />

            <button className="relative p-2 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors">
              <Bell className="h-4 w-4" strokeWidth={1.5} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-error rounded-full" />
            </button>
            <div className="h-4 w-px bg-border mx-0.5" />
            <Link to="/admin/account" className="flex items-center gap-2 p-1 rounded-md hover:bg-surface-raised transition-colors">
              <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[11px] font-semibold">
                {user?.username?.charAt(0)?.toUpperCase() || 'A'}
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
