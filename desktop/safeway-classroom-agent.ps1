<#
.SYNOPSIS
  SunSafe classroom agent: runs in the background on a classroom PC and puts the fire alert on screen.

.DESCRIPTION
  A web page cannot open itself, come in front of a lecturer's slides or play a siren without a click.
  This script is the small piece that can. It starts when the PC user logs in (see install-startup.ps1),
  asks the SunSafe server every few seconds whether this room has an alarm to answer, and when it does,
  opens the room's alert page full-screen (kiosk) in Microsoft Edge with sound allowed. When someone
  presses "I'll evacuate right now" the page tells the server, and this script closes the window.
  If the emergency team repeats the siren, the window opens again.

  Nothing is installed: it only needs Windows PowerShell and Edge (or Chrome), which classroom PCs have.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File safeway-classroom-agent.ps1 -Server https://safeway.example.com -Venue uc-3-3
#>
param(
  [Parameter(Mandatory = $true)][string]$Server,
  [Parameter(Mandatory = $true)][string]$Venue,
  [int]$PollSeconds = 3,
  # Keep the "acknowledged, leave now" message on screen this long before closing the window.
  [int]$CloseAfterSeconds = 8,
  # Print what would happen instead of opening or closing a window. For testing.
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Server = $Server.TrimEnd('/')
$stateUrl = "$Server/api/venues/$Venue"
$alertUrl = "$Server/classroom/$Venue"
# A profile of its own, so the autoplay flag applies even if the lecturer already has the browser open.
$profileDir = Join-Path $env:LOCALAPPDATA 'SunSafe\alert-browser'

function Find-Browser {
  $candidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
  )
  foreach ($path in $candidates) { if ($path -and (Test-Path $path)) { return $path } }
  throw 'Neither Microsoft Edge nor Google Chrome was found on this PC.'
}

function Show-Alert {
  if ($DryRun) { Write-Host "[dry run] would open $Server/classroom/$Venue full-screen"; return $null }
  $arguments = @(
    '--kiosk', $alertUrl,
    '--edge-kiosk-type=fullscreen',
    '--autoplay-policy=no-user-gesture-required',
    '--no-first-run',
    '--no-default-browser-check',
    "--user-data-dir=`"$profileDir`""
  )
  $process = Start-Process -FilePath (Find-Browser) -ArgumentList $arguments -PassThru
  # Bring it in front of whatever is on screen (slides, a video call).
  Start-Sleep -Milliseconds 1500
  try { (New-Object -ComObject WScript.Shell).AppActivate($process.Id) | Out-Null } catch { }
  return $process
}

function Hide-Alert($process) {
  if ($DryRun) { Write-Host '[dry run] would close the alert window'; return }
  if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
}

$window = $null       # the browser process showing the alert, if any
$showing = $false
$answeredAt = $null   # when we first saw the alert acknowledged while the window was open

Write-Host "SunSafe classroom agent watching $stateUrl every $PollSeconds s"
while ($true) {
  try {
    $state = Invoke-RestMethod -Uri $stateUrl -TimeoutSec 10
    $alert = $state.venue.alert
    $needsAnswer = ($null -ne $state.emergency) -and ($null -ne $alert) -and (-not $alert.acknowledged)

    if ($needsAnswer) {
      $answeredAt = $null
      $closedByHand = $showing -and $window -and $window.HasExited
      if (-not $showing -or $closedByHand) {
        # Not answered yet (or someone closed the window with Alt+F4 without answering): show it.
        $window = Show-Alert
        $showing = $true
      }
    }
    elseif ($showing) {
      if ($null -eq $answeredAt) { $answeredAt = Get-Date }
      if (((Get-Date) - $answeredAt).TotalSeconds -ge $CloseAfterSeconds) {
        Hide-Alert $window
        $window = $null
        $showing = $false
        $answeredAt = $null
      }
    }
  }
  catch {
    # Server unreachable or restarting: keep trying. An alarm must not be missed because of one bad request.
    Write-Host "SunSafe agent: $($_.Exception.Message)"
  }
  Start-Sleep -Seconds $PollSeconds
}
