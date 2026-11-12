/**
 * Application-wide constants.
 */

/**
 * Earliest year that Statswin treats as valid listening history.
 * Sessions before this boundary are filtered out of every range query.
 */
export const SERVICE_START_YEAR = 2025;

/**
 * Number of days of detailed sessions kept in `statswin.sessions.v3`.
 * Older sessions are compacted into `statswin.dailyRollups.v3`.
 */
export const RETENTION_DAYS = 90;

/**
 * A play shorter than this (total across its segments) counts as a skip.
 */
export const SKIP_THRESHOLD_MS = 10_000;

/**
 * Debounce window between `localStorage` flushes.
 */
export const SAVE_DEBOUNCE_MS = 5_000;

export const STORAGE_KEYS = {
  schema: "statswin.schema",
  sessions: "statswin.sessions.v3",
  tracks: "statswin.tracks.v3",
  dailyRollups: "statswin.dailyRollups.v3",
  language: "statswin_language",
  /** Legacy v2 keys, only read during migration. */
  legacySessions: "statswin.sessions",
  legacyResetFlag: "statswin.reset.v2",
  /** Safety copy of the v2 payload, removed automatically after a while. */
  legacyBackup: "statswin.sessions.backup",
} as const;

export const STORAGE_SCHEMA_VERSION = 3;

/**
 * Maximum accepted import file size (20 MiB).
 */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

/**
 * Maximum number of debug log entries kept in memory.
 */
export const MAX_DEBUG_LOGS = 200;
