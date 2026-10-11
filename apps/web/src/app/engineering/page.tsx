'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';

interface ActivityRow {
  user: { firstName: string; lastName: string; email: string };
  metrics: {
    mergeRequestsOpened: number;
    mergeRequestsMerged: number;
    reviewsGiven: number;
    pipelinesRun: number;
    commitCountNote: string;
  };
}

interface Report {
  disclaimerFa: string;
  dataIncompletenessNotesFa: string[];
  rows: ActivityRow[];
}

export default function EngineeringPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setFrom(start.toISOString().slice(0, 10));
    setTo(now.toISOString().slice(0, 10));

    async function init() {
      try {
        const me = await apiFetch<{ firstName: string; lastName: string }>('/auth/me');
        setUserName(`${me.firstName} ${me.lastName}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function onLoad(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const q = new URLSearchParams({ from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` });
      const data = await apiFetch<Report>(`/gitlab/engineering/activity?${q}`);
      setReport(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'بارگذاری گزارش ناموفق');
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
      <h1 className="mb-4 text-2xl font-bold">فعالیت مهندسی</h1>
      {error && <Alert type="error">{error}</Alert>}
      <form onSubmit={onLoad} className="card mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          از
          <input type="date" className="input mt-1 block" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm">
          تا
          <input type="date" className="input mt-1 block" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary">
          نمایش گزارش
        </button>
      </form>

      {report && (
        <>
          <Alert type="info">{report.disclaimerFa}</Alert>
          {report.dataIncompletenessNotesFa.map((note) => (
            <p key={note} className="mt-2 text-sm text-amber-800">
              {note}
            </p>
          ))}
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-[var(--muted)]">
                  <th className="p-2">کارمند</th>
                  <th className="p-2">MR باز</th>
                  <th className="p-2">MR ادغام</th>
                  <th className="p-2">Review</th>
                  <th className="p-2">Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.user.email} className="border-t border-[var(--border)]">
                    <td className="p-2">
                      {row.user.firstName} {row.user.lastName}
                    </td>
                    <td className="p-2">{row.metrics.mergeRequestsOpened}</td>
                    <td className="p-2">{row.metrics.mergeRequestsMerged}</td>
                    <td className="p-2">{row.metrics.reviewsGiven}</td>
                    <td className="p-2">{row.metrics.pipelinesRun}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
