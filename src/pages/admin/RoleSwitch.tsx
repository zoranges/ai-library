import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Shield, Building, CheckCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { adminApi } from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';

interface School {
  id: string;
  name: string;
  state?: string;
  district?: string;
}

export default function RoleSwitch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const switchRole = useAuthStore((s) => s.switchRole);
  const [schools, setSchools] = useState<School[]>([]);
  const [switchedSchool, setSwitchedSchool] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const [pendingSchool, setPendingSchool] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    adminApi.getSchools({ pageSize: 100 }).then((res: any) => {
      const list = res?.data?.data || res?.data || [];
      setSchools(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  const currentSchool = switchedSchool ? schools.find((s) => s.id === switchedSchool) : null;

  function handleSwitch(schoolId: string) {
    setPendingSchool(schoolId);
    setConfirmModal(true);
  }

  async function confirmSwitch() {
    if (!pendingSchool) return;
    setSwitching(true);
    try {
      // Save original token so we can switch back
      const originalToken = localStorage.getItem('auth_token');
      if (originalToken) {
        sessionStorage.setItem('auth_token_original', originalToken);
      }

      const res = await adminApi.switchRole('admin', pendingSchool);
      if (res?.data) {
        switchRole(res.data.token, res.data.user);
        setSwitchedSchool(pendingSchool);
        // Reload to apply the new role across the app
        window.location.reload();
        return;
      }
    } catch {} finally {
      setSwitching(false);
      setConfirmModal(false);
      setPendingSchool(null);
    }
  }

  function handleSwitchBack() {
    // Restore original token
    const originalToken = sessionStorage.getItem('auth_token_original');
    if (originalToken) {
      localStorage.setItem('auth_token', originalToken);
      sessionStorage.removeItem('auth_token_original');
    }
    navigate(0);
  }

  const pendingSchoolData = pendingSchool ? schools.find((s) => s.id === pendingSchool) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary font-heading">{t('admin.roleSwitch')}</h2>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-accent" strokeWidth={1.5} />
          <span className="text-[13px] text-text-secondary">{t('admin.currentRoleLabel')}</span>
          <Badge variant={switchedSchool ? 'warning' : 'accent'}>
            {switchedSchool ? t('admin.schoolAdmin') : t('admin.superAdmin')}
          </Badge>
        </div>
      </div>

      {switchedSchool && currentSchool && (
        <div className="bg-accent/5 border border-accent/15 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <span className="text-[13px] text-text-primary font-medium">
              {t('admin.viewingAs')} <span className="text-accent font-semibold">{currentSchool.name}</span> {t('admin.schoolAdmin')}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={handleSwitchBack} icon={<ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.5} />}>
            {t('admin.switchBackBtn')}
          </Button>
        </div>
      )}

      {schools.length === 0 && (
        <div className="text-center py-12 text-text-tertiary text-[13px]">{t('common.noData')}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {schools.map((school) => {
          const isCurrent = switchedSchool === school.id;
          return (
            <div
              key={school.id}
              className={cn(
                'bg-surface border rounded-lg p-4 transition-all duration-micro ease-out-quart',
                isCurrent ? 'border-accent/30 bg-accent/[0.02]' : 'border-border hover:border-border-strong'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-[14px] font-medium text-text-primary">{school.name}</h3>
                  <p className="text-[12px] text-text-tertiary mt-0.5">{school.state || school.district || ''}</p>
                </div>
                {isCurrent && (
                  <Badge variant="accent" size="sm" dot>{t('common.active')}</Badge>
                )}
              </div>
              {isCurrent ? (
                <div className="flex items-center gap-1.5 text-accent text-[12px] font-medium">
                  <CheckCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {t('admin.currentView')}
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => handleSwitch(school.id)} icon={<ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.5} />} fullWidth>
                  {t('admin.switchBtn')}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Modal isOpen={confirmModal} onClose={() => setConfirmModal(false)} title={t('admin.roleSwitch')} size="sm" footer={<><Button variant="ghost" onClick={() => setConfirmModal(false)}>{t('common.cancel')}</Button><Button onClick={confirmSwitch}>{t('admin.confirmSwitch')}</Button></>}>
        <div className="space-y-3">
          <p className="text-[13px] text-text-secondary">{t('admin.switchRoleConfirmText')}</p>
          {pendingSchoolData && (
            <div className="bg-surface-raised rounded-md p-3">
              <p className="text-[13px] font-medium text-text-primary">{pendingSchoolData.name}</p>
              <p className="text-[12px] text-text-tertiary">{pendingSchoolData.state || pendingSchoolData.district || ''}</p>
            </div>
          )}
          <p className="text-[11px] text-text-tertiary">{t('admin.switchBackHint')}</p>
        </div>
      </Modal>
    </div>
  );
}
