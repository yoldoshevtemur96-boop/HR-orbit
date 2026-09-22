const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PROBATION: 'bg-sky-50 text-sky-700',
  ON_LEAVE: 'bg-amber-50 text-amber-700',
  SUSPENDED: 'bg-orange-50 text-orange-700',
  TERMINATED: 'bg-rose-50 text-rose-700',
  ARCHIVED: 'bg-stone-100 text-stone-500',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Faol',
  PROBATION: 'Sinov muddatida',
  ON_LEAVE: "Ta'tilda",
  SUSPENDED: 'Toʻxtatilgan',
  TERMINATED: 'Ishdan boʻshatilgan',
  ARCHIVED: 'Arxivlangan',
};

export function EmploymentStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_STYLES[status] ?? 'bg-stone-100 text-stone-500'
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
