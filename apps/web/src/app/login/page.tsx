'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/Alert';
import { apiFetch, setToken, ApiError } from '@/lib/api';
import type { LoginResponse } from '@workpulse/shared-types';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.accessToken);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ورود ناموفق بود');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-panel lg:grid-cols-2">
        <section className="relative hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 p-10 text-white lg:block">
          <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,white,transparent_35%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <p className="text-sm text-brand-100">پلتفرم متن‌باز سازمانی</p>
              <h1 className="mt-3 text-4xl font-bold leading-tight">WorkPulse</h1>
              <p className="mt-4 max-w-sm text-brand-50/90">
                مدیریت حضور، عملکرد مهندسی و گزارش پیشنهادی حقوق برای تیم‌های دورکار.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-brand-50/90">
              <li>• رابط کاملاً فارسی و راست‌چین</li>
              <li>• کنترل دسترسی مبتنی بر نقش</li>
              <li>• حسابرسی رویدادهای حساس</li>
            </ul>
          </div>
        </section>

        <section className="p-8 md:p-10">
          <div className="mb-8 lg:hidden">
            <h1 className="text-3xl font-bold text-brand-800">WorkPulse</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">ورود به پنل مدیریت</p>
          </div>
          <h2 className="text-2xl font-semibold">ورود به سامانه</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            با ایمیل سازمانی و رمز عبور خود وارد شوید.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {error ? <Alert type="error">{error}</Alert> : null}
            <div>
              <label className="label-field" htmlFor="email">
                ایمیل
              </label>
              <input
                id="email"
                type="email"
                className="input-field"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
              />
            </div>
            <div>
              <label className="label-field" htmlFor="password">
                رمز عبور
              </label>
              <input
                id="password"
                type="password"
                className="input-field"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'در حال ورود...' : 'ورود'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
