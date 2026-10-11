//go:build windows

package idle

import (
	"syscall"
	"time"
	"unsafe"
)

var (
	user32           = syscall.NewLazyDLL("user32.dll")
	kernel32         = syscall.NewLazyDLL("kernel32.dll")
	getLastInputInfo = user32.NewProc("GetLastInputInfo")
	getTickCount     = kernel32.NewProc("GetTickCount")
	openInputDesktop = user32.NewProc("OpenInputDesktop")
	closeDesktop     = user32.NewProc("CloseDesktop")
)

type lastInputInfo struct {
	cbSize uint32
	dwTime uint32
}

func IdleSeconds() (int, error) {
	var info lastInputInfo
	info.cbSize = uint32(unsafe.Sizeof(info))
	r, _, err := getLastInputInfo.Call(uintptr(unsafe.Pointer(&info)))
	if r == 0 {
		return 0, err
	}
	tick, _, _ := getTickCount.Call()
	idleMs := uint32(tick) - info.dwTime
	return int(idleMs / 1000), nil
}

func IsScreenLocked() (bool, error) {
	// اگر نتوانیم desktop ورودی را باز کنیم، احتمالاً صفحه قفل است.
	h, _, _ := openInputDesktop.Call(0, 0, 0x0100) // DESKTOP_SWITCHDESKTOP
	if h == 0 {
		return true, nil
	}
	closeDesktop.Call(h)
	_ = time.Now()
	return false, nil
}
