'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { formatJalaliDateTime } from '@/lib/format';

interface NotificationItem {
  id: string;
  titleFa?: string;
  bodyFa?: string | null;
  title?: string;
  body?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<{ items?: NotificationItem[] } | NotificationItem[]>(
      '/notifications',
    );
    setItems(Array.isArray(data) ? data : data.items || []);
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
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری اعلان‌ها');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function markAll() {
    try {
      await apiFetch('/notifications/read-all', { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'عملیات ناموفق');
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">اعلان‌ها</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">اعلان‌های درون‌پنلی سامانه</p>
          </div>
          <button type="button" className="btn-secondary" onClick={markAll}>
            خواندن همه
          </button>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}

        {items.length === 0 ? (
          <EmptyState title="اعلانی وجود ندارد" />
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li
                key={n.id}
                className="card-surface flex flex-wrap items-start justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium">{n.titleFa || n.title}</p>
                  {(n.bodyFa || n.body) ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">{n.bodyFa || n.body}</p>
                  ) : null}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {formatJalaliDateTime(n.createdAt)}
                  <div>{n.readAt ? 'خوانده‌شده' : 'خوانده‌نشده'}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
