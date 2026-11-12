/**
 * Version shown in the UI and written into backups/diagnostics.
 *
 * Statswin ships as `2.0.0`; the version is derived from package.json so the
 * banner, the About dialog and export payloads never drift apart.
 */
import pkg from "../package.json";

export function getAppVersion(): string {
  return pkg.version ?? "0.0.0";
}

/** Marketing version without the patch segment, e.g. "2" for "2.0.0". */
export function getAppMajorVersion(): string {
  return getAppVersion().split(".")[0] ?? getAppVersion();
}
