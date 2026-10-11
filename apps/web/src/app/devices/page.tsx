'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { Loading } from '@/components/Loading';
import { apiFetch, getToken, ApiError } from '@/lib/api';
import { formatJalaliDateTime } from '@/lib/format';
import clsx from 'clsx';

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

type AgentOsTab = 'linux' | 'windows' | 'macos';

interface PlatformRelease {
  platform: 'linux' | 'windows' | 'macos' | 'macos-arm64';
  version: string;
  fileName: string;
  size: number;
  sha256: string;
  downloadPath: string;
  installScriptPath: string;
  installScriptFileName: string;
}

interface AgentReleasesResponse {
  available: boolean;
  version: string | null;
  builtAt: string | null;
  platforms: PlatformRelease[];
}

const API_BASE =
  typeof window === 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} مگابایت`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} کیلوبایت`;
}

function installOneLiner(platform: AgentOsTab): string {
  const base = API_BASE.replace(/\/$/, '');
  if (platform === 'linux') {
    return `curl -fsSL ${base}/agent/releases/linux/install-script | API_BASE=${base} bash`;
  }
  if (platform === 'macos') {
    return `curl -fsSL ${base}/agent/releases/macos/install-script | API_BASE=${base} bash`;
  }
  return `$env:API_BASE='${base}'; irm ${base}/agent/releases/windows/install-script | iex`;
}

function platformLabel(p: AgentOsTab): string {
  if (p === 'linux') return 'لینوکس';
  if (p === 'windows') return 'ویندوز';
  return 'macOS';
}

interface MeAgentStatus {
  hasDevice: boolean;
  isOnline: boolean;
  deviceName: string | null;
}

