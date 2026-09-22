'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Step = 'personal' | 'contact' | 'employment' | 'organization' | 'review';
const STEPS: { key: Step; label: string }[] = [
  { key: 'personal', label: 'Personal Information' },
  { key: 'contact', label: 'Contact Information' },
  { key: 'employment', label: 'Employment Information' },
  { key: 'organization', label: 'Organization' },
  { key: 'review', label: 'Review' },
];

interface FormState {
  employeeCode: string;
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  gender: string;
  pinfl: string;
  passportNumber: string;
  personalPhone: string;
  workPhone: string;
  personalEmail: string;
  workEmail: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  employmentType: string;
  contractNumber: string;
  workSchedule: string;
  workLocation: string;
  hiredAt: string;
  departmentId: string;
  branchId: string;
  positionId: string;
  managerId: string;
}

const EMPTY_FORM: FormState = {
  employeeCode: '',
  firstName: '',
  lastName: '',
  middleName: '',
  dateOfBirth: '',
  gender: '',
  pinfl: '',
  passportNumber: '',
  personalPhone: '',
  workPhone: '',
  personalEmail: '',
  workEmail: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  employmentType: '',
  contractNumber: '',
  workSchedule: '',
  workLocation: '',
  hiredAt: '',
  departmentId: '',
  branchId: '',
  positionId: '',
  managerId: '',
};

export default function NewEmployeePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('personal');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [positions, setPositions] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; fullName: string }[]>([]);

  useEffect(() => {
    api.get('/hr/departments').then((res) => setDepartments(res.data));
    api.get('/hr/branches').then((res) => setBranches(res.data));
    api.get('/hr/positions').then((res) => setPositions(res.data));
    api.get('/hr/employees', { params: { pageSize: 500 } }).then((res) => setEmployees(res.data.items));
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  function goNext() {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.key);
  }
  function goBack() {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.key);
  }

  async function handleCreate() {
    setError(null);
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        employeeCode: form.employeeCode,
        firstName: form.firstName,
        lastName: form.lastName,
        middleName: form.middleName || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        pinfl: form.pinfl || undefined,
        passportNumber: form.passportNumber || undefined,
        personalPhone: form.personalPhone || undefined,
        workPhone: form.workPhone || undefined,
        personalEmail: form.personalEmail || undefined,
        workEmail: form.workEmail || undefined,
        address: form.address || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
        employmentType: form.employmentType || undefined,
        contractNumber: form.contractNumber || undefined,
        workSchedule: form.workSchedule || undefined,
        workLocation: form.workLocation || undefined,
        hiredAt: form.hiredAt || undefined,
        departmentId: form.departmentId || undefined,
        branchId: form.branchId || undefined,
        positionId: form.positionId || undefined,
        managerId: form.managerId || undefined,
      };
      const res = await api.post('/hr/employees', payload);
      router.push(`/hr/employees/${res.data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Xodim yaratishda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Core HR</p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Yangi xodim qo&apos;shish</h1>

      <ol className="mt-6 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              i === stepIndex ? 'bg-accent text-white' : i < stepIndex ? 'bg-accent-soft text-accent' : 'bg-stone-100 text-stone-400'
            }`}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-5">
        {step === 'personal' && <StepPersonal form={form} update={update} />}
        {step === 'contact' && <StepContact form={form} update={update} />}
        {step === 'employment' && <StepEmployment form={form} update={update} />}
        {step === 'organization' && (
          <StepOrganization form={form} update={update} departments={departments} branches={branches} positions={positions} employees={employees} />
        )}
        {step === 'review' && <StepReview form={form} departments={departments} branches={branches} positions={positions} employees={employees} />}

        {error && <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 disabled:opacity-40 hover:bg-stone-50"
          >
            Orqaga
          </button>
          {step === 'review' ? (
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSubmitting}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? 'Yaratilmoqda...' : 'Xodimni yaratish'}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Keyingisi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-stone-600">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-stone-600">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-stone-300 px-3 py-2 text-sm">
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StepPersonal({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Employee ID" value={form.employeeCode} onChange={(v) => update('employeeCode', v)} required />
      <TextField label="First Name" value={form.firstName} onChange={(v) => update('firstName', v)} required />
      <TextField label="Last Name" value={form.lastName} onChange={(v) => update('lastName', v)} required />
      <TextField label="Middle Name" value={form.middleName} onChange={(v) => update('middleName', v)} />
      <TextField label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(v) => update('dateOfBirth', v)} />
      <SelectField
        label="Gender"
        value={form.gender}
        onChange={(v) => update('gender', v)}
        options={[
          { value: 'MALE', label: 'Erkak' },
          { value: 'FEMALE', label: 'Ayol' },
        ]}
      />
      <TextField label="PINFL" value={form.pinfl} onChange={(v) => update('pinfl', v)} />
      <TextField label="Passport / ID" value={form.passportNumber} onChange={(v) => update('passportNumber', v)} />
    </div>
  );
}

