#!/usr/bin/env bash
set -euo pipefail

# Function: info
# Prints informational message in cyan.
info() { printf "\033[0;36m%s\033[0m\n" "$1"; }
# Function: ok
# Prints success message in green.
ok() { printf "\033[0;32m%s\033[0m\n" "$1"; }
# Function: err
# Prints error message in red and exits.
err() { printf "\033[0;31m%s\033[0m\n" "$1"; exit 1; }

SPICE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/spicetify"
[[ -d "$SPICE_DIR" ]] || err "Spicetify not found. Please install Spicetify first: https://spicetify.app/docs/getting-started"

APPS_DIR="$SPICE_DIR/CustomApps"
mkdir -p "$APPS_DIR"
TARGET_DIR="$APPS_DIR/statswin"

info "Removing previous installation (if any)..."
rm -rf "$TARGET_DIR"

TMP_DIR="$(mktemp -d)"
ZIP_PATH="$TMP_DIR/statswin.zip"

# Function: latest_zip_url
# Returns the latest release zip URL, falling back to generic path.
latest_zip_url() {
  local owner="korovagg"
  local repo="statswin"
  local prefix="statswin"
  local api="https://api.github.com/repos/$owner/$repo/releases/latest"
  local url
  if url="$(curl -fsSL "$api" | grep -Eo '"browser_download_url":\s*"[^"]+"' | grep "$prefix" | grep -v source | head -n1 | cut -d'"' -f4)"; then
    printf "%s" "$url"
  else
    printf "https://github.com/%s/%s/releases/download/1.0.0/statswin-v1.0.0.zip" "$owner" "$repo"
  fi
}

info "Downloading latest Statswin release..."
# Prefer explicit release URL via environment override; fallback to latest API or pinned
# Function-level comment: Selects download URL (ENV override > API > pinned fallback).
if [[ -n "${STATSWIN_RELEASE_URL:-}" ]]; then
  DL_URL="$STATSWIN_RELEASE_URL"
else
  DL_URL="$(latest_zip_url)"
fi
curl -fsSL -o "$ZIP_PATH" "$DL_URL" || err "Failed to download: $DL_URL"
ok "Downloaded release"

info "Extracting..."
unzip -q "$ZIP_PATH" -d "$TMP_DIR"

EXTRACTED_DIR="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n1)"
mkdir -p "$TARGET_DIR"
if [[ -n "$EXTRACTED_DIR" ]]; then
  mv "$EXTRACTED_DIR"/* "$TARGET_DIR"/
else
  mv "$TMP_DIR"/* "$TARGET_DIR"/
fi

info "Configuring Spicetify..."
spicetify config custom_apps statswin
spicetify apply

ok "Statswin installed as a Spicetify CustomApp."
