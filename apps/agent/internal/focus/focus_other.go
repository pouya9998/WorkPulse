//go:build !linux && !windows && !darwin

package focus

func Foreground() (Info, error) {
	return Info{}, nil
}
