# Backup and restore

## Backup

```bash
chmod +x infra/scripts/backup.sh
./infra/scripts/backup.sh
```

The dump is written to `backups/workpulse-<timestamp>.sql.gz`.

## Restore

```bash
chmod +x infra/scripts/restore.sh
./infra/scripts/restore.sh backups/workpulse-YYYYMMDDTHHMMSSZ.sql.gz
```

Warning: restore overwrites the current database contents.
