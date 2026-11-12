# Screenshots

The images in this folder are generated from the built bundle with a small
Playwright harness, so they can be regenerated without running Spotify.

## How it works

- `tools/screenshot-harness/index.html` stubs the Spicetify client API (`Player`,
  `Platform.PlayerAPI`, `URI`) and seeds `localStorage` with synthetic listening
  data (70 days of sessions, four tracks, two artists).
- The harness loads the real production bundle (`dist/index.js` + `dist/style.css`).
- `scripts/screenshots.js` drives it with Playwright in two themes and two
  viewport sizes.

## Regenerate

```powershell
npm ci
npm run screenshots
```

Output (`docs/screens/`):

| File                | Theme | Viewport  | View                     |
| ------------------- | ----- | --------- | ------------------------ |
| `today-dark.png`    | dark  | 1280×800  | Today, hourly chart      |
| `year-light.png`    | light | 1280×800  | Year, monthly chart      |
| `tops-dark.png`     | dark  | 1280×800  | Top tracks/artists       |
| `settings-dark.png` | dark  | 1280×800  | Settings dialog          |
| `today-narrow.png`  | dark  | 768×1024  | Narrow layout            |

The harness also accepts query parameters for manual inspection:

```
tools/screenshot-harness/index.html?theme=light&lang=ru&v2=1
```

`v2=1` seeds the legacy `statswin.sessions` key so the v2→v3 migration can be
exercised manually.
