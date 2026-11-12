/**
 * Import validation helpers.
 *
 * Parsing lives in `storageV3.parseImportPayload`; this module keeps the shape
 * checks that can run before any storage is touched.
 */
import { MAX_IMPORT_BYTES } from "../config";
import { DailyRollup } from "../types";

export type ImportValidationResult =
  | { ok: true; sessions: unknown[]; rollups: Record<string, DailyRollup> }
  | { ok: false; errorKey: string };

/**
 * Validates a backup text payload and returns its session list.
 *
 * Accepts the v3 envelope (`{ schema, sessions, tracks, dailyRollups }`) and the
 * legacy v2 bare array. The heavy sanitizing happens when the sessions are
 * actually written.
 */
export function validateImportPayload(text: string): ImportValidationResult {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { ok: false, errorKey: "settings.import.error.invalidJson" };
  }
  if (byteLength(text) > MAX_IMPORT_BYTES) {
    return { ok: false, errorKey: "settings.import.error.tooLarge" };
  }

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
    if (Array.isArray(envelope.sessions)) {
      const rollups =
        envelope.dailyRollups && typeof envelope.dailyRollups === "object"
          ? (envelope.dailyRollups as Record<string, DailyRollup>)
          : {};
      return { ok: true, sessions: envelope.sessions, rollups };
    }
  }

  return { ok: false, errorKey: "settings.import.error.invalidShape" };
}

/**
 * Counts UTF-8 bytes without allocating a full copy where possible.
 */
function byteLength(text: string): number {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).length;
  return text.length * 2;
}
