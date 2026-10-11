import { format as formatJalali } from 'date-fns-jalali';

export function formatJalaliDateTime(value?: string | Date | null): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return formatJalali(date, 'yyyy/MM/dd HH:mm');
}

export function formatJalaliDate(value?: string | Date | null): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return formatJalali(date, 'yyyy/MM/dd');
}

export const CONTRACT_LABELS: Record<string, string> = {
  HOURLY: 'ساعتی',
  FULL_TIME_REMOTE: 'تمام‌وقت ریموت',
};

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'فعال',
  INACTIVE: 'غیرفعال',
  PENDING: 'در انتظار',
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'مدیر کل',
  ORGANIZATION_ADMIN: 'مدیر سازمان',
  TEAM_LEAD: 'سرپرست تیم',
  EMPLOYEE: 'کارمند',
  PAYROLL_REVIEWER: 'بازبین حقوق',
};
