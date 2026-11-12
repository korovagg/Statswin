import {
  ChartPoint,
  DailyRollup,
  Session,
  StoredSession,
  TrackInfo,
  TrackRecord,
} from "../types";
import { ChartGranularity, ChartSeries } from "../types";
import { MAX_IMPORT_BYTES, RETENTION_DAYS, SERVICE_START_YEAR, STORAGE_KEYS, STORAGE_SCHEMA_VERSION } from "../config";
import { dateKey, getHourlyBuckets, rangeForMonth, rangeForYear, toISODateLocal } from "../utils/dateRanges";
import { Locale, getCurrentLanguage } from "../utils/i18n";
import { normalizeCoverUrl } from "../utils/covers";

/**
 * Statswin storage, schema v3.
 *
 * Layout (everything in `localStorage` under Spotify's origin):
 *  - `statswin.sessions.v3`     compact sessions for the last RETENTION_DAYS
 *  - `statswin.tracks.v3`       de-duplicated track registry keyed by URI
 *  - `statswin.dailyRollups.v3` per-day aggregates for sessions older than that
 *  - `statswin.schema`          current schema version marker
 *
 * Sessions are kept in memory (split into detailed sessions and pre-aggregated
 * daily rollups) and written back with a debounce, so hot loops no longer touch
 * `localStorage` on every tick.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

interface StoreState {
  sessions: Session[];
  tracks: Record<string, TrackRecord>;
  rollups: Record<string, DailyRollup>;
}

const EMPTY_STATE: StoreState = { sessions: [], tracks: {}, rollups: {} };

let state: StoreState | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistRequested = false;

/**
 * Emits a window event, ignoring environments where CustomEvent is unavailable.
 */
function emit(name: string, detail?: unknown): void {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    // Best-effort UI notification only.
  }
}

/**
 * Reports a non-fatal storage problem so the header can show a banner.
 */
function warnStorage(reason: "quota" | "migration" | "migrationFailed", detail?: unknown): void {
  try {
    console.warn(`[Statswin] storage warning: ${reason}`, detail ?? "");
  } catch {
    // console may be unavailable in restricted contexts.
  }
  emit("statswin:storage-warning", { reason, ...(typeof detail === "object" && detail ? detail : {}) });
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    warnStorage("quota", { key, error: String(error) });
    return false;
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore: removal is not critical.
  }
}

/**
 * Parses JSON, returning `null` on any failure.
 */
function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function clampNumber(value: unknown, min: number, max: number): number | null {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Lower bound (inclusive) for any stored timestamp.
 */
function minAllowedTimestamp(): number {
  return new Date(SERVICE_START_YEAR, 0, 1, 0, 0, 0, 0).getTime();
}

/**
 * Trims album art URLs that would waste the storage budget.
 *
 * Spotify serves covers as https URLs. Inline `data:` images are accepted but
 * bounded much tighter; they only appear in local tooling and tests.
 */
function sanitizeImageUrl(url: unknown): string | undefined {
  // Stored covers are always https URLs; older builds could contain a
  // `spotify:image:<hash>` URI, which is converted during normalization.
  return normalizeCoverUrl(url);
}

/**
 * Normalizes a raw track object coming from v2 data or an import file.
 */
function sanitizeTrack(raw: unknown): TrackInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const track = raw as Record<string, unknown>;
  const uri = track.uri;
  if (!isNonEmptyString(uri)) return null;
  return {
    uri: uri.trim(),
    name: isNonEmptyString(track.name) ? track.name.trim() : uri.trim(),
    artist: isNonEmptyString(track.artist) ? track.artist.trim() : "",
    artistUri: isNonEmptyString(track.artistUri) ? track.artistUri.trim() : undefined,
    imageUrl: sanitizeImageUrl(track.imageUrl),
  };
}

/**
 * Sanitizes a v2-style session object into the fully resolved v3 shape.
 */
function sanitizeLegacySession(raw: unknown): Session | null {
  if (!raw || typeof raw !== "object") return null;
  const session = raw as Record<string, unknown>;
  const start = clampNumber(session.start, minAllowedTimestamp(), Number.MAX_SAFE_INTEGER);
  const end = clampNumber(session.end, minAllowedTimestamp(), Number.MAX_SAFE_INTEGER);
  if (start == null || end == null || end <= start) return null;
  const track = sanitizeTrack(session.track);
  if (!track) return null;
  const playId = isNonEmptyString(session.playId) ? session.playId : undefined;
  return { start, end, track, playId };
}

