<#
.SYNOPSIS
  Makes the SafeWay classroom agent start by itself whenever this Windows user logs in.

.DESCRIPTION
  Puts a shortcut in the user's Startup folder that runs safeway-classroom-agent.ps1 hidden, and starts it
  now. No administrator rights needed. Run it once on each classroom PC with that room's venue id
  (the last part of the /classroom/<venue> address, for example uc-3-3, lt-5 or jc-1).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File install-startup.ps1 -Server https://safeway.example.com -Venue uc-3-3

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File install-startup.ps1 -Remove
#>
param(
  [string]$Server,
  [string]$Venue,
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'SafeWay classroom alert.lnk'

if ($Remove) {
  if (Test-Path $shortcutPath) { Remove-Item $shortcutPath }
  Write-Host 'Removed. The agent will not start at the next login (it keeps running until you log out).'
  return
}
if (-not $Server -or -not $Venue) { throw 'Give both -Server (the SafeWay address) and -Venue (the room id), or -Remove.' }

$agent = Join-Path $PSScriptRoot 'safeway-classroom-agent.ps1'
if (-not (Test-Path $agent)) { throw "safeway-classroom-agent.ps1 must be in the same folder as this script ($PSScriptRoot)." }

# Fail now, with a clear message, rather than silently at the next login.
$state = Invoke-RestMethod -Uri "$($Server.TrimEnd('/'))/api/venues/$Venue" -TimeoutSec 10
Write-Host "Server reached. This PC will alert for: $($state.venue.name)"

$powershell = Join-Path $PSHOME 'powershell.exe'
$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$agent`" -Server `"$Server`" -Venue `"$Venue`""

$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershell
$shortcut.Arguments = $arguments
$shortcut.WindowStyle = 7 # minimised
$shortcut.Description = 'Shows the SafeWay fire alert on this classroom PC'
$shortcut.Save()

Start-Process -FilePath $powershell -ArgumentList $arguments -WindowStyle Hidden
Write-Host "Installed: $shortcutPath"
Write-Host 'The agent is running now and will start at every login.'
