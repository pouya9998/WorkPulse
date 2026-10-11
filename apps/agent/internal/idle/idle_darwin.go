//go:build darwin

package idle

import (
	"os/exec"
	"strconv"
	"strings"
)

func IdleSeconds() (int, error) {
	// HIDIdleTime from ioreg (nanoseconds)
	out, err := exec.Command("ioreg", "-c", "IOHIDSystem").Output()
	if err != nil {
		return 0, nil
	}
	for _, line := range strings.Split(string(out), "\n") {
		if strings.Contains(line, "HIDIdleTime") {
			parts := strings.Split(line, "=")
			if len(parts) < 2 {
				continue
			}
			raw := strings.TrimSpace(parts[len(parts)-1])
			ns, convErr := strconv.ParseUint(raw, 10, 64)
			if convErr != nil {
				continue
			}
			return int(ns / 1_000_000_000), nil
		}
	}
	return 0, nil
}

func IsScreenLocked() (bool, error) {
	// CGSession screen locked hint
	out, err := exec.Command("python3", "-c",
		`import Quartz; print(Quartz.CGSessionCopyCurrentDictionary().get("CGSSessionScreenIsLocked", False))`).Output()
	if err == nil {
		return strings.Contains(strings.ToLower(string(out)), "true"), nil
	}
	out2, err2 := exec.Command("osascript", "-e",
		`tell application "System Events" to get (running of screen saver) is true`).Output()
	if err2 == nil {
		return strings.Contains(strings.ToLower(string(out2)), "true"), nil
	}
	return false, nil
}
