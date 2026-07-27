import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, School, Users, BookOpen, BarChart3, Trophy,
  UserCog, ArrowLeftRight, ChevronRight, Menu, X, LogOut, Bell, Zap, Search, BookOpen as BookIcon, Settings, FileCheck, Tags, Upload,
  ChevronLeft, Home
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

const COLLAPSED_KEY = 'admin_sidebar_collapsed';

export default function AdminLayout() {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true');
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


  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

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
      { key: 'categories', label: t('admin.bookCategories', '图书分类'), icon: <Tags className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/books/categories' },
      { key: 'batch-upload', label: t('admin.batchUpload', '批量上传'), icon: <Upload className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/batch-upload' },
      { key: 'statistics', label: t('admin.statistics'), icon: <BarChart3 className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/statistics' },
      { key: 'leaderboard', label: t('admin.leaderboard'), icon: <Trophy className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/leaderboard' },
    ];
    if (isSuperAdmin) {
      items.push(
        { key: 'admins', label: t('admin.admins'), icon: <UserCog className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/admins' },
        { key: 'role-switch', label: t('admin.roleSwitch'), icon: <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/role-switch' },
        { key: 'ai-config', label: t('admin.aiConfig'), icon: <Zap className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/ai-config' },
        { key: 'system-settings', label: t('admin.systemSettings', '系统设置'), icon: <Settings className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/system-settings' },
        { key: 'ic-whitelist', label: t('admin.icWhitelist'), icon: <FileCheck className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/ic-whitelist' },
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
    <div className="flex bg-bg-secondary" style={{ minHeight: '100vh' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden transition-opacity duration-standard ease-out-quart"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — mobile: fixed overlay; desktop: sticky */}
      <aside
        className={cn(
          'flex flex-col transition-all duration-standard ease-out-quart shrink-0',
          'fixed inset-y-0 left-0 z-40 lg:sticky lg:top-0 lg:z-auto lg:self-start',
          collapsed ? 'w-14' : 'w-56',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{ background: 'oklch(0.14 0.015 255)', height: '100vh' }}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center h-12 border-b border-white/[0.06] shrink-0',
          collapsed ? 'justify-center px-1' : 'gap-2 px-4'
        )}>
          <div className="h-7 w-7 bg-accent rounded-md flex items-center justify-center shrink-0">
            <BookIcon className="h-4 w-4 text-white" strokeWidth={1.5} />
          </div>
          {!collapsed && (
            <>
              <span className="text-[15px] font-semibold text-white font-heading tracking-tight truncate">AI Library</span>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white/[0.08] text-white/60 rounded shrink-0">{t('admin.adminPanel', 'Admin')}</span>
            </>
          )}
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-1 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          <div className="space-y-0.5">
            {sidebarItems.map((item) => {
              const isActive = activeKey === item.key;
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'relative flex items-center rounded-md transition-all duration-micro ease-out-quart',
                    collapsed ? 'justify-center w-9 h-9 mx-auto' : 'gap-2.5 px-3 py-1.5',
                    'text-[14px] font-medium',
                    isActive
                      ? 'text-white bg-white/[0.08]'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                  )}
                >
                  {!collapsed && isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-accent rounded-r-full" />
                  )}
                  {item.icon}
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Back to frontend */}
        <div className="border-t border-white/[0.06] p-1.5 shrink-0">
          <Link
            to="/"
            title={collapsed ? (t('admin.backToFrontend', 'Back to Frontend')) : undefined}
            className={cn(
              'flex items-center rounded-md transition-colors text-white/40 hover:text-white/70 hover:bg-white/[0.04]',
              collapsed ? 'justify-center w-9 h-9 mx-auto' : 'gap-2.5 px-3 py-1.5 text-[14px] font-medium'
            )}
          >
            <Home className="h-[18px] w-[18px]" strokeWidth={1.5} />
            {!collapsed && t('admin.backToFrontend', 'Back to Frontend')}
          </Link>
        </div>

        {/* User profile */}
        <div className="border-t border-white/[0.06] px-3 py-2.5 shrink-0">
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-2.5')}>
            <div className="h-8 w-8 rounded-full bg-white/[0.08] flex items-center justify-center text-white/60 text-[11px] font-medium shrink-0">
              {user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            {!collapsed && (
              <>
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
              </>
            )}
          </div>
          {collapsed && (
            <button
              onClick={handleLogout}
              className="mt-2 w-full flex items-center justify-center p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              title={t('auth.logout')}
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed((v: boolean) => !v)}
          className="hidden lg:flex absolute -right-3 top-16 h-6 w-6 rounded-full bg-surface border border-border items-center justify-center text-text-tertiary hover:text-text-primary hover:border-accent/30 transition-colors shadow-sm"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={cn('h-3 w-3 transition-transform duration-standard', collapsed && 'rotate-180')} strokeWidth={2} />
        </button>
      </aside>

      {/* Main content */}
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

            {/* Notifications — placeholder, no backend yet */}
            <button className="relative p-2 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors opacity-50 pointer-events-none" disabled title={t('admin.notificationsComingSoon', 'Notifications coming soon')}>
              <Bell className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <div className="h-4 w-px bg-border mx-0.5" />
            <Link to="/admin/account" className="flex items-center gap-2 p-1 rounded-md hover:bg-surface-raised transition-colors">
              <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[11px] font-semibold">
                {user?.username?.charAt(0)?.toUpperCase() || 'A'}
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
