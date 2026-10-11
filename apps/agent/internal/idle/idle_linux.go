//go:build linux

package idle

import (
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// IdleSeconds تلاش می‌کند زمان Idle را از xscreensaver یا xprintidle بخواند.
// اگر در دسترس نباشد 0 برمی‌گرداند (نه خطا) تا Agent بدون دسترسی خاص کار کند.
func IdleSeconds() (int, error) {
	if out, err := exec.Command("xprintidle").Output(); err == nil {
		ms, convErr := strconv.Atoi(strings.TrimSpace(string(out)))
		if convErr == nil {
			return ms / 1000, nil
		}
	}
	// محیط بدون نمایشگر / SSH
	if os.Getenv("DISPLAY") == "" {
		return 0, nil
	}
	return 0, nil
}

// IsScreenLocked تشخیص ساده قفل صفحه روی لینوکس.
func IsScreenLocked() (bool, error) {
	// gnome-screensaver / loginctl
	if out, err := exec.Command("loginctl", "show-session", selfSession(), "-p", "LockedHint").Output(); err == nil {
		return strings.Contains(string(out), "yes"), nil
	}
	_ = time.Now()
	return false, nil
}

func selfSession() string {
	out, err := exec.Command("loginctl").Output()
	if err != nil {
		return ""
	}
	lines := strings.Split(string(out), "\n")
	uid := strconv.Itoa(os.Getuid())
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) >= 3 && fields[2] == uid {
			return fields[0]
		}
	}
	return ""
}
