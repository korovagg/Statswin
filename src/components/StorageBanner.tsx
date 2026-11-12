import React from "react";
import { useEffect, useState } from "react";
import styles from "../css/app.module.scss";
import { useI18n } from "../utils/i18n";
import { trimSessionsOlderThan } from "../utils/storage";

type BannerState =
  | { kind: "none" }
  | { kind: "quota" }
  | { kind: "migration"; count: number }
  | { kind: "migrationFailed" };

/**
 * Header banner that surfaces storage problems (quota, migration results).
 *
 * Listens to `statswin:storage-warning`; quota warnings offer a one-click
 * "free up space" action that compacts sessions older than 30 days.
 */
export function CheckLimitsBanner() {
  const { t } = useI18n();
  const [banner, setBanner] = useState<BannerState>({ kind: "none" });

  useEffect(() => {
    const onWarning = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: string; count?: number }>).detail;
      switch (detail?.reason) {
        case "quota":
          setBanner({ kind: "quota" });
          break;
        case "migration":
          setBanner({ kind: "migration", count: detail.count ?? 0 });
          break;
        case "migrationFailed":
          setBanner({ kind: "migrationFailed" });
          break;
        default:
          break;
      }
    };
    window.addEventListener("statswin:storage-warning", onWarning);
    return () => window.removeEventListener("statswin:storage-warning", onWarning);
  }, []);

  if (banner.kind === "none") return null;

  const dismiss = () => setBanner({ kind: "none" });

  let message = "";
  if (banner.kind === "quota") message = t("storage.warning.quota");
  if (banner.kind === "migration") message = t("storage.warning.migration", { count: banner.count });
  if (banner.kind === "migrationFailed") message = t("storage.warning.migrationFailed");

  return (
    <div className={styles.storageBanner} role="status" aria-live="polite">
      <span className={styles.storageBannerText}>{message}</span>
      {banner.kind === "quota" && (
        <button
          type="button"
          className={styles.storageBannerAction}
          onClick={() => {
            trimSessionsOlderThan(30);
            dismiss();
          }}
        >
          {t("storage.warning.freeSpace")}
        </button>
      )}
      <button
        type="button"
        className={styles.storageBannerClose}
        onClick={dismiss}
        aria-label={t("settings.close")}
      >
        ×
      </button>
    </div>
  );
}
