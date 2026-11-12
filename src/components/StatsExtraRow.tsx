import React from "react";
import { useMemo } from "react";
import styles from "../css/app.module.scss";
import { Session } from "../types";
import { useI18n } from "../utils/i18n";
import { aggregateTotals } from "../utils/topAggregators";
import { rangeTouchesRollups } from "../utils/storage";
import { formatCount } from "../utils/format";

type Props = {
  sessions: Session[];
  rangeStart: number;
};

/**
 * Secondary metrics: unique tracks, unique artists and skipped tracks.
 *
 * Uses the shared `aggregateTotals` helper so the skip threshold lives in one
 * place. When the range reaches past the 90-day retention window the identity
 * based counts can only cover detailed sessions, which the hint explains.
 */
export function StatsExtraRow({ sessions, rangeStart }: Props) {
  const { t, lang } = useI18n();

  const totals = useMemo(() => aggregateTotals(sessions), [sessions]);
  const partial = useMemo(() => rangeTouchesRollups(rangeStart), [rangeStart]);

  return (
    <div className={styles.metricGrid}>
      <div className={styles.tile}>
        <div className={styles.tilePrimaryValue}>{formatCount(totals.tracksCount, lang)}</div>
        <div className={styles.tileLabel}>{t("extra.tracksCount")}</div>
      </div>
      <div className={styles.tile}>
        <div className={styles.tilePrimaryValue}>{formatCount(totals.artistsCount, lang)}</div>
        <div className={styles.tileLabel}>{t("extra.artistsCount")}</div>
      </div>
      <div className={styles.tile}>
        <div className={styles.tilePrimaryValue}>{formatCount(totals.skippedCount, lang)}</div>
        <div className={styles.tileLabel}>{t("extra.skippedCount")}</div>
      </div>
      {partial && <div className={styles.rollupNote}>{t("extra.rollupNote")}</div>}
    </div>
  );
}
