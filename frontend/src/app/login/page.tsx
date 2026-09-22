'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const setTokens = useAuthStore((s) => s.setTokens);

  const [organizationSlug, setOrganizationSlug] = useState('demo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.post('/auth/login', { organizationSlug, email, password });
      setTokens(res.data.accessToken, res.data.refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Kirishda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] px-6">
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">HR Orbit</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Tizimga kirish</h1>
        <p className="mt-1 text-sm text-stone-500">Tashkilot hisobingiz bilan davom eting.</p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <Field label="Tashkilot (slug)">
            <input
              value={organizationSlug}
              onChange={(e) => setOrganizationSlug(e.target.value)}
              placeholder="demo"
              required
              className="input"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="siz@kompaniya.uz"
              required
              className="input"
            />
          </Field>
          <Field label="Parol">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="input"
            />
          </Field>

          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Kirilmoqda...' : 'Kirish'}
          </button>
        </form>

        <div className="mt-8 rounded-lg border border-stone-200 bg-white p-4 text-xs text-stone-500">
          <p className="mb-1 font-semibold text-stone-700">Demo hisoblar (parol: Password123!)</p>
          <p>ceo@demo.uz · hr@demo.uz · boshliq@demo.uz · legal@demo.uz · xodim@demo.uz</p>
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid #dde1d6;
          border-radius: 8px;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          background: white;
          outline: none;
        }
        .input:focus {
          border-color: #2e7d4f;
          box-shadow: 0 0 0 3px rgba(46, 125, 79, 0.12);
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-stone-600">{label}</span>
      {children}
    </label>
  );
}
