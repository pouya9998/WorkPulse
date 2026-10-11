# Desktop Agent guide

Current agent version: **0.2.0** (phase 2)

## Implemented

- Device registration with user email/password (`login`)
- Work start / end (`start-work` / `end-work`)
- Heartbeat every 60 seconds by default (`run`)
- Idle and screen-lock detection on Linux/Windows (best effort)
- Local SQLite offline queue and resync (`sync` / `run` loop)
- Connection status and queue size display
- Device access revoke from web/API

## Not collected by the agent

- Screenshots
- Keystrokes
- Clipboard
- Audio or video

## Build

Prerequisite: Go 1.22+

```bash
cd apps/agent
make build-linux
make build-windows
# or
make build-all
```

Output: `apps/agent/bin/`

## Usage

```bash
# Register device
./bin/workpulse-agent-linux-amd64 login \
  -api http://localhost:4000/api \
  -email employee@example.com \
  -password '********' \
  -name "Work laptop"

# Background loop
./bin/workpulse-agent-linux-amd64 run

# Work start / end
./bin/workpulse-agent-linux-amd64 start-work
./bin/workpulse-agent-linux-amd64 end-work

# Local status
./bin/workpulse-agent-linux-amd64 status
```

Settings are stored in `~/.workpulse/config.json`.  
Offline queue is stored in `~/.workpulse/offline-queue.db`.

## Platform notes

### Linux
- Idle: via `xprintidle` when available
- Lock: via `loginctl LockedHint` when session APIs are available
- No root required

### Windows
- Idle: `GetLastInputInfo`
- Lock: input-desktop accessibility check

If OS APIs are unavailable, the agent still runs and reports idle/lock as `0` / `false`.

## Related APIs

| Path | Description |
|------|--------|
| `POST /api/agent/register` | Register device |
| `POST /api/agent/work/start` | Start work |
| `POST /api/agent/work/end` | End work |
| `POST /api/agent/heartbeat` | Heartbeat |
| `POST /api/agent/events/sync` | Batch sync |
| `GET /api/devices` | List devices |
| `POST /api/devices/:id/revoke` | Revoke device |
| `GET /api/attendance/status` | Attendance status |
| `GET /api/attendance/timeline` | Timeline |
