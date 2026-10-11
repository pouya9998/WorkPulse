package prompt

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"sync"
	"syscall"

	"golang.org/x/term"
)

var (
	stdinOnce sync.Once
	stdin     *bufio.Reader
)

func reader() *bufio.Reader {
	stdinOnce.Do(func() {
		stdin = bufio.NewReader(os.Stdin)
	})
	return stdin
}

func Line(label, defaultValue string) (string, error) {
	if defaultValue != "" {
		fmt.Printf("%s [%s]: ", label, defaultValue)
	} else {
		fmt.Printf("%s: ", label)
	}
	text, err := reader().ReadString('\n')
	if err != nil && text == "" {
		return "", err
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return defaultValue, nil
	}
	return text, nil
}

func Password(label string) (string, error) {
	fmt.Printf("%s: ", label)
	fd := int(syscall.Stdin)
	if term.IsTerminal(fd) {
		bytes, err := term.ReadPassword(fd)
		fmt.Println()
		if err != nil {
			return "", err
		}
		return strings.TrimSpace(string(bytes)), nil
	}
	text, err := reader().ReadString('\n')
	if err != nil && text == "" {
		return "", err
	}
	return strings.TrimSpace(text), nil
}
