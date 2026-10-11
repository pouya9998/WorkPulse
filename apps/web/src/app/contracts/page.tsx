'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { CONTRACT_LABELS } from '@/lib/format';

interface ContractRow {
  id: string;
  contractType: string;
  currency: string;
  isActive: boolean;
  user: { firstName: string; lastName: string; email: string };
  versions: { versionNumber: number; hourlyRate?: string | null; baseMonthly?: string | null }[];
}

export default function ContractsPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    async function init() {
      try {
        const me = await apiFetch<{ firstName: string; lastName: string }>('/auth/me');
        setUserName(`${me.firstName} ${me.lastName}`);
        const data = await apiFetch<ContractRow[]>('/contracts');
        setContracts(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else if (err instanceof ApiError && err.status === 403) {
          setError('مجوز مشاهده قراردادها را ندارید');
        } else {
          setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری');
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

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
        <h1 className="text-2xl font-bold">قراردادها</h1>
        <Link href="/payroll" className="btn-secondary">
          دوره‌های حقوق
        </Link>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-[var(--muted)]">
              <th className="p-2">کارمند</th>
              <th className="p-2">نوع</th>
              <th className="p-2">نسخه جاری</th>
              <th className="p-2">نرخ / پایه</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => {
              const v = c.versions[0];
              return (
                <tr key={c.id} className="border-t border-[var(--border)]">
                  <td className="p-2">
                    {c.user.firstName} {c.user.lastName}
                  </td>
                  <td className="p-2">{CONTRACT_LABELS[c.contractType] || c.contractType}</td>
                  <td className="p-2">v{v?.versionNumber ?? '—'}</td>
                  <td className="p-2">
                    {c.contractType === 'HOURLY'
                      ? v?.hourlyRate
                      : v?.baseMonthly}{' '}
                    {c.currency}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {contracts.length === 0 && (
          <p className="p-4 text-sm text-[var(--muted)]">قراردادی ثبت نشده است.</p>
        )}
      </div>
    </AppShell>
  );
}
