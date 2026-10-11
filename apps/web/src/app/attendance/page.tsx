'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { formatJalaliDateTime } from '@/lib/format';

interface AttendanceStatus {
  displayStatus: string;
  displayStatusFa: string;
  workSession: { id: string; startedAt: string; deviceName: string | null } | null;
  agent: {
    deviceId: string;
    name: string;
    platform: string;
    agentVersion: string;
    lastHeartbeatAt: string | null;
    isOnline: boolean;
    status: string;
  } | null;
  currentState: string;
  focusedApp: {
    appName: string;
    processName: string | null;
    windowTitle: string | null;
    url?: string | null;
    detail?: string | null;
    at: string;
  } | null;
  appFocusToday: Array<{
    id: string;
    appName: string;
    processName: string;
    windowTitle: string | null;
    url?: string | null;
    detail?: string | null;
    startedAt: string;
    endedAt: string | null;
  }>;
  canStartWork: boolean;
  canEndWork: boolean;
  recentEvents: Array<{
    id: string;
    type: string;
    typeFa: string;
    occurredAtDevice: string;
    outOfOrder: boolean;
  }>;
  notes: string[];
}

interface TimelineResponse {
  from: string;
  to: string;
  sessions: Array<{ id: string; status: string; startedAt: string; endedAt: string | null }>;
  events: Array<{
    id: string;
    type: string;
    typeFa: string;
    occurredAtDevice: string;
    outOfOrder: boolean;
  }>;
}

