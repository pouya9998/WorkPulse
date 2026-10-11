//go:build darwin

package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const label = "com.workpulse.agent"

func plistPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "Library", "LaunchAgents", label+".plist"), nil
}

func Install() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, err = filepath.Abs(exe)
	if err != nil {
		return err
	}
	path, err := plistPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	home := os.Getenv("HOME")
	content := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>%s</string>
  <key>ProgramArguments</key>
  <array>
    <string>%s</string>
    <string>run</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>%s/Library/Logs/workpulse-agent.log</string>
  <key>StandardErrorPath</key>
  <string>%s/Library/Logs/workpulse-agent.err.log</string>
</dict>
</plist>
`, label, exe, home, home)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return err
	}
	_ = exec.Command("launchctl", "unload", path).Run()
	if err := exec.Command("launchctl", "load", path).Run(); err != nil {
		return fmt.Errorf("launchctl load failed: %w", err)
	}
	fmt.Println("Installed LaunchAgent:", path)
	return nil
}

func Uninstall() error {
	path, err := plistPath()
	if err != nil {
		return err
	}
	_ = exec.Command("launchctl", "unload", path).Run()
	_ = os.Remove(path)
	fmt.Println("Removed LaunchAgent (if present):", label)
	return nil
}

func Status() (string, error) {
	path, err := plistPath()
	if err != nil {
		return "", err
	}
	exists := "missing"
	if _, err := os.Stat(path); err == nil {
		exists = "present"
	}
	out, _ := exec.Command("launchctl", "list", label).CombinedOutput()
	loaded := "not-loaded"
	if len(out) > 0 && !strings.Contains(string(out), "Could not find") {
		loaded = "loaded"
	}
	return fmt.Sprintf("plist=%s path=%s launchctl=%s", exists, path, loaded), nil
}
