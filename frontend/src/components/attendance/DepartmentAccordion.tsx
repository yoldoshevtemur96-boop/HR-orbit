'use client';

import { useState } from 'react';

interface DepartmentAccordionProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

// HR/Timekeeper uchun kunlik davomat jadvalini bo'lim bo'yicha
// guruhlab ko'rsatadi — har bir bo'lim yig'ma holatda boshlanadi.
export function DepartmentAccordion({ title, count, defaultOpen = false, children }: DepartmentAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-stone-50"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 flex-shrink-0 text-stone-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span className="text-sm font-semibold text-stone-800">{title}</span>
        <span className="ml-auto rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-500">
          {count} ta xodim
        </span>
      </button>
      {isOpen && <div className="border-t border-stone-200">{children}</div>}
    </div>
  );
}
