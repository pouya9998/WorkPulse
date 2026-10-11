'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';

interface Policy {
  id: string;
  nameFa: string;
  expectedWorkStartUtc: string;
  expectedWorkEndUtc: string;
  graceMinutes: number;
  heartbeatTimeoutMinutes: number;
  isDefault: boolean;
  isActive: boolean;
}

export default function PoliciesPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [items, setItems] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nameFa: 'سیاست پیش‌فرض',
    expectedWorkStartUtc: '06:00',
    expectedWorkEndUtc: '14:00',
    graceMinutes: 15,
    heartbeatTimeoutMinutes: 2,
    isDefault: true,
  });

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    async function load() {
      try {
        const me = await apiFetch<{ firstName: string; lastName: string }>('/auth/me');
        setUserName(`${me.firstName} ${me.lastName}`);
        const list = await apiFetch<Policy[]>('/attendance-policies');
        setItems(list);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else if (err instanceof ApiError && err.status === 403) {
          setError('فقط مدیران می‌توانند سیاست‌ها را مدیریت کنند');
        } else {
          setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/attendance-policies', { method: 'POST', body: form });
      const list = await apiFetch<Policy[]>('/attendance-policies');
      setItems(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ذخیره ناموفق بود');
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Loading />
      </AppShell>
    );
  }

  return (
    <AppShell userName={userName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">سیاست‌های حضور</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            ساعات مورد انتظار و آستانه heartbeat (UTC)
          </p>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}

        <form onSubmit={onSubmit} className="card-surface grid gap-4 p-5 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-[var(--muted)]">نام سیاست</span>
            <input
              className="input-field w-full"
              value={form.nameFa}
              onChange={(e) => setForm({ ...form, nameFa: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">شروع مورد انتظار (UTC)</span>
            <input
              className="input-field w-full"
              dir="ltr"
              pattern="^([01]\d|2[0-3]):[0-5]\d$"
              value={form.expectedWorkStartUtc}
              onChange={(e) => setForm({ ...form, expectedWorkStartUtc: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">پایان مورد انتظار (UTC)</span>
            <input
              className="input-field w-full"
              dir="ltr"
              pattern="^([01]\d|2[0-3]):[0-5]\d$"
              value={form.expectedWorkEndUtc}
              onChange={(e) => setForm({ ...form, expectedWorkEndUtc: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">مهلت تأخیر (دقیقه)</span>
            <input
              type="number"
              className="input-field w-full"
              min={0}
              max={120}
              value={form.graceMinutes}
              onChange={(e) =>
                setForm({ ...form, graceMinutes: Number(e.target.value) })
              }
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">انقضای heartbeat (دقیقه)</span>
            <input
              type="number"
              className="input-field w-full"
              min={1}
              max={60}
              value={form.heartbeatTimeoutMinutes}
              onChange={(e) =>
                setForm({ ...form, heartbeatTimeoutMinutes: Number(e.target.value) })
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            سیاست پیش‌فرض سازمان
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary">
              ذخیره سیاست
            </button>
          </div>
        </form>

        {items.length === 0 ? (
          <EmptyState title="سیاستی تعریف نشده است" />
        ) : (
          <div className="card-surface overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-ink-50/60 text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">نام</th>
                  <th className="px-4 py-3 text-right font-medium">بازه UTC</th>
                  <th className="px-4 py-3 text-right font-medium">مهلت / HB</th>
                  <th className="px-4 py-3 text-right font-medium">پیش‌فرض</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">{p.nameFa}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {p.expectedWorkStartUtc} – {p.expectedWorkEndUtc}
                    </td>
                    <td className="px-4 py-3">
                      {p.graceMinutes} د / HB {p.heartbeatTimeoutMinutes} د
                    </td>
                    <td className="px-4 py-3">{p.isDefault ? 'بله' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
