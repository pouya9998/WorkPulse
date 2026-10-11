# Desktop Agent guide

Current agent version: **0.4.0**

## Role

The agent stays online on the employee machine. **Start / End work is done in the web panel**, not from the agent CLI.

The agent reports:

- Heartbeat
- Idle / screen lock (best effort)
- Foreground application name
- Window title (up to ~300 chars)
- Best-effort **URL** (browser address bar / AppleScript / accessibility)
- **Detail** (normalized page title, file path, or media title)

It does **not** capture screenshots, keystrokes, clipboard, audio, or video.

## Language

All agent CLI messages are **English**.

## Download from the panel

| Path | Description |
|------|-------------|
| `GET /api/agent/releases` | List builds |
| `GET /api/agent/releases/linux/download` | Linux amd64 binary |
| `GET /api/agent/releases/windows/download` | Windows amd64 binary |
| `GET /api/agent/releases/macos/download` | macOS Intel binary |
| `GET /api/agent/releases/macos-arm64/download` | macOS Apple Silicon binary |
| `GET /api/agent/releases/:platform/install-script` | Installer |

In the UI: **Devices** → install → run agent → when online, use **Attendance** → Start/End work.

```bash
# Linux install (enables login auto-start by default)
curl -fsSL http://localhost:4000/api/agent/releases/linux/install-script \
  | API_BASE=http://localhost:4000/api bash

# macOS (auto-selects amd64 / arm64)
curl -fsSL http://localhost:4000/api/agent/releases/macos/install-script \
  | API_BASE=http://localhost:4000/api bash

# Start (prompts for email/password in English)
workpulse-agent
```

```powershell
$env:API_BASE='http://localhost:4000/api'
irm http://localhost:4000/api/agent/releases/windows/install-script | iex
workpulse-agent
```

Set `INSTALL_SERVICE=0` to skip auto-start during install.

## Build from source

```bash
cd apps/agent
make prepare-releases   # linux + windows + macos binaries + install scripts + manifest
```

## Commands

| Command | Purpose |
|---------|---------|
| `workpulse-agent` / `run` | Login if needed, then run heartbeat loop |
| `login` | Interactive registration |
| `status` | Local status including focused app / URL |
| `sync` | Flush offline queue |
| `service install` | Enable login auto-start |
| `service uninstall` | Disable login auto-start |
| `service status` | Show auto-start status |
| `start-work` / `end-work` | Disabled — use the web panel |

## Auto-start

| OS | Mechanism |
|----|-----------|
| Linux | User systemd unit `~/.config/systemd/user/workpulse-agent.service` |
| Windows | Logon scheduled task (or Startup shortcut fallback) |
| macOS | LaunchAgent `~/Library/LaunchAgents/com.workpulse.agent.plist` |

## Related APIs

| Path | Description |
|------|-------------|
| `POST /api/agent/register` | Register device |
| `POST /api/agent/heartbeat` | Heartbeat (+ focused app / url / detail) |
| `POST /api/agent/events/sync` | Offline sync |
| `POST /api/attendance/work/start` | Start work (JWT, requires online agent) |
| `POST /api/attendance/work/end` | End work (JWT, requires online agent) |
| `GET /api/devices/me/status` | Panel unlock status |
| `GET /api/devices` | List devices |

## Platform notes

### Linux
- Idle: `xprintidle` when available
- Focus: `xdotool` / `xprop` + `/proc`
- URL: best-effort AT-SPI via optional Python/gi

### Windows
- Idle: `GetLastInputInfo`
- Focus: `GetForegroundWindow` + process image name
- URL: best-effort UI Automation (Chrome/Edge address bar)

### macOS
- Idle: `ioreg` HIDIdleTime
- Focus / URL: AppleScript for frontmost app and Safari/Chrome/Edge/Firefox
