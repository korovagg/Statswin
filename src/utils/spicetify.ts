import type { SpicetifyGlobal } from "../spicetify";

/**
 * Returns the global Spicetify client API, or `null` when running outside Spotify.
 *
 * Always prefer this accessor over `(window as any).Spicetify` so the typed
 * surface stays in one place.
 */
export function getSpicetify(): SpicetifyGlobal | null {
  if (typeof window === "undefined") return null;
  const spicetify = window.Spicetify;
  return spicetify && typeof spicetify === "object" ? spicetify : null;
}
