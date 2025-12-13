Param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Function: Write-Info
# Prints informational message in cyan.
function Write-Info { param($Message) Write-Host $Message -ForegroundColor Cyan }

# Function: Write-Ok
# Prints success message in green.
function Write-Ok { param($Message) Write-Host $Message -ForegroundColor Green }

# Function: Write-Err
# Prints error message in red.
function Write-Err { param($Message) Write-Host $Message -ForegroundColor Red }

Write-Info "Checking Spicetify..."
$spiceDir = Join-Path $env:APPDATA 'spicetify'
if (!(Test-Path $spiceDir)) {
  Write-Err 'Spicetify not found. Please install Spicetify first: https://spicetify.app/docs/getting-started'
  exit 1
}

$appsDir = Join-Path $spiceDir 'CustomApps'
New-Item -ItemType Directory -Force -Path $appsDir | Out-Null

$targetDir = Join-Path $appsDir 'statswin'
if (Test-Path $targetDir) {
  Write-Info "Removing previous installation..."
  Remove-Item -Recurse -Force $targetDir
}

# Function: Get-LatestReleaseZipUrl
# Returns browser_download_url for latest release zip asset, or fallback URL.
function Get-LatestReleaseZipUrl {
  param(
    [string]$Owner,
    [string]$Repo,
    [string]$AssetPrefix = "statswin"
  )
  try {
    $apiUrl = "https://api.github.com/repos/$Owner/$Repo/releases/latest"
    $releaseInfo = Invoke-RestMethod -Uri $apiUrl -ErrorAction Stop
    $asset = $releaseInfo.assets | Where-Object { $_.name -like "$AssetPrefix*.zip" -and $_.name -notlike "*source*" } | Select-Object -First 1
    if ($asset) { return $asset.browser_download_url }
  } catch {}
  return "https://github.com/$Owner/$Repo/releases/download/1.0.0/statswin-v1.0.0.zip"
}

Write-Info "Downloading latest Statswin release..."
$tempDir = Join-Path $env:TEMP "statswin-install"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$zipPath = Join-Path $tempDir "statswin.zip"
# Prefer explicit release URL via environment override; fallback to latest API
# Function-level comment: Selects download URL (ENV override > API > pinned fallback).
function Select-DownloadUrl {
  param(
    [string]$Owner = "korovagg",
    [string]$Repo = "statswin"
  )
  $envUrl = $env:STATSWIN_RELEASE_URL
  if ($envUrl -and -not [string]::IsNullOrWhiteSpace($envUrl)) {
    return $envUrl
  }
  return Get-LatestReleaseZipUrl -Owner $Owner -Repo $Repo -AssetPrefix "statswin"
}
$downloadUrl = Select-DownloadUrl -Owner "korovagg" -Repo "statswin"

try {
  Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -ErrorAction Stop
  Write-Ok "Downloaded: $downloadUrl"
} catch {
  Write-Err "Failed to download release: $downloadUrl"
  exit 1
}

Write-Info "Extracting..."
Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
$extractedDirs = Get-ChildItem $tempDir -Directory
if ($extractedDirs.Count -ge 1) {
  Move-Item -Path $extractedDirs[0].FullName -Destination $targetDir -Force
} else {
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  Get-ChildItem $tempDir -File | ForEach-Object { Move-Item -Path $_.FullName -Destination $targetDir -Force }
}

Write-Info "Configuring Spicetify..."
spicetify config custom_apps statswin
spicetify apply

Write-Ok 'Statswin installed as a Spicetify CustomApp.'