/**
 * Sanitizes a compact stored session, resolving the track from the registry.
 */
function sanitizeStoredSession(raw: unknown, tracks: Record<string, TrackRecord>): Session | null {
  if (!raw || typeof raw !== "object") return null;
  const session = raw as Record<string, unknown>;
  const start = clampNumber(session.start, minAllowedTimestamp(), Number.MAX_SAFE_INTEGER);
  const end = clampNumber(session.end, minAllowedTimestamp(), Number.MAX_SAFE_INTEGER);
  if (start == null || end == null || end <= start) return null;
  const trackId = isNonEmptyString(session.trackId) ? session.trackId : undefined;
  if (!trackId) return null;
  const record = tracks[trackId];
  if (!record) return null;
  return {
    start,
    end,
    playId: isNonEmptyString(session.playId) ? session.playId : undefined,
    track: {
      uri: trackId,
      name: record.name,
      artist: record.artist,
      artistUri: record.artistUri,
      imageUrl: record.imageUrl,
    },
  };
}

/**
 * Returns the local midnight timestamp for `RETENTION_DAYS` ago.
 */
function retentionBoundary(now = Date.now()): number {
  return now - RETENTION_DAYS * DAY_MS;
}

/**
 * Splits a session into per-day chunks, honoring local day boundaries and DST.
 */
function forEachDaySlice(session: Session, from: number, to: number, cb: (dayKey: string, ms: number) => void): void {
  const clampedStart = Math.max(session.start, from);
  const clampedEnd = Math.min(session.end, to);
  if (clampedEnd <= clampedStart) return;
  let cursor = clampedStart;
  while (cursor < clampedEnd) {
    const key = dateKey(cursor);
    const nextDay = new Date(cursor);
    nextDay.setHours(24, 0, 0, 0);
    const segmentEnd = Math.min(clampedEnd, nextDay.getTime());
    const ms = segmentEnd - cursor;
    if (ms > 0) cb(key, ms);
    cursor = segmentEnd;
  }
}

/**
 * Computes plays/unique tracks/unique artists per day for a set of sessions.
 */
function rollupFromSessions(sessions: Session[]): Record<string, DailyRollup> {
  const byDay = new Map<string, { ms: number; playIds: Set<string>; tracks: Set<string>; artists: Set<string> }>();
  for (const session of sessions) {
    forEachDaySlice(session, 0, Number.MAX_SAFE_INTEGER, (key, ms) => {
      let bucket = byDay.get(key);
      if (!bucket) {
        bucket = { ms: 0, playIds: new Set(), tracks: new Set(), artists: new Set() };
        byDay.set(key, bucket);
      }
      bucket.ms += ms;
      if (session.playId) bucket.playIds.add(session.playId);
      bucket.tracks.add(session.track.uri);
      const artistKey = artistIdentity(session.track);
      if (artistKey) bucket.artists.add(artistKey);
    });
  }
  const result: Record<string, DailyRollup> = {};
  for (const [key, bucket] of byDay) {
    result[key] = {
      ms: bucket.ms,
      plays: bucket.playIds.size,
      trackCount: bucket.tracks.size,
      artistCount: bucket.artists.size,
    };
  }
  return result;
}

/**
 * Stable identity for an artist, tolerant of case variants.
 */
function artistIdentity(track: TrackInfo): string {
  const name = track.artist.trim().toLowerCase();
  const uri = track.artistUri ? `|${track.artistUri}` : "";
  return `${name}${uri}`;
}

/**
 * Compacts sessions older than the retention window into daily rollups.
 * Mutates `sessions` (removing the compacted ones) and returns the rollups.
 */
