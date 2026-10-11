'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { formatJalaliDate, formatJalaliDateTime } from '@/lib/format';

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

interface ActivityReport {
  user: { id: string; fullName: string; email: string; jobTitle?: string | null };
  timezone: string;
  rangeLabel: string;
  from: string;
  to: string;
  workSessions: Array<{
    id: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    startedLabel: string;
    endedLabel: string | null;
  }>;
  segments: Array<{
    id: string;
    startedAt: string;
    endedAt: string | null;
    durationMinutes: number;
    appName: string;
    processName: string;
    detail: string | null;
    url: string | null;
    windowTitle: string | null;
    context: string | null;
    narrativeFa: string;
    timeLabel: string;
  }>;
  storyFa: string[];
  summary: {
    segmentCount: number;
    distinctApps: string[];
    totalFocusMinutes: number;
  };
  notesFa: string[];
}

function todayInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ActivityReportPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState('');
  const [date, setDate] = useState(todayInputValue);
  const [report, setReport] = useState<ActivityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    async function init() {
      try {
        const me = await apiFetch<{
          firstName: string;
          lastName: string;
          permissions: string[];
        }>('/auth/me');
        setUserName(`${me.firstName} ${me.lastName}`);
        if (!me.permissions?.includes('attendance:manage')) {
          setError('فقط مدیر سازمان یا سرپرست تیم به این گزارش دسترسی دارند.');
          setLoading(false);
          return;
        }
        const list = await apiFetch<UserOption[]>('/users?status=ACTIVE');
        setUsers(list);
        if (list.length > 0) setUserId(list[0].id);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setError('مجوز مشاهده این گزارش را ندارید.');
        } else {
          setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری');
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  const loadReport = useCallback(async () => {
    if (!userId) return;
    setLoadingReport(true);
    setError(null);
    try {
      const data = await apiFetch<ActivityReport>(
        `/reports/activity?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`,
      );
      setReport(data);
    } catch (err) {
      setReport(null);
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری گزارش فعالیت');
    } finally {
      setLoadingReport(false);
    }
  }, [userId, date, router]);

  useEffect(() => {
    if (userId) void loadReport();
  }, [userId, date, loadReport]);

  const selectedLabel = useMemo(() => {
    const u = users.find((x) => x.id === userId);
    return u ? `${u.firstName} ${u.lastName}` : '';
  }, [users, userId]);

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">
              <Link href="/reports" className="text-brand-700 hover:underline">
                گزارش‌ها
              </Link>
              <span className="mx-1">/</span>
              فعالیت کاربر
            </p>
            <h1 className="mt-1 text-2xl font-bold">گزارش فعالیت روزانه</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              تایم‌لاین برنامه‌های فعال هر کاربر — مناسب مدیر و سرپرست
            </p>
          </div>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}

        <div className="card-surface grid gap-4 p-5 md:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">کاربر</span>
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} — {u.email}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">تاریخ</span>
            <input
              type="date"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              dir="ltr"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="btn-primary w-full md:w-auto"
              onClick={() => void loadReport()}
              disabled={loadingReport || !userId}
            >
              {loadingReport ? 'در حال بارگذاری…' : 'به‌روزرسانی'}
            </button>
          </div>
        </div>

        {loadingReport && !report ? <Loading /> : null}

        {report ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="card-surface p-4">
                <p className="text-sm text-[var(--muted)]">کاربر</p>
                <p className="mt-1 text-lg font-semibold">{report.user.fullName}</p>
                <p className="text-xs text-[var(--muted)]" dir="ltr">
                  {report.user.email}
                </p>
              </div>
              <div className="card-surface p-4">
                <p className="text-sm text-[var(--muted)]">بازه</p>
                <p className="mt-1 text-lg font-semibold">{formatJalaliDate(report.from)}</p>
                <p className="text-xs text-[var(--muted)]" dir="ltr">
                  {report.timezone}
                </p>
              </div>
              <div className="card-surface p-4">
                <p className="text-sm text-[var(--muted)]">خلاصه</p>
                <p className="mt-1 text-lg font-semibold">
                  {report.summary.segmentCount} بخش · {report.summary.totalFocusMinutes} دقیقه
                </p>
                <p className="truncate text-xs text-[var(--muted)]">
                  {report.summary.distinctApps.join('، ') || '—'}
                </p>
              </div>
            </div>

            {report.workSessions.length ? (
              <div className="card-surface p-5">
                <h2 className="text-lg font-semibold">نشست‌های کاری</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {report.workSessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2"
                    >
                      <span>
                        شروع {s.startedLabel}
                        {s.endedLabel ? ` → پایان ${s.endedLabel}` : ' · باز'}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {s.status === 'OPEN' ? 'باز' : 'بسته'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="card-surface p-5">
              <h2 className="text-lg font-semibold">داستان روز</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {selectedLabel} — به زبان ساده
              </p>
              {!report.storyFa.length ? (
                <div className="mt-4">
                  <EmptyState
                    title="فعالیتی ثبت نشده"
                    description="برای این روز هنوز سوییچ برنامه از Agent گزارش نشده است."
                  />
                </div>
              ) : (
                <ol className="mt-4 space-y-3">
                  {report.storyFa.map((line, i) => (
                    <li
                      key={`${report.segments[i]?.id ?? i}-${line}`}
                      className="flex gap-3 rounded-xl border border-[var(--border)] bg-ink-50/40 px-4 py-3 text-sm"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="card-surface p-5">
              <h2 className="text-lg font-semibold">جزئیات تایم‌لاین</h2>
              {!report.segments.length ? (
                <p className="mt-3 text-sm text-[var(--muted)]">ردیفی وجود ندارد</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                      <tr>
                        <th className="px-3 py-2 text-right">زمان</th>
                        <th className="px-3 py-2 text-right">برنامه</th>
                        <th className="px-3 py-2 text-right">جزئیات</th>
                        <th className="px-3 py-2 text-right">مدت (دقیقه)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.segments.map((s) => (
                        <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                          <td className="px-3 py-2 whitespace-nowrap" dir="ltr">
                            {s.timeLabel}
                            {s.endedAt ? (
                              <span className="block text-xs text-[var(--muted)]">
                                تا {formatJalaliDateTime(s.endedAt).split(' ').pop()}
                              </span>
                            ) : (
                              <span className="block text-xs text-brand-700">فعال</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium">{s.appName}</td>
                          <td className="px-3 py-2">
                            {s.context ? (
                              <span className="block truncate" dir="ltr" title={s.context}>
                                {s.context}
                              </span>
                            ) : (
                              '—'
                            )}
                            {s.url ? (
                              <span
                                className="mt-0.5 block truncate text-xs text-brand-700"
                                dir="ltr"
                                title={s.url}
                              >
                                {s.url}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">{s.durationMinutes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {report.notesFa.length ? (
              <Alert type="info">
                <ul className="list-disc pr-5">
                  {report.notesFa.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
