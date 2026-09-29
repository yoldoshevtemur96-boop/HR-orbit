'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { MATERIAL_TYPE_LABEL, MATERIAL_TYPE_STYLE, MaterialCover } from '@/components/learning/materialUi';
import type { LearningMaterialType } from '@/types/learning';

interface Overview {
  isHr: boolean;
  assignments: { active: number; completed: number; overdue: number };
  requests: { pending: number };
  catalog?: {
    total: number;
    latest: { id: string; title: string; type: LearningMaterialType; coverUrl: string | null; status: string }[];
  };
  events?: { upcoming: number };
  rules?: { active: number };
}

// L&D admin bosh sahifasi — har bir bo'limga kartalar. HR hammasini,
// departament rahbari faqat Tayinlovlar va So'rovlar kartalarini ko'radi.
export default function LearningAdminHubPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Overview>('/learning-admin/overview')
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik yuz berdi'));
  }, []);

  if (error) return <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>;
  if (!data) return <p className="text-sm text-stone-400">Yuklanmoqda...</p>;

  return (
    <div className="flex flex-col gap-8">
      {data.isHr && data.catalog && (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <Card title="Katalog" addHref="/learning-admin/catalog/new" allHref="/learning-admin/catalog">
            {data.catalog.latest.length === 0 ? (
              <p className="text-sm text-stone-400">Katalog bo&apos;sh.</p>
            ) : (
              <ul className="flex flex-col">
                {data.catalog.latest.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/learning-admin/catalog/${m.id}`}
                      className="flex items-center gap-3 rounded-lg px-1 py-2.5 transition hover:bg-stone-50"
                    >
                      <MaterialCover material={m} className="h-9 w-9 flex-shrink-0 rounded-md" iconClassName="h-4 w-4" />
                      <span className="min-w-0 flex-1 truncate text-sm text-stone-800">{m.title}</span>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${MATERIAL_TYPE_STYLE[m.type]}`}>
                        {MATERIAL_TYPE_LABEL[m.type]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-stone-400">Jami: {data.catalog.total} ta material</p>
          </Card>

          <SummaryCard assignments={data.assignments} />
        </div>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold text-stone-900">O&apos;qitishni boshqarish</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {data.isHr && (
            <Card
              title="Tadbirlar va dasturlar"
              subtitle="oflayn va onlayn tadbirlarni boshqarish"
              icon={<path d="M4 6h16v14H4V6Zm0 4h16M8 3v4M16 3v4" />}
              iconClass="bg-amber-50 text-amber-600"
              allHref="/learning/events"
              soonNote="Tadbir yaratish va qatnashchilar — tez orada"
            >
              <Metric value={data.events?.upcoming ?? 0} label="yaqinlashayotgan tadbir" />
            </Card>
          )}

          {data.isHr && (
            <Card
              title="Marafonlar"
              subtitle="bosqichli dasturlar: ketma-ket kurslar to'plami"
              icon={<path d="M5 21V4m0 0h11l-2 4 2 4H5" />}
              iconClass="bg-teal-50 text-teal-600"
              disabled
              soonNote="Tez orada"
            />
          )}

          <Card
            title="Tayinlovlar"
            subtitle={data.isHr ? 'kurslarni xodimlarga tayinlash' : "o'z xodimlaringizga kurs tayinlash"}
            icon={<path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 9a6 6 0 0 1 12 0M17 8l2 2 3-4" />}
            iconClass="bg-emerald-50 text-emerald-600"
            addHref="/learning-admin/assignments/new"
            allHref="/learning-admin/assignments"
          >
            <div className="flex flex-col gap-2">
              {data.isHr && (
                <SubLink href="/learning-admin/rules" title="Qoidalar" subtitle={`avtomatik tayinlash · ${data.rules?.active ?? 0} ta faol`} />
              )}
              {data.isHr && <SubLink href={null} title="Fayl orqali" subtitle="CSV fayl bilan ommaviy tayinlash — tez orada" />}
              {!data.isHr && (
                <div className="flex gap-6">
                  <Metric value={data.assignments.active} label="jarayonda" />
                  <Metric value={data.assignments.overdue} label="muddati o'tgan" tone={data.assignments.overdue > 0 ? 'bad' : 'default'} />
                </div>
              )}
            </div>
          </Card>

          <Card
            title="So'rovlar"
            subtitle="o'qish so'rovlari, katalogdan tashqari kurslar, materialga ruxsat"
            icon={<path d="M4 6h16v12H4V6Zm0 0 8 7 8-7" />}
            iconClass="bg-violet-50 text-violet-600"
            soonNote="Ko'rib chiqish (tasdiqlash / rad etish) — tez orada"
          >
            <Metric value={data.requests.pending} label="ko'rib chiqish kutilmoqda" tone={data.requests.pending > 0 ? 'warn' : 'default'} />
          </Card>
        </div>
      </section>
    </div>
  );
}

function Card({
  title,
  subtitle,
  icon,
  iconClass,
  addHref,
  allHref,
  disabled = false,
  soonNote,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: JSX.Element;
  iconClass?: string;
  addHref?: string | null;
  allHref?: string;
  disabled?: boolean;
  soonNote?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-4">
        {icon && (
          <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              {icon}
            </svg>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-stone-900">{title}</h3>
            {addHref && (
              <Link
                href={addHref}
                title="Yangi"
                className="flex h-5 w-5 items-center justify-center rounded-full border border-accent text-xs font-bold leading-none text-accent hover:bg-accent hover:text-white"
              >
                +
              </Link>
            )}
          </div>
          {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
        </div>
        {allHref && !disabled && (
          <Link href={allHref} className="text-sm font-medium text-accent hover:underline">
            barchasi
          </Link>
        )}
      </div>
      {children}
      {soonNote && <p className="text-xs text-stone-400">{soonNote}</p>}
    </div>
  );
}

function SubLink({ href, title, subtitle }: { href: string | null; title: string; subtitle: string }) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-stone-800">{title}</span>
        <span className="block text-xs text-stone-500">{subtitle}</span>
      </span>
      {href && <span className="text-stone-400">›</span>}
    </>
  );
  return href ? (
    <Link href={href} className="flex items-center gap-3 rounded-lg bg-stone-50 px-4 py-3 transition hover:bg-stone-100">
      {content}
    </Link>
  ) : (
    <div className="flex items-center gap-3 rounded-lg bg-stone-50 px-4 py-3 opacity-60">{content}</div>
  );
}

function Metric({ value, label, tone = 'default' }: { value: number; label: string; tone?: 'default' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'text-rose-600' : tone === 'warn' ? 'text-amber-600' : 'text-stone-900';
  return (
    <div>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}

function SummaryCard({ assignments }: { assignments: Overview['assignments'] }) {
  return (
    <Link
      href="/learning-admin/assignments"
      className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 transition hover:border-stone-300"
    >
      <h3 className="text-base font-semibold text-stone-900">Tayinlovlar holati</h3>
      <div className="flex flex-col gap-3">
        <Metric value={assignments.active} label="jarayonda" />
        <Metric value={assignments.overdue} label="muddati o'tgan" tone={assignments.overdue > 0 ? 'bad' : 'default'} />
        <Metric value={assignments.completed} label="tugatilgan" />
      </div>
    </Link>
  );
}