function compactState(next: StoreState, now = Date.now()): void {
  const boundary = retentionBoundary(now);
  const old: Session[] = [];
  const recent: Session[] = [];
  for (const session of next.sessions) {
    if (session.end <= boundary) old.push(session);
    else recent.push(session);
  }
  if (old.length === 0) return;

  const freshRollups = rollupFromSessions(old);
  for (const [key, rollup] of Object.entries(freshRollups)) {
    const existing = next.rollups[key];
    if (!existing) {
      next.rollups[key] = rollup;
    } else {
      next.rollups[key] = {
        ms: existing.ms + rollup.ms,
        plays: existing.plays + rollup.plays,
        trackCount: Math.max(existing.trackCount, rollup.trackCount),
        artistCount: Math.max(existing.artistCount, rollup.artistCount),
      };
    }
  }
  next.sessions = recent;

  // Drop registry rows that are no longer referenced by any detailed session.
  const referenced = new Set(recent.map((session) => session.track.uri));
  for (const uri of Object.keys(next.tracks)) {
    if (!referenced.has(uri)) delete next.tracks[uri];
  }
}

/**
 * Registers a track in the registry, preserving the freshest metadata.
 */
function rememberTrack(tracks: Record<string, TrackRecord>, track: TrackInfo): void {
  const existing = tracks[track.uri];
  tracks[track.uri] = {
    name: track.name || existing?.name || "",
    artist: track.artist || existing?.artist || "",
    artistUri: track.artistUri || existing?.artistUri,
    imageUrl: track.imageUrl || existing?.imageUrl,
  };
}

/**
 * Serializes the in-memory state into the three v3 keys.
 */
function persistNow(): void {
  if (!state) return;
  const boundary = retentionBoundary();
  const storedSessions: StoredSession[] = state.sessions
    .filter((session) => session.end > boundary)
    .map((session) => ({
      id: `${session.start.toString(36)}-${Math.floor(session.end - session.start).toString(36)}-${session.track.uri.slice(-8)}`,
      start: session.start,
      end: session.end,
      trackId: session.track.uri,
      playId: session.playId,
    }));

  const okSessions = safeSet(STORAGE_KEYS.sessions, JSON.stringify(storedSessions));
  const okTracks = safeSet(STORAGE_KEYS.tracks, JSON.stringify(state.tracks));
  const okRollups = safeSet(STORAGE_KEYS.dailyRollups, JSON.stringify(state.rollups));
  if (okSessions && okTracks && okRollups) {
    safeSet(STORAGE_KEYS.schema, String(STORAGE_SCHEMA_VERSION));
  }
}

/**
 * Requests a debounced write; repeated calls inside the window coalesce.
 */
function schedulePersist(): void {
  if (persistTimer != null) return;
  persistRequested = true;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (!persistRequested) return;
    persistRequested = false;
    persistNow();
  }, 5000);
}

/**
 * Writes immediately and clears any pending debounce.
 */
