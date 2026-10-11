'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { formatJalaliDateTime } from '@/lib/format';

interface Correction {
  id: string;
  status: string;
  reasonFa: string;
  reviewNotesFa?: string | null;
  createdAt: string;
  requestedStartAt?: string | null;
  requestedEndAt?: string | null;
  user?: { firstName: string; lastName: string };
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'در انتظار',
  APPROVED: 'تأیید شده',
  REJECTED: 'رد شده',
};

export default function CorrectionsPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [canReview, setCanReview] = useState(false);
  const [items, setItems] = useState<Correction[]>([]);
  const [reasonFa, setReasonFa] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function reload(tokenOk = true) {
    const [list, me] = await Promise.all([
      apiFetch<Correction[]>('/attendance-corrections'),
      tokenOk
        ? apiFetch<{ firstName: string; lastName: string; permissions: string[] }>(
            '/auth/me',
          )
        : Promise.resolve(null),
    ]);
    setItems(list);
    if (me) {
      setUserName(`${me.firstName} ${me.lastName}`);
      setCanReview(me.permissions.includes('attendance:manage'));
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    reload()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reasonFa.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/attendance-corrections', {
        method: 'POST',
        body: { reasonFa: reasonFa.trim() },
      });
      setReasonFa('');
      await reload(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت درخواست ناموفق بود');
    } finally {
      setSubmitting(false);
    }
  }

  async function review(id: string, action: 'approve' | 'reject') {
    let reviewNotesFa: string | undefined;
    if (action === 'reject') {
      const notes = window.prompt('دلیل رد را وارد کنید:');
      if (!notes?.trim()) return;
      reviewNotesFa = notes.trim();
    }
    try {
      await apiFetch(`/attendance-corrections/${id}/${action}`, {
        method: 'POST',
        body: { reviewNotesFa },
      });
      await reload(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'رسیدگی ناموفق بود');
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
          <h1 className="text-2xl font-bold">اصلاح حضور</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            درخواست اصلاح و پیگیری وضعیت بازبینی
          </p>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}

        <form onSubmit={onSubmit} className="card-surface space-y-4 p-5">
          <h2 className="font-semibold">درخواست جدید</h2>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">توضیح (فارسی)</span>
            <textarea
              className="input-field min-h-[5rem] w-full"
              value={reasonFa}
              onChange={(e) => setReasonFa(e.target.value)}
              required
              maxLength={2000}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'در حال ارسال…' : 'ثبت درخواست'}
          </button>
        </form>

        {items.length === 0 ? (
          <EmptyState title="درخواستی ثبت نشده است" />
        ) : (
          <div className="card-surface overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-ink-50/60 text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">زمان</th>
                  <th className="px-4 py-3 text-right font-medium">کاربر</th>
                  <th className="px-4 py-3 text-right font-medium">دلیل</th>
                  <th className="px-4 py-3 text-right font-medium">وضعیت</th>
                  {canReview ? (
                    <th className="px-4 py-3 text-right font-medium">عملیات</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">{formatJalaliDateTime(item.createdAt)}</td>
                    <td className="px-4 py-3">
                      {item.user
                        ? `${item.user.firstName} ${item.user.lastName}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 max-w-xs">{item.reasonFa}</td>
                    <td className="px-4 py-3">
                      {STATUS_LABELS[item.status] || item.status}
                      {item.reviewNotesFa ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {item.reviewNotesFa}
                        </p>
                      ) : null}
                    </td>
                    {canReview ? (
                      <td className="px-4 py-3">
                        {item.status === 'PENDING' ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn-primary !py-1 text-xs"
                              onClick={() => review(item.id, 'approve')}
                            >
                              تأیید
                            </button>
                            <button
                              type="button"
                              className="btn-secondary !py-1 text-xs"
                              onClick={() => review(item.id, 'reject')}
                            >
                              رد
                            </button>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    ) : null}
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
