package focus

import (
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
)

// Info describes the foreground application and optional deep context (best effort).
type Info struct {
	ProcessName string
	AppName     string
	WindowTitle string
	URL         string
	Detail      string
}

var (
	reURLInTitle = regexp.MustCompile(`https?://[^\s<>"']+`)
	rePathUnix   = regexp.MustCompile(`(?:^|[\s—\-–|])(/[\w./@~+-]+\.\w{1,12})`)
	rePathWin    = regexp.MustCompile(`(?:^|[\s—\-–|])([A-Za-z]:\\(?:[\w .@+-]+\\)*[\w .@+-]+\.\w{1,12})`)
)

// Enrich fills Detail/URL from window title and optional URL probe results.
func Enrich(info *Info) {
	title := strings.TrimSpace(info.WindowTitle)
	if title == "" {
		return
	}

	if info.URL == "" {
		if m := reURLInTitle.FindString(title); m != "" {
			info.URL = strings.TrimRight(m, ".,);]")
		}
	}

	info.Detail = deriveDetail(title, info.AppName, info.ProcessName)

	if info.URL != "" {
		if u, err := url.Parse(info.URL); err == nil && u.Scheme != "" && u.Host != "" {
			info.URL = u.String()
		}
	}
}

func deriveDetail(title, appName, processName string) string {
	// Strip common " - Browser" / " — App" suffixes
	separators := []string{" — ", " – ", " - ", " | "}
	base := title
	for _, sep := range separators {
		if i := strings.LastIndex(title, sep); i > 0 {
			right := strings.TrimSpace(title[i+len(sep):])
			left := strings.TrimSpace(title[:i])
			appHint := strings.ToLower(appName + " " + processName)
			if looksLikeAppSuffix(right, appHint) && left != "" {
				base = left
				break
			}
		}
	}

	if m := rePathUnix.FindStringSubmatch(title); len(m) > 1 {
		return filepath.Clean(m[1])
	}
	if m := rePathWin.FindStringSubmatch(title); len(m) > 1 {
		return m[1]
	}
	return base
}

func looksLikeAppSuffix(suffix, appHint string) bool {
	s := strings.ToLower(suffix)
	browsers := []string{
		"chrome", "firefox", "safari", "edge", "brave", "opera",
		"chromium", "google chrome", "microsoft edge", "mozilla firefox",
		"kmplayer", "vlc", "mpv", "potplayer",
		"code", "cursor", "phpstorm", "webstorm", "idea", "goland",
		"visual studio", "notepad", "sublime",
	}
	for _, b := range browsers {
		if strings.Contains(s, b) || strings.Contains(appHint, b) {
			return true
		}
	}
	return len(suffix) < 40 && !strings.Contains(suffix, "/")
}

// IsBrowserProcess reports whether the process looks like a web browser.
func IsBrowserProcess(processName, appName string) bool {
	s := strings.ToLower(processName + " " + appName)
	for _, b := range []string{"chrome", "chromium", "firefox", "msedge", "edge", "brave", "opera", "safari", "vivaldi"} {
		if strings.Contains(s, b) {
			return true
		}
	}
	return false
}
