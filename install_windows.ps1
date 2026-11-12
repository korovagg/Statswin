Param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Owner = 'korovagg'
$Repo = 'Statswin'

function Write-Info { param($Message) Write-Host $Message -ForegroundColor Cyan }
function Write-Ok { param($Message) Write-Host $Message -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host $Message -ForegroundColor Yellow }
function Write-Err { param($Message) Write-Host $Message -ForegroundColor Red }

Write-Info 'Checking Spicetify...'
$spiceDir = Join-Path $env:APPDATA 'spicetify'
if (!(Test-Path $spiceDir)) {
  Write-Err 'Spicetify not found. Please install Spicetify first: https://spicetify.app/docs/getting-started'
  exit 1
}

$spicetifyCmd = Get-Command spicetify -ErrorAction SilentlyContinue
if (-not $spicetifyCmd) {
  Write-Warn 'spicetify CLI not found in PATH; the app files will be installed but not activated.'
}

$appsDir = Join-Path $spiceDir 'CustomApps'
New-Item -ItemType Directory -Force -Path $appsDir | Out-Null
$targetDir = Join-Path $appsDir 'statswin'

function Get-LatestReleaseZipUrl {
  param([string]$Owner, [string]$Repo)
  $apiUrl = "https://api.github.com/repos/$Owner/$Repo/releases/latest"
  $releaseInfo = Invoke-RestMethod -Uri $apiUrl -Headers @{ 'User-Agent' = 'statswin-installer' } -ErrorAction Stop
  $asset = $releaseInfo.assets |
    Where-Object { $_.name -like 'statswin-*.zip' -and $_.name -notlike '*source*' } |
    Select-Object -First 1
  if ($asset) { return $asset.browser_download_url }
  return $null
}

$downloadUrl = $env:STATSWIN_RELEASE_URL
if ([string]::IsNullOrWhiteSpace($downloadUrl)) {
  Write-Info 'Resolving the latest Statswin release...'
  try {
    $downloadUrl = Get-LatestReleaseZipUrl -Owner $Owner -Repo $Repo
  } catch {
    $downloadUrl = $null
  }
}
if ([string]::IsNullOrWhiteSpace($downloadUrl)) {
  Write-Err "Could not resolve a release asset for $Owner/$Repo."
  Write-Err 'Set STATSWIN_RELEASE_URL to a direct .zip URL and re-run the installer,'
  Write-Err "or download the latest release manually: https://github.com/$Owner/$Repo/releases"
  exit 1
}

$tempDir = Join-Path $env:TEMP ("statswin-install-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$zipPath = Join-Path $tempDir 'statswin.zip'

try {
  Write-Info "Downloading $downloadUrl"
  Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing -ErrorAction Stop
  Write-Ok 'Downloaded release'
} catch {
  Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
  Write-Err "Failed to download release: $downloadUrl"
  exit 1
}

try {
  Write-Info 'Extracting...'
  $extractDir = Join-Path $tempDir 'extract'
  Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

  $sourceDir = Join-Path $extractDir 'statswin'
  if (!(Test-Path $sourceDir)) {
    $candidate = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1
    if ($candidate) { $sourceDir = $candidate.FullName }
  }
  if (!(Test-Path (Join-Path $sourceDir 'index.js'))) {
    Write-Err 'The downloaded archive does not contain statswin/index.js.'
    exit 1
  }

  if (Test-Path $targetDir) {
    Write-Info 'Removing previous installation...'
    Remove-Item -Recurse -Force $targetDir
  }
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  Copy-Item -Path (Join-Path $sourceDir '*') -Destination $targetDir -Recurse -Force
  Write-Ok "Installed into $targetDir"
} finally {
  Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
}

if ($spicetifyCmd) {
  Write-Info 'Configuring Spicetify...'
  spicetify config custom_apps statswin
  spicetify apply
  Write-Ok 'Statswin installed as a Spicetify CustomApp. Restart Spotify.'
} else {
  Write-Warn 'Run these commands manually once the Spicetify CLI is available:'
  Write-Warn '  spicetify config custom_apps statswin'
  Write-Warn '  spicetify apply'
}
