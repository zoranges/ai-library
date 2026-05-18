import { useState, useEffect } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen, User, LogOut, Menu, X, Bell, Moon, Sun, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', path: '/' },
  { key: 'library', label: 'Library', path: '/books' },
  { key: 'discover', label: 'Discover', path: '/leaderboard' },
];

export default function FrontendLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, fetchMe, logout } = useAuthStore();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated && !user) fetchMe();
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const isActive = (item: typeof NAV_ITEMS[number]) => {
    if (item.key === 'home') return location.pathname === '/';
    return location.pathname.startsWith(item.path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-secondary">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 h-14 bg-surface border-b border-border shadow-1">
        <div className="max-w-7xl mx-auto h-full flex items-center gap-4 px-4 sm:px-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 bg-accent rounded-lg flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            <span className="text-base font-bold text-text-primary hidden sm:block">AI Library</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1 ml-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                to={item.path}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  isActive(item)
                    ? 'text-accent bg-accent/5'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Admin link */}
          {(user?.role === 'super_admin' || user?.role === 'school_admin' || user?.role === 'admin') && (
            <Link
              to="/admin"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-accent hover:bg-accent/5 rounded-md transition-colors"
            >
              <Shield className="h-4 w-4" strokeWidth={1.5} />
              <span className="hidden lg:inline">Admin</span>
            </Link>
          )}

          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? <Sun className="h-4 w-4" strokeWidth={1.5} /> : <Moon className="h-4 w-4" strokeWidth={1.5} />}
            </button>

            {/* Language toggle */}
            <button className="hidden sm:flex items-center justify-center px-2 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors">
              EN
            </button>

            {/* Notification */}
            <button className="relative p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
              <Bell className="h-4 w-4" strokeWidth={1.5} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-error rounded-full ring-2 ring-surface" />
            </button>

            {/* User / Auth */}
            {isAuthenticated ? (
              <div className="flex items-center gap-1">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-bg-tertiary transition-colors"
                >
                  <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-medium text-text-primary hidden lg:block max-w-[100px] truncate">
                    {user?.username}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-md text-text-tertiary hover:text-error hover:bg-error/5 transition-colors hidden sm:block"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-1">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 text-sm font-medium text-white bg-accent rounded-md hover:bg-accent-hover transition-colors shadow-1"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-surface animate-slide-down">
            <div className="px-3 py-2 space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  to={item.path}
                  className={cn(
                    'block px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive(item)
                      ? 'text-accent bg-accent/5'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                  )}
                >
                  {item.label}
                </Link>
              ))}
              {(user?.role === 'super_admin' || user?.role === 'school_admin' || user?.role === 'admin') && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-accent hover:bg-accent/5 rounded-md transition-colors"
                >
                  <Shield className="h-4 w-4" strokeWidth={1.5} />
                  Admin
                </Link>
              )}
              <hr className="border-border my-2" />
              <Link
                to="/profile"
                className="block px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-md transition-colors"
              >
                Profile
              </Link>
              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-sm font-medium text-error/80 hover:text-error hover:bg-error/5 rounded-md transition-colors"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-accent rounded-lg flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-white" strokeWidth={2} />
                </div>
                <span className="text-base font-bold text-text-primary">AI Library</span>
              </div>
              <p className="text-sm text-text-tertiary leading-relaxed">
                AI-powered digital reading platform.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3">Navigation</h4>
              <div className="space-y-2">
                <Link to="/" className="block text-sm text-text-tertiary hover:text-accent transition-colors">Home</Link>
                <Link to="/books" className="block text-sm text-text-tertiary hover:text-accent transition-colors">Library</Link>
                <Link to="/leaderboard" className="block text-sm text-text-tertiary hover:text-accent transition-colors">Leaderboard</Link>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3">My Account</h4>
              <div className="space-y-2">
                <Link to="/profile" className="block text-sm text-text-tertiary hover:text-accent transition-colors">Profile</Link>
                <Link to="/profile/favorites" className="block text-sm text-text-tertiary hover:text-accent transition-colors">Favorites</Link>
                <Link to="/profile/achievements" className="block text-sm text-text-tertiary hover:text-accent transition-colors">Achievements</Link>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3">Legal</h4>
              <div className="space-y-2">
                <a href="#" className="block text-sm text-text-tertiary hover:text-accent transition-colors">Privacy Policy</a>
                <a href="#" className="block text-sm text-text-tertiary hover:text-accent transition-colors">Terms of Use</a>
                <a href="#" className="block text-sm text-text-tertiary hover:text-accent transition-colors">Help</a>
                <a href="#" className="block text-sm text-text-tertiary hover:text-accent transition-colors">Contact Us</a>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-5 border-t border-border text-center">
            <p className="text-xs text-text-tertiary">
              &copy; 2025 AI Library. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
