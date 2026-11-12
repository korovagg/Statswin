import { addSession, flushStorage } from "../utils/storage";
import { MAX_DEBUG_LOGS } from "../config";
import { Session, TrackInfo } from "../types";
import { getSpicetify } from "../utils/spicetify";

/**
 * Listening tracker.
 *
 * Accrual model: wall-clock time while the player reports "playing", corrected
 * for seeks. Track position is only used to detect seeks and pauses, never to
 * add time — this keeps the live counter stable on background tabs.
 *
 * A segment is opened when playback starts and closed (written to storage) only
 * on `track_change`, `pause`, `stop`, `seek` or `unmount`.
 */

const TICK_MS = 1000;
const SEEK_BACK_THRESHOLD_MS = 1500;
const SEEK_FORWARD_THRESHOLD_MS = 5000;

export type TrackerFinalizeReason = "track_change" | "pause" | "stop" | "seek" | "unmount" | "hidden";

interface ListeningTracker {
  start(): void;
  stop(): void;
  flush(): void;
  getLiveAccrualMs(): number;
  isRunning(): boolean;
}

interface DebugEntry {
  ts: number;
  type: string;
  payload?: unknown;
}

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" ? (value as AnyRecord) : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Pushes a debug entry into the in-memory ring buffer exposed on `window`.
 */
function logEvent(type: string, payload?: unknown): void {
  try {
    const logs: DebugEntry[] = Array.isArray(window.__statswinLogs)
      ? (window.__statswinLogs as DebugEntry[])
      : [];
    logs.push({ ts: Date.now(), type, payload });
    while (logs.length > MAX_DEBUG_LOGS) logs.shift();
    window.__statswinLogs = logs;
  } catch {
    // Debug logging must never break playback tracking.
  }
}

/**
 * Extracts the first artist URI from any of the shapes Spicetify exposes.
 */
function resolveArtistUri(trackLike: unknown): string | undefined {
  try {
    const root = asRecord(trackLike);
    if (!root) return undefined;

    const artists = root.artists;
    if (Array.isArray(artists)) {
      const first = asRecord(artists[0]);
      const uri = first?.uri;
      if (typeof uri === "string" && uri) return uri;
    }
    const direct = root.artist_uri ?? root.artistUri;
    if (typeof direct === "string" && direct) return direct;

    const metadata = asRecord(root.metadata);
    const metaUri = metadata?.artist_uri ?? metadata?.artistUri;
    if (typeof metaUri === "string" && metaUri) return metaUri;
    const metaArtists = metadata?.artists;
    if (Array.isArray(metaArtists)) {
      const first = asRecord(metaArtists[0]);
      if (typeof first?.uri === "string" && first.uri) return first.uri;
    }

    const data = asRecord(root.data);
    const nested = asRecord(data?.track) ?? asRecord(data?.item);
    const nestedArtists = nested?.artists;
    if (Array.isArray(nestedArtists)) {
      const first = asRecord(nestedArtists[0]);
      if (typeof first?.uri === "string" && first.uri) return first.uri;
    }
  } catch {
    // Fall through to undefined.
  }
  return undefined;
}

/**
 * Extracts an album art URL from any of the shapes Spicetify exposes.
 */
function resolveImageUrl(trackLike: unknown): string | undefined {
  try {
    const root = asRecord(trackLike);
    if (!root) return undefined;

    const album = asRecord(root.album);
    const albumImages = album?.images;
    if (Array.isArray(albumImages)) {
      const first = asRecord(albumImages[0]);
      if (typeof first?.url === "string" && first.url) return first.url;
    }
    const coverSources = asRecord(album?.coverArt)?.sources;
    if (Array.isArray(coverSources)) {
      const first = asRecord(coverSources[0]);
      if (typeof first?.url === "string" && first.url) return first.url;
    }

    const direct = root.image_url ?? root.imageUrl ?? root.coverArtUrl;
    if (typeof direct === "string" && direct) return direct;

    const metadata = asRecord(root.metadata);
    const metaUrl = metadata?.image_url ?? metadata?.imageUrl;
    if (typeof metaUrl === "string" && metaUrl) return metaUrl;

    const data = asRecord(root.data);
    const nested =
      asRecord(data?.track) ?? asRecord(data?.item) ?? asRecord(data?.album) ?? asRecord(data);
    const nestedAlbum = asRecord(nested?.album);
    const nestedImages = nestedAlbum?.images ?? nested?.images;
    if (Array.isArray(nestedImages)) {
      const first = asRecord(nestedImages[0]);
      if (typeof first?.url === "string" && first.url) return first.url;
    }
    if (typeof nested?.image_url === "string" && nested.image_url) return nested.image_url;
  } catch {
    // Fall through to undefined.
  }
  return undefined;
}

function sanitizeTrack(track: TrackInfo | null): TrackInfo | null {
  if (!track || !track.uri) return null;
  return {
    uri: track.uri,
    name: track.name || track.uri,
    artist: track.artist || "",
    artistUri: track.artistUri,
    imageUrl: track.imageUrl && track.imageUrl.length <= 512 ? track.imageUrl : undefined,
  };
}

