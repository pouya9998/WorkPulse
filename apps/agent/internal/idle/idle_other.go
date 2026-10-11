//go:build !linux && !windows && !darwin

package idle

func IdleSeconds() (int, error) {
	return 0, nil
}

func IsScreenLocked() (bool, error) {
	return false, nil
}
