package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	BaseURL     string
	DeviceToken string
	HTTP        *http.Client
}

func New(baseURL, token string) *Client {
	return &Client{
		BaseURL:     trimSlash(baseURL),
		DeviceToken: token,
		HTTP:        &http.Client{Timeout: 20 * time.Second},
	}
}

type RegisterRequest struct {
	Email        string `json:"email"`
	Password     string `json:"password"`
	DeviceUID    string `json:"deviceUid"`
	Name         string `json:"name"`
	Platform     string `json:"platform"`
	OSVersion    string `json:"osVersion,omitempty"`
	AgentVersion string `json:"agentVersion"`
}

type RegisterResponse struct {
	DeviceID                 string `json:"deviceId"`
	DeviceUID                string `json:"deviceUid"`
	DeviceToken              string `json:"deviceToken"`
	UserID                   string `json:"userId"`
	OrganizationID           string `json:"organizationId"`
	HeartbeatIntervalSeconds int    `json:"heartbeatIntervalSeconds"`
	Message                  string `json:"message"`
}

type EventItem struct {
	ClientEventID    string                 `json:"clientEventId"`
	Type             string                 `json:"type"`
	OccurredAtDevice string                 `json:"occurredAtDevice"`
	Sequence         *int64                 `json:"sequence,omitempty"`
	Payload          map[string]interface{} `json:"payload,omitempty"`
}

type SyncRequest struct {
	Events []EventItem `json:"events"`
}

type SyncResponse struct {
	Accepted   int    `json:"accepted"`
	Duplicates int    `json:"duplicates"`
	ServerTime string `json:"serverTime"`
}

type FocusedApp struct {
	ProcessName string `json:"processName,omitempty"`
	AppName     string `json:"appName,omitempty"`
	WindowTitle string `json:"windowTitle,omitempty"`
	URL         string `json:"url,omitempty"`
	Detail      string `json:"detail,omitempty"`
}

type HeartbeatRequest struct {
	ClientEventID string      `json:"clientEventId"`
	SentAtDevice  string      `json:"sentAtDevice"`
	IdleSeconds   *int        `json:"idleSeconds,omitempty"`
	IsLocked      bool        `json:"isLocked"`
	AgentVersion  string      `json:"agentVersion,omitempty"`
	FocusedApp    *FocusedApp `json:"focusedApp,omitempty"`
}

type WorkRequest struct {
	ClientEventID    string `json:"clientEventId"`
	OccurredAtDevice string `json:"occurredAtDevice"`
}

func (c *Client) Register(req RegisterRequest) (*RegisterResponse, error) {
	var out RegisterResponse
	if err := c.postPublic("/agent/register", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) StartWork(req WorkRequest) error {
	return c.postAuth("/agent/work/start", req, nil)
}

func (c *Client) EndWork(req WorkRequest) error {
	return c.postAuth("/agent/work/end", req, nil)
}

func (c *Client) Heartbeat(req HeartbeatRequest) error {
	return c.postAuth("/agent/heartbeat", req, nil)
}

func (c *Client) SyncEvents(req SyncRequest) (*SyncResponse, error) {
	var out SyncResponse
	if err := c.postAuth("/agent/events/sync", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) postPublic(path string, body any, out any) error {
	return c.do("POST", path, body, out, false)
}

func (c *Client) postAuth(path string, body any, out any) error {
	return c.do("POST", path, body, out, true)
}

func (c *Client) do(method, path string, body any, out any, auth bool) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(method, c.BaseURL+path, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if auth {
		req.Header.Set("X-Device-Token", c.DeviceToken)
	}
	res, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return fmt.Errorf("HTTP %d: %s", res.StatusCode, string(data))
	}
	if out == nil || len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, out)
}

func trimSlash(s string) string {
	for len(s) > 0 && s[len(s)-1] == '/' {
		s = s[:len(s)-1]
	}
	return s
}
