import { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, School, Users, BookOpen, BarChart3, Trophy,
  UserCog, ArrowLeftRight, ChevronRight, Menu, X, LogOut, Bell, BookOpen as BookIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

interface SidebarItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const sidebarItems: SidebarItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin' },
  { key: 'schools', label: '学校管理', icon: <School className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/schools' },
  { key: 'students', label: '学生管理', icon: <Users className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/students' },
  { key: 'books', label: '图书管理', icon: <BookOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/books' },
  { key: 'statistics', label: '数据统计', icon: <BarChart3 className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/statistics' },
  { key: 'leaderboard', label: '排行榜', icon: <Trophy className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/leaderboard' },
  { key: 'admins', label: '管理员', icon: <UserCog className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/admins' },
  { key: 'role-switch', label: '角色切换', icon: <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={1.5} />, path: '/admin/role-switch' },
];

function getBreadcrumbs(pathname: string): { label: string; path: string }[] {
  const crumbs: { label: string; path: string }[] = [{ label: '后台', path: '/admin' }];
  const segments = pathname.split('/').filter(Boolean);
  const labelMap: Record<string, string> = {
    admin: '后台',
    schools: '学校管理',
    students: '学生管理',
    books: '图书管理',
    statistics: '数据统计',
    leaderboard: '排行榜',
    admins: '管理员',
    account: '账户设置',
    'role-switch': '角色切换',
    new: '新增',
    edit: '编辑',
  };
  let path = '';
  segments.forEach((seg, i) => {
    path += `/${seg}`;
    if (i > 0) {
      crumbs.push({ label: labelMap[seg] || seg, path });
    }
  });
  return crumbs;
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const breadcrumbs = getBreadcrumbs(location.pathname);
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
          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-white/[0.08] text-white/60 rounded">Admin</span>
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
            返回前台
          </Link>
        </div>

        <div className="border-t border-white/[0.06] p-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-white/[0.08] flex items-center justify-center text-white/60 text-xs font-medium">
              {user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white/80 truncate">{user?.username || '管理员'}</p>
              <p className="text-[11px] text-white/35">{user?.role === 'super_admin' ? 'Super Admin' : 'School Admin'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              title="退出登录"
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
