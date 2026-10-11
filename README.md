# WorkPulse

**پلتفرم متن‌باز مدیریت نیروی انسانی ریموت و ارزیابی عملکرد مهندسان نرم‌افزار**

WorkPulse برای تیم‌های دورکار نرم‌افزاری طراحی شده است: حضور کاری، وضعیت دستگاه (Agent)، جلسات، فعالیت مهندسی (GitLab)، هشدارها، قرارداد و گزارش پیشنهادی حقوق — با رابط کاملاً فارسی و RTL.

| | |
|---|---|
| مجوز | [AGPL-3.0-or-later](LICENSE) |
| معماری | Modular Monolith |
| UI | فارسی · RTL · تقویم شمسی · Vazirmatn |
| استقرار | Docker Compose (on-premises) |

---

## فهرست مطالب

- [ویژگی‌ها](#ویژگیها)
- [معماری و تکنولوژی](#معماری-و-تکنولوژی)
- [پیش‌نیازها](#پیشنیازها)
- [اجرای سریع با Docker](#اجرای-سریع-با-docker)
- [ساختار Repository](#ساختار-repository)
- [پیکربندی محیط](#پیکربندی-محیط)
- [Desktop Agent](#desktop-agent)
- [توسعه محلی](#توسعه-محلی)
- [تست‌ها](#تستها)
- [Backup و Restore](#backup-و-restore)
- [مستندات](#مستندات)
- [وضعیت پیاده‌سازی](#وضعیت-پیادهسازی)
- [امنیت و حریم خصوصی](#امنیت-و-حریم-خصوصی)
- [مشارکت](#مشارکت)
- [مجوز](#مجوز)

---

## ویژگی‌ها

### مدیریت کاربران و دسترسی
- ایجاد، ویرایش، فعال/غیرفعال‌سازی کاربر (بدون حذف فیزیکی سابقه)
- نقش‌ها: Super Admin، Organization Admin، Team Lead، Employee، Payroll Reviewer
- RBAC واقعی در Backend + نشست JWT قابل لغو
- Bootstrap امن مدیر اولیه (فقط وقتی هنوز کاربری وجود ندارد)

### حضور و Agent دسکتاپ
- شروع / پایان کار، Heartbeat (پیش‌فرض ۶۰ ثانیه)
- تشخیص Idle و قفل صفحه (بهترین تلاش روی Linux / Windows)
- صف آفلاین محلی و همگام‌سازی مجدد
- ثبت دستگاه و لغو دسترسی توسط مدیر
- **Agent اسکرین‌شات، کلید، Clipboard، صدا یا تصویر ضبط نمی‌کند**

### جلسات
- ثبت دستی جلسه، شرکت‌کنندگان، لغو، تشخیص تداخل با نشست کاری
- Adapter تقویم قابل توسعه (OAuth واقعی Google/Outlook در نسخه فعلی stub است)

### GitLab
- اتصال به GitLab.com یا Self-hosted
- Webhook با اعتبارسنجی secret
- نگاشت صریح هویت GitLab به کارمند
- گزارش فعالیت مهندسی با یادداشت ناقص بودن داده  
  (Commit/MR به‌تنهایی معیار بهره‌وری قطعی نیست)

### قرارداد و حقوق پیشنهادی
- قرارداد ساعتی و تمام‌وقت ریموت با **نسخه‌بندی**
- محاسبات مالی با Decimal (بدون float)
- تمام‌وقت به‌خاطر Idle یا قطع Heartbeat خودکار کم نمی‌شود
- گردش تأیید/رد گزارش توسط بازبین

### هشدار، گزارش و حسابرسی
- هشدارهای قابل تنظیم + اعلان درون‌پنلی
- اصلاح حضور با تأیید مدیر
- گزارش مدیریتی و خروجی حسابرسی
- Audit Log برای رویدادهای حساس

---

## معماری و تکنولوژی

```
[مرورگر RTL/FA] ---> [Next.js Web]
                         |
                         v
                   [NestJS API] <--- [Go Desktop Agent]
                         |
                         v
                   [PostgreSQL]
```

| لایه | تکنولوژی |
|------|-----------|
| Frontend | Next.js، TypeScript، Tailwind، date-fns-jalali |
| Backend | NestJS، Prisma، REST، OpenAPI/Swagger |
| Database | PostgreSQL + Migration نسخه‌بندی‌شده |
| Agent | Go (Linux / Windows) |
| Infra | Docker Compose، Healthcheck، Volume پایدار |

جزئیات: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## پیش‌نیازها

### اجرای Dockerized (پیشنهادی)
- Docker Engine
- Docker Compose v2+
- حدود ۲GB RAM آزاد

نیازی به نصب Node.js، Go یا PostgreSQL روی Host برای نسخه Dockerized نیست.

### توسعه محلی (اختیاری)
- Node.js 20+
- Go 1.22+ (برای Agent)
- PostgreSQL (یا سرویس compose)

---

## اجرای سریع با Docker

```bash
git clone https://github.com/pouya9998/WorkPulse.git
cd WorkPulse
cp .env.example .env
# حتماً POSTGRES_PASSWORD، JWT_SECRET، ENCRYPTION_KEY و رمز مدیر را عوض کنید
docker compose up -d --build
```

| سرویس | آدرس |
|--------|------|
| پنل وب | http://localhost:3000 |
| API | http://localhost:4000/api |
| Swagger | http://localhost:4000/api/docs |

ورود اولیه با `BOOTSTRAP_ADMIN_EMAIL` و `BOOTSTRAP_ADMIN_PASSWORD` از فایل `.env`.

### فرمان‌های رایج

```bash
docker compose ps
docker compose logs -f
docker compose down          # داده Volume حفظ می‌شود
docker compose down -v       # خطرناک: حذف Volumeها و تمام داده‌ها
```

Migration هنگام استارت کانتینر API با `prisma migrate deploy` اعمال می‌شود.

راهنمای نصب: [docs/INSTALL.md](docs/INSTALL.md)  
راهنمای Production: [docs/PRODUCTION.md](docs/PRODUCTION.md)

---

## ساختار Repository

```
WorkPulse/
├── apps/
│   ├── api/                 # Backend NestJS + Prisma
│   ├── web/                 # Frontend Next.js (فارسی / RTL)
│   └── agent/               # Desktop Agent (Go)
├── packages/
│   └── shared-types/        # تایپ‌های مشترک
├── infra/
│   ├── docker/              # Dockerfileها و entrypoint
│   └── scripts/             # Backup / Restore
├── docs/                    # مستندات
├── docker-compose.yml
├── .env.example
├── LICENSE                  # AGPL-3.0
├── CONTRIBUTING.md
└── README.md
```

---

## پیکربندی محیط

فایل `.env.example` را کپی کنید و مقادیر را تنظیم کنید. **هرگز `.env` را در Git قرار ندهید.**

متغیرهای مهم:

| متغیر | توضیح |
|--------|--------|
| `POSTGRES_*` / `DATABASE_URL` | اتصال PostgreSQL |
| `JWT_SECRET` | کلید امضای JWT (قوی و تصادفی) |
| `ENCRYPTION_KEY` | رمزنگاری توکن GitLab |
| `CORS_ORIGINS` | مبدأهای مجاز Frontend |
| `BOOTSTRAP_ADMIN_*` | مدیر اولیه (فقط نصب خالی) |
| `GITLAB_WEBHOOK_SECRET` | اعتبارسنجی Webhook (اختیاری) |
| `NEXT_PUBLIC_API_URL` | آدرس API از دید مرورگر |

نکته: اگر در شِل `DATABASE_URL=...@localhost` export شده باشد، Compose آن را بر `.env` اولویت می‌دهد و کانتینر API ممکن است به دیتابیس وصل نشود. قبل از `docker compose up` آن را `unset` کنید.

---

## Desktop Agent

```bash
cd apps/agent
make build-linux    # یا make build-windows / make build-all

./bin/workpulse-agent-linux-amd64 login \
  -api http://localhost:4000/api \
  -email employee@example.com \
  -password '********'

./bin/workpulse-agent-linux-amd64 run
./bin/workpulse-agent-linux-amd64 start-work
./bin/workpulse-agent-linux-amd64 end-work
./bin/workpulse-agent-linux-amd64 status
```

تنظیمات در `~/.workpulse/config.json` و صف آفلاین در `~/.workpulse/offline-queue.db`.

راهنمای کامل: [docs/AGENT.md](docs/AGENT.md)

---

## توسعه محلی

```bash
cp .env.example .env
# DATABASE_URL را برای Host روی localhost تنظیم کنید
npm install
npm run prisma:generate --workspace=@workpulse/api
npm run prisma:migrate --workspace=@workpulse/api
npm run dev:api    # معمولاً :4000
npm run dev:web    # معمولاً :3000
```

---

## تست‌ها

```bash
# واحد
npm run test --workspace=@workpulse/api

# e2e (نیاز به PostgreSQL در دسترس)
export DATABASE_URL="postgresql://workpulse:change_me_strong_password@localhost:5432/workpulse?schema=public"
export JWT_SECRET="change_me_jwt_secret_min_32_chars_long!!"
export ENCRYPTION_KEY="change_me_encryption_key_min_32_chars"
# برای جلوگیری از Bootstrap ناخواسته در تست:
export BOOTSTRAP_ADMIN_EMAIL=""
export BOOTSTRAP_ADMIN_PASSWORD=""
npm run test:e2e --workspace=@workpulse/api
```

هشدار: تست‌های e2e ممکن است داده‌های دیتابیس تست را پاک کنند؛ روی محیط Production اجرا نکنید.

---

## Backup و Restore

```bash
./infra/scripts/backup.sh
./infra/scripts/restore.sh backups/workpulse-YYYYMMDDTHHMMSSZ.sql.gz
```

جزئیات: [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md)

---

## مستندات

| سند | موضوع |
|-----|--------|
| [docs/INSTALL.md](docs/INSTALL.md) | نصب Docker Compose |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | استقرار Production |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | معماری |
| [docs/API.md](docs/API.md) | نمای کلی API |
| [docs/AGENT.md](docs/AGENT.md) | Desktop Agent |
| [docs/GITLAB.md](docs/GITLAB.md) | اتصال GitLab |
| [docs/CALENDAR.md](docs/CALENDAR.md) | جلسات و تقویم |
| [docs/SECURITY.md](docs/SECURITY.md) | امنیت و حریم خصوصی |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | پشتیبان‌گیری |
| [docs/STATUS.md](docs/STATUS.md) | وضعیت واقعی پیاده‌سازی |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | راهنمای توسعه |
| [CONTRIBUTING.md](CONTRIBUTING.md) | مشارکت |

پس از اجرا، مستندات تعاملی API در `/api/docs` در دسترس است.

---

## وضعیت پیاده‌سازی

فازهای ۱ تا ۷ پیاده‌سازی شده‌اند. محدودیت‌های واقعی (مثلاً OAuth تقویم stub، sync محدود GitLab، نبود اعلان ایمیل) در [docs/STATUS.md](docs/STATUS.md) مستند شده‌اند.

ادعای «پیاده‌سازی‌شده» فقط جایی است که کد و تست مربوط وجود دارد.

---

## امنیت و حریم خصوصی

- Secret در سورس کد نیست؛ فقط Environment Variables
- bcrypt برای رمز عبور، JWT + نشست قابل لغو
- ایزوله بودن داده بین سازمان‌ها
- Rate limiting، CORS محدود، هدرهای امنیتی پایه
- رمزنگاری توکن GitLab سمت سرور
- Audit Log با سانسور فیلدهای حساس

جزئیات: [docs/SECURITY.md](docs/SECURITY.md)

---

## مشارکت

از Pull Request خوش‌آمد می‌گوییم. لطفاً [CONTRIBUTING.md](CONTRIBUTING.md) را بخوانید:

1. UI قابل مشاهده برای کاربر فارسی و RTL باشد.
2. زمان‌ها در Backend به‌صورت UTC ذخیره شوند.
3. قابلیت اصلی صرفاً نمایشی نباشد.
4. برای منطق حساس تست بنویسید.

---

## مجوز

این پروژه تحت مجوز **GNU Affero General Public License v3.0 or later** منتشر می‌شود.

متن کامل: [LICENSE](LICENSE)
