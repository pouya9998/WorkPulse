'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // حتی در خطای شبکه، توکن محلی پاک می‌شود
    }
    setToken(null);
    router.replace('/login');
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-bold text-brand-700">
              WorkPulse
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
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
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
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
