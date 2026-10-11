'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch, setToken } from '@/lib/api';
import clsx from 'clsx';

const navItems = [
  { href: '/dashboard', label: 'داشبورد' },
  { href: '/reports', label: 'گزارش‌ها' },
  { href: '/attendance', label: 'حضور' },
  { href: '/meetings', label: 'جلسات' },
  { href: '/alerts', label: 'هشدارها' },
  { href: '/notifications', label: 'اعلان‌ها' },
  { href: '/corrections', label: 'اصلاح حضور' },
  { href: '/policies', label: 'سیاست‌ها' },
  { href: '/devices', label: 'دستگاه‌ها' },
  { href: '/users', label: 'کاربران' },
  { href: '/gitlab', label: 'GitLab' },
  { href: '/engineering', label: 'مهندسی' },
  { href: '/contracts', label: 'قراردادها' },
  { href: '/payroll', label: 'حقوق' },
  { href: '/audit', label: 'حسابرسی' },
  { href: '/settings', label: 'تنظیمات' },
];

interface AgentGateStatus {
  hasDevice: boolean;
  isOnline: boolean;
  panelUnlocked: boolean;
  canBypassGate: boolean;
  deviceName?: string | null;
}

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [gate, setGate] = useState<AgentGateStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const status = await apiFetch<AgentGateStatus>('/devices/me/status');
        if (cancelled) return;
        setGate(status);
        const onDevices = pathname.startsWith('/devices');
        if (!status.panelUnlocked && !onDevices) {
          router.replace('/devices');
        }
      } catch {
        // ignore; page-level auth handles 401
      }
    }
    check();
    const timer = setInterval(check, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pathname, router]);

  async function logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // clear local token anyway
    }
    setToken(null);
    router.replace('/login');
  }

  const locked = gate && !gate.panelUnlocked;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-6">
            <Link href={locked ? '/devices' : '/dashboard'} className="text-lg font-bold text-brand-700">
              WorkPulse
            </Link>
            <nav className="hidden max-w-[52vw] flex-wrap items-center gap-1 lg:flex">
              {navItems.map((item) => {
                const disabled = locked && !item.href.startsWith('/devices');
                if (disabled) {
                  return (
                    <span
                      key={item.href}
                      className="cursor-not-allowed rounded-lg px-3 py-2 text-sm text-[var(--muted)] opacity-40"
                      title="ابتدا Agent را متصل کنید"
                    >
                      {item.label}
                    </span>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'rounded-lg px-3 py-2 text-sm transition',
                      pathname.startsWith(item.href)
                        ? 'bg-brand-50 font-medium text-brand-800'
                        : 'text-[var(--muted)] hover:bg-ink-50 hover:text-[var(--text)]',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {gate ? (
              <span
                className={clsx(
                  'hidden rounded-md px-2 py-1 text-xs sm:inline',
                  gate.isOnline
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-800',
                )}
                title={
                  gate.isOnline
                    ? 'Agent همین حساب کاربری آنلاین است'
                    : 'Agent با ایمیل همین حساب آنلاین نیست (ممکن است دستگاه دیگران آنلاین باشد)'
                }
              >
                Agent من: {gate.isOnline ? 'آنلاین' : 'آفلاین'}
              </span>
            ) : null}
            <span className="hidden text-sm text-[var(--muted)] sm:inline">
              {userName}
            </span>
            <button type="button" onClick={logout} className="btn-secondary !py-2">
              خروج
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
