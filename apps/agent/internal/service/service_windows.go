//go:build windows

package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const taskName = "WorkPulseAgent"

func Install() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, err = filepath.Abs(exe)
	if err != nil {
		return err
	}
	cmd := exec.Command(
		"schtasks", "/Create", "/F",
		"/TN", taskName,
		"/SC", "ONLOGON",
		"/RL", "LIMITED",
		"/TR", fmt.Sprintf(`"%s" run`, exe),
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		if err2 := installWindowsStartup(exe); err2 != nil {
			return fmt.Errorf("schtasks failed (%v: %s); startup fallback: %w", err, strings.TrimSpace(string(out)), err2)
		}
		fmt.Println("Installed Startup shortcut (schtasks unavailable)")
		return nil
	}
	fmt.Println("Installed logon scheduled task:", taskName)
	return nil
}

func installWindowsStartup(exe string) error {
	startup := filepath.Join(os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
	if err := os.MkdirAll(startup, 0o755); err != nil {
		return err
	}
	lnk := filepath.Join(startup, "WorkPulse Agent.lnk")
	ps := fmt.Sprintf(`
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut('%s')
$s.TargetPath = '%s'
$s.Arguments = 'run'
$s.WorkingDirectory = '%s'
$s.Save()
`, strings.ReplaceAll(lnk, "'", "''"), strings.ReplaceAll(exe, "'", "''"), strings.ReplaceAll(filepath.Dir(exe), "'", "''"))
	return exec.Command("powershell", "-NoProfile", "-Command", ps).Run()
}

func Uninstall() error {
	_ = exec.Command("schtasks", "/Delete", "/F", "/TN", taskName).Run()
	startup := filepath.Join(os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "WorkPulse Agent.lnk")
	_ = os.Remove(startup)
	fmt.Println("Removed auto-start task/shortcut (if present)")
	return nil
}

func Status() (string, error) {
	out, err := exec.Command("schtasks", "/Query", "/TN", taskName).CombinedOutput()
	task := "missing"
	if err == nil && strings.Contains(string(out), taskName) {
		task = "present"
	}
	startup := filepath.Join(os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "WorkPulse Agent.lnk")
	shortcut := "missing"
	if _, err := os.Stat(startup); err == nil {
		shortcut = "present"
	}
	return fmt.Sprintf("task=%s shortcut=%s", task, shortcut), nil
}
