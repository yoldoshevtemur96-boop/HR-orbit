const STATUS_STYLES: Record<string, string> = {
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  CANCELLED: 'bg-stone-100 text-stone-500',
};

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Jarayonda',
  APPROVED: 'Tasdiqlandi',
  REJECTED: 'Rad etildi',
  CANCELLED: 'Bekor qilindi',
};

export function StatusBadge({ status }: { status: string }) {
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
