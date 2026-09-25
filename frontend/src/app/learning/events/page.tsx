'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { EventCard } from '@/components/learning/EventCard';
import { EmptyState, PageBackLink } from '@/components/learning/materialUi';
import type { LearningEvent } from '@/types/learning';

type Scope = 'upcoming' | 'mine' | 'past';

const SCOPES: { key: Scope; label: string }[] = [
  { key: 'upcoming', label: 'Yaqinlashayotgan' },
  { key: 'mine', label: 'Men yozilganlar' },
  { key: 'past', label: "O'tganlar" },
];

export default function LearningEventsPage() {
  const [scope, setScope] = useState<Scope>('upcoming');
  const [events, setEvents] = useState<LearningEvent[] | null>(null);

  const load = useCallback(() => {
    api.get<LearningEvent[]>('/learning/events', { params: { scope } }).then((res) => setEvents(res.data));
  }, [scope]);

  useEffect(() => {
    setEvents(null);
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageBackLink />
      <div>
        <h1 className="font-display text-2xl font-semibold text-stone-900">Tadbirlar afishasi</h1>
        <p className="mt-1 text-sm text-stone-500">Treninglar, vebinarlar va ichki tadbirlar</p>
      </div>

      <nav className="flex gap-1 border-b border-stone-200">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setScope(s.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              scope === s.key ? 'border-accent text-accent' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {events === null ? (
        <p className="text-sm text-stone-400">Yuklanmoqda...</p>
      ) : events.length === 0 ? (
        <EmptyState>
          {scope === 'upcoming' && "Yaqin kunlarda tadbir rejalashtirilmagan."}
          {scope === 'mine' && 'Siz hali hech qaysi tadbirga yozilmagansiz.'}
          {scope === 'past' && "O'tgan tadbirlar yo'q."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
