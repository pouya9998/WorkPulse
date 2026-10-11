.PHONY: build-linux build-windows build-macos build-all deps test prepare-releases

VERSION ?= 0.4.0
OUT_DIR ?= bin
RELEASES_DIR ?= releases
MODULE := github.com/workpulse/agent
LDFLAGS := -s -w -X $(MODULE)/internal/config.AgentVersion=$(VERSION)
export PATH := $(HOME)/.local/go/bin:/usr/local/go/bin:$(PATH)

deps:
	go mod tidy

build-linux: deps
	mkdir -p $(OUT_DIR)
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o $(OUT_DIR)/workpulse-agent-linux-amd64 ./cmd/workpulse-agent

build-windows: deps
	mkdir -p $(OUT_DIR)
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o $(OUT_DIR)/workpulse-agent-windows-amd64.exe ./cmd/workpulse-agent

build-macos: deps
	mkdir -p $(OUT_DIR)
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o $(OUT_DIR)/workpulse-agent-darwin-amd64 ./cmd/workpulse-agent
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o $(OUT_DIR)/workpulse-agent-darwin-arm64 ./cmd/workpulse-agent

build-all: build-linux build-windows build-macos

# Assemble downloadable artifacts (binaries + install scripts + manifest)
prepare-releases: build-all
	mkdir -p $(RELEASES_DIR)
	cp $(OUT_DIR)/workpulse-agent-linux-amd64 $(RELEASES_DIR)/
	cp $(OUT_DIR)/workpulse-agent-windows-amd64.exe $(RELEASES_DIR)/
	cp $(OUT_DIR)/workpulse-agent-darwin-amd64 $(RELEASES_DIR)/
	cp $(OUT_DIR)/workpulse-agent-darwin-arm64 $(RELEASES_DIR)/
	cp install/install-linux.sh $(RELEASES_DIR)/
	cp install/install-windows.ps1 $(RELEASES_DIR)/
	cp install/install-macos.sh $(RELEASES_DIR)/
	chmod +x $(RELEASES_DIR)/install-linux.sh $(RELEASES_DIR)/install-macos.sh \
	  $(RELEASES_DIR)/workpulse-agent-linux-amd64 \
	  $(RELEASES_DIR)/workpulse-agent-darwin-amd64 \
	  $(RELEASES_DIR)/workpulse-agent-darwin-arm64
	@linux_sha=$$(sha256sum $(RELEASES_DIR)/workpulse-agent-linux-amd64 | awk '{print $$1}'); \
	win_sha=$$(sha256sum $(RELEASES_DIR)/workpulse-agent-windows-amd64.exe | awk '{print $$1}'); \
	mac_amd_sha=$$(sha256sum $(RELEASES_DIR)/workpulse-agent-darwin-amd64 | awk '{print $$1}'); \
	mac_arm_sha=$$(sha256sum $(RELEASES_DIR)/workpulse-agent-darwin-arm64 | awk '{print $$1}'); \
	linux_size=$$(wc -c < $(RELEASES_DIR)/workpulse-agent-linux-amd64 | tr -d ' '); \
	win_size=$$(wc -c < $(RELEASES_DIR)/workpulse-agent-windows-amd64.exe | tr -d ' '); \
	mac_amd_size=$$(wc -c < $(RELEASES_DIR)/workpulse-agent-darwin-amd64 | tr -d ' '); \
	mac_arm_size=$$(wc -c < $(RELEASES_DIR)/workpulse-agent-darwin-arm64 | tr -d ' '); \
	built_at=$$(date -u +"%Y-%m-%dT%H:%M:%SZ"); \
	printf '%s\n' \
	  '{' \
	  "  \"version\": \"$(VERSION)\"," \
	  "  \"builtAt\": \"$$built_at\"," \
	  '  "platforms": {' \
	  '    "linux": {' \
	  '      "binary": "workpulse-agent-linux-amd64",' \
	  '      "installScript": "install-linux.sh",' \
	  "      \"sha256\": \"$$linux_sha\"," \
	  "      \"size\": $$linux_size" \
	  '    },' \
	  '    "windows": {' \
	  '      "binary": "workpulse-agent-windows-amd64.exe",' \
	  '      "installScript": "install-windows.ps1",' \
	  "      \"sha256\": \"$$win_sha\"," \
	  "      \"size\": $$win_size" \
	  '    },' \
	  '    "macos": {' \
	  '      "binary": "workpulse-agent-darwin-amd64",' \
	  '      "installScript": "install-macos.sh",' \
	  "      \"sha256\": \"$$mac_amd_sha\"," \
	  "      \"size\": $$mac_amd_size" \
	  '    },' \
	  '    "macos-arm64": {' \
	  '      "binary": "workpulse-agent-darwin-arm64",' \
	  '      "installScript": "install-macos.sh",' \
	  "      \"sha256\": \"$$mac_arm_sha\"," \
	  "      \"size\": $$mac_arm_size" \
	  '    }' \
	  '  }' \
	  '}' > $(RELEASES_DIR)/manifest.json
	@echo "Releases ready in $(RELEASES_DIR)/"
	@cat $(RELEASES_DIR)/manifest.json

test:
	go test ./...
