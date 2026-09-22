'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { EmploymentStatusBadge } from '@/components/hr/EmploymentStatusBadge';
import type { Employee } from '@/types/core-hr';

type TabKey = 'overview' | 'personal' | 'contact' | 'employment';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'personal', label: 'Personal Information' },
  { key: 'contact', label: 'Contact' },
  { key: 'employment', label: 'Employment' },
];

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: "To'liq stavka",
  PART_TIME: 'Qisman stavka',
  TEMPORARY: 'Vaqtinchalik',
  CONTRACT: 'Shartnoma',
  REMOTE: 'Masofaviy',
  HYBRID: 'Gibrid',
};

// My Profile — faqat READ-ONLY. Tahrirlash tugmalari bu sahifada umuman
// render qilinmaydi (Core HR'dagi profil sahifasidan farqli) — spec talabi:
// "Employee can only view their own profile", "must NOT edit HR-controlled
// employment data". Shaxsiy ma'lumot o'zgarishi "My Requests" orqali
// so'rov sifatida yuboriladi.
export default function MyProfilePage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  useEffect(() => {
    api
      .get<Employee>('/hr/employees/me')
      .then((res) => setEmployee(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik yuz berdi'));
  }, []);

  if (error) {
    return <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>;
  }
  if (!employee) {
    return <p className="text-sm text-stone-400">Yuklanmoqda...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
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
            <span>{employee.position?.name ?? 'Lavozim belgilanmagan'}</span>
            <span>{employee.department?.name ?? "Bo'lim belgilanmagan"}</span>
            <span>{employee.branch?.name ?? 'Filial belgilanmagan'}</span>
            {employee.manager && <span>Rahbar: {employee.manager.fullName}</span>}
            <span>Ishga kirgan: {new Date(employee.hiredAt).toLocaleDateString('uz-UZ')}</span>
          </div>
        </div>
      </div>

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

      {activeTab === 'overview' && (
        <TabCard>
          <Field label="Employee ID" value={employee.employeeCode} />
          <Field label="Full Name" value={employee.fullName} />
          <Field label="Position" value={employee.position?.name} />
          <Field label="Department" value={employee.department?.name} />
          <Field label="Branch" value={employee.branch?.name} />
          <Field label="Manager" value={employee.manager?.fullName} />
          <Field label="Status" value={<EmploymentStatusBadge status={employee.status} />} />
          <Field label="Hire Date" value={new Date(employee.hiredAt).toLocaleDateString('uz-UZ')} />
        </TabCard>
      )}

      {activeTab === 'personal' && (
        <TabCard>
          <Field label="First Name" value={employee.firstName} />
          <Field label="Last Name" value={employee.lastName} />
          <Field label="Middle Name" value={employee.middleName} />
          <Field
            label="Date of Birth"
            value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString('uz-UZ') : null}
          />
          <Field label="Gender" value={employee.gender === 'MALE' ? 'Erkak' : employee.gender === 'FEMALE' ? 'Ayol' : null} />
          <Field label="PINFL" value={employee.pinfl} />
          <Field label="Passport / ID" value={employee.passportNumber} />
        </TabCard>
      )}

      {activeTab === 'contact' && (
        <TabCard>
          <Field label="Personal Phone" value={employee.personalPhone} />
          <Field label="Work Phone" value={employee.workPhone} />
          <Field label="Personal Email" value={employee.personalEmail} />
          <Field label="Work Email" value={employee.workEmail} />
          <Field label="Address" value={employee.address} />
          <Field label="Emergency Contact" value={employee.emergencyContactName} />
          <Field label="Emergency Contact Phone" value={employee.emergencyContactPhone} />
        </TabCard>
      )}

      {activeTab === 'employment' && (
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
      )}
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