export function flushStorage(): void {
  if (persistTimer != null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistRequested = false;
  persistNow();
}

/**
 * Loads v3 data from `localStorage` (or migrates v2, see `migrateV2ToV3`).
 */
function loadState(): StoreState {
  if (state) return state;

  const schema = safeGet(STORAGE_KEYS.schema);
  if (schema !== String(STORAGE_SCHEMA_VERSION)) {
    state = EMPTY_STATE;
    return state;
  }

  const tracks = parseJson<Record<string, TrackRecord>>(safeGet(STORAGE_KEYS.tracks)) ?? {};
  const sanitizedTracks: Record<string, TrackRecord> = {};
  for (const [uri, record] of Object.entries(tracks)) {
    const info = sanitizeTrack({ uri, ...record });
    if (info) rememberTrack(sanitizedTracks, info);
  }

  const storedSessions = parseJson<StoredSession[]>(safeGet(STORAGE_KEYS.sessions)) ?? [];
  const sessions = Array.isArray(storedSessions)
    ? storedSessions
        .map((raw) => sanitizeStoredSession(raw, sanitizedTracks))
        .filter((session): session is Session => session != null)
        .sort((a, b) => a.start - b.start)
    : [];

  const rawRollups = parseJson<Record<string, DailyRollup>>(safeGet(STORAGE_KEYS.dailyRollups)) ?? {};
  const rollups: Record<string, DailyRollup> = {};
  for (const [key, rollup] of Object.entries(rawRollups)) {
    if (!rollup || typeof rollup !== "object") continue;
    const ms = clampNumber(rollup.ms, 0, Number.MAX_SAFE_INTEGER);
    if (ms == null) continue;
    rollups[key] = {
      ms,
      plays: clampNumber(rollup.plays, 0, Number.MAX_SAFE_INTEGER) ?? 0,
      trackCount: clampNumber(rollup.trackCount, 0, Number.MAX_SAFE_INTEGER) ?? 0,
      artistCount: clampNumber(rollup.artistCount, 0, Number.MAX_SAFE_INTEGER) ?? 0,
    };
  }

  state = { sessions, tracks: sanitizedTracks, rollups };
  return state;
}

function getState(): StoreState {
  return loadState();
}

/**
 * Drops the in-memory cache so the next read re-parses `localStorage`.
 */
function invalidateCache(): void {
  state = null;
}

/**
 * One-time migration from the v2 (`statswin.sessions`) schema.
 *
 * The original v2 payload is preserved under `statswin.sessions.backup` and the
 * legacy reset flag is deleted so a downgrade cannot trigger another wipe.
 */
export function migrateV2ToV3(): { migrated: boolean; count: number } {
  const schema = safeGet(STORAGE_KEYS.schema);
  if (schema === String(STORAGE_SCHEMA_VERSION)) return { migrated: false, count: 0 };

  // Always remove the v2 reset flag: it could otherwise wipe data on a downgrade.
  safeRemove(STORAGE_KEYS.legacyResetFlag);

  const legacyRaw = safeGet(STORAGE_KEYS.legacySessions);
  const legacy = parseJson<unknown[]>(legacyRaw);
  const legacySessions = Array.isArray(legacy)
    ? legacy.map(sanitizeLegacySession).filter((s): s is Session => s != null)
    : [];

  const next: StoreState = { sessions: [], tracks: {}, rollups: {} };
  const now = Date.now();
  const boundary = retentionBoundary(now);
  const oldSessions: Session[] = [];

  for (const session of legacySessions) {
    rememberTrack(next.tracks, session.track);
    if (session.end <= boundary) oldSessions.push(session);
    else next.sessions.push(session);
  }
  next.sessions.sort((a, b) => a.start - b.start);

  if (oldSessions.length > 0) {
    const rollups = rollupFromSessions(oldSessions);
    next.rollups = rollups;
    const referenced = new Set(next.sessions.map((session) => session.track.uri));
    for (const uri of Object.keys(next.tracks)) {
      if (!referenced.has(uri)) delete next.tracks[uri];
    }
  }

  // Keep a safety copy of the raw v2 payload before replacing anything.
  if (legacyRaw && legacyRaw.length > 0) {
    safeSet(STORAGE_KEYS.legacyBackup, JSON.stringify({ savedAt: now, raw: legacyRaw }));
  }

  const previous = state;
  state = next;
  const schemaWritten = safeSet(STORAGE_KEYS.schema, String(STORAGE_SCHEMA_VERSION));
  if (!schemaWritten) {
    state = previous;
    warnStorage("migrationFailed");
    return { migrated: false, count: 0 };
  }
  persistNow();

  // Only drop the legacy keys after the new ones are safely written.
  safeRemove(STORAGE_KEYS.legacySessions);

  if (next.sessions.length > 0 || oldSessions.length > 0) {
    emit("statswin:storage-warning", { reason: "migration", count: next.sessions.length + oldSessions.length });
  }
  return { migrated: true, count: next.sessions.length + oldSessions.length };
}

/**
 * Returns detailed sessions that overlap [start, end], sorted by start.
 */
export function getSessionsInRange(start: number, end: number): Session[] {
  const { sessions } = getState();
  const minStart = Math.max(start, minAllowedTimestamp());
  if (end < minStart) return [];
  return sessions.filter((session) => Math.max(session.start, minStart) <= Math.min(session.end, end));
}

/**
 * Returns every detailed session (used by backup export).
 */
export function loadSessions(): Session[] {
  return [...getState().sessions];
}

/**
 * Returns the track registry (used by backup export and diagnostics).
 */
export function loadTrackRegistry(): Record<string, TrackRecord> {
  return { ...getState().tracks };
}

/**
 * Returns the daily rollups (used by backup export).
 */
export function loadDailyRollups(): Record<string, DailyRollup> {
  return { ...getState().rollups };
}

/**
 * Appends a finished session to the in-memory store and schedules a flush.
 */
export function addSession(session: Session): void {
  const sanitized = sanitizeLegacySession(session);
  if (!sanitized) return;
  const current = getState();
  rememberTrack(current.tracks, sanitized.track);
  current.sessions.push(sanitized);
  current.sessions.sort((a, b) => a.start - b.start);
  compactState(current);
  schedulePersist();
  emit("statswin:session-added", sanitized);
}

/**
 * Replaces the whole store with an imported set of sessions.
 */
export function replaceSessions(sessions: Session[]): number {
  const next = buildStateFromSessions(sessions, {});
  state = next;
  flushStorage();
  emit("statswin:session-added", { reason: "import" });
  return next.sessions.length;
}

/**
 * Appends imported sessions to the current store.
 *
 * `skipDuplicates` drops sessions whose `(uri, start, end)` triple already exists.
 */
export function mergeSessions(
  sessions: Session[],
  options: { skipDuplicates: boolean }
): { added: number; skipped: number } {
  const current = getState();
  const seen = new Set<string>();
  if (options.skipDuplicates) {
    for (const session of current.sessions) {
      seen.add(sessionKey(session));
    }
  }

  let added = 0;
  let skipped = 0;
  for (const session of sessions) {
    const sanitized = sanitizeLegacySession(session);
    if (!sanitized) {
      skipped += 1;
      continue;
    }
    if (options.skipDuplicates) {
      const key = sessionKey(sanitized);
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
    }
    rememberTrack(current.tracks, sanitized.track);
    current.sessions.push(sanitized);
    added += 1;
  }
  current.sessions.sort((a, b) => a.start - b.start);
  compactState(current);
  flushStorage();
  emit("statswin:session-added", { reason: "import" });
  return { added, skipped };
}

function sessionKey(session: Session): string {
  return `${session.track.uri}|${session.start}|${session.end}`;
}

/**
 * Builds a store state from a list of sessions plus optional rollups.
 */
function buildStateFromSessions(
  sessions: Session[],
  rollups: Record<string, DailyRollup>
): StoreState {
  const next: StoreState = { sessions: [], tracks: {}, rollups: { ...rollups } };
  for (const session of sessions) {
    const sanitized = sanitizeLegacySession(session);
    if (!sanitized) continue;
    rememberTrack(next.tracks, sanitized.track);
    next.sessions.push(sanitized);
  }
  next.sessions.sort((a, b) => a.start - b.start);
  compactState(next);
  return next;
}

/**
 * Imports a parsed v3 backup envelope (or a bare v2 session array).
 */
export function importBackupEnvelope(
  envelope: { sessions: unknown[]; rollupsRecord?: Record<string, DailyRollup> },
  mode: "merge" | "replace",
  skipDuplicates: boolean
): { added: number; skipped: number } {
  const tracks = getState().tracks;
  const sessions = envelope.sessions
    .map((raw) => sanitizeStoredSession(raw, tracks) ?? sanitizeLegacySession(raw))
    .filter((session): session is Session => session != null);

  if (mode === "replace") {
    const added = replaceSessions(sessions);
    const skipped = envelope.sessions.length - added;
    return { added, skipped };
  }
  return mergeSessions(sessions, { skipDuplicates });
}

/**
 * Clears every stored datum (sessions, registry and rollups).
 */
export function clearAllSessions(): void {
  state = { sessions: [], tracks: {}, rollups: {} };
  if (persistTimer != null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistNow();
  emit("statswin:session-added", { reason: "manual_reset" });
}

/**
 * Drops detailed sessions older than `days` to free up quota.
 */
export function trimSessionsOlderThan(days: number): number {
  const current = getState();
  const boundary = Date.now() - Math.max(0, days) * DAY_MS;
  const removed = current.sessions.filter((session) => session.end <= boundary);
  if (removed.length === 0) return 0;
  const rollups = rollupFromSessions(removed);
  for (const [key, rollup] of Object.entries(rollups)) {
    const existing = current.rollups[key];
    current.rollups[key] = existing
      ? {
          ms: existing.ms + rollup.ms,
          plays: existing.plays + rollup.plays,
          trackCount: Math.max(existing.trackCount, rollup.trackCount),
          artistCount: Math.max(existing.artistCount, rollup.artistCount),
        }
      : rollup;
  }
  current.sessions = current.sessions.filter((session) => session.end > boundary);
  flushStorage();
  emit("statswin:session-added", { reason: "trim" });
  return removed.length;
}

/**
 * Total listening time in a range, combining rollups and detailed sessions.
 */
export function getTotalMsInRange(start: number, end: number): number {
  const minStart = Math.max(start, minAllowedTimestamp());
  if (end < minStart) return 0;
  let total = 0;

  const { rollups, sessions } = getState();
  for (const [key, rollup] of Object.entries(rollups)) {
    const dayStart = new Date(`${key}T00:00:00`).getTime();
    if (!Number.isFinite(dayStart)) continue;
    const dayEnd = dayStart + DAY_MS - 1;
    if (dayEnd < minStart || dayStart > end) continue;
    if (dayStart >= minStart && dayEnd <= end) {
      total += rollup.ms;
    } else {
      const overlap = Math.min(dayEnd, end) - Math.max(dayStart, minStart) + 1;
      total += Math.max(0, overlap);
    }
  }
  for (const session of sessions) {
    total += Math.max(0, Math.min(session.end, end) - Math.max(session.start, minStart));
  }
  return total;
}

/**
 * Aggregates listening time per local day for the given range.
 */
export function aggregateMsByDay(sessions: Session[], start: number, end: number): { date: string; ms: number }[] {
  const byDay = new Map<string, number>();
  for (const session of sessions) {
    forEachDaySlice(session, start, end, (key, ms) => {
      byDay.set(key, (byDay.get(key) ?? 0) + ms);
    });
  }
  return Array.from(byDay.entries())
    .map(([date, ms]) => ({ date, ms }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Determines the chart bucketing for a range: hours, days, months or years.
 */
export function pickGranularity(period: { start: number; end: number }, isSingleDay: boolean): ChartGranularity {
  if (isSingleDay) return "hour";
  const span = period.end - period.start;
  const startDate = new Date(period.start);
  const endDate = new Date(period.end);
  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;
  if (span > 2 * 366 * DAY_MS || months > 24) return "year";
  if (months > 1) return "month";
  return "day";
}

/**
 * Builds chart points for a range at the requested granularity.
 */
export function buildChartSeries(
  range: { start: number; end: number },
  granularity: ChartGranularity,
  lang?: string
): ChartSeries {
  const locale: string = lang ?? getCurrentLanguage();
  switch (granularity) {
    case "hour":
      return { granularity, points: buildHourlyPoints(range) };
    case "month":
      return { granularity, points: buildMonthlyPoints(range, locale) };
    case "year":
      return { granularity, points: buildYearlyPoints(range) };
    case "day":
    default:
      return { granularity: "day", points: buildDailyPoints(range, locale) };
  }
}

function formatHourLabel(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

function buildHourlyPoints(range: { start: number; end: number }): ChartPoint[] {
  const { sessions, rollups } = getState();
  const buckets = getHourlyBuckets(range);
  const totals = buckets.map(() => 0);

  const accumulate = (from: number, to: number) => {
    const bucketStart = Math.floor((from - range.start) / (60 * 60 * 1000));
    const bucketEnd = Math.floor((to - range.start) / (60 * 60 * 1000));
    for (let index = Math.max(0, bucketStart); index <= Math.min(totals.length - 1, bucketEnd); index += 1) {
      const bucket = buckets[index];
      if (!bucket) continue;
      totals[index] = (totals[index] ?? 0) + Math.max(0, Math.min(to, bucket.end) - Math.max(from, bucket.start));
    }
  };

  for (const session of sessions) {
    accumulate(Math.max(session.start, range.start), Math.min(session.end, range.end));
  }

  // Rollups are only needed for ranges older than the retention window; their
  // per-day total is spread across the hour buckets that overlap that day.
  const minStart = minAllowedTimestamp();
  if (range.start < retentionBoundary(Date.now()) - DAY_MS) {
    for (const key of Object.keys(rollups)) {
      const dayStart = new Date(`${key}T00:00:00`).getTime();
      if (!Number.isFinite(dayStart)) continue;
      const dayEnd = dayStart + DAY_MS - 1;
      if (dayEnd < Math.max(range.start, minStart) || dayStart > range.end) continue;
      const overlap = Math.min(dayEnd, range.end) - Math.max(dayStart, range.start);
      if (overlap > 0) accumulate(Math.max(dayStart, range.start), Math.min(dayEnd, range.end));
    }
  }

  return buckets.map((bucket, index) => ({ label: formatHourLabel(bucket.start), ms: totals[index] ?? 0 }));
}

function buildDailyPoints(range: { start: number; end: number }, locale: string): ChartPoint[] {
  const byDay = new Map<string, number>();
  const { sessions, rollups } = getState();
  const minStart = Math.max(range.start, minAllowedTimestamp());

  for (const session of sessions) {
    forEachDaySlice(session, minStart, range.end, (key, ms) => {
      byDay.set(key, (byDay.get(key) ?? 0) + ms);
    });
  }

  for (const [key, rollup] of Object.entries(rollups)) {
    const dayStart = new Date(`${key}T00:00:00`).getTime();
    if (!Number.isFinite(dayStart)) continue;
    const dayEnd = dayStart + DAY_MS - 1;
    if (dayEnd < minStart || dayStart > range.end) continue;
    if (dayStart >= minStart && dayEnd <= range.end) {
      byDay.set(key, (byDay.get(key) ?? 0) + rollup.ms);
    } else {
      const overlap = Math.min(dayEnd, range.end) - Math.max(dayStart, minStart) + 1;
      if (overlap > 0) byDay.set(key, (byDay.get(key) ?? 0) + overlap);
    }
  }

  const points: ChartPoint[] = [];
  const cursor = new Date(minStart);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(range.end);
  endDay.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= endDay.getTime()) {
    const key = toISODateLocal(cursor.getTime());
    const label = cursor.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
    points.push({ label, ms: byDay.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

function buildMonthlyPoints(range: { start: number; end: number }, locale: string): ChartPoint[] {
  const byMonth = new Map<string, number>();
  const { sessions, rollups } = getState();
  const minStart = Math.max(range.start, minAllowedTimestamp());

  for (const session of sessions) {
    const from = Math.max(session.start, minStart);
    const to = Math.min(session.end, range.end);
    if (to <= from) continue;
    let cursor = from;
    while (cursor < to) {
      const d = new Date(cursor);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
      const segmentEnd = Math.min(to, nextMonth);
      byMonth.set(key, (byMonth.get(key) ?? 0) + (segmentEnd - cursor));
      cursor = segmentEnd;
    }
  }

  for (const [key, rollup] of Object.entries(rollups)) {
    const [yearStr, monthStr] = key.split("-");
    if (!yearStr || !monthStr) continue;
    // Internal month key is zero-based to match the session aggregation above.
    const normalized = `${yearStr}-${String(Number(monthStr) - 1).padStart(2, "0")}`;
    const monthStart = new Date(Number(yearStr), Number(monthStr) - 1, 1).getTime();
    const monthEnd = new Date(Number(yearStr), Number(monthStr), 0, 23, 59, 59, 999).getTime();
    if (monthEnd < minStart || monthStart > range.end) continue;
    const eligible = monthStart >= minStart && monthEnd <= range.end;
    const overlap = eligible ? rollup.ms : Math.max(0, Math.min(monthEnd, range.end) - Math.max(monthStart, minStart));
    if (overlap > 0) byMonth.set(normalized, (byMonth.get(normalized) ?? 0) + overlap);
  }

  const points: ChartPoint[] = [];
  const cursor = new Date(minStart);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  const endDate = new Date(range.end);
  endDate.setDate(1);
  endDate.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= endDate.getTime()) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth()).padStart(2, "0")}`;
    const label = cursor.toLocaleDateString(locale, { month: "short", year: "numeric" });
    points.push({ label, ms: byMonth.get(key) ?? 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return points;
}

function buildYearlyPoints(range: { start: number; end: number }): ChartPoint[] {
  const byYear = new Map<number, number>();
  const { sessions, rollups } = getState();
  const minStart = Math.max(range.start, minAllowedTimestamp());

  for (const session of sessions) {
    const from = Math.max(session.start, minStart);
    const to = Math.min(session.end, range.end);
    if (to <= from) continue;
    let cursor = from;
    while (cursor < to) {
      const year = new Date(cursor).getFullYear();
      const nextYear = new Date(year + 1, 0, 1, 0, 0, 0, 0).getTime();
      const segmentEnd = Math.min(to, nextYear);
      byYear.set(year, (byYear.get(year) ?? 0) + (segmentEnd - cursor));
      cursor = segmentEnd;
    }
  }

  for (const [key, rollup] of Object.entries(rollups)) {
    const year = Number(key.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999).getTime();
    if (yearEnd < minStart || yearStart > range.end) continue;
    const eligible = yearStart >= minStart && yearEnd <= range.end;
    const overlap = eligible ? rollup.ms : Math.max(0, Math.min(yearEnd, range.end) - Math.max(yearStart, minStart));
    if (overlap > 0) byYear.set(year, (byYear.get(year) ?? 0) + overlap);
  }

  const points: ChartPoint[] = [];
  const startYear = new Date(minStart).getFullYear();
  const endYear = new Date(range.end).getFullYear();
  for (let year = startYear; year <= endYear; year += 1) {
    points.push({ label: String(year), ms: byYear.get(year) ?? 0 });
  }
  return points;
}

/**
 * Sum of daily rollups inside a range (used for identity-based stats coverage).
 */
export function hasDetailedSessionsSince(start: number): boolean {
  const { sessions } = getState();
  return sessions.some((session) => session.end > start);
}

/**
 * Whether any data (detailed or rolled up) exists at or after `ts`.
 */
export function earliestDataTimestamp(): number | null {
  const { rollups, sessions } = getState();
  let earliest: number | null = null;
  for (const session of sessions) {
    if (earliest == null || session.start < earliest) earliest = session.start;
  }
  for (const key of Object.keys(rollups)) {
    const dayStart = new Date(`${key}T00:00:00`).getTime();
    if (Number.isFinite(dayStart) && (earliest == null || dayStart < earliest)) earliest = dayStart;
  }
  return earliest;
}

/**
 * Parses and validates a backup file body.
 *
 * Accepts the v3 envelope and a bare v2 session array.
 */
export function parseImportPayload(
  text: string
): { ok: true; sessions: unknown[]; rollups: Record<string, DailyRollup> } | { ok: false; errorKey: string } {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, errorKey: "settings.import.error.tooLarge" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errorKey: "settings.import.error.invalidJson" };
  }

  if (Array.isArray(parsed)) {
    return { ok: true, sessions: parsed, rollups: {} };
  }

  if (parsed && typeof parsed === "object") {
    const envelope = parsed as Record<string, unknown>;
    const sessions = envelope.sessions;
    if (Array.isArray(sessions)) {
      const rollups =
        envelope.dailyRollups && typeof envelope.dailyRollups === "object"
          ? (envelope.dailyRollups as Record<string, DailyRollup>)
          : {};
      return { ok: true, sessions, rollups };
    }
  }

  return { ok: false, errorKey: "settings.import.error.invalidShape" };
}

/**
 * Returns the rollups that cover a range (used by the rollup note in the UI).
 */
export function rangeTouchesRollups(start: number): boolean {
  const { rollups } = getState();
  const boundary = retentionBoundary(Date.now());
  if (start > boundary) return false;
  return Object.keys(rollups).some((key) => new Date(`${key}T00:00:00`).getTime() < boundary);
}

/**
 * Recomputes derived state after an external `localStorage` change.
 */
export function handleExternalStorageChange(key: string | null): void {
  if (
    key == null ||
    key === STORAGE_KEYS.sessions ||
    key === STORAGE_KEYS.tracks ||
    key === STORAGE_KEYS.dailyRollups
  ) {
    invalidateCache();
    emit("statswin:session-added", { reason: "external" });
  }
}

/**
 * Test/debug helper: wipes the in-memory cache without touching storage.
 */
export function __resetStorageCacheForTests(): void {
  state = null;
  if (persistTimer != null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}

export type { Locale };
export { rangeForMonth, rangeForYear };
