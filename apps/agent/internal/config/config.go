package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

// AgentVersion is overridable at link time via:
// go build -ldflags "-X github.com/workpulse/agent/internal/config.AgentVersion=..."
var AgentVersion = "0.4.0"

type Config struct {
	APIURL         string `json:"apiUrl"`
	DeviceToken    string `json:"deviceToken"`
	DeviceID       string `json:"deviceId"`
	DeviceUID      string `json:"deviceUid"`
	DeviceName     string `json:"deviceName"`
	UserID         string `json:"userId"`
	OrganizationID string `json:"organizationId"`
	HeartbeatSec   int    `json:"heartbeatSec"`
	IdleThreshold  int    `json:"idleThresholdSec"`
	DataDir        string `json:"dataDir"`
}

func DefaultPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".workpulse", "config.json"), nil
}

func DefaultDataDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".workpulse"), nil
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	if cfg.HeartbeatSec <= 0 {
		cfg.HeartbeatSec = 60
	}
	if cfg.IdleThreshold <= 0 {
		cfg.IdleThreshold = 300
	}
	if cfg.DataDir == "" {
		dir, err := DefaultDataDir()
		if err != nil {
			return nil, err
		}
		cfg.DataDir = dir
	}
	return &cfg, nil
}

func (c *Config) Save(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

func (c *Config) RequireAuth() error {
	if c.APIURL == "" || c.DeviceToken == "" {
		return errors.New("agent is not registered; run login first")
	}
	return nil
}

// Defaults holds values written by the installer (api URL, etc.).
type Defaults struct {
	APIURL string `json:"apiUrl"`
}

func DefaultsPath() (string, error) {
	dir, err := DefaultDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "defaults.json"), nil
}

func LoadDefaults() (*Defaults, error) {
	path, err := DefaultsPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &Defaults{}, nil
		}
		return nil, err
	}
	var d Defaults
	if err := json.Unmarshal(data, &d); err != nil {
		return nil, err
	}
	return &d, nil
}

func SaveDefaults(d *Defaults) error {
	path, err := DefaultsPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(d, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}
