'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Branch, Department } from '@/types/core-hr';

// Alohida "Organization" modeli yo'q — Department (parentId bilan
// ierarxik) va Branch ikkalasi bitta vizual daraxt sifatida birlashtirilib
// ko'rsatiladi (faqat frontend composite view, backendda yangi model yo'q).
export default function OrganizationPage() {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [branches, setBranches] = useState<Branch[] | null>(null);

  useEffect(() => {
    api.get('/hr/departments').then((res) => setDepartments(res.data));
    api.get('/hr/branches').then((res) => setBranches(res.data));
  }, []);

  const rootDepartments = departments?.filter((d) => !d.parentId) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Core HR</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Tashkiliy tuzilma</h1>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Bo&apos;limlar ierarxiyasi</h2>
        {departments === null ? (
          <p className="text-sm text-stone-400">Yuklanmoqda...</p>
        ) : rootDepartments.length === 0 ? (
          <p className="text-sm text-stone-400">Bo&apos;lim topilmadi</p>
        ) : (
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <ul className="flex flex-col gap-2">
              {rootDepartments.map((d) => (
                <DeptNode key={d.id} department={d} allDepartments={departments} depth={0} />
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Filiallar</h2>
        {branches === null ? (
          <p className="text-sm text-stone-400">Yuklanmoqda...</p>
        ) : branches.length === 0 ? (
          <p className="text-sm text-stone-400">Filial topilmadi</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <div key={b.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="text-sm font-semibold text-stone-800">{b.name}</p>
                <p className="mt-0.5 text-xs text-stone-400">{b.region ?? "Region ko'rsatilmagan"}</p>
                <p className="mt-2 text-xs text-stone-500">
                  {b.employeeCount} xodim &middot; {b.positionCount} lavozim
                </p>
                {b.manager && <p className="mt-1 text-xs text-stone-500">Rahbar: {b.manager.fullName}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DeptNode({ department, allDepartments, depth }: { department: Department; allDepartments: Department[]; depth: number }) {
  const children = allDepartments.filter((d) => d.parentId === department.id);
  return (
    <li>
      <div className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-stone-50" style={{ marginLeft: depth * 20 }}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-stone-400">{department.code}</span>
          <span className="text-sm font-medium text-stone-800">{department.name}</span>
          {department.headEmployee && <span className="text-xs text-stone-400">— {department.headEmployee.fullName}</span>}
        </div>
        <span className="text-xs text-stone-500">
          {department.employeeCount} xodim &middot; {department.vacantPositionCount} bo&apos;sh o&apos;rin
        </span>
      </div>
      {children.length > 0 && (
        <ul className="flex flex-col gap-1">
          {children.map((child) => (
            <DeptNode key={child.id} department={child} allDepartments={allDepartments} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
