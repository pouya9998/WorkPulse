package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/workpulse/agent/internal/api"
	"github.com/workpulse/agent/internal/config"
	"github.com/workpulse/agent/internal/focus"
	"github.com/workpulse/agent/internal/idle"
	"github.com/workpulse/agent/internal/prompt"
	"github.com/workpulse/agent/internal/queue"
	"github.com/workpulse/agent/internal/service"
	"github.com/workpulse/agent/internal/state"
)

func main() {
	cmd := "run"
	args := []string{}
	if len(os.Args) >= 2 {
		cmd = os.Args[1]
		args = os.Args[2:]
	}

	switch cmd {
	case "version", "-version", "--version":
		fmt.Printf("workpulse-agent %s\n", config.AgentVersion)
	case "login":
		if err := runLogin(args); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	case "start-work", "end-work":
		fmt.Fprintln(os.Stderr, "Start/End work is controlled from the WorkPulse web panel.")
		fmt.Fprintln(os.Stderr, "Keep this agent running with: workpulse-agent run")
		os.Exit(1)
	case "run", "start":
		runDaemon()
	case "status":
		runStatus()
	case "sync":
		runSyncOnce()
	case "service":
		if err := runService(args); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	case "help", "-h", "--help":
		printUsage()
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`WorkPulse Agent — remote attendance companion

Commands:
  run         Start the agent (prompts for email/password if needed)
  login       Interactive device registration
  sync        Flush offline queue
  status      Show local status
  service     install | uninstall | status  (login auto-start)
  version     Print version

Usage:
  workpulse-agent
  workpulse-agent run
  workpulse-agent service install

Start and end work from the web panel while this agent stays online.
The agent reports heartbeat, idle, lock, foreground app, window title,
and best-effort URL / detail (file path or page title).
It does not capture screenshots, keystrokes, clipboard, audio, or video.`)
}

func runService(args []string) error {
	sub := "status"
	if len(args) > 0 {
		sub = args[0]
	}
	switch sub {
	case "install":
		return service.Install()
	case "uninstall":
		return service.Uninstall()
	case "status":
		msg, err := service.Status()
		if err != nil {
			return err
		}
		fmt.Println("Auto-start:", msg)
		return nil
	default:
		return fmt.Errorf("usage: workpulse-agent service install|uninstall|status")
	}
}

func runLogin(args []string) error {
	fs := flag.NewFlagSet("login", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	apiURL := fs.String("api", "", "API base URL")
	email := fs.String("email", "", "User email")
	password := fs.String("password", "", "Password")
	name := fs.String("name", "", "Device name")
	if err := fs.Parse(args); err != nil {
		return err
	}

	defaults, _ := config.LoadDefaults()
	defaultAPI := "http://localhost:4000/api"
	if defaults != nil && strings.TrimSpace(defaults.APIURL) != "" {
		defaultAPI = strings.TrimRight(defaults.APIURL, "/")
	}

	resolvedAPI := strings.TrimSpace(*apiURL)
	if resolvedAPI == "" {
		value, err := prompt.Line("API URL", defaultAPI)
		if err != nil {
			return err
		}
		resolvedAPI = strings.TrimRight(strings.TrimSpace(value), "/")
	}

	resolvedEmail := strings.TrimSpace(*email)
	if resolvedEmail == "" {
		value, err := prompt.Line("Work email", "")
		if err != nil {
			return err
		}
		resolvedEmail = strings.TrimSpace(value)
	}

	resolvedPassword := *password
	if resolvedPassword == "" {
		value, err := prompt.Password("Password")
		if err != nil {
			return err
		}
		resolvedPassword = value
	}

	resolvedName := strings.TrimSpace(*name)
	if resolvedName == "" {
		value, err := prompt.Line("Device name", hostname())
		if err != nil {
			return err
		}
		resolvedName = strings.TrimSpace(value)
	}
	if resolvedName == "" {
		resolvedName = hostname()
	}

	if resolvedAPI == "" || resolvedEmail == "" || resolvedPassword == "" {
		return errors.New("API URL, email, and password are required")
	}

	deviceUID := deviceUID()
	client := api.New(resolvedAPI, "")
	res, err := client.Register(api.RegisterRequest{
		Email:        resolvedEmail,
		Password:     resolvedPassword,
		DeviceUID:    deviceUID,
		Name:         resolvedName,
		Platform:     runtime.GOOS,
		OSVersion:    runtime.GOARCH,
		AgentVersion: config.AgentVersion,
	})
	if err != nil {
		return fmt.Errorf("device registration failed: %w", err)
	}

	dataDir, err := config.DefaultDataDir()
	if err != nil {
		return err
	}

	cfg := &config.Config{
		APIURL:         resolvedAPI,
		DeviceToken:    res.DeviceToken,
		DeviceID:       res.DeviceID,
		DeviceUID:      res.DeviceUID,
		DeviceName:     resolvedName,
		UserID:         res.UserID,
		OrganizationID: res.OrganizationID,
		HeartbeatSec:   res.HeartbeatIntervalSeconds,
		IdleThreshold:  300,
		DataDir:        dataDir,
	}
	path, _ := config.DefaultPath()
	if err := cfg.Save(path); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}
	_ = config.SaveDefaults(&config.Defaults{APIURL: resolvedAPI})

	fmt.Println("Login successful — device registered.")
	fmt.Println("Device ID:", res.DeviceID)
	fmt.Println("Config file:", path)
	fmt.Println("Keep the agent running, then Start/End work from the web panel.")
	return nil
}

