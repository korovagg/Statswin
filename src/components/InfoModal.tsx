import React from "react";
import { useEffect, useId } from "react";
import styles from "../css/app.module.scss";
import { useI18n } from "../utils/i18n";
import { getAppVersion } from "../version";
import { AppIcon } from "./icons/AppIcon";

interface InfoModalProps {
  open: boolean;
  onClose: () => void;
}

const GITHUB_URL = "https://github.com/korovagg/Statswin";

/**
 * About dialog with version, author and issue links.
 */
export function InfoModal({ open, onClose }: InfoModalProps) {
  const { t } = useI18n();
  const titleId = useId().replace(/:/g, "");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      id="statswin-info-modal"
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`statswin-info-title-${titleId}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <button type="button" className={styles.modalClose} aria-label={t("settings.close")} onClick={onClose}>
          ×
        </button>

        <div className={styles.aboutHeader}>
          <AppIcon />
          <div>
            <div className={styles.aboutName}>Statswin</div>
            <div className={styles.version}>v{getAppVersion()}</div>
          </div>
        </div>
        <h2 id={`statswin-info-title-${titleId}`} className={styles.modalTitle}>
          {t("info.title")}
        </h2>
        <div className={styles.modalBody}>
          <p className={styles.modalText}>{t("info.text")}</p>
          <div className={styles.modalActions}>
            <a href="https://korowin.42web.io" target="_blank" rel="noreferrer" className={styles.filterButton}>
              {t("info.author")}
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={styles.filterButton}>
              {t("info.github")}
            </a>
            <a href={`${GITHUB_URL}/issues/new`} target="_blank" rel="noreferrer" className={styles.filterButton}>
              {t("info.reportBug")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
