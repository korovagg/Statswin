/**
 * Minimal Spicetify runtime typings covering the shapes Statswin actually uses.
 *
 * The Spicetify client API is loosely typed and differs between versions, so the
 * deep playback structures stay `unknown` here and are narrowed defensively in
 * `services/listeningTracker.ts` (see `resolveArtistUri` / `resolveImageUrl`).
 */

export interface SpicetifyImageSource {
  url?: string;
}

export interface SpicetifyAlbumLike {
  images?: SpicetifyImageSource[];
  coverArt?: { sources?: SpicetifyImageSource[] };
}

export interface SpicetifyTrackLike {
  uri?: string;
  name?: string;
  artist?: string;
  artist_name?: string;
  artists?: Array<{ uri?: string; name?: string }>;
  album?: SpicetifyAlbumLike;
  metadata?: Record<string, string | undefined>;
  duration?: number;
  /** Common legacy field aliases seen in different Spicetify versions. */
  image_url?: string;
  imageUrl?: string;
  coverArtUrl?: string;
}

export interface SpicetifyPlayerData {
  track?: SpicetifyTrackLike;
  duration?: number;
  position?: number;
}

export interface SpicetifyPlayer {
  data?: SpicetifyPlayerData;
  isPlaying(): boolean;
  getProgress?(): number;
  addEventListener?(event: string, callback: (payload: unknown) => void): void;
}

export interface SpicetifyPlatformApi {
  PlayerAPI?: {
    /** Internal player state; shape is not part of the public API. */
    _state?: unknown;
  };
  History?: {
    push(entry: { pathname: string }): void;
  };
}

export interface SpicetifyUri {
  fromString?(uri: string): { toURLPath?(isRelative?: boolean): string } | null;
}

export interface SpicetifyGlobal {
  Player: SpicetifyPlayer;
  Platform?: SpicetifyPlatformApi;
  URI?: SpicetifyUri;
  showNotification?(message: string, isError?: boolean): void;
  React?: unknown;
  ReactDOM?: unknown;
}

declare global {
  interface Window {
    Spicetify?: SpicetifyGlobal;
    __statswinTracker?: unknown;
    __statswinLogs?: unknown;
  }
}
