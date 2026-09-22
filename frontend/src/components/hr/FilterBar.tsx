'use client';

interface SelectOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  selects?: {
    key: string;
    label: string;
    value: string;
    options: SelectOption[];
    onChange: (value: string) => void;
  }[];
  action?: React.ReactNode;
}

export function FilterBar({ search, onSearchChange, searchPlaceholder = 'Qidiruv...', selects, action }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-56 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
      />
      {selects?.map((s) => (
        <select
          key={s.key}
          value={s.value}
          onChange={(e) => s.onChange(e.target.value)}
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700 outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        >
          <option value="">{s.label}</option>
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      <div className="ml-auto">{action}</div>
    </div>
  );
}
