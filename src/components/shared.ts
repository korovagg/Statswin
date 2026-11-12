import { PeriodRange } from "../types/period";
import { getSpicetify } from "../utils/spicetify";

/**
 * Shared list plumbing for the Top tracks / Top artists panels.
 */

/**
 * Converts a Spotify URI into a navigable app path.
 */
export function uriToPath(uri: string): string | null {
  try {
    const path = getSpicetify()?.URI?.fromString?.(uri)?.toURLPath?.(true);
    if (typeof path === "string" && path.length > 0) return path.startsWith("/") ? path : `/${path}`;
  } catch {
    // Fall through to the URI-based fallback below.
  }
  const match = /^spotify:(track|album|artist):([a-zA-Z0-9]+)$/.exec(uri);
  if (match) return `/${match[1]}/${match[2]}`;
  return null;
}

/**
 * Navigates the Spotify shell to a pathname.
 */
export function navigateTo(pathname: string | null): void {
  if (!pathname) return;
  try {
    getSpicetify()?.Platform?.History?.push({ pathname });
  } catch {
    // Navigation is a progressive enhancement.
  }
}

/**
 * Convenience wrapper: navigate to whatever `uri` points at.
 */
export function openUri(uri: string | undefined): void {
  if (!uri) return;
  navigateTo(uriToPath(uri));
}

/**
 * Searches for a free-text term (used for artists without a URI).
 */
export function searchFor(term: string): void {
  navigateTo(`/search/${encodeURIComponent(term)}`);
}

export type TopListProps = {
  topRange: PeriodRange;
};
