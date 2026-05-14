import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Mail, Lock, Shield, Info, ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

const roles = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'School Admin' },
];

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [role, setRole] = useState('super_admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ipBinding, setIpBinding] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      const { user } = useAuthStore.getState();
      if (user?.role === 'super_admin' || user?.role === 'school_admin' || user?.role === 'admin') {
        navigate('/admin');
      } else {
        setError('此账号无管理员权限');
        useAuthStore.getState().logout();
      }
    } catch {
      setError('邮箱或密码错误');
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'oklch(0.12 0.015 255)' }}
    >
      <div className="w-full max-w-[400px]">
        <div className="bg-surface rounded-xl border border-border shadow-3 p-8">
          <div className="flex flex-col items-center mb-7">
            <div className="h-11 w-11 bg-accent rounded-lg flex items-center justify-center mb-3">
              <BookOpen className="h-5 w-5 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-xl font-semibold text-text-primary font-heading">管理员登录 🔐</h1>
            <p className="text-[13px] text-text-tertiary mt-1">仅限授权管理员访问</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[13px] font-medium text-text mb-1.5 block">角色</label>
              <div className="flex bg-surface-raised rounded-md p-1 gap-0.5">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={cn(
                      'flex-1 py-1.5 text-[13px] font-medium rounded-[6px] transition-all duration-micro ease-out-quart',
                      role === r.value
                        ? 'bg-surface text-text-primary shadow-1'
                        : 'text-text-tertiary hover:text-text-secondary'
                    )}
                    onClick={() => setRole(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="邮箱"
              type="email"
              placeholder="admin@library.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="h-4 w-4" strokeWidth={1.5} />}
              required
            />

            <Input
              label="密码"
              type="password"
              placeholder="输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-4 w-4" strokeWidth={1.5} />}
              required
            />

            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={ipBinding}
                  onChange={(e) => setIpBinding(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="h-[18px] w-[18px] rounded-[4px] border border-border peer-checked:bg-accent peer-checked:border-accent transition-all flex items-center justify-center">
                  {ipBinding && <span className="text-white text-[10px]">✓</span>}
                </div>
              </div>
              <span className="text-[13px] text-text-secondary group-hover:text-text-primary transition-colors">绑定当前 IP 地址</span>
              <Info className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} />
            </label>

            {error && (
              <div className="flex items-center gap-2 text-error text-[13px] bg-error/5 px-3 py-2 rounded-md">
                <Shield className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                {error}
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              loading={isLoading}
              className="!h-11 !text-sm !font-medium !rounded-xl"
            >
              登录
            </Button>
          </form>

          <p className="text-center text-[11px] text-text-tertiary mt-5">
            安全管理访问 · 所有操作均有记录
          </p>

          <div className="mt-4 pt-4 border-t border-border text-center">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-[12px] text-text-tertiary hover:text-accent transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
              学生登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
