import React, { useRef, useState } from "react";
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
import { validateImportPayload } from "../utils/importValidator";
import { backupFilename, buildBackupPayload, buildDiagnosticsPayload, downloadJson } from "../utils/backup";
import { getAppVersion } from "../version";
import { BackupIcon, CloseIcon, FileIcon, ImportIcon, TrashIcon } from "./icons";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type PendingImport = {
  text: string;
  sessionCount: number;
};

type Tab = "data" | "general";

/**
 * Settings dialog.
 *
 * Structure: a navigation rail with two panes ("Data" and "General"), grouped
 * action rows with an icon, title and description, inline import flow (mode +
 * duplicate handling + summary) and a destructive zone with confirmation.
 */
export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { t, lang, setLang } = useI18n();
  const [tab, setTab] = useState<Tab>("data");
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const closeAndReset = () => {
    setConfirmReset(false);
    setPending(null);
    setMessage(null);
    setTab("data");
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

  // A relative path keeps the file name out of the UI while still showing which
  // file the user picked (privacy: no absolute home directory paths).
  const formatFileName = (file: File): string => {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    return relative && relative.length > 0 ? relative : file.name;
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
      setPendingFileName(formatFileName(file));
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
    setMessage({ kind: "ok", text: t("settings.import.done", { added: result.added, skipped: result.skipped }) });
    setPending(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (pending) {
        setPending(null);
        return;
      }
      closeAndReset();
    }
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
      <div className={`${styles.modal} ${styles.settingsModal}`}>
        <header className={styles.modalHeader}>
          <h2 id="statswin-settings-title" className={styles.modalTitle}>
            {t("settings.title")}
          </h2>
          <button
            type="button"
            className={styles.iconButton}
            onClick={closeAndReset}
            aria-label={t("settings.close")}
          >
            <CloseIcon />
          </button>
        </header>

        <div className={styles.settingsLayout}>
          <nav className={styles.settingsNav} role="tablist" aria-label={t("settings.title")}>
            {(
              [
                { id: "data" as Tab, label: t("settings.tab.data") },
                { id: "general" as Tab, label: t("settings.tab.general") },
              ]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`${styles.settingsNavItem} ${tab === item.id ? styles.settingsNavItemActive : ""}`}
                onClick={() => {
                  setTab(item.id);
                  setMessage(null);
                  setPending(null);
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className={styles.settingsPane} role="tabpanel">
            {message && (
              <div
                className={message.kind === "error" ? styles.alertError : styles.alertOk}
                role={message.kind === "error" ? "alert" : "status"}
              >
                {message.text}
              </div>
            )}

            {tab === "data" &&
              (pending ? (
                <section className={styles.paneSection}>
                  <div className={styles.paneSectionTitle}>{t("settings.import.title")}</div>
                  <p className={styles.paneSectionText}>
                    {t("settings.import.summary", { count: pending.sessionCount, file: pendingFileName })}
                  </p>

                  <fieldset className={styles.optionList}>
                    <legend className={styles.optionLegend}>{t("settings.import.mode")}</legend>
                    <label className={styles.option}>
                      <input
                        type="radio"
                        name="statswin-import-mode"
                        checked={importMode === "merge"}
                        onChange={() => setImportMode("merge")}
                      />
                      <span>
                        <span className={styles.optionTitle}>{t("settings.import.merge")}</span>
                        <span className={styles.optionHint}>{t("settings.import.mergeHint")}</span>
                      </span>
                    </label>
                    <label className={styles.option}>
                      <input
                        type="radio"
                        name="statswin-import-mode"
                        checked={importMode === "replace"}
                        onChange={() => setImportMode("replace")}
                      />
                      <span>
                        <span className={styles.optionTitle}>{t("settings.import.replace")}</span>
                        <span className={styles.optionHint}>{t("settings.import.replaceHint")}</span>
                      </span>
                    </label>
                    <label className={`${styles.option} ${importMode === "replace" ? styles.optionDisabled : ""}`}>
                      <input
                        type="checkbox"
                        checked={skipDuplicates}
                        disabled={importMode === "replace"}
                        onChange={(event) => setSkipDuplicates(event.target.checked)}
                      />
                      <span className={styles.optionTitle}>{t("settings.import.skipDupes")}</span>
                    </label>
                  </fieldset>

                  <div className={styles.paneActions}>
                    <button type="button" className={styles.primaryButton} onClick={runImport}>
                      {t("settings.import.confirm")}
                    </button>
                    <button type="button" className={styles.secondaryButton} onClick={() => setPending(null)}>
                      {t("settings.import.cancel")}
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <section className={styles.paneSection}>
                    <div className={styles.paneSectionTitle}>{t("settings.data.title")}</div>
                    <p className={styles.paneSectionText}>{t("settings.data.hint")}</p>

                    <div className={styles.rowList}>
                      <button type="button" className={styles.actionRow} onClick={handleBackup}>
                        <span className={styles.actionRowIcon}>
                          <BackupIcon />
                        </span>
                        <span className={styles.actionRowText}>
                          <span className={styles.actionRowTitle}>{t("settings.backup")}</span>
                          <span className={styles.actionRowHint}>{t("settings.backupHint")}</span>
                        </span>
                      </button>

                      <button
                        type="button"
                        className={styles.actionRow}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <span className={styles.actionRowIcon}>
                          <ImportIcon />
                        </span>
                        <span className={styles.actionRowText}>
                          <span className={styles.actionRowTitle}>{t("settings.import")}</span>
                          <span className={styles.actionRowHint}>{t("settings.importHint")}</span>
                        </span>
                      </button>
                      <input
                        ref={fileInputRef}
                        id="statswin-import-file"
                        type="file"
                        accept="application/json,.json"
                        hidden
                        onChange={onFileChange}
                      />

                      <button type="button" className={styles.actionRow} onClick={handleDiagnostics}>
                        <span className={styles.actionRowIcon}>
                          <FileIcon />
                        </span>
                        <span className={styles.actionRowText}>
                          <span className={styles.actionRowTitle}>{t("settings.diagnostics")}</span>
                          <span className={styles.actionRowHint}>{t("settings.diagnosticsHint")}</span>
                        </span>
                      </button>
                    </div>
                  </section>

                  <section className={`${styles.paneSection} ${styles.dangerSection}`}>
                    <div className={styles.paneSectionTitle}>{t("settings.danger.title")}</div>
                    {confirmReset ? (
                      <>
                        <p className={styles.paneSectionText}>{t("settings.reset.confirm.text")}</p>
                        <div className={styles.paneActions}>
                          <button type="button" className={styles.dangerButton} onClick={handleReset}>
                            {t("settings.reset.confirm.ok")}
                          </button>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => setConfirmReset(false)}
                          >
                            {t("settings.reset.confirm.cancel")}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className={styles.paneActions}>
                        <button type="button" className={styles.dangerButton} onClick={() => setConfirmReset(true)}>
                          <TrashIcon />
                          {t("settings.reset.button")}
                        </button>
                      </div>
                    )}
                  </section>
                </>
              ))}

            {tab === "general" && (
              <section className={styles.paneSection}>
                <div className={styles.paneSectionTitle}>{t("settings.language.title")}</div>
                <p className={styles.paneSectionText}>{t("settings.language.hint")}</p>
                <div className={styles.segmentedControl} role="radiogroup" aria-label={t("settings.language.title")}>
                  {(["en", "ru"] as Locale[]).map((code) => (
                    <label key={code} className={lang === code ? styles.segmentActive : styles.segment}>
                      <input type="radio" name="statswin-lang" checked={lang === code} onChange={() => setLang(code)} />
                      {t(`settings.language.${code}`)}
                    </label>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
