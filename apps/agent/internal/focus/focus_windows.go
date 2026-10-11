//go:build windows

package focus

import (
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

var (
	user32                   = syscall.NewLazyDLL("user32.dll")
	kernel32                 = syscall.NewLazyDLL("kernel32.dll")
	psapi                    = syscall.NewLazyDLL("psapi.dll")
	getForegroundWindow      = user32.NewProc("GetForegroundWindow")
	getWindowTextW           = user32.NewProc("GetWindowTextW")
	getWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
	openProcess              = kernel32.NewProc("OpenProcess")
	closeHandle              = kernel32.NewProc("CloseHandle")
	queryFullProcessImageNameW = kernel32.NewProc("QueryFullProcessImageNameW")
	getModuleBaseNameW       = psapi.NewProc("GetModuleBaseNameW")
)

const processQueryLimitedInformation = 0x1000

func Foreground() (Info, error) {
	info := Info{}
	hwnd, _, _ := getForegroundWindow.Call()
	if hwnd == 0 {
		return info, nil
	}

	var title [512]uint16
	getWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&title[0])), uintptr(len(title)))
	info.WindowTitle = syscall.UTF16ToString(title[:])

	var pid uint32
	getWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
	if pid == 0 {
		Enrich(&info)
		return info, nil
	}

	h, _, _ := openProcess.Call(processQueryLimitedInformation, 0, uintptr(pid))
	if h != 0 {
		defer closeHandle.Call(h)
		var buf [260]uint16
		size := uint32(len(buf))
		r, _, _ := queryFullProcessImageNameW.Call(h, 0, uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&size)))
		if r != 0 {
			full := syscall.UTF16ToString(buf[:])
			base := filepath.Base(full)
			info.ProcessName = base
			info.AppName = stringsTrimExt(base)
		} else {
			var name [260]uint16
			r2, _, _ := getModuleBaseNameW.Call(h, 0, uintptr(unsafe.Pointer(&name[0])), uintptr(len(name)))
			if r2 != 0 {
				base := syscall.UTF16ToString(name[:])
				info.ProcessName = base
				info.AppName = stringsTrimExt(base)
			}
		}
	}

	if IsBrowserProcess(info.ProcessName, info.AppName) {
		info.URL = probeWindowsBrowserURL()
	}

	Enrich(&info)
	return info, nil
}

func probeWindowsBrowserURL() string {
	// PowerShell UI Automation best-effort (Chrome / Edge address bar).
	ps := `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
$edits = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
foreach ($e in $edits) {
  try {
    $name = $e.Current.Name
    if ($name -match 'Address|Search|URL|موقعیت|آدرس') {
      $pat = [System.Windows.Automation.ValuePattern]$e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
      $v = $pat.Current.Value
      if ($v -match '^https?://') { Write-Output $v; break }
    }
  } catch {}
}
`
	out, err := exec.Command("powershell", "-NoProfile", "-Command", ps).Output()
	if err != nil {
		return ""
	}
	line := strings.TrimSpace(string(out))
	if strings.HasPrefix(line, "http://") || strings.HasPrefix(line, "https://") {
		return line
	}
	return ""
}

func stringsTrimExt(name string) string {
	ext := filepath.Ext(name)
	if ext == "" {
		return name
	}
	return name[:len(name)-len(ext)]
}