export default function AttendancePage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [st, tl] = await Promise.all([
      apiFetch<AttendanceStatus>('/attendance/status'),
      apiFetch<TimelineResponse>('/attendance/timeline'),
    ]);
    setStatus(st);
    setTimeline(tl);
  }, []);

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
        setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری حضور');
      } finally {
        setLoading(false);
      }
    }
    init();
    const timer = setInterval(() => {
      load().catch(() => undefined);
    }, 15000);
    return () => clearInterval(timer);
  }, [router, load]);

  async function workAction(kind: 'start' | 'end') {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/attendance/work/${kind}`, { method: 'POST', body: {} });
      setSuccess(kind === 'start' ? 'شروع کار ثبت شد' : 'پایان کار ثبت شد');
      await load();
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

  const agentOnline = !!status?.agent?.isOnline;

  return (
    <AppShell userName={userName}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">حضور و وضعیت Agent</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              شروع و پایان کار از همین پنل — Agent باید آنلاین باشد
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !status?.canStartWork}
              onClick={() => workAction('start')}
              title={!agentOnline ? 'Agent آنلاین نیست' : undefined}
            >
              شروع کار
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || !status?.canEndWork}
              onClick={() => workAction('end')}
            >
              پایان کار
            </button>
          </div>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}
        {success ? <Alert type="success">{success}</Alert> : null}

        {!agentOnline ? (
          <Alert type="info">
            برای شروع/پایان کار، Agent را روی سیستم خود اجرا کنید. صفحه{' '}
            <a href="/devices" className="font-medium underline">
              دستگاه‌ها
            </a>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="card-surface p-5">
            <p className="text-sm text-[var(--muted)]">وضعیت نمایشی</p>
            <p className="mt-2 text-xl font-semibold text-brand-800">
              {status?.displayStatusFa || '—'}
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              حالت دستگاه: {status?.currentState || 'UNKNOWN'}
            </p>
          </div>
          <div className="card-surface p-5">
            <p className="text-sm text-[var(--muted)]">نشست کاری</p>
            {status?.workSession ? (
              <>
                <p className="mt-2 font-medium">فعال</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  از {formatJalaliDateTime(status.workSession.startedAt)}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  دستگاه: {status.workSession.deviceName || '—'}
                </p>
              </>
            ) : (
              <p className="mt-2 font-medium">نشست باز نیست</p>
            )}
          </div>
          <div className="card-surface p-5">
            <p className="text-sm text-[var(--muted)]">Agent</p>
            {status?.agent ? (
              <>
                <p className="mt-2 font-medium">{status.agent.name}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {status.agent.platform} · v{status.agent.agentVersion}
                </p>
                <p className="mt-2">
                  <span
                    className={
                      status.agent.isOnline
                        ? 'rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700'
                        : 'rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800'
                    }
                  >
                    {status.agent.isOnline ? 'متصل' : 'Heartbeat منقضی / قطع'}
                  </span>
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  آخرین Heartbeat: {formatJalaliDateTime(status.agent.lastHeartbeatAt)}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">دستگاهی ثبت نشده است</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card-surface p-5">
            <h2 className="text-lg font-semibold">آخرین برنامه فعال</h2>
            {status?.focusedApp ? (
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-xl font-semibold text-brand-800">{status.focusedApp.appName}</p>
                <p className="text-xs text-[var(--muted)]" dir="ltr">
                  {status.focusedApp.processName || '—'}
                </p>
                {status.focusedApp.detail ? (
                  <p className="truncate text-xs text-[var(--muted)]" dir="ltr" title={status.focusedApp.detail}>
                    {status.focusedApp.detail}
                  </p>
                ) : status.focusedApp.windowTitle ? (
                  <p className="truncate text-xs text-[var(--muted)]" dir="ltr" title={status.focusedApp.windowTitle}>
                    {status.focusedApp.windowTitle}
                  </p>
                ) : null}
                {status.focusedApp.url ? (
                  <p className="truncate text-xs text-brand-700" dir="ltr" title={status.focusedApp.url}>
                    {status.focusedApp.url}
                  </p>
                ) : null}
                <p className="text-xs text-[var(--muted)]">
                  {formatJalaliDateTime(status.focusedApp.at)}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">هنوز برنامه‌ای گزارش نشده است</p>
            )}
          </div>
          <div className="card-surface p-5">
            <h2 className="text-lg font-semibold">برنامه‌های امروز</h2>
            {!status?.appFocusToday?.length ? (
              <p className="mt-3 text-sm text-[var(--muted)]">لیست خالی است</p>
            ) : (
              <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto text-sm">
                {status.appFocusToday.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-col gap-1 rounded-xl border border-[var(--border)] px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{a.appName}</span>
                      <span className="text-xs text-[var(--muted)]">
                        {formatJalaliDateTime(a.startedAt)}
                        {a.endedAt ? '' : ' · فعال'}
                      </span>
                    </div>
                    {a.detail || a.windowTitle ? (
                      <span className="truncate text-xs text-[var(--muted)]" dir="ltr">
                        {a.detail || a.windowTitle}
                      </span>
                    ) : null}
                    {a.url ? (
                      <span className="truncate text-xs text-brand-700" dir="ltr">
                        {a.url}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {status?.notes?.length ? (
          <Alert type="info">
            <ul className="list-disc pr-5">
              {status.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <div className="card-surface p-5">
          <h2 className="text-lg font-semibold">رویدادهای اخیر</h2>
          {!status?.recentEvents?.length ? (
            <div className="mt-4">
              <EmptyState
                title="رویدادی ثبت نشده"
                description="Agent را اجرا کنید، سپس از دکمهٔ شروع کار در همین صفحه استفاده کنید."
              />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-[var(--border)] text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">زمان دستگاه</th>
                    <th className="px-3 py-2 text-right font-medium">رویداد</th>
                    <th className="px-3 py-2 text-right font-medium">نکته</th>
                  </tr>
                </thead>
                <tbody>
                  {status.recentEvents.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-2">{formatJalaliDateTime(e.occurredAtDevice)}</td>
                      <td className="px-3 py-2">{e.typeFa}</td>
                      <td className="px-3 py-2 text-xs text-[var(--muted)]">
                        {e.outOfOrder ? 'خارج از ترتیب' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card-surface p-5">
          <h2 className="text-lg font-semibold">تایم‌لاین ۲۴ ساعت اخیر</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            از {formatJalaliDateTime(timeline?.from)} تا {formatJalaliDateTime(timeline?.to)}
          </p>
          {!timeline?.events?.length ? (
            <div className="mt-4">
              <EmptyState title="تایم‌لاین خالی است" />
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {timeline.events.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <span className="font-medium">{e.typeFa}</span>
                  <span className="text-[var(--muted)]">
                    {formatJalaliDateTime(e.occurredAtDevice)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
