.PHONY: build-linux build-windows build-all deps test

VERSION ?= 0.2.0
OUT_DIR ?= bin
export PATH := $(HOME)/.local/go/bin:/usr/local/go/bin:$(PATH)

deps:
	go mod tidy

build-linux: deps
	mkdir -p $(OUT_DIR)
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "-s -w" -o $(OUT_DIR)/workpulse-agent-linux-amd64 ./cmd/workpulse-agent

build-windows: deps
	mkdir -p $(OUT_DIR)
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags "-s -w" -o $(OUT_DIR)/workpulse-agent-windows-amd64.exe ./cmd/workpulse-agent

build-all: build-linux build-windows

test:
	go test ./...