export default function DevicesPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>();
  const [myEmail, setMyEmail] = useState<string>();
  const [myAgent, setMyAgent] = useState<MeAgentStatus | null>(null);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [releases, setReleases] = useState<AgentReleasesResponse | null>(null);
  const [platform, setPlatform] = useState<AgentOsTab>('linux');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const [data, status] = await Promise.all([
      apiFetch<DeviceItem[]>('/devices'),
      apiFetch<MeAgentStatus>('/devices/me/status'),
    ]);
    setDevices(data);
    setMyAgent(status);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    async function init() {
      try {
        const me = await apiFetch<{ firstName: string; lastName: string; email: string }>(
          '/auth/me',
        );
        setUserName(`${me.firstName} ${me.lastName}`);
        setMyEmail(me.email);
        const [, releaseData] = await Promise.all([
          load(),
          apiFetch<AgentReleasesResponse>('/agent/releases').catch(() => null),
        ]);
        setReleases(releaseData);
        if (releaseData?.platforms?.some((p) => p.platform === 'linux')) {
          setPlatform('linux');
        } else if (releaseData?.platforms?.some((p) => p.platform === 'windows')) {
          setPlatform('windows');
        } else if (
          releaseData?.platforms?.some(
            (p) => p.platform === 'macos' || p.platform === 'macos-arm64',
          )
        ) {
          setPlatform('macos');
        }
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

  const selected = useMemo(() => {
    if (!releases?.platforms) return null;
    if (platform === 'macos') {
      return (
        releases.platforms.find((p) => p.platform === 'macos') ??
        releases.platforms.find((p) => p.platform === 'macos-arm64') ??
        null
      );
    }
    return releases.platforms.find((p) => p.platform === platform) ?? null;
  }, [releases, platform]);

  const macosArm = useMemo(
    () => releases?.platforms.find((p) => p.platform === 'macos-arm64') ?? null,
    [releases],
  );

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

  async function copyInstall() {
    try {
      await navigator.clipboard.writeText(installOneLiner(platform));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('کپی در کلیپ‌بورد ناموفق بود');
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Loading />
      </AppShell>
    );
  }

  const apiBase = API_BASE.replace(/\/$/, '');

  return (
    <AppShell userName={userName}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">دستگاه‌ها و Agent</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            ابتدا Agent را وصل کنید؛ بعد از آنلاین شدن می‌توانید از پنل استفاده و شروع/پایان کار را بزنید.
          </p>
        </div>

        {error ? <Alert type="error">{error}</Alert> : null}
        {success ? <Alert type="success">{success}</Alert> : null}

        {myAgent && !myAgent.isOnline ? (
          <Alert type="error">
            Agent حساب شما ({myEmail}) آنلاین نیست. اگر در جدول پایین دستگاه دیگری «آنلاین» است، آن
            دستگاه با ایمیل کاربر دیگری login شده. برای شروع کار با حساب خودتان، در ترمینال Agent را
            متوقف کنید (Ctrl+C) و دوباره با ایمیل خودتان اجرا کنید: <span dir="ltr">workpulse-agent</span>
          </Alert>
        ) : null}

        <Alert type="info">
          برچسب بالای صفحه فقط وضعیت Agentِ «همین حساب» را نشان می‌دهد. جدول ممکن است دستگاه کاربران
          دیگر را هم نشان دهد. شروع/پایان کار فقط با Agent آنلاینِ خودتان ممکن است.
        </Alert>

        <section id="agent-download" className="card-surface overflow-hidden">
          <div className="border-b border-[var(--border)] bg-brand-50/60 px-5 py-4 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">نصب Agent روی سیستم کاربر</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  دو مرحله: نصب فایل، سپس اجرای Agent
                  {releases?.version ? (
                    <span className="mr-2" dir="ltr">
                      · v{releases.version}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
                {(['linux', 'windows', 'macos'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={clsx(
                      'rounded-lg px-4 py-2 text-sm transition',
                      platform === p
                        ? 'bg-brand-700 font-medium text-white'
                        : 'text-[var(--muted)] hover:text-[var(--text)]',
                    )}
                  >
                    {platformLabel(p)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6 p-5 md:p-6">
            {!releases?.available || !selected ? (
              <Alert type="error">
                فایل Agent روی سرور موجود نیست. سرویس API را دوباره بیلد کنید.
              </Alert>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border)] bg-ink-50/50 p-4">
                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">
                      ۱
                    </div>
                    <h3 className="font-semibold">نصب</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      دستور را در ترمینال سیستم کاربر اجرا کنید، یا فایل را مستقیم دانلود کنید.
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      <code
                        className="block overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs leading-relaxed"
                        dir="ltr"
                      >
                        {installOneLiner(platform)}
                      </code>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary !py-2 text-sm" onClick={copyInstall}>
                          {copied ? 'کپی شد' : 'کپی دستور نصب'}
                        </button>
                        <a
                          href={`${apiBase}${selected.downloadPath}`}
                          className="btn-primary !py-2 text-sm"
                          download
                        >
                          دانلود مستقیم فایل
                        </a>
                      </div>
                      <p className="text-xs text-[var(--muted)]" dir="ltr">
                        {selected.fileName} · {formatBytes(selected.size)}
                      </p>
                      {platform === 'macos' && macosArm ? (
                        <a
                          href={`${apiBase}${macosArm.downloadPath}`}
                          className="text-xs text-brand-700 underline"
                          download
                          dir="ltr"
                        >
                          Apple Silicon: {macosArm.fileName}
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-ink-50/50 p-4">
                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">
                      ۲
                    </div>
                    <h3 className="font-semibold">اجرا و ورود</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      این فرمان را بزنید. Agent (به انگلیسی) ایمیل و رمز را می‌پرسد و آنلاین می‌ماند.
                      نصب‌کننده به‌صورت پیش‌فرض auto-start بعد از ورود به سیستم را هم فعال می‌کند.
                    </p>
                    <div className="mt-4 space-y-3">
                      <code
                        className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-medium"
                        dir="ltr"
                      >
                        workpulse-agent
                      </code>
                      <ul className="space-y-2 text-sm text-[var(--muted)]">
                        <li>• ایمیل و رمز سازمانی را وارد کنید</li>
                        <li>• Agent را باز نگه دارید (Heartbeat) یا از auto-start استفاده کنید</li>
                        <li>
                          • در صورت نیاز:{' '}
                          <span dir="ltr">workpulse-agent service install</span>
                        </li>
                        <li>• سپس از صفحهٔ «حضور» شروع/پایان کار را بزنید</li>
                        <li>• نام برنامه، عنوان پنجره و در صورت امکان URL گزارش می‌شود</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[var(--muted)]">
                  حریم خصوصی: بدون اسکرین‌شات/کلید/Clipboard/صدا/ویدیو — حضور، Idle، قفل صفحه، نام
                  برنامه، عنوان پنجره و اختیاری URL/مسیر فایل.
                </p>
              </>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">دستگاه‌های متصل</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              پس از ورود موفق در Agent، دستگاه اینجا نمایش داده می‌شود.
            </p>
          </div>

          {devices.length === 0 ? (
            <EmptyState
              title="هنوز دستگاهی متصل نیست"
              description="مرحله نصب و سپس اجرای workpulse-agent را انجام دهید."
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
                      {myEmail && d.user.email === myEmail ? (
                        <span className="mr-2 text-xs text-brand-700">(شما)</span>
                      ) : (
                        <span className="mr-2 text-xs text-[var(--muted)]" dir="ltr">
                          ({d.user.email})
                        </span>
                      )}
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
        </section>
      </div>
    </AppShell>
  );
}
