'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { formatJalaliDateTime } from '@/lib/format';

interface AuditItem {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  actor?: { firstName: string; lastName: string; email: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'ورود',
  'auth.logout': 'خروج',
  'auth.revoke_sessions': 'لغو نشست‌ها',
  'user.created': 'ایجاد کاربر',
  'user.updated': 'ویرایش کاربر',
  'user.password_reset': 'بازنشانی رمز',
  'bootstrap.completed': 'تکمیل Bootstrap',
  'device.registered': 'ثبت دستگاه',
  'device.revoked': 'لغو دستگاه',
  'attendance_correction.requested': 'درخواست اصلاح حضور',
  'attendance_correction.approved': 'تأیید اصلاح حضور',
  'attendance_correction.rejected': 'رد اصلاح حضور',
};

export default function AuditPage() {
  const router = useRouter();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>();

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }

    async function load() {
      try {
        const me = await apiFetch<{ firstName: string; lastName: string }>('/auth/me');
        setUserName(`${me.firstName} ${me.lastName}`);
        const data = await apiFetch<{ items: AuditItem[] }>('/audit-logs');
        setItems(data.items);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری حسابرسی');
      } finally {
        setLoading(false);
      }
    }
    load();
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">تاریخچه حسابرسی</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            رویدادهای حساس سامانه برای ردیابی تغییرات
          </p>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}

        {items.length === 0 ? (
          <EmptyState title="رویدادی ثبت نشده است" />
        ) : (
          <div className="card-surface overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-ink-50/60 text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">زمان</th>
                  <th className="px-4 py-3 text-right font-medium">عملیات</th>
                  <th className="px-4 py-3 text-right font-medium">موجودیت</th>
                  <th className="px-4 py-3 text-right font-medium">عامل</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">{formatJalaliDateTime(item.createdAt)}</td>
                    <td className="px-4 py-3">
                      {ACTION_LABELS[item.action] || item.action}
                    </td>
                    <td className="px-4 py-3">
                      {item.entityType}
                      {item.entityId ? (
                        <span className="mr-1 text-xs text-[var(--muted)]" dir="ltr">
                          ({item.entityId.slice(0, 8)}…)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {item.actor
                        ? `${item.actor.firstName} ${item.actor.lastName}`
                        : '—'}
                    </td>
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