/**
 * Reads the current track info from the Spicetify player.
 */
function getCurrentTrackInfo(): TrackInfo | null {
  try {
    const spicetify = getSpicetify();
    if (!spicetify) return null;

    const playerData = spicetify.Player.data;
    const track = playerData?.track;
    if (track?.uri) {
      return sanitizeTrack({
        uri: track.uri,
        name: track.name || track.metadata?.name || "",
        artist: track.artist_name || track.artist || track.metadata?.artist_name || "",
        artistUri: resolveArtistUri(track) ?? resolveArtistUri(playerData),
        imageUrl: resolveImageUrl(track) ?? resolveImageUrl(playerData),
      });
    }

    const state = asRecord(spicetify.Platform?.PlayerAPI?._state);
    const item = state?.item;
    const itemRecord = asRecord(item);
    const itemUri = itemRecord?.uri;
    if (typeof itemUri === "string" && itemUri) {
      const artists = itemRecord?.artists;
      const firstArtist = Array.isArray(artists) ? asRecord(artists[0]) : null;
      const artistName =
        (typeof firstArtist?.name === "string" && firstArtist.name) ||
        (typeof itemRecord?.artist === "string" && itemRecord.artist) ||
        "";
      return sanitizeTrack({
        uri: itemUri,
        name: (typeof itemRecord?.name === "string" && itemRecord.name) || "",
        artist: artistName,
        artistUri: resolveArtistUri(item) ?? resolveArtistUri(state),
        imageUrl: resolveImageUrl(item) ?? resolveImageUrl(state),
      });
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Whether Spotify reports active playback.
 */
function isPlaying(): boolean {
  try {
    return !!getSpicetify()?.Player.isPlaying();
  } catch {
    return false;
  }
}

/**
 * Current track duration in milliseconds, if known.
 */
function getDurationMs(): number | null {
  try {
    const data = getSpicetify()?.Player.data;
    const duration = data?.duration ?? data?.track?.duration;
    return typeof duration === "number" && Number.isFinite(duration) ? duration : null;
  } catch {
    return null;
  }
}

/**
 * Normalizes the player position across the several APIs Spicetify exposes.
 */
function getProgressMs(durationHint: number | null): number | null {
  try {
    const spicetify = getSpicetify();
    if (!spicetify) return null;
    const duration = durationHint ?? getDurationMs();

    const fromPlayer = spicetify.Player.getProgress?.();
    if (typeof fromPlayer === "number" && Number.isFinite(fromPlayer)) {
      // Some versions return a 0..1 fraction instead of milliseconds.
      if (duration && fromPlayer > 0 && fromPlayer <= 1) return Math.round(fromPlayer * duration);
      if (fromPlayer > 1) return Math.round(fromPlayer);
    }

    const position = spicetify.Player.data?.position;
    if (typeof position === "number" && Number.isFinite(position)) return Math.round(position);

    const state = asRecord(spicetify.Platform?.PlayerAPI?._state);
    if (state) {
      const basePosition =
        asNumber(state.position) ?? asNumber(state.positionAsOfTimestamp);
      if (basePosition != null) {
        let computed = basePosition;
        const timestamp = asNumber(state.timestamp);
        const playingFlag =
          typeof state.isPlaying === "boolean" ? state.isPlaying : isPlaying();
        if (playingFlag && timestamp != null) {
          computed += Math.max(0, Date.now() - timestamp);
        }
        if (duration && computed > duration) computed = duration;
        return Math.round(computed);
      }
    }
    return null;
  } catch {
    return null;
  }
}

function generatePlayId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Creates (or returns) the singleton tracker.
 */
export function createListeningTracker(): ListeningTracker {
  const existing = window.__statswinTracker as ListeningTracker | undefined;
  if (existing && typeof existing.start === "function" && typeof existing.getLiveAccrualMs === "function") {
    return existing;
  }

  let intervalId: number | null = null;
  let currentTrack: TrackInfo | null = null;
  let currentPlayId: string | undefined;
  let segmentOpen = false;
  let segmentStartedWallMs = 0;
  let segmentAccumMs = 0;
  let lastTickPerf = 0;
  let lastProgressMs: number | null = null;
  let lastPlaying = false;
  let attached = false;

  function dispatchTick(deltaMs: number, liveMs: number): void {
    try {
      window.dispatchEvent(
        new CustomEvent("statswin:tick", { detail: { deltaMs, liveMs, track: currentTrack } })
      );
    } catch {
      // UI is optional.
    }
  }

  function openSegment(): void {
    if (segmentOpen) return;
    if (!currentPlayId) currentPlayId = generatePlayId();
    segmentOpen = true;
    segmentStartedWallMs = Date.now();
    segmentAccumMs = 0;
    lastTickPerf = performance.now();
    lastProgressMs = getProgressMs(getDurationMs());
    logEvent("segment_open", { uri: currentTrack?.uri });
  }

  function finalizeSegment(reason: TrackerFinalizeReason): void {
    if (!segmentOpen || !currentTrack) {
      segmentOpen = false;
      segmentAccumMs = 0;
      return;
    }
    const accrued = Math.max(0, Math.round(segmentAccumMs));
    if (accrued >= 500) {
      const session: Session = {
        start: segmentStartedWallMs,
        end: segmentStartedWallMs + accrued,
        track: currentTrack,
        playId: currentPlayId,
      };
      addSession(session);
      logEvent("segment_close", { reason, ms: accrued, uri: currentTrack.uri });
    }
    segmentOpen = false;
    segmentAccumMs = 0;
    lastTickPerf = 0;
  }

  /**
   * Detects seeks by comparing the freshly read position with the previous one.
   */
  function handleSeekIfAny(currentProgressMs: number | null): boolean {
    if (currentProgressMs == null || lastProgressMs == null) {
      lastProgressMs = currentProgressMs;
      return false;
    }
    const delta = currentProgressMs - lastProgressMs;
    const isSeek = delta < -SEEK_BACK_THRESHOLD_MS || delta > SEEK_FORWARD_THRESHOLD_MS;
    lastProgressMs = currentProgressMs;
    if (!isSeek || !segmentOpen) return false;

    const sameTrack = getCurrentTrackInfo()?.uri === currentTrack?.uri;
    finalizeSegment("seek");
    // Keep the same playId: a seek is not a new play.
    if (isPlaying() && sameTrack) openSegment();
    logEvent("seek_detected", { delta });
    return true;
  }

  function handleTrackChange(track: TrackInfo): void {
    if (currentTrack && currentTrack.uri !== track.uri) {
      finalizeSegment("track_change");
    }
    currentTrack = track;
    currentPlayId = generatePlayId();
    lastProgressMs = getProgressMs(getDurationMs());
    segmentOpen = false;
    if (isPlaying()) openSegment();
  }

  /**
   * Main loop: wall-clock accrual with seek correction.
   */
  function tick(): void {
    const track = getCurrentTrackInfo();
    const playing = isPlaying();

    if (!track) {
      if (segmentOpen) finalizeSegment("stop");
      currentTrack = null;
      lastPlaying = playing;
      return;
    }

    if (!currentTrack || currentTrack.uri !== track.uri) {
      handleTrackChange(track);
      lastPlaying = playing;
      return;
    }

    // Keep metadata fresh (name/artist can arrive a tick later).
    currentTrack = { ...currentTrack, ...track, imageUrl: track.imageUrl ?? currentTrack.imageUrl };

    if (playing) {
      if (!segmentOpen) openSegment();
      const nowPerf = performance.now();
      if (lastTickPerf > 0) {
        const delta = Math.max(0, Math.min(TICK_MS * 5, Math.round(nowPerf - lastTickPerf)));
        if (delta > 0) {
          segmentAccumMs += delta;
          dispatchTick(delta, segmentAccumMs);
        }
      }
      lastTickPerf = nowPerf;
      handleSeekIfAny(getProgressMs(getDurationMs()));
    } else {
      if (segmentOpen && lastPlaying) finalizeSegment("pause");
      lastProgressMs = getProgressMs(getDurationMs());
    }
    lastPlaying = playing;
  }

  function onProgressEvent(payload: unknown): void {
    const data = asRecord(payload)?.data ?? payload;
    let progress: number | null = null;
    if (typeof data === "number" && Number.isFinite(data)) {
      if (data > 0 && data <= 1) {
        const duration = getDurationMs();
        progress = duration ? Math.round(data * duration) : null;
      } else {
        progress = Math.round(data);
      }
    }
    if (progress == null) progress = getProgressMs(getDurationMs());
    handleSeekIfAny(progress);
  }

  function attachEvents(): void {
    if (attached) return;
    const player = getSpicetify()?.Player;
    if (!player?.addEventListener) return;
    attached = true;
    try {
      player.addEventListener("onprogress", onProgressEvent);
      player.addEventListener("onplaypause", () => {
        // Deferring one microtask lets the player settle its state.
        window.setTimeout(() => tick(), 0);
      });
    } catch {
      attached = false;
    }
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === "hidden") {
      // Player position can jump while the tab is hidden; close the segment so
      // no downtime is ever accrued.
      if (segmentOpen) finalizeSegment("hidden");
      flushStorage();
    }
  }

  function onBeforeUnload(): void {
    if (segmentOpen) finalizeSegment("unmount");
    flushStorage();
  }

  const api: ListeningTracker = {
    start() {
      if (intervalId != null) return;
      attachEvents();
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("beforeunload", onBeforeUnload);
      intervalId = window.setInterval(tick, TICK_MS);
      tick();
    },
    stop() {
      if (intervalId != null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (segmentOpen) finalizeSegment("stop");
      flushStorage();
    },
    flush() {
      if (segmentOpen) finalizeSegment("unmount");
      flushStorage();
    },
    getLiveAccrualMs() {
      return segmentOpen ? segmentAccumMs : 0;
    },
    isRunning() {
      return intervalId != null;
    },
  };

  window.__statswinTracker = api;
  return api;
}

/**
 * Returns the singleton tracker without starting it (used by the UI).
 */
export function getListeningTracker(): ListeningTracker {
  return createListeningTracker();
}
