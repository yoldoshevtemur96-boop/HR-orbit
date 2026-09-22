'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { EmploymentStatusBadge } from '@/components/hr/EmploymentStatusBadge';
import { EmploymentHistoryTable } from '@/components/hr/EmploymentHistoryTable';
import { useAuthStore } from '@/store/authStore';
import type { Employee, EmployeeEducation, EmploymentRecord } from '@/types/core-hr';

type TabKey = 'overview' | 'personal' | 'contact' | 'employment' | 'education' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'personal', label: 'Personal Information' },
  { key: 'contact', label: 'Contact' },
  { key: 'employment', label: 'Employment' },
  { key: 'education', label: 'Education' },
  { key: 'history', label: 'Employment History' },
];

const CAN_EDIT_ROLES = ['SUPER_ADMIN', 'HR_MANAGER', 'HR_SPECIALIST'];

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const canEdit = user ? CAN_EDIT_ROLES.includes(user.role) : false;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const load = useCallback(() => {
    api
      .get<Employee>(`/hr/employees/${params.id}`)
      .then((res) => setEmployee(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik yuz berdi'));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>;
  }
  if (!employee) {
    return <p className="text-sm text-stone-400">Yuklanmoqda...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader employee={employee} />

      <div className="flex gap-1 overflow-x-auto border-b border-stone-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'border-accent text-accent'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab employee={employee} />}
      {activeTab === 'personal' && <PersonalTab employee={employee} />}
      {activeTab === 'contact' && <ContactTab employee={employee} />}
      {activeTab === 'employment' && <EmploymentTab employee={employee} canEdit={canEdit} onChanged={load} />}
      {activeTab === 'education' && <EducationTab employeeId={employee.id} canEdit={canEdit} />}
      {activeTab === 'history' && <HistoryTab employeeId={employee.id} />}
    </div>
  );
}

function ProfileHeader({ employee }: { employee: Employee }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-semibold text-accent">
        {employee.firstName[0]}
        {employee.lastName[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-semibold text-stone-900">{employee.fullName}</h1>
          <EmploymentStatusBadge status={employee.status} />
        </div>
        <p className="mt-0.5 font-mono text-xs text-stone-400">{employee.employeeCode}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
          <span>{employee.position?.name ?? "Lavozim belgilanmagan"}</span>
          <span>{employee.department?.name ?? "Bo'lim belgilanmagan"}</span>
          <span>{employee.branch?.name ?? 'Filial belgilanmagan'}</span>
          {employee.manager && <span>Rahbar: {employee.manager.fullName}</span>}
          <span>Ishga kirgan: {new Date(employee.hiredAt).toLocaleDateString('uz-UZ')}</span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 text-sm text-stone-800">{value ?? '—'}</p>
    </div>
  );
}

function TabCard({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 rounded-lg border border-stone-200 bg-white p-5 sm:grid-cols-2">{children}</div>;
}

function OverviewTab({ employee }: { employee: Employee }) {
  return (
    <TabCard>
      <Field label="Employee ID" value={employee.employeeCode} />
      <Field label="Full Name" value={employee.fullName} />
      <Field label="Position" value={employee.position?.name} />
      <Field label="Department" value={employee.department?.name} />
      <Field label="Branch" value={employee.branch?.name} />
      <Field label="Manager" value={employee.manager?.fullName} />
      <Field label="Status" value={<EmploymentStatusBadge status={employee.status} />} />
      <Field label="Hire Date" value={new Date(employee.hiredAt).toLocaleDateString('uz-UZ')} />
      <Field label="Work Email" value={employee.workEmail} />
      <Field label="Work Phone" value={employee.workPhone} />
    </TabCard>
  );
}

function PersonalTab({ employee }: { employee: Employee }) {
  const hasSensitive = 'pinfl' in employee;
  return (
    <TabCard>
      <Field label="First Name" value={employee.firstName} />
      <Field label="Last Name" value={employee.lastName} />
      <Field label="Middle Name" value={employee.middleName} />
      <Field label="Date of Birth" value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString('uz-UZ') : null} />
      <Field label="Gender" value={employee.gender === 'MALE' ? 'Erkak' : employee.gender === 'FEMALE' ? 'Ayol' : null} />
      <Field label="PINFL" value={hasSensitive ? employee.pinfl ?? '—' : <span className="text-stone-400">Cheklangan</span>} />
      <Field
        label="Passport / ID"
        value={hasSensitive ? employee.passportNumber ?? '—' : <span className="text-stone-400">Cheklangan</span>}
      />
    </TabCard>
  );
}

function ContactTab({ employee }: { employee: Employee }) {
  return (
    <TabCard>
      <Field label="Personal Phone" value={employee.personalPhone} />
      <Field label="Work Phone" value={employee.workPhone} />
      <Field label="Personal Email" value={employee.personalEmail} />
      <Field label="Work Email" value={employee.workEmail} />
      <Field label="Address" value={employee.address} />
      <Field label="Emergency Contact" value={employee.emergencyContactName} />
      <Field label="Emergency Contact Phone" value={employee.emergencyContactPhone} />
    </TabCard>
  );
}

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: "To'liq stavka",
  PART_TIME: 'Qisman stavka',
  TEMPORARY: 'Vaqtinchalik',
  CONTRACT: 'Shartnoma',
  REMOTE: 'Masofaviy',
  HYBRID: 'Gibrid',
};

function EmploymentTab({ employee, canEdit, onChanged }: { employee: Employee; canEdit: boolean; onChanged: () => void }) {
  const [isChanging, setIsChanging] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <TabCard>
        <Field label="Employee ID" value={employee.employeeCode} />
        <Field label="Hire Date" value={new Date(employee.hiredAt).toLocaleDateString('uz-UZ')} />
        <Field label="Status" value={<EmploymentStatusBadge status={employee.status} />} />
        <Field label="Employment Type" value={employee.employmentType ? EMPLOYMENT_TYPE_LABEL[employee.employmentType] : null} />
        <Field label="Contract Number" value={employee.contractNumber} />
        <Field
          label="Contract Period"
          value={
            employee.contractStartDate
              ? `${new Date(employee.contractStartDate).toLocaleDateString('uz-UZ')} – ${
                  employee.contractEndDate ? new Date(employee.contractEndDate).toLocaleDateString('uz-UZ') : 'muddatsiz'
                }`
              : null
          }
        />
        <Field label="Position" value={employee.position?.name} />
        <Field label="Department" value={employee.department?.name} />
        <Field label="Branch" value={employee.branch?.name} />
        <Field label="Manager" value={employee.manager?.fullName} />
        <Field label="Work Schedule" value={employee.workSchedule} />
        <Field label="Work Location" value={employee.workLocation} />
      </TabCard>

      {canEdit && (
        <button
          type="button"
          onClick={() => setIsChanging(true)}
          className="self-start rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent-soft"
        >
          Lavozimni o&apos;zgartirish
        </button>
      )}

      {isChanging && (
        <ChangeEmploymentForm employee={employee} onClose={() => setIsChanging(false)} onSaved={() => { setIsChanging(false); onChanged(); }} />
      )}
    </div>
  );
}

function ChangeEmploymentForm({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: () => void }) {
  const [positionId, setPositionId] = useState(employee.positionId ?? '');
  const [departmentId, setDepartmentId] = useState(employee.departmentId ?? '');
  const [branchId, setBranchId] = useState(employee.branchId ?? '');
  const [reason, setReason] = useState('');
  const [positions, setPositions] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get('/hr/positions').then((res) => setPositions(res.data));
    api.get('/hr/departments').then((res) => setDepartments(res.data));
    api.get('/hr/branches').then((res) => setBranches(res.data));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.patch(`/hr/employees/${employee.id}/employment`, {
        positionId: positionId || null,
        departmentId: departmentId || null,
        branchId: branchId || null,
        reason,
      });
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-stone-800">Yangi employment ma&apos;lumotlari</h3>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-stone-600">Lavozim</span>
        <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className="rounded-md border border-stone-300 px-3 py-2 text-sm">
          <option value="">—</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-stone-600">Bo&apos;lim</span>
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="rounded-md border border-stone-300 px-3 py-2 text-sm">
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-stone-600">Filial</span>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-md border border-stone-300 px-3 py-2 text-sm">
          <option value="">—</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-stone-600">Sabab *</span>
        <input
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Masalan: Lavozim ko'tarildi"
          className="rounded-md border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          Saqlash
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
          Bekor qilish
        </button>
      </div>
    </form>
  );
}

