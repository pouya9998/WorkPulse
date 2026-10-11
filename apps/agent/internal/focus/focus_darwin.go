//go:build darwin

package focus

import (
	"os/exec"
	"strings"
)

func Foreground() (Info, error) {
	info := Info{}

	// Frontmost app name
	if out, err := exec.Command("osascript", "-e",
		`tell application "System Events" to get name of first application process whose frontmost is true`).Output(); err == nil {
		info.AppName = strings.TrimSpace(string(out))
		info.ProcessName = strings.ToLower(strings.ReplaceAll(info.AppName, " ", ""))
	}

	// Window title
	if out, err := exec.Command("osascript", "-e",
		`tell application "System Events" to tell (first application process whose frontmost is true) to get name of front window`).Output(); err == nil {
		info.WindowTitle = strings.TrimSpace(string(out))
	}

	if IsBrowserProcess(info.ProcessName, info.AppName) {
		info.URL = probeMacBrowserURL(info.AppName)
	}

	Enrich(&info)
	return info, nil
}

func probeMacBrowserURL(appName string) string {
	app := strings.TrimSpace(appName)
	scripts := map[string]string{
		"Google Chrome": `tell application "Google Chrome" to get URL of active tab of front window`,
		"Chromium":      `tell application "Chromium" to get URL of active tab of front window`,
		"Microsoft Edge": `tell application "Microsoft Edge" to get URL of active tab of front window`,
		"Brave Browser": `tell application "Brave Browser" to get URL of active tab of front window`,
		"Safari":        `tell application "Safari" to get URL of front document`,
		"Firefox":       `tell application "Firefox" to get URL of active tab of front window`,
	}

	script, ok := scripts[app]
	if !ok {
		// fuzzy match
		lower := strings.ToLower(app)
		for k, v := range scripts {
			if strings.Contains(lower, strings.ToLower(k)) || strings.Contains(strings.ToLower(k), lower) {
				script = v
				ok = true
				break
			}
		}
	}
	if !ok || script == "" {
		return ""
	}
	out, err := exec.Command("osascript", "-e", script).Output()
	if err != nil {
		return ""
	}
	u := strings.TrimSpace(string(out))
	if strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://") {
		return u
	}
	return ""
}
