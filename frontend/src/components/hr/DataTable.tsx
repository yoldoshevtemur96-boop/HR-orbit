'use client';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortKey?: string;
  align?: 'left' | 'right';
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyText?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (sortBy: string) => void;
}

// Qayta ishlatiladigan enterprise jadval — Employees/Departments/Branches/
// Positions sahifalarida bir xil ko'rinish va xatti-harakat uchun.
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  emptyText = "Ma'lumot topilmadi",
  sortBy,
  sortDir,
  onSortChange,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500 ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.sortKey && onSortChange ? (
                  <button
                    type="button"
                    onClick={() => onSortChange(col.sortKey!)}
                    className="inline-flex items-center gap-1 hover:text-stone-800"
                  >
                    {col.header}
                    {sortBy === col.sortKey && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-stone-400">
                Yuklanmoqda...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-stone-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                {columns.map((col) => (
                  <td key={col.key} className={`px-5 py-3 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
      <span>
        {total} tadan {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium disabled:opacity-40 hover:bg-stone-50"
        >
          Oldingi
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium disabled:opacity-40 hover:bg-stone-50"
        >
          Keyingi
        </button>
      </div>
    </div>
  );
}
