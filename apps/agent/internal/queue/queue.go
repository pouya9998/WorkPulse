package queue

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"

	"github.com/workpulse/agent/internal/api"
)

type Queue struct {
	db *sql.DB
}

type PendingEvent struct {
	ID               int64
	ClientEventID    string
	Type             string
	OccurredAtDevice string
	Sequence         int64
	PayloadJSON      string
}

func Open(dataDir string) (*Queue, error) {
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(dataDir, "offline-queue.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	q := &Queue{db: db}
	if err := q.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return q, nil
}

func (q *Queue) Close() error {
	return q.db.Close()
}

func (q *Queue) migrate() error {
	_, err := q.db.Exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_event_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  occurred_at_device TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_events_synced ON events(synced, id);
`)
	return err
}

func (q *Queue) Enqueue(clientEventID, eventType, occurredAt string, sequence int64, payloadJSON string) error {
	_, err := q.db.Exec(
		`INSERT OR IGNORE INTO events(client_event_id, type, occurred_at_device, sequence, payload_json, created_at, synced)
		 VALUES(?,?,?,?,?,?,0)`,
		clientEventID, eventType, occurredAt, sequence, payloadJSON, time.Now().UTC().Format(time.RFC3339),
	)
	return err
}

func (q *Queue) Pending(limit int) ([]PendingEvent, error) {
	rows, err := q.db.Query(
		`SELECT id, client_event_id, type, occurred_at_device, sequence, COALESCE(payload_json,'')
		 FROM events WHERE synced=0 ORDER BY occurred_at_device ASC, id ASC LIMIT ?`, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []PendingEvent
	for rows.Next() {
		var e PendingEvent
		if err := rows.Scan(&e.ID, &e.ClientEventID, &e.Type, &e.OccurredAtDevice, &e.Sequence, &e.PayloadJSON); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (q *Queue) MarkSynced(ids []int64) error {
	tx, err := q.db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare(`UPDATE events SET synced=1 WHERE id=?`)
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	defer stmt.Close()
	for _, id := range ids {
		if _, err := stmt.Exec(id); err != nil {
			_ = tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

func (q *Queue) PendingCount() (int, error) {
	var n int
	err := q.db.QueryRow(`SELECT COUNT(*) FROM events WHERE synced=0`).Scan(&n)
	return n, err
}

func (q *Queue) ToAPIEvents(items []PendingEvent) []api.EventItem {
	out := make([]api.EventItem, 0, len(items))
	for _, item := range items {
		seq := item.Sequence
		ev := api.EventItem{
			ClientEventID:    item.ClientEventID,
			Type:             item.Type,
			OccurredAtDevice: item.OccurredAtDevice,
			Sequence:         &seq,
		}
		out = append(out, ev)
	}
	return out
}

func NewClientEventID(prefix string) string {
	return fmt.Sprintf("%s-%d-%d", prefix, time.Now().UnixNano(), os.Getpid())
}
