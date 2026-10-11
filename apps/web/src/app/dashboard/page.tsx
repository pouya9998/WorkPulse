'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Loading } from '@/components/Loading';
import { Alert } from '@/components/Alert';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { formatJalaliDateTime, ROLE_LABELS } from '@/lib/format';

interface MeResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organization: { id: string; name: string; timezone: string };
  roles: Array<{ code: string; nameFa: string }>;
}

interface OrgResponse {
  id: string;
  name: string;
  userCount: number;
  teamCount: number;
  timezone: string;
}

interface AttendanceStatus {
  displayStatusFa: string;
  canStartWork: boolean;
  canEndWork: boolean;
  agent: { isOnline: boolean; name: string } | null;
  focusedApp: {
    appName: string;
    detail?: string | null;
    url?: string | null;
  } | null;
  workSession: { startedAt: string } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [org, setOrg] = useState<OrgResponse | null>(null);
  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadAttendance = useCallback(async () => {
    try {
      const st = await apiFetch<AttendanceStatus>('/attendance/status');
      setAttendance(st);
    } catch {
      // employees without unlock may still land here briefly
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }

    async function load() {
      try {
        const [meData, orgData] = await Promise.all([
          apiFetch<MeResponse>('/auth/me'),
          apiFetch<OrgResponse>('/organizations/me'),
        ]);
        setMe(meData);
        setOrg(orgData);
        await loadAttendance();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری داشبورد');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router, loadAttendance]);

  async function workAction(kind: 'start' | 'end') {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/attendance/work/${kind}`, { method: 'POST', body: {} });
      setSuccess(kind === 'start' ? 'شروع کار ثبت شد' : 'پایان کار ثبت شد');
      await loadAttendance();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'عملیات ناموفق بود');
    } finally {
      setBusy(false);
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
    <AppShell userName={me ? `${me.firstName} ${me.lastName}` : undefined}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">داشبورد</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              خوش آمدید{me ? `، ${me.firstName}` : ''}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !attendance?.canStartWork}
              onClick={() => workAction('start')}
            >
              شروع کار
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || !attendance?.canEndWork}
              onClick={() => workAction('end')}
            >
              پایان کار
            </button>
          </div>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}
        {success ? <Alert type="success">{success}</Alert> : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="card-surface p-5">
            <p className="text-sm text-[var(--muted)]">سازمان</p>
            <p className="mt-2 text-xl font-semibold">{org?.name || '—'}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">منطقه زمانی: {org?.timezone}</p>
          </div>
          <div className="card-surface p-5">
            <p className="text-sm text-[var(--muted)]">وضعیت حضور</p>
            <p className="mt-2 text-xl font-semibold">{attendance?.displayStatusFa || '—'}</p>
            <p className="mt-2 text-xs">
              Agent:{' '}
              {attendance?.agent?.isOnline ? (
                <span className="text-emerald-700">آنلاین</span>
              ) : (
                <span className="text-amber-800">آفلاین</span>
              )}
            </p>
            {attendance?.workSession ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                از {formatJalaliDateTime(attendance.workSession.startedAt)}
              </p>
            ) : null}
          </div>
          <div className="card-surface p-5">
            <p className="text-sm text-[var(--muted)]">برنامه فعال</p>
            <p className="mt-2 text-xl font-semibold">{attendance?.focusedApp?.appName || '—'}</p>
            {attendance?.focusedApp?.detail ? (
              <p className="mt-1 truncate text-xs text-[var(--muted)]" dir="ltr">
                {attendance.focusedApp.detail}
              </p>
            ) : null}
            {attendance?.focusedApp?.url ? (
              <p className="mt-1 truncate text-xs text-brand-700" dir="ltr">
                {attendance.focusedApp.url}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-[var(--muted)]">نقش‌ها</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {me?.roles.map((r) => (
                <span
                  key={r.code}
                  className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800"
                >
                  {r.nameFa || ROLE_LABELS[r.code] || r.code}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
