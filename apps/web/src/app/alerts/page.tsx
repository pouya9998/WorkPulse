'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Alert as UiAlert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { formatJalaliDateTime } from '@/lib/format';

interface AlertItem {
  id: string;
  type: string;
  status: string;
  titleFa: string;
  messageFa: string;
  createdAt: string;
  user?: { firstName: string; lastName: string };
}

const TYPE_LABELS: Record<string, string> = {
  MISSING_WORK_START: 'شروع کار ثبت نشده',
  HEARTBEAT_EXPIRED: 'Heartbeat منقضی',
  AGENT_NOT_SYNCED: 'Agent همگام نشده',
  UNRESOLVED_TIME: 'زمان حل‌نشده',
  MEETING_CONFLICT: 'تداخل جلسه',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'باز',
  ACKNOWLEDGED: 'مشاهده‌شده',
  RESOLVED: 'بسته‌شده',
};

export default function AlertsPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [items, setItems] = useState<AlertItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    const data = await apiFetch<{ items: AlertItem[] }>(`/alerts${qs}`);
    setItems(data.items);
  }, [statusFilter]);

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
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری هشدارها');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router, load]);

  async function act(id: string, action: 'acknowledge' | 'resolve') {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/alerts/${id}/${action}`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'عملیات ناموفق بود');
    } finally {
      setBusyId(null);
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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">هشدارها</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              پایش ناهنجاری‌های حضور و Agent
            </p>
          </div>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--muted)]">فیلتر وضعیت</span>
            <select
              className="input-field min-w-[10rem]"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setLoading(true);
                load()
                  .catch(() => setError('خطا در فیلتر'))
                  .finally(() => setLoading(false));
              }}
            >
              <option value="">همه</option>
              <option value="OPEN">باز</option>
              <option value="ACKNOWLEDGED">مشاهده‌شده</option>
              <option value="RESOLVED">بسته‌شده</option>
            </select>
          </label>
        </div>

        {error ? <UiAlert type="error">{error}</UiAlert> : null}

        {items.length === 0 ? (
          <EmptyState title="هشداری ثبت نشده است" />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="card-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-800">{item.titleFa}</p>
                    <p className="mt-1 text-sm">{item.messageFa}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {TYPE_LABELS[item.type] || item.type} ·{' '}
                      {STATUS_LABELS[item.status] || item.status} ·{' '}
                      {formatJalaliDateTime(item.createdAt)}
                      {item.user
                        ? ` · ${item.user.firstName} ${item.user.lastName}`
                        : null}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {item.status === 'OPEN' ? (
                      <button
                        type="button"
                        className="btn-secondary !py-1.5 text-sm"
                        disabled={busyId === item.id}
                        onClick={() => act(item.id, 'acknowledge')}
                      >
                        مشاهده شد
                      </button>
                    ) : null}
                    {item.status !== 'RESOLVED' ? (
                      <button
                        type="button"
                        className="btn-primary !py-1.5 text-sm"
                        disabled={busyId === item.id}
                        onClick={() => act(item.id, 'resolve')}
                      >
                        بستن
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
