/**
 * Minimal Spicetify runtime typings covering the shapes Statswin actually uses.
 *
 * The Spicetify client API is loosely typed and differs between versions, so the
 * deep playback structures stay `unknown` here and are narrowed defensively in
 * `services/listeningTracker.ts` (see `resolveArtistUri` / `resolveImageUrl`).
 */

export interface SpicetifyImageSource {
  url?: string;
  /** Newer clients report the image hash as `spotify:image:<hash>`. */
  label?: string;
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
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
  /** Current clients expose cover images on the item as well as on the album. */
  images?: SpicetifyImageSource[];
  metadata?: Record<string, string | undefined>;
  duration?: number;
  /** Common legacy field aliases seen in different Spicetify versions. */
  image_url?: string;
  imageUrl?: string;
  coverArtUrl?: string;
}

export interface SpicetifyPlayerData {
  /** Legacy shape; current clients use `item`. */
  track?: SpicetifyTrackLike;
  /** Currently playing context item (track/episode). */
  item?: SpicetifyTrackLike;
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
