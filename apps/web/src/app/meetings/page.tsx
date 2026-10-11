'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format as formatJalali } from 'date-fns-jalali';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { formatJalaliDateTime } from '@/lib/format';

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface MeetingItem {
  id: string;
  titleFa: string;
  descriptionFa?: string | null;
  startAt: string;
  endAt: string;
  status: string;
  participants: Array<{
    user: { id: string; firstName: string; lastName: string };
  }>;
}

type ViewMode = 'week' | 'day';

function startOfUtcDay(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export default function MeetingsPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [view, setView] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(() => startOfUtcDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    titleFa: '',
    descriptionFa: '',
    startAt: '',
    endAt: '',
    participantId: '',
  });

  const range = useMemo(() => {
    const from = new Date(anchor);
    const to = new Date(anchor);
    if (view === 'day') {
      to.setUTCDate(to.getUTCDate() + 1);
    } else {
      to.setUTCDate(to.getUTCDate() + 7);
    }
    return { from, to };
  }, [anchor, view]);

  async function loadMeetings() {
    const qs = `?from=${range.from.toISOString()}&to=${range.to.toISOString()}`;
    const list = await apiFetch<MeetingItem[]>(`/meetings${qs}`);
    setMeetings(list.filter((m) => m.status === 'SCHEDULED'));
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
        try {
          const userList = await apiFetch<UserOption[]>('/users');
          setUsers(userList);
          if (userList[0]) setForm((f) => ({ ...f, participantId: userList[0].id }));
        } catch {
          // کارمند ممکن است users:read نداشته باشد
        }
        await loadMeetings();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری جلسات');
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!loading) {
      loadMeetings().catch(() => setError('به‌روزرسانی فهرست ناموفق بود'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from.toISOString(), range.to.toISOString()]);

  const grouped = useMemo(() => {
    const map = new Map<string, MeetingItem[]>();
    for (const m of meetings) {
      const dayKey = formatJalali(new Date(m.startAt), 'yyyy/MM/dd');
      const arr = map.get(dayKey) ?? [];
      arr.push(m);
      map.set(dayKey, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [meetings]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.participantId) {
      setError('حداقل یک شرکت‌کننده لازم است');
      return;
    }
    setError(null);
    try {
      await apiFetch('/meetings', {
        method: 'POST',
        body: {
          titleFa: form.titleFa,
          descriptionFa: form.descriptionFa || undefined,
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          participants: [{ userId: form.participantId }],
        },
      });
      setForm((f) => ({ ...f, titleFa: '', descriptionFa: '', startAt: '', endAt: '' }));
      await loadMeetings();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ایجاد جلسه ناموفق بود');
    }
  }

  async function cancelMeeting(id: string) {
    if (!window.confirm('جلسه لغو شود؟')) return;
    try {
      await apiFetch(`/meetings/${id}/cancel`, { method: 'POST' });
      await loadMeetings();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'لغو ناموفق بود');
    }
  }

  function shiftAnchor(days: number) {
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() + days);
    setAnchor(startOfUtcDay(d));
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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">جلسات</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              نمای روز / هفته با تاریخ شمسی — زمان‌ها UTC ذخیره می‌شوند
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary !py-1.5" onClick={() => shiftAnchor(view === 'day' ? -1 : -7)}>
              قبلی
            </button>
            <button type="button" className="btn-secondary !py-1.5" onClick={() => setAnchor(startOfUtcDay(new Date()))}>
              امروز
            </button>
            <button type="button" className="btn-secondary !py-1.5" onClick={() => shiftAnchor(view === 'day' ? 1 : 7)}>
              بعدی
            </button>
            <select
              className="input-field"
              value={view}
              onChange={(e) => setView(e.target.value as ViewMode)}
            >
              <option value="week">هفته</option>
              <option value="day">روز</option>
            </select>
          </div>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}

        {users.length > 0 ? (
          <form onSubmit={onCreate} className="card-surface grid gap-4 p-5 md:grid-cols-2">
            <h2 className="font-semibold md:col-span-2">جلسه جدید</h2>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-[var(--muted)]">عنوان</span>
              <input
                className="input-field w-full"
                value={form.titleFa}
                onChange={(e) => setForm({ ...form, titleFa: e.target.value })}
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">شروع (UTC)</span>
              <input
                type="datetime-local"
                className="input-field w-full"
                dir="ltr"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[var(--muted)]">پایان (UTC)</span>
              <input
                type="datetime-local"
                className="input-field w-full"
                dir="ltr"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                required
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-[var(--muted)]">شرکت‌کننده</span>
              <select
                className="input-field w-full"
                value={form.participantId}
                onChange={(e) => setForm({ ...form, participantId: e.target.value })}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary">
                ایجاد جلسه
              </button>
            </div>
          </form>
        ) : null}

        {grouped.length === 0 ? (
          <EmptyState title="جلسه‌ای در این بازه نیست" />
        ) : (
          <div className="space-y-6">
            {grouped.map(([day, dayMeetings]) => (
              <section key={day}>
                <h3 className="mb-2 text-sm font-semibold text-brand-800">{day}</h3>
                <div className="space-y-2">
                  {dayMeetings.map((m) => (
                    <article key={m.id} className="card-surface flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-medium">{m.titleFa}</p>
                        <p className="text-sm text-[var(--muted)]">
                          {formatJalaliDateTime(m.startAt)} – {formatJalaliDateTime(m.endAt)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {m.participants
                            .map((p) => `${p.user.firstName} ${p.user.lastName}`)
                            .join('، ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary !py-1.5 text-sm"
                        onClick={() => cancelMeeting(m.id)}
                      >
                        لغو
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
