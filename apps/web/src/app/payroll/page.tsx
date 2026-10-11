'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { formatJalaliDateTime } from '@/lib/format';

interface Period {
  id: string;
  labelFa: string;
  periodStart: string;
  periodEnd: string;
  status: string;
}

interface Proposal {
  id: string;
  status: string;
  proposedAmount: string;
  user?: { firstName: string; lastName: string };
}

export default function PayrollPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  async function load() {
    const [p, pr] = await Promise.all([
      apiFetch<Period[]>('/payroll/periods').catch(() => [] as Period[]),
      apiFetch<Proposal[]>('/payroll/proposals'),
    ]);
    setPeriods(p);
    setProposals(pr);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    async function init() {
      try {
        const me = await apiFetch<{ firstName: string; lastName: string }>('/auth/me');
        setUserName(`${me.firstName} ${me.lastName}`);
        await load();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(err instanceof ApiError ? err.message : 'خطا');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function generate(periodId: string) {
    setGenerating(periodId);
    setError(null);
    try {
      await apiFetch(`/payroll/periods/${periodId}/generate`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تولید پیشنهاد ناموفق');
    } finally {
      setGenerating(null);
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">حقوق و دستمزد</h1>
        <Link href="/contracts" className="btn-secondary">
          قراردادها
        </Link>
      </div>
      {error && <Alert type="error">{error}</Alert>}

      <section className="card mb-6">
        <h2 className="mb-3 text-lg font-semibold">دوره‌ها</h2>
        <ul className="divide-y divide-[var(--border)] text-sm">
          {periods.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {p.labelFa} — {formatJalaliDateTime(p.periodStart)} تا{' '}
                {formatJalaliDateTime(p.periodEnd)} ({p.status})
              </span>
              <button
                type="button"
                className="btn-secondary !py-1 text-xs"
                disabled={generating === p.id}
                onClick={() => generate(p.id)}
              >
                {generating === p.id ? '…' : 'تولید پیشنهادها'}
              </button>
            </li>
          ))}
        </ul>
        {periods.length === 0 && (
          <p className="text-sm text-[var(--muted)]">دوره‌ای تعریف نشده — از API ایجاد کنید.</p>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">پیشنهادها</h2>
        <ul className="divide-y divide-[var(--border)] text-sm">
          {proposals.map((pr) => (
            <li key={pr.id} className="flex items-center justify-between py-2">
              <span>
                {pr.user ? `${pr.user.firstName} ${pr.user.lastName}` : '—'} — {pr.proposedAmount}{' '}
                — {pr.status}
              </span>
              <Link href={`/payroll/${pr.id}`} className="text-brand-700 hover:underline">
                جزئیات
              </Link>
            </li>
          ))}
        </ul>
        {proposals.length === 0 && (
          <p className="text-sm text-[var(--muted)]">پیشنهادی وجود ندارد.</p>
        )}
      </section>
    </AppShell>
  );
}
