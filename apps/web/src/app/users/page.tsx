'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import {
  CONTRACT_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  formatJalaliDateTime,
} from '@/lib/format';
import type { PublicUser } from '@workpulse/shared-types';

interface MeResponse {
  firstName: string;
  lastName: string;
}

const ROLE_OPTIONS = [
  'ORGANIZATION_ADMIN',
  'TEAM_LEAD',
  'EMPLOYEE',
  'PAYROLL_REVIEWER',
  'SUPER_ADMIN',
] as const;

export default function UsersPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    jobTitle: '',
    contractType: 'FULL_TIME_REMOTE',
    roles: ['EMPLOYEE'] as string[],
    timezone: 'Asia/Tehran',
  });

  async function loadUsers(q?: string) {
    const query = q ? `?search=${encodeURIComponent(q)}` : '';
    const data = await apiFetch<PublicUser[]>(`/users${query}`);
    setUsers(data);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }

    async function init() {
      try {
        const meData = await apiFetch<MeResponse>('/auth/me');
        setMe(meData);
        await loadUsers();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری کاربران');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await loadUsers(search.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'جستجو ناموفق بود');
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          phone: form.phone || undefined,
          username: form.username || undefined,
          jobTitle: form.jobTitle || undefined,
        }),
      });
      setSuccess('کاربر با موفقیت ایجاد شد');
      setShowForm(false);
      setForm({
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        password: '',
        phone: '',
        jobTitle: '',
        contractType: 'FULL_TIME_REMOTE',
        roles: ['EMPLOYEE'],
        timezone: 'Asia/Tehran',
      });
      await loadUsers(search.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ایجاد کاربر ناموفق بود');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(user: PublicUser) {
    setError(null);
    setSuccess(null);
    try {
      const path =
        user.status === 'ACTIVE'
          ? `/users/${user.id}/deactivate`
          : `/users/${user.id}/activate`;
      await apiFetch(path, { method: 'POST' });
      setSuccess(
        user.status === 'ACTIVE'
          ? 'کاربر غیرفعال شد'
          : 'کاربر مجدداً فعال شد',
      );
      await loadUsers(search.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تغییر وضعیت ناموفق بود');
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
            <h1 className="text-2xl font-bold">مدیریت کاربران</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              ایجاد، ویرایش وضعیت و مشاهده کاربران سازمان
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'بستن فرم' : 'کاربر جدید'}
          </button>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}
        {success ? <Alert type="success">{success}</Alert> : null}

        {showForm ? (
          <form onSubmit={onCreate} className="card-surface grid gap-4 p-5 md:grid-cols-2">
            <div>
              <label className="label-field">نام</label>
              <input
                className="input-field"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="label-field">نام خانوادگی</label>
              <input
                className="input-field"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
            <div>
              <label className="label-field">ایمیل</label>
              <input
                className="input-field"
                type="email"
                required
                dir="ltr"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label-field">نام کاربری (اختیاری)</label>
              <input
                className="input-field"
                dir="ltr"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div>
              <label className="label-field">رمز عبور موقت</label>
              <input
                className="input-field"
                type="password"
                required
                minLength={8}
                dir="ltr"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <label className="label-field">عنوان شغلی</label>
              <input
                className="input-field"
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              />
            </div>
            <div>
              <label className="label-field">شماره تماس</label>
              <input
                className="input-field"
                dir="ltr"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label-field">نوع قرارداد</label>
              <select
                className="input-field"
                value={form.contractType}
                onChange={(e) => setForm({ ...form, contractType: e.target.value })}
              >
                <option value="FULL_TIME_REMOTE">تمام‌وقت ریموت</option>
                <option value="HOURLY">ساعتی</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label-field">نقش‌ها</label>
              <div className="flex flex-wrap gap-3">
                {ROLE_OPTIONS.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.roles.includes(role)}
                      onChange={(e) => {
                        setForm({
                          ...form,
                          roles: e.target.checked
                            ? [...form.roles, role]
                            : form.roles.filter((r) => r !== role),
                        });
                      }}
                    />
                    {ROLE_LABELS[role]}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary" disabled={submitting || form.roles.length === 0}>
                {submitting ? 'در حال ذخیره...' : 'ایجاد کاربر'}
              </button>
            </div>
          </form>
        ) : null}

        <form onSubmit={onSearch} className="flex flex-wrap gap-3">
          <input
            className="input-field max-w-md"
            placeholder="جستجو بر اساس نام، ایمیل یا نام کاربری"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-secondary">
            جستجو
          </button>
        </form>

        {users.length === 0 ? (
          <EmptyState
            title="کاربری یافت نشد"
            description="با دکمه «کاربر جدید» اولین کاربر سازمان را ایجاد کنید."
          />
        ) : (
          <div className="card-surface overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-ink-50/60 text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">نام</th>
                  <th className="px-4 py-3 text-right font-medium">ایمیل</th>
                  <th className="px-4 py-3 text-right font-medium">نقش</th>
                  <th className="px-4 py-3 text-right font-medium">قرارداد</th>
                  <th className="px-4 py-3 text-right font-medium">وضعیت</th>
                  <th className="px-4 py-3 text-right font-medium">آخرین ورود</th>
                  <th className="px-4 py-3 text-right font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3 font-medium">{user.fullName}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      {user.roles.map((r) => r.nameFa || ROLE_LABELS[r.code]).join('، ')}
                    </td>
                    <td className="px-4 py-3">
                      {CONTRACT_LABELS[user.contractType] || user.contractType}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          user.status === 'ACTIVE'
                            ? 'rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700'
                            : 'rounded-md bg-red-50 px-2 py-1 text-xs text-red-700'
                        }
                      >
                        {STATUS_LABELS[user.status] || user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {formatJalaliDateTime((user as PublicUser & { lastLoginAt?: string }).lastLoginAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={user.status === 'ACTIVE' ? 'btn-danger !py-1.5 !text-xs' : 'btn-primary !py-1.5 !text-xs'}
                        onClick={() => toggleStatus(user)}
                      >
                        {user.status === 'ACTIVE' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                      </button>
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
