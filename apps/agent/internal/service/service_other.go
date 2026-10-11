//go:build !linux && !windows && !darwin

package service

import (
	"fmt"
	"runtime"
)

func Install() error {
	return fmt.Errorf("auto-start is not supported on %s", runtime.GOOS)
}

func Uninstall() error {
	return fmt.Errorf("auto-start is not supported on %s", runtime.GOOS)
}

func Status() (string, error) {
	return "", fmt.Errorf("auto-start is not supported on %s", runtime.GOOS)
}