function StepContact({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Personal Phone" value={form.personalPhone} onChange={(v) => update('personalPhone', v)} />
      <TextField label="Work Phone" value={form.workPhone} onChange={(v) => update('workPhone', v)} />
      <TextField label="Personal Email" type="email" value={form.personalEmail} onChange={(v) => update('personalEmail', v)} />
      <TextField label="Work Email" type="email" value={form.workEmail} onChange={(v) => update('workEmail', v)} />
      <TextField label="Address" value={form.address} onChange={(v) => update('address', v)} />
      <TextField label="Emergency Contact" value={form.emergencyContactName} onChange={(v) => update('emergencyContactName', v)} />
      <TextField label="Emergency Contact Phone" value={form.emergencyContactPhone} onChange={(v) => update('emergencyContactPhone', v)} />
    </div>
  );
}

function StepEmployment({ form, update }: { form: FormState; update: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Hire Date" type="date" value={form.hiredAt} onChange={(v) => update('hiredAt', v)} />
      <SelectField
        label="Employment Type"
        value={form.employmentType}
        onChange={(v) => update('employmentType', v)}
        options={[
          { value: 'FULL_TIME', label: "To'liq stavka" },
          { value: 'PART_TIME', label: 'Qisman stavka' },
          { value: 'TEMPORARY', label: 'Vaqtinchalik' },
          { value: 'CONTRACT', label: 'Shartnoma' },
          { value: 'REMOTE', label: 'Masofaviy' },
          { value: 'HYBRID', label: 'Gibrid' },
        ]}
      />
      <TextField label="Contract Number" value={form.contractNumber} onChange={(v) => update('contractNumber', v)} />
      <TextField label="Work Schedule" value={form.workSchedule} onChange={(v) => update('workSchedule', v)} />
      <TextField label="Work Location" value={form.workLocation} onChange={(v) => update('workLocation', v)} />
    </div>
  );
}

function StepOrganization({
  form,
  update,
  departments,
  branches,
  positions,
  employees,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  positions: { id: string; name: string }[];
  employees: { id: string; fullName: string }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField label="Department" value={form.departmentId} onChange={(v) => update('departmentId', v)} options={departments.map((d) => ({ value: d.id, label: d.name }))} />
      <SelectField label="Branch" value={form.branchId} onChange={(v) => update('branchId', v)} options={branches.map((b) => ({ value: b.id, label: b.name }))} />
      <SelectField label="Position" value={form.positionId} onChange={(v) => update('positionId', v)} options={positions.map((p) => ({ value: p.id, label: p.name }))} />
      <SelectField label="Manager" value={form.managerId} onChange={(v) => update('managerId', v)} options={employees.map((e) => ({ value: e.id, label: e.fullName }))} />
    </div>
  );
}

function StepReview({
  form,
  departments,
  branches,
  positions,
  employees,
}: {
  form: FormState;
  departments: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  positions: { id: string; name: string }[];
  employees: { id: string; fullName: string }[];
}) {
  const findName = (list: { id: string; name?: string; fullName?: string }[], id: string) =>
    list.find((x) => x.id === id)?.name ?? list.find((x) => x.id === id)?.fullName ?? '—';

  const rows: [string, string][] = [
    ['Employee ID', form.employeeCode],
    ['Full Name', [form.lastName, form.firstName, form.middleName].filter(Boolean).join(' ')],
    ['Work Email', form.workEmail || '—'],
    ['Personal Phone', form.personalPhone || '—'],
    ['Department', form.departmentId ? findName(departments, form.departmentId) : '—'],
    ['Branch', form.branchId ? findName(branches, form.branchId) : '—'],
    ['Position', form.positionId ? findName(positions, form.positionId) : '—'],
    ['Manager', form.managerId ? findName(employees, form.managerId) : '—'],
  ];

  return (
    <div className="flex flex-col gap-1">
      <p className="mb-2 text-sm text-stone-500">Ma&apos;lumotlarni tekshiring va tasdiqlang.</p>
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between border-b border-stone-100 py-2 text-sm">
          <span className="text-stone-500">{label}</span>
          <span className="font-medium text-stone-800">{value}</span>
        </div>
      ))}
    </div>
  );
}