function EducationTab({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const [items, setItems] = useState<EmployeeEducation[] | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [level, setLevel] = useState('');
  const [institution, setInstitution] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [graduationYear, setGraduationYear] = useState('');

  const load = useCallback(() => {
    api.get<EmployeeEducation[]>(`/hr/employees/${employeeId}/education`).then((res) => setItems(res.data));
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/hr/employees/${employeeId}/education`, {
      level,
      institution,
      specialty: specialty || undefined,
      graduationYear: graduationYear ? Number(graduationYear) : undefined,
    });
    setLevel('');
    setInstitution('');
    setSpecialty('');
    setGraduationYear('');
    setIsAdding(false);
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-stone-200 bg-white">
        {items === null ? (
          <p className="p-5 text-sm text-stone-400">Yuklanmoqda...</p>
        ) : items.length === 0 ? (
          <p className="p-5 text-sm text-stone-400">Ma&apos;lumot kiritilmagan</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((edu) => (
              <li key={edu.id} className="p-4">
                <p className="text-sm font-medium text-stone-800">
                  {edu.level} — {edu.institution}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {edu.specialty ?? ''} {edu.graduationYear ? `· ${edu.graduationYear}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && !isAdding && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="self-start rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent-soft"
        >
          + Qo&apos;shish
        </button>
      )}

      {isAdding && (
        <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-5">
          <input required value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Ta'lim darajasi (masalan Bakalavr)" className="rounded-md border border-stone-300 px-3 py-2 text-sm" />
          <input required value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="O'quv muassasasi" className="rounded-md border border-stone-300 px-3 py-2 text-sm" />
          <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Mutaxassislik" className="rounded-md border border-stone-300 px-3 py-2 text-sm" />
          <input value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} placeholder="Bitirgan yili" type="number" className="rounded-md border border-stone-300 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Saqlash
            </button>
            <button type="button" onClick={() => setIsAdding(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
              Bekor qilish
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function HistoryTab({ employeeId }: { employeeId: string }) {
  const [history, setHistory] = useState<EmploymentRecord[] | null>(null);

  useEffect(() => {
    api.get<EmploymentRecord[]>(`/hr/employees/${employeeId}/history`).then((res) => setHistory(res.data));
  }, [employeeId]);

  return <EmploymentHistoryTable history={history} />;
}
