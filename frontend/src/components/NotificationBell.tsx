'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Notification } from '@/types/notification';

const TYPE_LABEL: Record<string, string> = {
  REQUEST_SUBMITTED: 'Javob kutilmoqda',
  REQUEST_APPROVED: 'Tasdiqlandi',
  REQUEST_REJECTED: 'Rad etildi',
  HR_MESSAGE: 'HR xabari',
  DOCUMENT_AVAILABLE: 'Hujjat tayyor',
  LEARNING_ASSIGNED: "Yangi o'quv material",
  LEARNING_REMINDER: 'Muddat eslatmasi',
};

const POLL_INTERVAL_MS = 60_000;

// AppShell'dagi qo'ng'iroq ikonkasi shu komponent bilan almashtirildi —
// real-time yo'q (websocket), oddiy interval bilan so'rov yuboradi.
export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function load() {
    api
      .get<Notification[]>('/notifications')
      .then((res) => setItems(res.data))
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = items.filter((n) => !n.isRead).length;

  async function handleClick(notification: Notification) {
    if (!notification.isRead) {
      await api.patch(`/notifications/${notification.id}/read`);
      setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
    }
    setIsOpen(false);
    if (notification.entityType === 'WorkflowInstance' && notification.entityId) {
      router.push(`/workflow/${notification.entityId}`);
    } else if (notification.entityType === 'LearningMaterial' && notification.entityId) {
      router.push(`/learning/materials/${notification.entityId}`);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Bildirishnomalar"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-lg border border-stone-200 bg-white shadow-lg">
          <div className="border-b border-stone-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-stone-800">Bildirishnomalar</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-stone-400">Bildirishnoma yo&apos;q</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex w-full flex-col gap-0.5 border-b border-stone-50 px-4 py-2.5 text-left transition hover:bg-stone-50 last:border-0 ${
                    n.isRead ? '' : 'bg-accent-soft/40'
                  }`}
                >
                  <span className="text-xs font-medium text-accent">{TYPE_LABEL[n.type] ?? n.type}</span>
                  <span className="text-sm text-stone-700">{n.message}</span>
                  <span className="text-[11px] text-stone-400">{new Date(n.createdAt).toLocaleString('uz-UZ')}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
