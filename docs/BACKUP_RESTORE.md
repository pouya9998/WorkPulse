# پشتیبان‌گیری و بازگردانی

## Backup

```bash
chmod +x infra/scripts/backup.sh
./infra/scripts/backup.sh
```

فایل در مسیر `backups/workpulse-<timestamp>.sql.gz` ذخیره می‌شود.

## Restore

```bash
chmod +x infra/scripts/restore.sh
./infra/scripts/restore.sh backups/workpulse-YYYYMMDDTHHMMSSZ.sql.gz
```

هشدار: Restore داده‌های فعلی را بازنویسی می‌کند.
