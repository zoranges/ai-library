import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Image, RefreshCw, Check } from 'lucide-react';
import Card from '@/components/ui/Card';
import { adminApi } from '@/utils/api';

interface ImageConfig {
  key: string;
  label: string;
  description: string;
}

const PAGE_IMAGES: ImageConfig[] = [
  { key: 'login_page_image', label: '普通用户登录页', description: '普通用户登录页右侧背景图' },
  { key: 'register_page_image', label: '注册用户登录页', description: '注册用户登录页右侧背景图' },
  { key: 'admin_login_page_image', label: '管理员登录页', description: '管理员登录页右侧背景图' },
];

export default function SystemSettings() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    setLoading(true);
    try {
      const res = await adminApi.getSystemConfig();
      if (res.data) {
        const map: Record<string, string> = {};
        for (const row of res.data as any[]) {
          map[row.configKey] = row.configValue;
        }
        setConfigs(map);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  const handleUpload = useCallback(async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading((prev) => ({ ...prev, [key]: true }));
    try {
      const result = await adminApi.uploadFile(file);
      const newConfigs = { ...configs, [key]: result.url };
      setConfigs(newConfigs);
      await adminApi.updateSystemConfig({ [key]: result.url });
      setSaved((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 2000);
    } catch {} finally {
      setUploading((prev) => ({ ...prev, [key]: false }));
    }
  }, [configs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 rounded-full animate-spin border-accent/20 border-t-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-lg font-extrabold text-text-primary font-heading">{t('admin.systemSettings', '系统设置')}</h2>
        <p className="text-[13px] text-text-tertiary mt-1">{t('admin.systemSettingsDesc', '管理系统级别的配置，包括各登录页和启动页的背景图片')}</p>
      </div>

      <Card padding="lg">
        <h3 className="text-[14px] font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Image className="h-4 w-4" strokeWidth={1.5} />
          页面背景图片
        </h3>
        <div className="space-y-4">
          {PAGE_IMAGES.map((item) => {
            const currentUrl = configs[item.key] || '';
            const isUploading = uploading[item.key];
            const isSaved = saved[item.key];

            return (
              <div key={item.key} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-surface-raised/30">
                <div className="h-20 w-36 shrink-0 rounded-lg border border-border overflow-hidden bg-bg-tertiary">
                  {currentUrl ? (
                    <img src={currentUrl} alt={item.label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-text-tertiary">
                      <Image className="h-6 w-6" strokeWidth={1} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-text-primary">{item.label}</p>
                  <p className="text-[12px] text-text-tertiary mt-0.5">{item.description}</p>
                  <p className="text-[11px] text-text-tertiary mt-1 truncate">{currentUrl || '—'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isSaved && (
                    <span className="flex items-center gap-1 text-[12px] text-success">
                      <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                      已保存
                    </span>
                  )}
                  <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md border border-border cursor-pointer transition-colors hover:bg-surface-raised ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isUploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : <Upload className="h-3.5 w-3.5" strokeWidth={1.5} />}
                    {isUploading ? '上传中...' : '更换图片'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUpload(item.key, e)}
                      disabled={isUploading}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
