package main

import (
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/workpulse/agent/internal/api"
	"github.com/workpulse/agent/internal/config"
	"github.com/workpulse/agent/internal/idle"
	"github.com/workpulse/agent/internal/queue"
	"github.com/workpulse/agent/internal/state"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	cmd := os.Args[1]
	switch cmd {
	case "version", "-version", "--version":
		fmt.Printf("workpulse-agent %s\n", config.AgentVersion)
	case "login":
		runLogin(os.Args[2:])
	case "start-work":
		runWorkAction(true)
	case "end-work":
		runWorkAction(false)
	case "run":
		runDaemon()
	case "status":
		runStatus()
	case "sync":
		runSyncOnce()
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`WorkPulse Agent — مدیریت حضور ریموت

فرمان‌ها:
  login       ثبت دستگاه با ایمیل/رمز
  run         اجرای پس‌زمینه (Heartbeat + Idle + همگام‌سازی)
  start-work  شروع کار
  end-work    پایان کار
  sync        همگام‌سازی صف آفلاین
  status      نمایش وضعیت محلی
  version     نمایش نسخه

نمونه:
  workpulse-agent login -api http://localhost:4000/api -email user@ex.com -password '***'
  workpulse-agent run
  workpulse-agent start-work`)
}

func runLogin(args []string) {
	fs := flag.NewFlagSet("login", flag.ExitOnError)
	apiURL := fs.String("api", "http://localhost:4000/api", "آدرس API")
	email := fs.String("email", "", "ایمیل کاربر")
	password := fs.String("password", "", "رمز عبور")
	name := fs.String("name", hostname(), "نام دستگاه")
	_ = fs.Parse(args)

	if *email == "" || *password == "" {
		fmt.Fprintln(os.Stderr, "email و password الزامی هستند")
		os.Exit(1)
	}

	deviceUID := deviceUID()
	client := api.New(*apiURL, "")
	res, err := client.Register(api.RegisterRequest{
		Email:        *email,
		Password:     *password,
		DeviceUID:    deviceUID,
		Name:         *name,
		Platform:     runtime.GOOS,
		OSVersion:    runtime.GOARCH,
		AgentVersion: config.AgentVersion,
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "ثبت دستگاه ناموفق:", err)
		os.Exit(1)
	}

	dataDir, err := config.DefaultDataDir()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	cfg := &config.Config{
		APIURL:         *apiURL,
		DeviceToken:    res.DeviceToken,
		DeviceID:       res.DeviceID,
		DeviceUID:      res.DeviceUID,
		DeviceName:     *name,
		UserID:         res.UserID,
		OrganizationID: res.OrganizationID,
		HeartbeatSec:   res.HeartbeatIntervalSeconds,
		IdleThreshold:  300,
		DataDir:        dataDir,
	}
	path, _ := config.DefaultPath()
	if err := cfg.Save(path); err != nil {
		fmt.Fprintln(os.Stderr, "ذخیره تنظیمات ناموفق:", err)
		os.Exit(1)
	}

	fmt.Println("دستگاه با موفقیت ثبت شد.")
	fmt.Println("شناسه دستگاه:", res.DeviceID)
	fmt.Println("فایل تنظیمات:", path)
	fmt.Println("هشدار: توکن دستگاه فقط در همین فایل محلی ذخیره می‌شود.")
}

