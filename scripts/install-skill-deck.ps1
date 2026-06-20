$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$StartScript = Join-Path $PSScriptRoot "start-skill-deck.ps1"
$BootstrapScript = Join-Path $PSScriptRoot "bootstrap.mjs"
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "Skill Deck.lnk"

Set-Location -LiteralPath $ProjectRoot
node $BootstrapScript

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`""
$shortcut.WorkingDirectory = $ProjectRoot
$shortcut.Description = "Start Skill Deck"
$shortcut.Save()

Write-Host "Skill Deck desktop shortcut created: $ShortcutPath"
