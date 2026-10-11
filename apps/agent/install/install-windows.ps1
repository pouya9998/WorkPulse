# WorkPulse desktop agent installer (Windows amd64)
$ErrorActionPreference = 'Stop'

if (-not $env:API_BASE -or [string]::IsNullOrWhiteSpace($env:API_BASE)) {
  $env:API_BASE = 'http://localhost:4000/api'
}
$ApiBase = $env:API_BASE.TrimEnd('/')
$InstallDir = Join-Path $env:LOCALAPPDATA 'WorkPulse'
$BinPath = Join-Path $InstallDir 'workpulse-agent.exe'
$DownloadUrl = "$ApiBase/agent/releases/windows/download"
$ConfigDir = Join-Path $env:USERPROFILE '.workpulse'
$DefaultsPath = Join-Path $ConfigDir 'defaults.json'
$InstallService = if ($env:INSTALL_SERVICE) { $env:INSTALL_SERVICE } else { '1' }

Write-Host 'WorkPulse Agent installer'
Write-Host "  API: $ApiBase"
Write-Host "  Install dir: $InstallDir"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null

Write-Host 'Downloading agent...'
Invoke-WebRequest -Uri $DownloadUrl -OutFile $BinPath -UseBasicParsing

@{ apiUrl = $ApiBase } | ConvertTo-Json | Set-Content -Path $DefaultsPath -Encoding UTF8

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $userPath) { $userPath = '' }
$parts = $userPath -split ';' | Where-Object { $_ -and $_.Trim() -ne '' }
if ($parts -notcontains $InstallDir) {
  $newPath = if ($userPath.Trim().Length -eq 0) { $InstallDir } else { "$userPath;$InstallDir" }
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
  $env:Path = "$InstallDir;$env:Path"
  Write-Host "Added to user PATH: $InstallDir"
}

Write-Host ""
Write-Host "Installed: $BinPath"
try { & $BinPath version } catch { Write-Host '(version check skipped)' }

if ($InstallService -eq '1' -or $InstallService -eq 'true') {
  Write-Host ""
  Write-Host 'Enabling login auto-start...'
  try {
    & $BinPath service install
  } catch {
    Write-Host 'Auto-start install skipped (run: workpulse-agent service install)'
  }
}

Write-Host ""
Write-Host 'Start the agent (it will ask for email and password):'
Write-Host '  workpulse-agent'
Write-Host ""
Write-Host 'Open a new PowerShell window if PATH was just updated.'
Write-Host 'Then open WorkPulse → Attendance and use Start/End work in the panel.'