func runWorkAction(start bool) {
	cfg, q, client := mustReady()
	defer q.Close()

	rt := &state.Runtime{}
	eventType := "WORK_END"
	prefix := "wend"
	if start {
		eventType = "WORK_START"
		prefix = "wstart"
	}

	clientEventID := queue.NewClientEventID(prefix)
	occurred := time.Now().UTC().Format(time.RFC3339)
	seq := rt.NextSequence()

	if err := q.Enqueue(clientEventID, eventType, occurred, seq, ""); err != nil {
		fmt.Fprintln(os.Stderr, "صف محلی:", err)
		os.Exit(1)
	}

	req := api.WorkRequest{ClientEventID: clientEventID, OccurredAtDevice: occurred}
	var err error
	if start {
		err = client.StartWork(req)
	} else {
		err = client.EndWork(req)
	}

	if err != nil {
		fmt.Println("ارتباط برقرار نشد؛ رویداد در صف آفلاین ذخیره شد:", err)
		fmt.Printf("نوع رویداد: %s | دستگاه: %s\n", eventType, cfg.DeviceName)
		os.Exit(0)
	}

	// در صورت موفقیت مستقیم، صف را هم خالی می‌کنیم
	_ = flushQueue(client, q)
	if start {
		fmt.Println("شروع کار ثبت شد.")
	} else {
		fmt.Println("پایان کار ثبت شد.")
	}
}

func runDaemon() {
	cfg, q, client := mustReady()
	defer q.Close()

	rt := &state.Runtime{Working: true, Connected: true}
	fmt.Printf("WorkPulse Agent %s در حال اجرا...\n", config.AgentVersion)
	fmt.Printf("API: %s | دستگاه: %s | Heartbeat: %ds\n", cfg.APIURL, cfg.DeviceName, cfg.HeartbeatSec)
	fmt.Println("این Agent اسکرین‌شات، کلید، Clipboard یا صدا ضبط نمی‌کند.")

	// رویداد آنلاین
	_ = enqueueAndTry(client, q, rt, "AGENT_ONLINE", "")

	ticker := time.NewTicker(time.Duration(cfg.HeartbeatSec) * time.Second)
	syncTicker := time.NewTicker(15 * time.Second)
	idleTicker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	defer syncTicker.Stop()
	defer idleTicker.Stop()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// اولین heartbeat فوری
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
		case <-stop:
			_ = enqueueAndTry(client, q, rt, "AGENT_OFFLINE", "")
			fmt.Println("\nAgent متوقف شد.")
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

	fmt.Println("وضعیت Agent")
	fmt.Println("  نسخه:        ", config.AgentVersion)
	fmt.Println("  API:         ", cfg.APIURL)
	fmt.Println("  دستگاه:      ", cfg.DeviceName)
	fmt.Println("  پلتفرم:      ", runtime.GOOS)
	fmt.Println("  صف آفلاین:   ", pending)
	fmt.Println("  Idle (ثانیه):", idleSec)
	fmt.Println("  قفل صفحه:    ", locked)
}

func runSyncOnce() {
	_, q, client := mustReady()
	defer q.Close()
	if err := flushQueue(client, q); err != nil {
		fmt.Fprintln(os.Stderr, "همگام‌سازی ناموفق:", err)
		os.Exit(1)
	}
	pending, _ := q.PendingCount()
	fmt.Println("همگام‌سازی انجام شد. باقیمانده صف:", pending)
}

func sendHeartbeat(client *api.Client, q *queue.Queue, rt *state.Runtime, cfg *config.Config) {
	idleSec, _ := idle.IdleSeconds()
	locked, _ := idle.IsScreenLocked()
	id := queue.NewClientEventID("hb")
	now := time.Now().UTC().Format(time.RFC3339)
	req := api.HeartbeatRequest{
		ClientEventID: id,
		SentAtDevice:  now,
		IdleSeconds:   &idleSec,
		IsLocked:      locked,
		AgentVersion:  config.AgentVersion,
	}
	if err := client.Heartbeat(req); err != nil {
		_ = q.Enqueue(id, "HEARTBEAT", now, rt.NextSequence(), fmt.Sprintf(`{"idleSeconds":%d,"isLocked":%v}`, idleSec, locked))
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

	// Heartbeatهای صف‌شده را جدا از sync رویدادهای حضور ارسال می‌کنیم
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
	conn := "آنلاین"
	if !snap.Connected {
		conn = "آفلاین"
	}
	fmt.Printf("[%s] اتصال=%s | صف=%d | Idle=%v | قفل=%v\n",
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
