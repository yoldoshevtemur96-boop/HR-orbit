'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  EmptyState,
  MaterialCard,
  MaterialRow,
  formatDate,
} from '@/components/learning/materialUi';
import { EventCard } from '@/components/learning/EventCard';
import type { LearningEvent, LearningMaterial, LearningSummary } from '@/types/learning';

type TabKey = 'continue' | 'assigned' | 'events' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'continue', label: 'Davom ettirish' },
  { key: 'assigned', label: 'Tayinlangan' },
  { key: 'events', label: 'Tadbirlar' },
  { key: 'history', label: 'Tarix' },
];

const QUICK_LINKS: {
  href: string;
  title: string;
  subtitle: string;
  countKey: keyof LearningSummary;
  iconClass: string;
  icon: JSX.Element;
}[] = [
  {
    href: '/learning/events',
    title: 'Tadbirlar afishasi',
    subtitle: 'treninglar va dasturlar',
    countKey: 'upcomingEvents',
    iconClass: 'bg-amber-50 text-amber-600',
    icon: <path d="M4 6h16v14H4V6Zm0 4h16M8 3v4M16 3v4" />,
  },
  {
    href: '/learning/favorites',
    title: 'Sevimlilar',
    subtitle: 'saqlangan materiallar',
    countKey: 'favorites',
    iconClass: 'bg-rose-50 text-rose-600',
    icon: <path d="M7 3h10v18l-5-4-5 4V3Z" />,
  },
  {
    href: '/learning/requests',
    title: "Mening so'rovlarim",
    subtitle: 'rahbar tasdig‘i',
    countKey: 'pendingRequests',
    iconClass: 'bg-emerald-50 text-emerald-600',
    icon: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />,
  },
  {
    href: '/learning/goals',
    title: 'Rivojlanish maqsadlari',
    subtitle: "o'qish maqsad sifatida",
    countKey: 'activeGoals',
    iconClass: 'bg-sky-50 text-sky-600',
    icon: <path d="M7 17 17 7M9 7h8v8" />,
  },
];

// Learning & Development — xodimning bosh sahifasi
export default function LearningHomePage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabKey>('continue');
  const [summary, setSummary] = useState<LearningSummary | null>(null);
  const [latest, setLatest] = useState<LearningMaterial[] | null>(null);
  const [tabData, setTabData] = useState<Partial<Record<TabKey, LearningMaterial[] | LearningEvent[]>>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<LearningSummary>('/learning/summary')
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err?.response?.data?.error?.message ?? 'Yuklashda xatolik yuz berdi'));
    api.get<LearningMaterial[]>('/learning/materials', { params: { limit: 8 } }).then((res) => setLatest(res.data));
  }, []);

  useEffect(() => {
    if (tabData[tab]) return;
    const request =
      tab === 'continue'
        ? api.get<LearningMaterial[]>('/learning/my/progress', { params: { status: 'IN_PROGRESS' } })
        : tab === 'history'
          ? api.get<LearningMaterial[]>('/learning/my/progress', { params: { status: 'COMPLETED' } })
          : tab === 'assigned'
            ? api.get<LearningMaterial[]>('/learning/my/assignments')
            : api.get<LearningEvent[]>('/learning/events', { params: { scope: 'mine' } });
    request.then((res) => setTabData((prev) => ({ ...prev, [tab]: res.data })));
  }, [tab, tabData]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    router.push(q ? `/learning/catalog?q=${encodeURIComponent(q)}` : '/learning/catalog');
  }

  const current = tabData[tab];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Learning &amp; Development</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">O&apos;qish va rivojlanish</h1>
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <form onSubmit={handleSearch} className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Material bo'yicha qidirish"
          className="w-full rounded-xl border border-stone-200 bg-white py-3.5 pl-12 pr-4 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
      </form>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {QUICK_LINKS.map((q) => {
          const count = summary?.[q.countKey];
          return (
            <Link
              key={q.href}
              href={q.href}
              className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-5 transition hover:border-stone-300 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${q.iconClass}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    {q.icon}
                  </svg>
                </span>
                {count !== undefined && count > 0 && (
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">{count}</span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-900">{q.title}</p>
                <p className="mt-0.5 text-xs text-stone-400">{q.subtitle}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="flex flex-col gap-4 rounded-2xl bg-sky-50/60 p-6">
        <h2 className="font-display text-xl font-semibold text-stone-900">O&apos;qish</h2>
        <nav className="flex gap-1 border-b border-stone-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === t.key ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              {t.label}
              {t.key === 'assigned' && summary && summary.assigned > 0 && (
                <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">{summary.assigned}</span>
              )}
            </button>
          ))}
        </nav>

        {current === undefined ? (
          <p className="text-sm text-stone-400">Yuklanmoqda...</p>
        ) : current.length === 0 ? (
          <EmptyState>
            {tab === 'continue' && "Boshlangan material yo'q — katalogdan birini tanlang."}
            {tab === 'assigned' && "Sizga tayinlangan material yo'q."}
            {tab === 'events' && (
              <>
                Siz hali tadbirga yozilmagansiz.{' '}
                <Link href="/learning/events" className="font-medium text-accent hover:underline">
                  Afishani ko&apos;rish
                </Link>
              </>
            )}
            {tab === 'history' && "Tugatilgan material hali yo'q."}
          </EmptyState>
        ) : tab === 'events' ? (
          <div className="grid gap-3 md:grid-cols-2">
            {(current as LearningEvent[]).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(current as LearningMaterial[]).map((material) => (
              <MaterialRow
                key={material.id}
                material={material}
                extra={
                  tab === 'assigned' && material.assignment?.dueDate ? (
                    <span className="text-amber-600"> · muddat: {formatDate(material.assignment.dueDate)}</span>
                  ) : tab === 'history' && material.myProgress?.completedAt ? (
                    <> · {formatDate(material.myProgress.completedAt)}</>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-stone-900">So&apos;nggi qo&apos;shilganlar</h2>
          <Link href="/learning/catalog" className="text-sm font-medium text-accent hover:underline">
            barchasi
          </Link>
        </div>
        {latest === null ? (
          <p className="text-sm text-stone-400">Yuklanmoqda...</p>
        ) : latest.length === 0 ? (
          <EmptyState>Katalogda hali material yo&apos;q.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            {latest.map((m) => (
              <MaterialCard key={m.id} material={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
