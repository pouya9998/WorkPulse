'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { formatJalaliDateTime } from '@/lib/format';

interface Connection {
  configured: boolean;
  baseUrl?: string;
  status?: string;
  lastSyncAt?: string | null;
  lastError?: string | null;
}

interface Project {
  id: string;
  gitlabProjectId: number;
  pathWithNamespace: string;
  name: string;
  isConnected: boolean;
}

interface Mapping {
  id: string;
  gitlabUserId: number;
  gitlabUsername: string;
  user: { firstName: string; lastName: string; email: string };
}

export default function GitLabPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [baseUrl, setBaseUrl] = useState('https://gitlab.com');
  const [token, setToken] = useState('');
  const [syncing, setSyncing] = useState(false);

  async function reload() {
    const [conn, projs, maps] = await Promise.all([
      apiFetch<Connection>('/gitlab/connection'),
      apiFetch<Project[]>('/gitlab/projects'),
      apiFetch<Mapping[]>('/gitlab/mappings'),
    ]);
    setConnection(conn);
    setProjects(projs);
    setMappings(maps);
    if (conn.baseUrl) setBaseUrl(conn.baseUrl);
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
        await reload();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else if (err instanceof ApiError && err.status === 403) {
          setError('مجوز مدیریت GitLab را ندارید');
        } else {
          setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری');
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function onSaveConnection(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await apiFetch('/gitlab/connection', {
        method: 'POST',
        body: JSON.stringify({ baseUrl, token }),
      });
      setToken('');
      setSuccess('اتصال GitLab ذخیره شد');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ذخیره ناموفق');
    }
  }

  async function onSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await apiFetch<{ syncedProjects: number }>('/gitlab/sync', { method: 'POST' });
      setSuccess(`همگام‌سازی انجام شد (${res.syncedProjects} پروژه)`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'همگام‌سازی ناموفق');
    } finally {
      setSyncing(false);
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">اتصال GitLab</h1>
        <Link href="/engineering" className="btn-secondary">
          گزارش فعالیت مهندسی
        </Link>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <section className="card mb-6 space-y-4">
        <h2 className="text-lg font-semibold">تنظیمات اتصال</h2>
        {connection?.configured && (
          <p className="text-sm text-[var(--muted)]">
            وضعیت: {connection.status} — آخرین همگام‌سازی:{' '}
            {connection.lastSyncAt ? formatJalaliDateTime(connection.lastSyncAt) : '—'}
          </p>
        )}
        {connection?.lastError && (
          <Alert type="error">خطای آخر: {connection.lastError}</Alert>
        )}
        <form onSubmit={onSaveConnection} className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            آدرس پایه
            <input className="input mt-1 w-full" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </label>
          <label className="block text-sm">
            توکن دسترسی (Personal Access Token)
            <input
              className="input mt-1 w-full"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={connection?.configured ? 'برای تغییر، توکن جدید وارد کنید' : ''}
            />
          </label>
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="btn-primary">
              ذخیره اتصال
            </button>
            <button type="button" className="btn-secondary" disabled={syncing} onClick={onSync}>
              {syncing ? 'در حال همگام‌سازی…' : 'همگام‌سازی پروژه‌ها'}
            </button>
          </div>
        </form>
      </section>

      <section className="card mb-6">
        <h2 className="mb-3 text-lg font-semibold">پروژه‌های متصل</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">پروژه‌ای ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {projects.map((p) => (
              <li key={p.id} className="flex justify-between py-2 text-sm">
                <span>{p.pathWithNamespace}</span>
                <span className={p.isConnected ? 'text-green-700' : 'text-[var(--muted)]'}>
                  {p.isConnected ? 'فعال' : 'فقط فهرست'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">نگاشت کاربران</h2>
        {mappings.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">نگاشتی تعریف نشده — از API یا تست e2e اضافه کنید.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-[var(--muted)]">
                <th className="py-2">کارمند</th>
                <th className="py-2">GitLab</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id} className="border-t border-[var(--border)]">
                  <td className="py-2">
                    {m.user.firstName} {m.user.lastName}
                  </td>
                  <td className="py-2">
                    @{m.gitlabUsername} ({m.gitlabUserId})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