func ensureLoggedIn() error {
	cfg, err := loadConfig()
	if err == nil && cfg.RequireAuth() == nil {
		return nil
	}
	fmt.Println("Sign in with your WorkPulse account to start the agent.")
	return runLogin(nil)
}

func runDaemon() {
	if err := ensureLoggedIn(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	cfg, q, client := mustReady()
	defer q.Close()

	rt := &state.Runtime{Working: true, Connected: true}
	fmt.Printf("WorkPulse Agent %s running...\n", config.AgentVersion)
	fmt.Printf("API: %s | Device: %s | Heartbeat: %ds\n", cfg.APIURL, cfg.DeviceName, cfg.HeartbeatSec)
	fmt.Println("Privacy: no screenshots, keystrokes, clipboard, audio, or video.")
	fmt.Println("Reports app name, window title, optional URL/path detail.")
	fmt.Println("Start/End work from the WorkPulse web panel.")

	_ = enqueueAndTry(client, q, rt, "AGENT_ONLINE", "")

	ticker := time.NewTicker(time.Duration(cfg.HeartbeatSec) * time.Second)
	syncTicker := time.NewTicker(15 * time.Second)
	idleTicker := time.NewTicker(10 * time.Second)
	focusTicker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	defer syncTicker.Stop()
	defer idleTicker.Stop()
	defer focusTicker.Stop()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	var lastFocusKey string
	sendHeartbeat(client, q, rt, cfg)

	for {
		select {
		case <-ticker.C:
			sendHeartbeat(client, q, rt, cfg)
			printStatusLine(rt, q)
		case <-syncTicker.C:
			if err := flushQueue(client, q); err != nil {
				pending, _ := q.PendingCount()
				rt.SetSyncMeta(pending, false, err.Error())
			} else {
				pending, _ := q.PendingCount()
				rt.SetSyncMeta(pending, true, "")
			}
		case <-idleTicker.C:
			handleIdleLock(client, q, rt, cfg)
		case <-focusTicker.C:
			info, _ := focus.Foreground()
			key := info.ProcessName + "|" + info.AppName + "|" + info.URL + "|" + info.Detail
			if key != "|||" && key != lastFocusKey {
				lastFocusKey = key
				sendHeartbeat(client, q, rt, cfg)
			}
		case <-stop:
			_ = enqueueAndTry(client, q, rt, "AGENT_OFFLINE", "")
			fmt.Println("\nAgent stopped.")
			return
		}
	}
}

func runStatus() {
	cfg, err := loadConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	q, err := queue.Open(cfg.DataDir)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer q.Close()
	pending, _ := q.PendingCount()
	idleSec, _ := idle.IdleSeconds()
	locked, _ := idle.IsScreenLocked()
	app, _ := focus.Foreground()

	fmt.Println("Agent status")
	fmt.Println("  Version:     ", config.AgentVersion)
	fmt.Println("  API:         ", cfg.APIURL)
	fmt.Println("  Device:      ", cfg.DeviceName)
	fmt.Println("  Platform:    ", runtime.GOOS)
	fmt.Println("  Offline queue:", pending)
	fmt.Println("  Idle (sec):  ", idleSec)
	fmt.Println("  Screen lock: ", locked)
	fmt.Println("  Focused app: ", app.AppName, "("+app.ProcessName+")")
	if app.WindowTitle != "" {
		fmt.Println("  Window title:", truncate(app.WindowTitle, 120))
	}
	if app.Detail != "" {
		fmt.Println("  Detail:      ", truncate(app.Detail, 120))
	}
	if app.URL != "" {
		fmt.Println("  URL:         ", truncate(app.URL, 200))
	}
}

func runSyncOnce() {
	if err := ensureLoggedIn(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	_, q, client := mustReady()
	defer q.Close()
	if err := flushQueue(client, q); err != nil {
		fmt.Fprintln(os.Stderr, "sync failed:", err)
		os.Exit(1)
	}
	pending, _ := q.PendingCount()
	fmt.Println("Sync complete. Pending queue:", pending)
}

func sendHeartbeat(client *api.Client, q *queue.Queue, rt *state.Runtime, cfg *config.Config) {
	idleSec, _ := idle.IdleSeconds()
	locked, _ := idle.IsScreenLocked()
	app, _ := focus.Foreground()
	id := queue.NewClientEventID("hb")
	now := time.Now().UTC().Format(time.RFC3339)
	req := api.HeartbeatRequest{
		ClientEventID: id,
		SentAtDevice:  now,
		IdleSeconds:   &idleSec,
		IsLocked:      locked,
		AgentVersion:  config.AgentVersion,
	}
	if app.ProcessName != "" || app.AppName != "" {
		req.FocusedApp = &api.FocusedApp{
			ProcessName: app.ProcessName,
			AppName:     app.AppName,
			WindowTitle: truncate(app.WindowTitle, 300),
			URL:         truncate(app.URL, 1000),
			Detail:      truncate(app.Detail, 300),
		}
	}
	if err := client.Heartbeat(req); err != nil {
		payload := fmt.Sprintf(
			`{"idleSeconds":%d,"isLocked":%v,"processName":%q,"appName":%q}`,
			idleSec, locked, app.ProcessName, app.AppName,
		)
		_ = q.Enqueue(id, "HEARTBEAT", now, rt.NextSequence(), payload)
		pending, _ := q.PendingCount()
		rt.SetSyncMeta(pending, false, err.Error())
		return
	}
	pending, _ := q.PendingCount()
	rt.SetSyncMeta(pending, true, "")
	_, _ = rt.SetIdleLocked(idleSec >= cfg.IdleThreshold, locked)
}

func handleIdleLock(client *api.Client, q *queue.Queue, rt *state.Runtime, cfg *config.Config) {
	idleSec, _ := idle.IdleSeconds()
	locked, _ := idle.IsScreenLocked()
	isIdle := idleSec >= cfg.IdleThreshold
	idleChanged, lockChanged := rt.SetIdleLocked(isIdle, locked)

	if idleChanged {
		if isIdle {
			_ = enqueueAndTry(client, q, rt, "IDLE_START", "")
		} else {
			_ = enqueueAndTry(client, q, rt, "IDLE_END", "")
		}
	}
	if lockChanged {
		if locked {
			_ = enqueueAndTry(client, q, rt, "SCREEN_LOCK", "")
		} else {
			_ = enqueueAndTry(client, q, rt, "SCREEN_UNLOCK", "")
		}
	}
}

func enqueueAndTry(client *api.Client, q *queue.Queue, rt *state.Runtime, eventType, payload string) error {
	id := queue.NewClientEventID(eventType)
	now := time.Now().UTC().Format(time.RFC3339)
	seq := rt.NextSequence()
	if err := q.Enqueue(id, eventType, now, seq, payload); err != nil {
		return err
	}
	return flushQueue(client, q)
}

func flushQueue(client *api.Client, q *queue.Queue) error {
	pending, err := q.Pending(100)
	if err != nil {
		return err
	}
	if len(pending) == 0 {
		return nil
	}

	var attendance []queue.PendingEvent
	var hbIDs []int64
	for _, p := range pending {
		if p.Type == "HEARTBEAT" {
			idleSec := 0
			locked := false
			_ = client.Heartbeat(api.HeartbeatRequest{
				ClientEventID: p.ClientEventID,
				SentAtDevice:  p.OccurredAtDevice,
				IdleSeconds:   &idleSec,
				IsLocked:      locked,
				AgentVersion:  config.AgentVersion,
			})
			hbIDs = append(hbIDs, p.ID)
			continue
		}
		attendance = append(attendance, p)
	}
	if len(hbIDs) > 0 {
		_ = q.MarkSynced(hbIDs)
	}
	if len(attendance) == 0 {
		return nil
	}

	res, err := client.SyncEvents(api.SyncRequest{Events: q.ToAPIEvents(attendance)})
	if err != nil {
		return err
	}
	ids := make([]int64, 0, len(attendance))
	for _, p := range attendance {
		ids = append(ids, p.ID)
	}
	if err := q.MarkSynced(ids); err != nil {
		return err
	}
	_ = res
	return nil
}

func printStatusLine(rt *state.Runtime, q *queue.Queue) {
	snap := rt.Snapshot()
	pending, _ := q.PendingCount()
	conn := "online"
	if !snap.Connected {
		conn = "offline"
	}
	fmt.Printf("[%s] connection=%s | queue=%d | idle=%v | locked=%v\n",
		time.Now().Format("15:04:05"), conn, pending, snap.LastIdle, snap.LastLocked)
}

func mustReady() (*config.Config, *queue.Queue, *api.Client) {
	cfg, err := loadConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := cfg.RequireAuth(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	q, err := queue.Open(cfg.DataDir)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	client := api.New(cfg.APIURL, cfg.DeviceToken)
	return cfg, q, client
}

func loadConfig() (*config.Config, error) {
	path, err := config.DefaultPath()
	if err != nil {
		return nil, err
	}
	return config.Load(path)
}

func hostname() string {
	h, err := os.Hostname()
	if err != nil || h == "" {
		return "workpulse-device"
	}
	return h
}

func deviceUID() string {
	h := sha256.Sum256([]byte(hostname() + "|" + runtime.GOOS + "|" + runtime.GOARCH))
	return hex.EncodeToString(h[:])
}

func truncate(s string, n int) string {
	if n <= 0 || len(s) <= n {
		return s
	}
	return s[:n]
}
