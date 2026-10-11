# مستندات API

Swagger تعاملی پس از اجرا:

`http://localhost:4000/api/docs`

## نقاط کلیدی فاز ۱

| روش | مسیر | توضیح | دسترسی |
|-----|------|--------|--------|
| GET | `/api/health` | سلامت | عمومی |
| GET | `/api/bootstrap/status` | وضعیت Bootstrap | عمومی |
| POST | `/api/auth/login` | ورود | عمومی |
| POST | `/api/auth/logout` | خروج | احراز هویت |
| GET | `/api/auth/me` | کاربر جاری | احراز هویت |
| GET | `/api/users` | فهرست کاربران | `users:read` |
| POST | `/api/users` | ایجاد کاربر | `users:write` |
| PATCH | `/api/users/:id` | ویرایش | `users:write` |
| POST | `/api/users/:id/deactivate` | غیرفعال‌سازی | `users:deactivate` |
| POST | `/api/users/:id/activate` | فعال‌سازی | `users:write` |
| GET | `/api/roles` | نقش‌ها | `users:read` |
| GET | `/api/audit-logs` | حسابرسی | `audit:read` |
| GET | `/api/organizations/me` | سازمان جاری | احراز هویت |

## فاز ۲ — حضور و دستگاه

| روش | مسیر | توضیح |
|-----|------|--------|
| POST | `/api/devices/register` | ثبت دستگاه Agent |
| GET | `/api/devices` | فهرست دستگاه‌ها |
| POST | `/api/agent/work/start` | شروع کار (Agent) |
| POST | `/api/agent/work/end` | پایان کار |
| POST | `/api/agent/events/sync` | همگام‌رویداد |
| GET | `/api/attendance/...` | تایم‌لاین حضور |

## فاز ۵ — GitLab

| روش | مسیر | توضیح | دسترسی |
|-----|------|--------|--------|
| GET | `/api/gitlab/connection` | وضعیت اتصال | `gitlab:manage` |
| POST | `/api/gitlab/connection` | ذخیره Base URL + Token رمزشده | `gitlab:manage` |
| GET | `/api/gitlab/projects` | پروژه‌های ثبت‌شده | `gitlab:manage` |
| POST | `/api/gitlab/projects/connect` | علامت‌گذاری پروژه متصل | `gitlab:manage` |
| POST | `/api/gitlab/sync` | همگام‌سازی فهرست پروژه | `gitlab:manage` |
| GET/POST/PUT/DELETE | `/api/gitlab/mappings` | نگاشت کاربر | `gitlab:manage` |
| POST | `/api/gitlab/webhooks?organizationId=` | Webhook GitLab | عمومی + Secret |
| GET | `/api/gitlab/engineering/activity` | گزارش فعالیت مهندسی | احراز هویت + `engineering:read` برای تیم |

## فاز ۶ — حقوق و قرارداد

| روش | مسیر | توضیح | دسترسی |
|-----|------|--------|--------|
| GET/POST | `/api/contracts` | قراردادها | `payroll:read` / `payroll:review` |
| POST | `/api/contracts/:id/versions` | نسخه جدید نرخ/حقوق | `payroll:review` |
| GET/POST | `/api/payroll/periods` | دوره حقوق | `payroll:read` / `payroll:review` |
| GET | `/api/payroll/proposals` | پیشنهادها (کارمند: خود) | احراز هویت |
| GET | `/api/payroll/proposals/:id` | جزئیات + `formulaBreakdownFa` | مالک یا `payroll:read` |
| POST | `/api/payroll/periods/:id/generate` | تولید پیشنهاد | `payroll:review` |
| POST | `/api/payroll/proposals/:id/review` | تأیید/رد | `payroll:review` |

احراز هویت: هدر `Authorization: Bearer <token>`  
Agent: هدر `X-Device-Token`

## فاز ۲–۷ (خلاصه)

| حوزه | مسیرهای اصلی |
|------|----------------|
| Agent/دستگاه | `/api/agent/*`, `/api/devices` |
| حضور | `/api/attendance/status`, `/timeline` |
| سیاست/اصلاح | `/api/attendance-policies`, `/api/attendance-corrections` |
| هشدار/اعلان | `/api/alerts`, `/api/notifications` |
| جلسات | `/api/meetings` |
| GitLab | `/api/gitlab/*`, `/api/gitlab/webhooks` |
| حقوق | `/api/contracts`, `/api/payroll/*` |
| گزارش/تنظیمات | `/api/reports/*`, `/api/settings/organization` |

جزئیات تعاملی: Swagger `/api/docs`

## فاز ۳ — سیاست، اصلاح، هشدار، اعلان

| روش | مسیر | توضیح | دسترسی |
|-----|------|--------|--------|
| GET/POST/PATCH | `/api/attendance-policies` | سیاست حضور | read / manage |
| GET/POST | `/api/attendance-corrections` | درخواست اصلاح | read |
| POST | `/api/attendance-corrections/:id/approve` | تأیید | `attendance:manage` |
| POST | `/api/attendance-corrections/:id/reject` | رد | `attendance:manage` |
| GET | `/api/alerts` | هشدارها | `alerts:read` |
| POST | `/api/alerts/:id/acknowledge` | مشاهده شد | `alerts:read` |
| POST | `/api/alerts/:id/resolve` | بستن | `alerts:read` |
| GET | `/api/notifications` | اعلان درون‌پنلی | احراز هویت |
| POST | `/api/notifications/read-all` | خواندن همه | احراز هویت |
| POST | `/api/notifications/:id/read` | خواندن یکی | احراز هویت |

## فاز ۴ — جلسات

| روش | مسیر | توضیح | دسترسی |
|-----|------|--------|--------|
| GET/POST | `/api/meetings` | فهرست / ایجاد | read / manage |
| PATCH | `/api/meetings/:id` | ویرایش | `meetings:manage` |
| POST | `/api/meetings/:id/cancel` | لغو | `meetings:manage` |
| GET | `/api/meetings/:id/overlaps` | هم‌پوشانی با نشست کاری | `meetings:read` |
| POST | `/api/meetings/occurrences/:occurrenceId/attendance` | حضور دستی | `meetings:manage` |
| GET | `/api/meetings/calendar/events` | Adapter تقویم | `meetings:read` |

زمان‌ها در API و دیتابیس **UTC** ذخیره می‌شوند.
