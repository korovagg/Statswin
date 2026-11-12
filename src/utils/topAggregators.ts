import { Session, TrackInfo } from "../types";
import { SKIP_THRESHOLD_MS } from "../config";

/**
 * Shared aggregation primitives for the top tracks/artists lists and the
 * "extra" metrics row. Every consumer must use these so plays, skips and time
 * totals stay consistent across the UI.
 */

export type PlayGroup = {
  playId: string;
  ms: number;
  skipped: boolean;
  sessions: Session[];
};

/**
 * Groups sessions by `playId`, computing total duration and the skip flag.
 *
 * Sessions without a `playId` get a synthetic id derived from the track URI and
 * start time so they are still aggregated (and never merged together).
 */
export function groupPlays(sessions: Session[], thresholdMs = SKIP_THRESHOLD_MS): Map<string, PlayGroup> {
  const groups = new Map<string, PlayGroup>();
  for (const session of sessions) {
    const key = session.playId ?? `${session.track.uri}@${session.start}`;
    let group = groups.get(key);
    if (!group) {
      group = { playId: key, ms: 0, skipped: false, sessions: [] };
      groups.set(key, group);
    }
    group.ms += Math.max(0, session.end - session.start);
    group.sessions.push(session);
  }
  for (const group of groups.values()) {
    group.skipped = group.ms < thresholdMs;
  }
  return groups;
}

/**
 * Counts unique tracks and artists and the number of skipped plays.
 *
 * Only non-skipped plays contribute to the track/artist sets, matching the
 * previous behaviour of the extra metrics row.
 */
export function aggregateTotals(sessions: Session[], thresholdMs = SKIP_THRESHOLD_MS): {
  tracksCount: number;
  artistsCount: number;
  skippedCount: number;
} {
  const groups = groupPlays(sessions, thresholdMs);
  const trackUris = new Set<string>();
  const artists = new Set<string>();
  let skippedCount = 0;

  for (const group of groups.values()) {
    if (group.skipped) {
      skippedCount += 1;
      continue;
    }
    for (const session of group.sessions) {
      if (session.track.uri) trackUris.add(session.track.uri);
      const artistKey = artistIdentity(session.track);
      if (artistKey) artists.add(artistKey);
    }
  }

  return { tracksCount: trackUris.size, artistsCount: artists.size, skippedCount };
}

/**
 * Stable, case-insensitive artist identity, disambiguated by URI when known.
 */
export function artistIdentity(track: TrackInfo): string {
  const name = track.artist.trim().toLowerCase();
  if (!name) return "";
  return track.artistUri ? `${name}|${track.artistUri}` : name;
}

export type TopKind = "track" | "artist";
export type TopSort = "plays" | "time";

export type TopItem = {
  key: string;
  uri?: string;
  name: string;
  subtitle: string;
  plays: number;
  ms: number;
  imageUrl?: string;
};

/**
 * Builds a top list for tracks or artists.
 *
 * - `plays` counts distinct `playId`s (a seek does not create a new play);
 * - skipped plays (total under the threshold) are excluded entirely;
 * - the result is sorted once, here.
 */
export function aggregateTop(sessions: Session[], kind: TopKind, sort: TopSort): TopItem[] {
  const groups = groupPlays(sessions);
  const byKey = new Map<string, TopItem>();

  for (const group of groups.values()) {
    if (group.skipped) continue;
    const first = group.sessions[0];
    if (!first) continue;

    const key = kind === "track" ? first.track.uri : artistIdentity(first.track);
    if (!key) continue;

    let item = byKey.get(key);
    if (!item) {
      item =
        kind === "track"
          ? {
              key,
              uri: first.track.uri,
              name: first.track.name,
              subtitle: first.track.artist,
              plays: 1,
              ms: group.ms,
              imageUrl: first.track.imageUrl,
            }
          : {
              key,
              uri: first.track.artistUri,
              name: first.track.artist,
              subtitle: "",
              plays: 1,
              ms: group.ms,
              imageUrl: first.track.imageUrl,
            };
      byKey.set(key, item);
    } else {
      item.plays += 1;
      item.ms += group.ms;
      if (!item.imageUrl && first.track.imageUrl) item.imageUrl = first.track.imageUrl;
      if (kind === "track" && first.track.name) item.name = first.track.name;
      if (kind === "artist" && !item.uri && first.track.artistUri) item.uri = first.track.artistUri;
    }
  }

  const result = Array.from(byKey.values());
  if (sort === "plays") {
    result.sort((a, b) => b.plays - a.plays || b.ms - a.ms || a.name.localeCompare(b.name));
  } else {
    result.sort((a, b) => b.ms - a.ms || b.plays - a.plays || a.name.localeCompare(b.name));
  }
  return result.slice(0, 50);
}
