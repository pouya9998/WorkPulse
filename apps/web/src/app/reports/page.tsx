'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { formatJalaliDateTime } from '@/lib/format';

interface Overview {
  generatedAt: string;
  summary: {
    userCount: number;
    activeUsers: number;
    openSessions: number;
    activeDevices: number;
    openAlerts: number;
    pendingCorrections: number;
    meetingsUpcoming: number;
    pendingPayroll: number;
    gitlabStatus: string;
  };
  attendanceEventCounts: Array<{ type: string; count: number }>;
  notesFa: string[];
}

interface AttendanceSummary {
  from: string;
  to: string;
  users: Array<{
    fullName: string;
    email: string;
    sessionCount: number;
    openSessions: number;
    totalHours: number;
  }>;
  notesFa: string[];
}

export default function ReportsPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    async function load() {
      try {
        const me = await apiFetch<{ firstName: string; lastName: string }>('/auth/me');
        setUserName(`${me.firstName} ${me.lastName}`);
        const [ov, att] = await Promise.all([
          apiFetch<Overview>('/reports/overview'),
          apiFetch<AttendanceSummary>('/reports/attendance-summary'),
        ]);
        setOverview(ov);
        setAttendance(att);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری گزارش');
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

  const s = overview?.summary;

  return (
    <AppShell userName={userName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">گزارش‌های مدیریتی</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            نمای کلی سازمان — تولید شده در {formatJalaliDateTime(overview?.generatedAt)}
          </p>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['کاربران فعال', s?.activeUsers],
            ['نشست باز', s?.openSessions],
            ['دستگاه فعال', s?.activeDevices],
            ['هشدار باز', s?.openAlerts],
            ['اصلاح در انتظار', s?.pendingCorrections],
            ['جلسات آینده', s?.meetingsUpcoming],
            ['حقوق در انتظار', s?.pendingPayroll],
            ['وضعیت GitLab', s?.gitlabStatus],
          ].map(([label, value]) => (
            <div key={String(label)} className="card-surface p-4">
              <p className="text-sm text-[var(--muted)]">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value ?? '—'}</p>
            </div>
          ))}
        </div>

        {overview?.notesFa?.length ? (
          <Alert type="info">
            <ul className="list-disc pr-5">
              {overview.notesFa.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <div className="card-surface p-5">
          <h2 className="text-lg font-semibold">خلاصه ساعات حضور (۷ روز)</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            از {formatJalaliDateTime(attendance?.from)} تا {formatJalaliDateTime(attendance?.to)}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 text-right">نام</th>
                  <th className="px-3 py-2 text-right">ایمیل</th>
                  <th className="px-3 py-2 text-right">تعداد نشست</th>
                  <th className="px-3 py-2 text-right">ساعات تقریبی</th>
                </tr>
              </thead>
              <tbody>
                {(attendance?.users || []).map((u) => (
                  <tr key={u.email} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-3 py-2">{u.fullName}</td>
                    <td className="px-3 py-2" dir="ltr">
                      {u.email}
                    </td>
                    <td className="px-3 py-2">{u.sessionCount}</td>
                    <td className="px-3 py-2">{u.totalHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
