import React from "react";
import { useRef, useState } from "react";
import styles from "../css/app.module.scss";
import {
  clearAllSessions,
  importBackupEnvelope,
  loadDailyRollups,
  loadSessions,
  loadTrackRegistry,
} from "../utils/storage";
import type { Session } from "../types";
import { useI18n, Locale } from "../utils/i18n";
import { BackupIcon } from "./icons/BackupIcon";
import { ImportIcon } from "./icons/ImportIcon";
import { validateImportPayload } from "../utils/importValidator";
import { backupFilename, buildBackupPayload, buildDiagnosticsPayload, downloadJson } from "../utils/backup";
import { getAppVersion } from "../version";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type PendingImport = {
  text: string;
  sessionCount: number;
};

/**
 * Settings dialog: language, backup, validated import (merge/replace) and reset.
 */
export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { t, lang, setLang } = useI18n();
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const closeAndReset = () => {
    setConfirmReset(false);
    setPending(null);
    setMessage(null);
    onClose();
  };

  const handleReset = () => {
    clearAllSessions();
    setConfirmReset(false);
    closeAndReset();
  };

  const handleBackup = () => {
    const registry = loadTrackRegistry();
    const sessions = loadSessions().map((session: Session) => ({
      id: `${session.start.toString(36)}-${Math.floor(session.end - session.start).toString(36)}-${session.track.uri.slice(-8)}`,
      start: session.start,
      end: session.end,
      trackId: session.track.uri,
      playId: session.playId,
    }));
    downloadJson(backupFilename(), buildBackupPayload(sessions, registry, loadDailyRollups()));
  };

  const handleDiagnostics = () => {
    const logs = Array.isArray(window.__statswinLogs) ? (window.__statswinLogs as unknown[]) : [];
    downloadJson(
      `statswin-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
      buildDiagnosticsPayload(logs, getAppVersion())
    );
  };

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);
    try {
      const text = await file.text();
      const validated = validateImportPayload(text);
      if (!validated.ok) {
        setMessage({ kind: "error", text: t(validated.errorKey) });
        return;
      }
      setPending({ text, sessionCount: validated.sessions.length });
    } catch {
      setMessage({ kind: "error", text: t("settings.import.error.read") });
    }
  };

  const runImport = () => {
    if (!pending) return;
    const validated = validateImportPayload(pending.text);
    if (!validated.ok) {
      setMessage({ kind: "error", text: t(validated.errorKey) });
      setPending(null);
      return;
    }
    const result = importBackupEnvelope(
      { sessions: validated.sessions, rollupsRecord: validated.rollups },
      importMode,
      skipDuplicates
    );
    setMessage({ kind: "info", text: t("settings.import.done", { added: result.added, skipped: result.skipped }) });
    setPending(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") closeAndReset();
  };

  return (
    <div
      id="statswin-settings-modal"
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="statswin-settings-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeAndReset();
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className={styles.modal}>
        <button type="button" className={styles.modalClose} onClick={closeAndReset} aria-label={t("settings.close")}>
          ×
        </button>
        <h2 id="statswin-settings-title" className={styles.modalTitle}>
          {t("settings.title")}
        </h2>

        <div className={styles.modalBody}>
          {confirmReset ? (
            <>
              <p className={styles.modalText}>{t("settings.reset.confirm.text")}</p>
              <div className={styles.modalActions}>
                <button type="button" className={styles.dangerButton} onClick={handleReset}>
                  {t("settings.reset.confirm.ok")}
                </button>
                <button type="button" className={styles.filterButton} onClick={() => setConfirmReset(false)}>
                  {t("settings.reset.confirm.cancel")}
                </button>
              </div>
            </>
          ) : pending ? (
            <>
              <p className={styles.modalText}>{t("settings.import.summary", { count: pending.sessionCount })}</p>
              <fieldset className={styles.radioGroup}>
                <label>
                  <input
                    type="radio"
                    name="statswin-import-mode"
                    checked={importMode === "merge"}
                    onChange={() => setImportMode("merge")}
                  />
                  {t("settings.import.merge")}
                </label>
                <label>
                  <input
                    type="radio"
                    name="statswin-import-mode"
                    checked={importMode === "replace"}
                    onChange={() => setImportMode("replace")}
                  />
                  {t("settings.import.replace")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(event) => setSkipDuplicates(event.target.checked)}
                  />
                  {t("settings.import.skipDupes")}
                </label>
              </fieldset>
              <div className={styles.modalActions}>
                <button type="button" className={styles.filterButton} onClick={runImport}>
                  {t("settings.import.confirm")}
                </button>
                <button type="button" className={styles.filterButton} onClick={() => setPending(null)}>
                  {t("settings.import.cancel")}
                </button>
              </div>
            </>
          ) : (
            <>
              {message && (
                <p
                  className={message.kind === "error" ? styles.messageError : styles.messageInfo}
                  role={message.kind === "error" ? "alert" : "status"}
                >
                  {message.text}
                </p>
              )}

              <div className={styles.modalActions}>
                <button type="button" className={styles.filterButton} onClick={handleBackup}>
                  <BackupIcon />
                  {t("settings.backup")}
                </button>
                <button type="button" className={styles.filterButton} onClick={() => fileInputRef.current?.click()}>
                  <ImportIcon />
                  {t("settings.import")}
                </button>
                <input
                  ref={fileInputRef}
                  id="statswin-import-file"
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={onFileChange}
                />
              </div>

              <div className={styles.modalSectionTitle}>{t("settings.language.title")}</div>
              <div className={styles.modalActions} role="radiogroup" aria-label={t("settings.language.title")}>
                {(["en", "ru"] as Locale[]).map((code) => (
                  <label key={code} className={styles.filterButton}>
                    <input
                      type="radio"
                      name="statswin-lang"
                      checked={lang === code}
                      onChange={() => setLang(code)}
                    />
                    {t(`settings.language.${code}`)}
                  </label>
                ))}
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.filterButton} onClick={handleDiagnostics}>
                  {t("settings.diagnostics")}
                </button>
              </div>

              <p className={styles.modalText}>{t("settings.reset.text")}</p>
              <button type="button" className={styles.dangerButton} onClick={() => setConfirmReset(true)}>
                {t("settings.reset.button")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
