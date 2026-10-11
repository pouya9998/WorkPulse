'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }

    async function load() {
      try {
        const me = await apiFetch<{ firstName: string; lastName: string }>('/auth/me');
        setUserName(`${me.firstName} ${me.lastName}`);
        const [st, tl] = await Promise.all([
          apiFetch<AttendanceStatus>('/attendance/status'),
          apiFetch<TimelineResponse>('/attendance/timeline'),
        ]);
        setStatus(st);
        setTimeline(tl);
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
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
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
          <h1 className="text-2xl font-bold">حضور و وضعیت Agent</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            وضعیت نشست کاری، همگام‌سازی و رویدادهای اخیر
          </p>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}

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
                description="با Agent فرمان‌های start-work و run را اجرا کنید."
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
