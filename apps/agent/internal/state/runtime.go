package state

import "sync"

type Runtime struct {
	mu            sync.Mutex
	Working       bool
	LastIdle      bool
	LastLocked    bool
	Sequence      int64
	PendingSync   int
	LastSyncError string
	Connected     bool
}

func (r *Runtime) NextSequence() int64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Sequence++
	return r.Sequence
}

func (r *Runtime) Snapshot() Runtime {
	r.mu.Lock()
	defer r.mu.Unlock()
	return Runtime{
		Working:       r.Working,
		LastIdle:      r.LastIdle,
		LastLocked:    r.LastLocked,
		Sequence:      r.Sequence,
		PendingSync:   r.PendingSync,
		LastSyncError: r.LastSyncError,
		Connected:     r.Connected,
	}
}

func (r *Runtime) SetWorking(v bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Working = v
}

func (r *Runtime) SetSyncMeta(pending int, connected bool, errMsg string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.PendingSync = pending
	r.Connected = connected
	r.LastSyncError = errMsg
}

func (r *Runtime) SetIdleLocked(idle, locked bool) (idleChanged, lockChanged bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	idleChanged = r.LastIdle != idle
	lockChanged = r.LastLocked != locked
	r.LastIdle = idle
	r.LastLocked = locked
	return
}
