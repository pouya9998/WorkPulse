'use client';

import { useEffect, useState } from 'react';
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

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [org, setOrg] = useState<OrgResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, [router]);

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
        <div>
          <h1 className="text-2xl font-bold">داشبورد مدیریتی</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            خوش آمدید{me ? `، ${me.firstName}` : ''}. نمای کلی سازمان شما.
          </p>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="card-surface p-5">
            <p className="text-sm text-[var(--muted)]">سازمان</p>
            <p className="mt-2 text-xl font-semibold">{org?.name || '—'}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">منطقه زمانی: {org?.timezone}</p>
          </div>
          <div className="card-surface p-5">
            <p className="text-sm text-[var(--muted)]">تعداد کاربران</p>
            <p className="mt-2 text-3xl font-bold text-brand-700">{org?.userCount ?? '—'}</p>
          </div>
          <div className="card-surface p-5">
            <p className="text-sm text-[var(--muted)]">نقش‌های شما</p>
            <div className="mt-3 flex flex-wrap gap-2">
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

        <div className="card-surface p-5">
          <h2 className="text-lg font-semibold">وضعیت فاز ۱</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            احراز هویت، نقش‌ها، مدیریت کاربران و حسابرسی پیاده‌سازی شده‌اند. Agent، جلسات، GitLab و حقوق در فازهای بعدی اضافه می‌شوند.
          </p>
          <p className="mt-4 text-xs text-[var(--muted)]">
            آخرین به‌روزرسانی رابط: {formatJalaliDateTime(new Date())}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
