/**
 * Album art helpers.
 *
 * Spotify exposes cover images differently across client versions:
 * an `https://i.scdn.co/image/...` URL in older builds and a
 * `spotify:image:<hash>` URI in newer ones. Stored data must be one canonical
 * shape, so everything is normalized to https here.
 */

const COVER_HOST = "https://i.scdn.co/image/";
/** Maximum stored cover URL length (keeps localStorage lean). */
const MAX_COVER_LENGTH = 512;
/** Inline data images are only produced by the local screenshot harness. */
const MAX_INLINE_COVER_LENGTH = 256;

const IMAGE_URI_PATTERN = /^spotify:image:([A-Za-z0-9]+)$/;
const IMAGE_URL_PATTERN = /^https:\/\/i\.scdn\.co\/image\/([A-Za-z0-9]+)$/;

/**
 * Converts a `spotify:image:<hash>` URI into the https cover URL.
 *
 * Returns `null` when the value is not an image URI.
 */
export function imageUriToUrl(value: string): string | null {
  const match = IMAGE_URI_PATTERN.exec(value.trim());
  return match?.[1] ? `${COVER_HOST}${match[1]}` : null;
}

/**
 * Same Spotify image hash from either an image URI or a cover URL, or `null`.
 */
export function imageHash(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return IMAGE_URI_PATTERN.exec(trimmed)?.[1] ?? IMAGE_URL_PATTERN.exec(trimmed)?.[1] ?? null;
}

/**
 * Normalizes any cover reference into a storable https (or inline data) URL.
 *
 * Unknown schemes are rejected so a malformed player value cannot end up in
 * the track registry.
 */
export function normalizeCoverUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  const fromUri = imageUriToUrl(trimmed);
  if (fromUri) return fromUri;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.length <= MAX_COVER_LENGTH ? trimmed : undefined;
  }
  if (/^data:image\//i.test(trimmed)) {
    return trimmed.length <= MAX_INLINE_COVER_LENGTH ? trimmed : undefined;
  }
  return undefined;
}

/**
 * Picks the best cover from a Spotify image list.
 *
 * Entries usually carry a `label` (`small`/`standard`/`large`/`xlarge`) and a
 * `maxWidth`; prefer the largest sensible one for a 36px thumbnail.
 */
export function pickCoverFromImages(images: unknown): string | undefined {
  if (!Array.isArray(images)) return undefined;
  const entries = images
    .map((image) => {
      const record = image as Record<string, unknown> | null;
      if (!record) return null;
      const raw = record.url;
      if (typeof raw !== "string") return null;
      const url = normalizeCoverUrl(raw);
      if (!url) return null;
      const width =
        typeof record.maxWidth === "number"
          ? record.maxWidth
          : typeof record.width === "number"
          ? record.width
          : 0;
      return { url, width };
    })
    .filter((entry): entry is { url: string; width: number } => entry != null);

  if (entries.length === 0) return undefined;

  // Cap at 640px: enough for a 2x thumbnail without pulling 2000px assets.
  const sorted = [...entries].sort((a, b) => a.width - b.width);
  return (sorted.find((entry) => entry.width >= 300 && entry.width <= 640) ?? sorted[sorted.length - 1])?.url;
}
