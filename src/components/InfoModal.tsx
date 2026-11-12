import React, { useEffect, useId } from "react";
import styles from "../css/app.module.scss";
import { useI18n } from "../utils/i18n";
import { getAppVersion } from "../version";
import { AppIcon, BugIcon, CloseIcon, GitHubIcon, UserIcon } from "./icons";

interface InfoModalProps {
  open: boolean;
  onClose: () => void;
}

const GITHUB_URL = "https://github.com/korovagg/Statswin";

/**
 * About dialog: app mark, version, short description and external links.
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

  const links = [
    { href: "https://korowin.42web.io", label: t("info.author"), Icon: UserIcon },
    { href: GITHUB_URL, label: t("info.github"), Icon: GitHubIcon },
    { href: `${GITHUB_URL}/issues/new`, label: t("info.reportBug"), Icon: BugIcon },
  ];

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
      <div className={`${styles.modal} ${styles.infoModal}`}>
        <header className={styles.modalHeader}>
          <h2 id={`statswin-info-title-${titleId}`} className={styles.modalTitle}>
            {t("info.title")}
          </h2>
          <button type="button" className={styles.iconButton} aria-label={t("settings.close")} onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className={styles.aboutHero}>
          <span className={styles.aboutMark} aria-hidden>
            <AppIcon />
          </span>
          <div className={styles.aboutMeta}>
            <div className={styles.aboutName}>Statswin</div>
            <div className={styles.aboutVersion}>v{getAppVersion()}</div>
          </div>
        </div>

        <p className={styles.aboutText}>{t("info.text")}</p>

        <div className={styles.rowList}>
          {links.map(({ href, label, Icon }) => (
            <a key={href} href={href} target="_blank" rel="noreferrer" className={styles.actionRow}>
              <span className={styles.actionRowIcon}>
                <Icon />
              </span>
              <span className={styles.actionRowText}>
                <span className={styles.actionRowTitle}>{label}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
