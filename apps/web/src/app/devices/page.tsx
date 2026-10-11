'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { formatJalaliDateTime } from '@/lib/format';

interface DeviceItem {
  id: string;
  name: string;
  platform: string;
  osVersion?: string | null;
  agentVersion: string;
  status: string;
  isOnline: boolean;
  lastSeenAt?: string | null;
  lastHeartbeatAt?: string | null;
  revokedAt?: string | null;
  user: { firstName: string; lastName: string; email: string };
}

export default function DevicesPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<DeviceItem[]>('/devices');
    setDevices(data);
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
        setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری دستگاه‌ها');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function revoke(id: string) {
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/devices/${id}/revoke`, { method: 'POST' });
      setSuccess('دسترسی دستگاه لغو شد');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'لغو دستگاه ناموفق بود');
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
          <h1 className="text-2xl font-bold">دستگاه‌های ثبت‌شده</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            مدیریت Agentهای متصل و لغو دسترسی در صورت نیاز
          </p>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}
        {success ? <Alert type="success">{success}</Alert> : null}

        <Alert type="info">
          Agent اسکرین‌شات، کلیدهای تایپ‌شده، Clipboard، صدا یا تصویر ضبط نمی‌کند. فقط رویدادهای
          حضور، Heartbeat، Idle و قفل صفحه ارسال می‌شود.
        </Alert>

        {devices.length === 0 ? (
          <EmptyState
            title="دستگاهی ثبت نشده است"
            description="روی سیستم کاربر: workpulse-agent login سپس workpulse-agent run"
          />
        ) : (
          <div className="card-surface overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-ink-50/60 text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">نام</th>
                  <th className="px-4 py-3 text-right font-medium">کاربر</th>
                  <th className="px-4 py-3 text-right font-medium">پلتفرم</th>
                  <th className="px-4 py-3 text-right font-medium">نسخه Agent</th>
                  <th className="px-4 py-3 text-right font-medium">اتصال</th>
                  <th className="px-4 py-3 text-right font-medium">آخرین Heartbeat</th>
                  <th className="px-4 py-3 text-right font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3 font-medium">{d.name}</td>
                    <td className="px-4 py-3">
                      {d.user.firstName} {d.user.lastName}
                    </td>
                    <td className="px-4 py-3">
                      {d.platform}
                      {d.osVersion ? ` / ${d.osVersion}` : ''}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {d.agentVersion}
                    </td>
                    <td className="px-4 py-3">
                      {d.status === 'REVOKED' ? (
                        <span className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                          لغو شده
                        </span>
                      ) : d.isOnline ? (
                        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                          آنلاین
                        </span>
                      ) : (
                        <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
                          آفلاین
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatJalaliDateTime(d.lastHeartbeatAt)}</td>
                    <td className="px-4 py-3">
                      {d.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          className="btn-danger !py-1.5 !text-xs"
                          onClick={() => revoke(d.id)}
                        >
                          لغو دسترسی
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      )}
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
