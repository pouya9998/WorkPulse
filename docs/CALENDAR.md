# راهنمای اتصال تقویم

وضعیت فعلی (فاز ۴):

- **Manual adapter**: جلسات ثبت‌شده در WorkPulse از طریق `ManualCalendarAdapter` و `GET /api/meetings/calendar/events` قابل خواندن هستند.
- **Null adapter**: برای `GOOGLE` / `OUTLOOK` / `NONE` — OAuth واقعی **پیاده‌سازی نشده**؛ registry به adapter خالی متصل است.
- **`CalendarConnection`**: فیلدهای `token_encrypted` / `refresh_token_encrypted` به‌عنوان placeholder برای اتصال آینده؛ upsert دستی هنگام ایجاد جلسه با provider `MANUAL`.

قوانین فعلی:

- هم‌پوشانی جلسه با نشست کاری باز: `GET /api/meetings/:id/overlaps` + هشدار `MEETING_CONFLICT` (dedupe روزانه).
- زمان جلسه در DB به UTC ذخیره می‌شود؛ UI وب برای ایجاد، ورودی UTC (`datetime-local`) دارد.

کارهای آینده:

- OAuth Google / Microsoft و sync دوطرفه
- جلوگیری از duplicate با رویدادهای خارجی پس از sync
