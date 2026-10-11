//go:build linux

package focus

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

var reAtspiURL = regexp.MustCompile(`https?://[^\s"'<>]+`)

func Foreground() (Info, error) {
	info := Info{}
	if os.Getenv("DISPLAY") == "" && os.Getenv("WAYLAND_DISPLAY") == "" {
		return info, nil
	}

	if out, err := exec.Command("xdotool", "getactivewindow", "getwindowname").Output(); err == nil {
		info.WindowTitle = strings.TrimSpace(string(out))
	}
	if out, err := exec.Command("xdotool", "getactivewindow", "getwindowpid").Output(); err == nil {
		pid := strings.TrimSpace(string(out))
		if pid != "" {
			fillFromPID(&info, pid)
		}
	}

	if info.ProcessName == "" {
		if out, err := exec.Command("xprop", "-root", "_NET_ACTIVE_WINDOW").Output(); err == nil {
			line := strings.TrimSpace(string(out))
			parts := strings.Fields(line)
			if len(parts) > 0 {
				wid := parts[len(parts)-1]
				if wid != "0x0" && wid != "0x00" {
					if pidOut, err := exec.Command("xprop", "-id", wid, "_NET_WM_PID").Output(); err == nil {
						fields := strings.Split(string(pidOut), "=")
						if len(fields) == 2 {
							fillFromPID(&info, strings.TrimSpace(fields[1]))
						}
					}
					if info.WindowTitle == "" {
						if titleOut, err := exec.Command("xprop", "-id", wid, "WM_NAME").Output(); err == nil {
							info.WindowTitle = parseXpropString(string(titleOut))
						}
					}
					if info.AppName == "" {
						if classOut, err := exec.Command("xprop", "-id", wid, "WM_CLASS").Output(); err == nil {
							info.AppName = parseXpropClass(string(classOut))
						}
					}
				}
			}
		}
	}

	if info.AppName == "" {
		info.AppName = info.ProcessName
	}

	if IsBrowserProcess(info.ProcessName, info.AppName) {
		info.URL = probeLinuxBrowserURL()
	}

	Enrich(&info)
	return info, nil
}

func probeLinuxBrowserURL() string {
	// Best-effort AT-SPI dump via gdbus / python (optional tools).
	script := `import gi
gi.require_version('Atspi', '2.0')
from gi.repository import Atspi
Atspi.init()
desk = Atspi.get_desktop(0)
def walk(n, depth=0):
    if n is None or depth > 12: return None
    try:
        role = n.get_role_name() or ''
        name = n.get_name() or ''
        if role in ('entry', 'text', 'document web', 'document frame') or 'address' in name.lower() or 'url' in name.lower():
            txt = n.get_text(0, -1) if hasattr(n, 'get_text') else name
            if txt and ('http://' in txt or 'https://' in txt):
                return txt.strip()
        for i in range(n.get_child_count() or 0):
            r = walk(n.get_child_at_index(i), depth+1)
            if r: return r
    except Exception:
        return None
    return None
for i in range(desk.get_child_count() or 0):
    app = desk.get_child_at_index(i)
    r = walk(app)
    if r:
        print(r)
        break
`
	out, err := exec.Command("python3", "-c", script).Output()
	if err != nil {
		return ""
	}
	line := strings.TrimSpace(string(out))
	if m := reAtspiURL.FindString(line); m != "" {
		return strings.TrimRight(m, ".,);]")
	}
	return ""
}

func fillFromPID(info *Info, pid string) {
	if _, err := strconv.Atoi(pid); err != nil {
		return
	}
	comm, err := os.ReadFile(filepath.Join("/proc", pid, "comm"))
	if err == nil {
		info.ProcessName = strings.TrimSpace(string(comm))
	}
	if exe, err := os.Readlink(filepath.Join("/proc", pid, "exe")); err == nil {
		base := filepath.Base(exe)
		if base != "" && !strings.HasPrefix(base, "deleted") {
			if info.ProcessName == "" {
				info.ProcessName = base
			}
			if info.AppName == "" {
				info.AppName = base
			}
		}
	}
}

func parseXpropString(s string) string {
	if i := strings.Index(s, "="); i >= 0 {
		v := strings.TrimSpace(s[i+1:])
		return strings.Trim(v, "\"")
	}
	return ""
}

func parseXpropClass(s string) string {
	if i := strings.Index(s, "="); i >= 0 {
		v := strings.TrimSpace(s[i+1:])
		parts := strings.Split(v, ",")
		if len(parts) > 0 {
			return strings.Trim(strings.TrimSpace(parts[len(parts)-1]), "\"")
		}
	}
	return ""
}
