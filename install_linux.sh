#!/usr/bin/env bash
set -euo pipefail

OWNER="korovagg"
REPO="Statswin"

info() { printf "\033[0;36m%s\033[0m\n" "$1"; }
ok() { printf "\033[0;32m%s\033[0m\n" "$1"; }
warn() { printf "\033[0;33m%s\033[0m\n" "$1"; }
err() { printf "\033[0;31m%s\033[0m\n" "$1"; exit 1; }

SPICE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/spicetify"
[[ -d "$SPICE_DIR" ]] || err "Spicetify not found. Please install Spicetify first: https://spicetify.app/docs/getting-started"

command -v unzip >/dev/null 2>&1 || err "unzip is required but was not found in PATH."
if ! command -v spicetify >/dev/null 2>&1; then
  warn "spicetify CLI not found in PATH; files will be installed but not activated."
fi

latest_zip_url() {
  local api="https://api.github.com/repos/$OWNER/$REPO/releases/latest"
  local json
  json="$(curl -fsSL -H 'User-Agent: statswin-installer' "$api")" || return 0
  if command -v jq >/dev/null 2>&1; then
    printf "%s" "$(printf '%s' "$json" | jq -r '.assets[]?.browser_download_url | select(test("statswin-.*\\.zip$"))' | head -n1)"
  else
    printf "%s" "$(printf '%s' "$json" | grep -Eo '"browser_download_url": *"[^"]+"' | grep 'statswin-' | grep -v source | head -n1 | cut -d'"' -f4)"
  fi
}

DL_URL="${STATSWIN_RELEASE_URL:-}"
if [[ -z "$DL_URL" ]]; then
  info "Resolving the latest Statswin release..."
  DL_URL="$(latest_zip_url)"
fi
if [[ -z "$DL_URL" ]]; then
  err "Could not resolve a release asset for $OWNER/$REPO. Set STATSWIN_RELEASE_URL to a direct .zip URL or download from https://github.com/$OWNER/$REPO/releases"
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

ZIP_PATH="$TMP_DIR/statswin.zip"
info "Downloading $DL_URL"
curl -fsSL -o "$ZIP_PATH" "$DL_URL" || err "Failed to download: $DL_URL"
ok "Downloaded release"

info "Extracting..."
unzip -q "$ZIP_PATH" -d "$TMP_DIR/extract"

SOURCE_DIR="$TMP_DIR/extract/statswin"
if [[ ! -d "$SOURCE_DIR" ]]; then
  SOURCE_DIR="$(find "$TMP_DIR/extract" -mindepth 1 -maxdepth 1 -type d | head -n1)"
fi
[[ -n "${SOURCE_DIR:-}" && -f "$SOURCE_DIR/index.js" ]] || err "The downloaded archive does not contain statswin/index.js."

TARGET_DIR="$SPICE_DIR/CustomApps/statswin"
info "Installing into $TARGET_DIR"
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
cp -R "$SOURCE_DIR/." "$TARGET_DIR/"

if command -v spicetify >/dev/null 2>&1; then
  info "Configuring Spicetify..."
  spicetify config custom_apps statswin
  spicetify apply
  ok "Statswin installed as a Spicetify CustomApp. Restart Spotify."
else
  warn "Run these commands manually once the Spicetify CLI is available:"
  warn "  spicetify config custom_apps statswin"
  warn "  spicetify apply"
fi
