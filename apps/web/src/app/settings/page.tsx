'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';

interface OrgSettings {
  id: string;
  name: string;
  timezone: string;
  locale: string;
  security: {
    jwtExpiresIn: string;
    corsOrigins: string[];
    throttleLimit: number;
    encryptionConfigured: boolean;
    gitlabWebhookSecretConfigured: boolean;
  };
  dataRetentionFa: string[];
  agentPrivacyFa: string[];
}

export default function SettingsPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [data, setData] = useState<OrgSettings | null>(null);
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Tehran');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    async function load() {
      try {
        const me = await apiFetch<{ firstName: string; lastName: string }>('/auth/me');
        setUserName(`${me.firstName} ${me.lastName}`);
        const settings = await apiFetch<OrgSettings>('/settings/organization');
        setData(settings);
        setName(settings.name);
        setTimezone(settings.timezone);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری تنظیمات');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await apiFetch<OrgSettings>('/settings/organization', {
        method: 'PATCH',
        body: JSON.stringify({ name, timezone }),
      });
      setData((prev) => (prev ? { ...prev, ...updated } : prev));
      setSuccess('تنظیمات ذخیره شد');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ذخیره ناموفق بود');
    } finally {
      setSaving(false);
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
          <h1 className="text-2xl font-bold">تنظیمات سامانه</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">سازمان، امنیت و حریم خصوصی Agent</p>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}
        {success ? <Alert type="success">{success}</Alert> : null}

        <form onSubmit={onSave} className="card-surface grid gap-4 p-5 md:grid-cols-2">
          <div>
            <label className="label-field">نام سازمان</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label-field">منطقه زمانی</label>
            <input className="input-field" value={timezone} onChange={(e) => setTimezone(e.target.value)} required dir="ltr" />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'در حال ذخیره...' : 'ذخیره'}
            </button>
          </div>
        </form>

        {data ? (
          <>
            <div className="card-surface space-y-2 p-5 text-sm">
              <h2 className="text-lg font-semibold">وضعیت امنیت</h2>
              <p>مدت JWT: <span dir="ltr">{data.security.jwtExpiresIn}</span></p>
              <p>سقف Rate Limit: {data.security.throttleLimit}</p>
              <p>رمزنگاری توکن‌ها: {data.security.encryptionConfigured ? 'پیکربندی شده' : 'ناقص'}</p>
              <p>Webhook Secret گیت‌لب: {data.security.gitlabWebhookSecretConfigured ? 'تنظیم شده' : 'خالی (اختیاری)'}</p>
              <p>CORS: <span dir="ltr">{data.security.corsOrigins.join(', ') || '—'}</span></p>
            </div>
            <div className="card-surface p-5">
              <h2 className="text-lg font-semibold">نگهداری داده</h2>
              <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-[var(--muted)]">
                {data.dataRetentionFa.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div className="card-surface p-5">
              <h2 className="text-lg font-semibold">حریم خصوصی Agent</h2>
              <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-[var(--muted)]">
                {data.agentPrivacyFa.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
