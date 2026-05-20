import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, Plus, Save, Trash2, X } from 'lucide-react';
import type { AIConfig } from '@/types';

export default function AIConfigPage() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AIConfig | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ configKey: '', configValue: '', description: '' });

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/admin/ai-config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setConfigs(data.data);
    } catch (err) {
      console.error('Failed to load AI configs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const token = localStorage.getItem('auth_token');
    if (editing) {
      await fetch(`/api/admin/ai-config/${editing.configKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ configValue: form.configValue, description: form.description }),
      });
    } else {
      await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
    }
    setEditing(null);
    setShowAdd(false);
    setForm({ configKey: '', configValue: '', description: '' });
    loadConfigs();
  }

  async function handleDelete(key: string) {
    if (!confirm(t('common.confirm') + ' ' + t('common.delete') + '?')) return;
    const token = localStorage.getItem('auth_token');
    await fetch(`/api/admin/ai-config/${key}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    loadConfigs();
  }

  function startEdit(config: AIConfig) {
    setEditing(config);
    setForm({ configKey: config.configKey, configValue: config.configValue, description: config.description || '' });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="w-6 h-6 text-accent" />
          <h2 className="text-xl font-bold text-text-primary">{t('admin.aiConfig')}</h2>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditing(null); setForm({ configKey: '', configValue: '', description: '' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {t('admin.addAiConfig')}
        </button>
      </div>

      {(showAdd || editing) && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text-primary">{editing ? t('admin.editAiConfig') : t('admin.addAiConfig')}</h3>
            <button onClick={() => { setShowAdd(false); setEditing(null); }} className="text-text-tertiary hover:text-text-primary">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">{t('admin.configKey')}</label>
              <input
                type="text"
                value={form.configKey}
                onChange={(e) => setForm({ ...form, configKey: e.target.value })}
                disabled={!!editing}
                className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">{t('admin.aiConfigDescription')}</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-text-secondary mb-1">{t('admin.configValue')}</label>
              <textarea
                value={form.configValue}
                onChange={(e) => setForm({ ...form, configValue: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowAdd(false); setEditing(null); }} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm hover:opacity-90">
              <Save className="w-4 h-4" />
              {t('common.save')}
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left p-4 font-medium text-text-secondary">{t('admin.configKey')}</th>
                <th className="text-left p-4 font-medium text-text-secondary">{t('admin.configValue')}</th>
                <th className="text-left p-4 font-medium text-text-secondary">{t('admin.aiConfigDescription')}</th>
                <th className="text-right p-4 font-medium text-text-secondary">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-text-tertiary">{t('common.loading')}</td></tr>
              ) : configs.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-text-tertiary">{t('common.noData')}</td></tr>
              ) : (
                configs.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-white/5">
                    <td className="p-4">
                      <span className="font-mono text-xs bg-white/10 px-2 py-1 rounded text-accent">{c.configKey}</span>
                    </td>
                    <td className="p-4 text-text-primary">
                      <span className="line-clamp-2 max-w-[400px] block">{c.configValue}</span>
                    </td>
                    <td className="p-4 text-text-tertiary">{c.description || '-'}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => startEdit(c)} className="p-2 text-text-tertiary hover:text-accent transition-colors">
                          {t('common.edit')}
                        </button>
                        <button onClick={() => handleDelete(c.configKey)} className="p-2 text-text-tertiary hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
