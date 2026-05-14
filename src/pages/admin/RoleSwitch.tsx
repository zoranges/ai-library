import { useState } from 'react';
import { ArrowLeftRight, Shield, Building, CheckCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { adminApi } from '@/utils/api';

const mockSchools = [
  { id: '1', name: 'SMK Tunku Abdul Rahman', state: 'Selangor', students: 450, admins: 2 },
  { id: '2', name: 'SK Bukit Damansara', state: 'Kuala Lumpur', students: 320, admins: 1 },
  { id: '3', name: 'SMK Sri Hartamas', state: 'Kuala Lumpur', students: 280, admins: 1 },
  { id: '4', name: 'SK Bangsar', state: 'Kuala Lumpur', students: 510, admins: 2 },
  { id: '5', name: 'SMK Pantai', state: 'Selangor', students: 190, admins: 1 },
];

export default function RoleSwitch() {
  const [switchedSchool, setSwitchedSchool] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const [pendingSchool, setPendingSchool] = useState<string | null>(null);

  const currentSchool = switchedSchool ? mockSchools.find((s) => s.id === switchedSchool) : null;

  function handleSwitch(schoolId: string) {
    setPendingSchool(schoolId);
    setConfirmModal(true);
  }

  async function confirmSwitch() {
    if (pendingSchool) {
      await adminApi.switchRole('admin').catch(() => {});
      setSwitchedSchool(pendingSchool);
    }
    setConfirmModal(false);
    setPendingSchool(null);
  }

  function handleSwitchBack() {
    setSwitchedSchool(null);
  }

  const pendingSchoolData = pendingSchool ? mockSchools.find((s) => s.id === pendingSchool) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary font-heading">Role Switch</h2>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-accent" strokeWidth={1.5} />
          <span className="text-[13px] text-text-secondary">Current:</span>
          <Badge variant={switchedSchool ? 'warning' : 'accent'}>
            {switchedSchool ? 'School Admin' : 'Super Admin'}
          </Badge>
        </div>
      </div>

      {switchedSchool && currentSchool && (
        <div className="bg-accent/5 border border-accent/15 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <span className="text-[13px] text-text-primary font-medium">
              Viewing as <span className="text-accent font-semibold">{currentSchool.name}</span> Admin
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={handleSwitchBack} icon={<ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.5} />}>
            Switch Back
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {mockSchools.map((school) => {
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
                  <p className="text-[12px] text-text-tertiary mt-0.5">{school.state}</p>
                </div>
                {isCurrent && (
                  <Badge variant="accent" size="sm" dot>Active</Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div>
                  <p className="text-lg font-semibold text-text-primary font-mono">{school.students}</p>
                  <p className="text-[11px] text-text-tertiary">Students</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-text-primary font-mono">{school.admins}</p>
                  <p className="text-[11px] text-text-tertiary">Admins</p>
                </div>
              </div>
              {isCurrent ? (
                <div className="flex items-center gap-1.5 text-accent text-[12px] font-medium">
                  <CheckCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Current View
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => handleSwitch(school.id)} icon={<ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.5} />} fullWidth>
                  Switch
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Modal isOpen={confirmModal} onClose={() => setConfirmModal(false)} title="Switch Role" size="sm" footer={<><Button variant="ghost" onClick={() => setConfirmModal(false)}>Cancel</Button><Button onClick={confirmSwitch}>Confirm Switch</Button></>}>
        <div className="space-y-3">
          <p className="text-[13px] text-text-secondary">Are you sure you want to switch to School Admin role?</p>
          {pendingSchoolData && (
            <div className="bg-surface-raised rounded-md p-3">
              <p className="text-[13px] font-medium text-text-primary">{pendingSchoolData.name}</p>
              <p className="text-[12px] text-text-tertiary">{pendingSchoolData.state} · {pendingSchoolData.students} students</p>
            </div>
          )}
          <p className="text-[11px] text-text-tertiary">You can switch back to Super Admin at any time.</p>
        </div>
      </Modal>
    </div>
  );
}
