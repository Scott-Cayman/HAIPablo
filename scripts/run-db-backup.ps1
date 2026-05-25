$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding

$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectRoot "backups\logs"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = Join-Path $logDir "backup-$timestamp.log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location $projectRoot

"[$(Get-Date -Format s)] Starting database backup" | Tee-Object -FilePath $logFile -Append
npm run db:backup 2>&1 | Tee-Object -FilePath $logFile -Append
"[$(Get-Date -Format s)] Database backup finished" | Tee-Object -FilePath $logFile -Append
