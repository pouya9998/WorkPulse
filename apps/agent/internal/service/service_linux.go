//go:build linux

package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const unitName = "workpulse-agent.service"

func unitPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "systemd", "user", unitName), nil
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
	path, err := unitPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	content := fmt.Sprintf(`[Unit]
Description=WorkPulse desktop agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=%s run
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`, exe)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return err
	}
	_ = exec.Command("systemctl", "--user", "daemon-reload").Run()
	if err := exec.Command("systemctl", "--user", "enable", "--now", unitName).Run(); err != nil {
		return fmt.Errorf("systemctl enable failed (is user systemd available?): %w", err)
	}
	fmt.Println("Installed and started user systemd unit:", path)
	return nil
}

func Uninstall() error {
	_ = exec.Command("systemctl", "--user", "disable", "--now", unitName).Run()
	path, err := unitPath()
	if err != nil {
		return err
	}
	_ = os.Remove(path)
	_ = exec.Command("systemctl", "--user", "daemon-reload").Run()
	fmt.Println("Removed user systemd unit (if present):", unitName)
	return nil
}

func Status() (string, error) {
	path, err := unitPath()
	if err != nil {
		return "", err
	}
	exists := "missing"
	if _, err := os.Stat(path); err == nil {
		exists = "present"
	}
	out, _ := exec.Command("systemctl", "--user", "is-enabled", unitName).Output()
	enabled := strings.TrimSpace(string(out))
	if enabled == "" {
		enabled = "unknown"
	}
	activeOut, _ := exec.Command("systemctl", "--user", "is-active", unitName).Output()
	active := strings.TrimSpace(string(activeOut))
	if active == "" {
		active = "unknown"
	}
	return fmt.Sprintf("unit=%s path=%s enabled=%s active=%s", exists, path, enabled, active), nil
}
