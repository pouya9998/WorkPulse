package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

const AgentVersion = "0.2.0"

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
		return errors.New("Agent ثبت نشده است. ابتدا فرمان login را اجرا کنید")
	}
	return nil
}
