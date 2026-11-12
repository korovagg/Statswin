import { TrackRecord, DailyRollup } from "../types";
import { BackupFileV3 } from "../types";

/**
 * Backup envelope creation and diagnostics export.
 */

export const BACKUP_SCHEMA = 3;

/**
 * Builds the v3 backup object written to disk.
 */
export function buildBackupPayload(
  sessions: Array<{ id: string; start: number; end: number; trackId: string; playId?: string }>,
  tracks: Record<string, TrackRecord>,
  dailyRollups: Record<string, DailyRollup>
): BackupFileV3 {
  return {
    schema: BACKUP_SCHEMA,
    app: "statswin",
    exportedAt: new Date().toISOString(),
    sessions,
    tracks,
    dailyRollups,
  };
}

/**
 * Triggers a browser download for a JSON payload.
 */
export function downloadJson(filename: string, payload: unknown): void {
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * `statswin-stats-YYYY-MM-DD.json`.
 */
export function backupFilename(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `statswin-stats-${yyyy}-${mm}-${dd}.json`;
}

/**
 * Serializes in-memory debug logs (no track metadata) for bug reports.
 */
export function buildDiagnosticsPayload(logs: unknown[], appVersion: string): Record<string, unknown> {
  return {
    app: "statswin",
    kind: "diagnostics",
    version: appVersion,
    exportedAt: new Date().toISOString(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    logs,
  };
}
