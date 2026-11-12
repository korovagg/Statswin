/**
 * Formatting helpers shared by every component.
 *
 * All date formatting is local-time based (`DD.MM.YYYY`) for a consistent
 * Russian/European reading order regardless of the UI language.
 */

/**
 * Formats milliseconds as compact `M:SS` (e.g. `4:07`).
 */
export function formatMinSec(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export type DurationUnit = "auto" | "hm" | "ms";

/**
 * Formats a duration with a selectable unit.
 *
 * - `hm`   → `3h 12m`
 * - `ms`   → `12m 05s`
 * - `auto` → picks the most readable form (days/hours/minutes/seconds).
 */
export function formatDuration(ms: number, unit: DurationUnit = "auto"): string {
  const safe = Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (unit === "hm") {
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
  if (unit === "ms") {
    return `${hours * 60 + minutes}m ${String(seconds).padStart(2, "0")}s`;
  }

  if (totalSeconds >= 86400) {
    const days = Math.floor(totalSeconds / 86400);
    const restHours = Math.floor((totalSeconds % 86400) / 3600);
    return `${days}d ${restHours}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

/**
 * Formats a timestamp as local `DD.MM.YYYY`.
 *
 * `lang` is accepted for API symmetry with range formatting; the numeric order
 * is intentionally locale-independent.
 */
export function formatDate(ts: number, _lang?: string): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * Formats a range as `DD.MM.YYYY — DD.MM.YYYY`, collapsing identical days.
 */
export function formatDateRange(start: number, end: number, lang?: string): string {
  const startLabel = formatDate(start, lang);
  const endLabel = formatDate(end, lang);
  if (startLabel === endLabel) return startLabel;
  return `${startLabel} — ${endLabel}`;
}

/**
 * Formats a 0..1 ratio as a whole percentage.
 */
export function formatPercent(ratio: number): string {
  const safe = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  return `${Math.round(safe * 100)}%`;
}

/**
 * Formats an integer with locale-aware group separators.
 */
export function formatCount(value: number, lang = "en"): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  try {
    return new Intl.NumberFormat(lang).format(safe);
  } catch {
    return String(safe);
  }
}
