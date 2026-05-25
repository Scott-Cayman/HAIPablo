$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runnerScript = Join-Path $projectRoot "scripts\run-db-backup.ps1"
$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""$runnerScript"""

schtasks /Create /F /TN "HAIPablo DB Backup Midnight" /SC DAILY /ST 00:00 /TR $taskCommand | Out-Host
schtasks /Create /F /TN "HAIPablo DB Backup Noon" /SC DAILY /ST 12:00 /TR $taskCommand | Out-Host

Write-Host "Scheduled tasks updated:" -ForegroundColor Green
Write-Host "HAIPablo DB Backup Midnight" -ForegroundColor Green
Write-Host "HAIPablo DB Backup Noon" -ForegroundColor Green
