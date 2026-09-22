import type { FormField } from '@/types/workflow';

interface DynamicRequestFormProps {
  fields: FormField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

// WorkflowTemplate.formSchema'dan dinamik forma maydonlarini chizadi.
// Workflow konstruktorida qo'shilgan har qanday yangi maydon (jumladan
// 'select' turi) bu yerda avtomatik to'g'ri render bo'ladi.
export function DynamicRequestForm({ fields, values, onChange }: DynamicRequestFormProps) {
  return (
    <>
      {fields.map((field) => (
        <label key={field.key} className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-stone-600">
            {field.label} {field.required && <span className="text-rose-500">*</span>}
          </span>
          {field.type === 'textarea' ? (
            <textarea
              required={field.required}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              rows={3}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          ) : field.type === 'select' ? (
            <select
              required={field.required}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">Tanlang</option>
              {(field.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
              required={field.required}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          )}
        </label>
      ))}
    </>
  );
}
