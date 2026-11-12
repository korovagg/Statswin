/**
 * Shared Statswin domain types.
 *
 * Since schema v3 there are two shapes in circulation:
 *  - `Session` is the in-memory, fully resolved session (v2-compatible, used by
 *    every UI component and aggregator);
 *  - `StoredSession` is the compact on-disk representation that references the
 *    track registry by id. The storage layer exchanges one for the other.
 */

export type TrackInfo = {
  uri: string;
  name: string;
  artist: string;
  artistUri?: string;
  imageUrl?: string;
};

/**
 * Fully resolved listening session (one continuous playback segment).
 */
export type Session = {
  start: number;
  end: number;
  track: TrackInfo;
  playId?: string;
};

/**
 * Compact session persisted in `statswin.sessions.v3`.
 */
export type StoredSession = {
  id: string;
  start: number;
  end: number;
  trackId: string;
  playId?: string;
};

/**
 * Track registry entry persisted in `statswin.tracks.v3`.
 */
export type TrackRecord = {
  name: string;
  artist: string;
  artistUri?: string;
  imageUrl?: string;
};

/**
 * Daily aggregate for sessions older than the retention window.
 */
export type DailyRollup = {
  ms: number;
  plays: number;
  trackCount: number;
  artistCount: number;
};

/**
 * Aggregation by day: local `YYYY-MM-DD` key plus total milliseconds.
 */
export type DayAggregate = {
  date: string;
  ms: number;
};

/**
 * Generic chart point (day, month, year or hour bucket) with a display label.
 */
export type ChartPoint = {
  label: string;
  ms: number;
};

/**
 * Identifies how the chart buckets the selected range.
 */
export type ChartGranularity = "hour" | "day" | "month" | "year";

/**
 * Ready-to-render chart model for a given range.
 */
export type ChartSeries = {
  granularity: ChartGranularity;
  points: ChartPoint[];
};

/**
 * Reusable backup envelope produced by the "Backup" action and accepted by import.
 */
export type BackupFileV3 = {
  schema: 3;
  app: "statswin";
  exportedAt: string;
  sessions: StoredSession[];
  tracks: Record<string, TrackRecord>;
  dailyRollups: Record<string, DailyRollup>;
};
