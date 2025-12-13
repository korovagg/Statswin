# Statswin
Detailed listening stats in Spotify — your listening time, track and artist counts and top lists in one place.
## One-Click Install (recommended)
### Windows
- Open PowerShell and run:
  ```powershell
  iwr -useb "https://raw.githubusercontent.com/korovagg/statswin/main/install_windows.ps1" | iex
  ```
### macOS/Linux
- Open Terminal and run:
  ```bash
  curl -fsSL "https://raw.githubusercontent.com/korovagg/statswin/main/install_linux.sh" | bash
  ```

## Manual Install
- Download the latest Statswin release `.zip` or build locally (`npm run build-local`).
- Locate your Spicetify folder:
  - CLI: run `spicetify config-dir` and open the `CustomApps` subfolder.
  - Windows: `%APPDATA%\spicetify\CustomApps`
  - macOS/Linux: `~/.config/spicetify/CustomApps`
- Extract the `statswin` folder into `CustomApps`.
- Activate the app:
  - `spicetify config custom_apps statswin`
  - `spicetify apply`
- Restart Spotify and open `Statswin` from the top navigation bar.

## Uninstall
- Remove the app from Spicetify and delete its files:
  - Windows:
    - Close Spotify.
    - Delete folder `%APPDATA%\spicetify\CustomApps\statswin`.
    - Run `spicetify config custom_apps statswin-` and then `spicetify apply`.
  - macOS/Linux:
    - Close Spotify.
    - Delete folder `~/.config/spicetify/CustomApps/statswin`.
    - Run `spicetify config custom_apps statswin-` and then `spicetify apply`.
- Relaunch Spotify.
