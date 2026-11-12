import React, { useMemo } from "react";
import styles from "../css/app.module.scss";
import { PeriodRange } from "../types/period";
import { useI18n } from "../utils/i18n";
import { formatDateRange, formatDuration } from "../utils/format";

type Props = {
  range: PeriodRange;
  totalMs: number;
  previousMs: number;
  previousLabel: string;
  className?: string;
};

/**
 * Hero summary tile: total listening time plus a delta against the previous
 * comparable period (never "yesterday" for every period, as before).
 */
export function StatsSummary({ range, totalMs, previousMs, previousLabel, className }: Props) {
  const { t, lang } = useI18n();

  const indicator = useMemo(() => {
    const direction = totalMs > previousMs ? 1 : totalMs < previousMs ? -1 : 0;
    return { direction, diffMs: Math.abs(totalMs - previousMs), hasComparison: previousMs > 0 };
  }, [totalMs, previousMs]);

  return (
    <section className={[styles.card, styles.hero, className].filter(Boolean).join(" ")}>
      <div className={styles.heroLabel}>{formatDateRange(range.start, range.end, lang)}</div>
      <div className={styles.heroValue}>{formatDuration(totalMs, "ms")}</div>
      <div className={styles.heroFooter}>
        <span className={styles.tileLabel}>{t("summary.listeningTime")}</span>
        {indicator.hasComparison ? (
          <span
            className={`${styles.compareLine} ${
              indicator.direction > 0
                ? styles.indicatorUp
                : indicator.direction < 0
                ? styles.indicatorDown
                : styles.indicatorFlat
            }`}
          >
            {indicator.direction > 0 ? "+" : indicator.direction < 0 ? "-" : "="}
            {formatDuration(indicator.diffMs, "ms")} {t("summary.vsPrevious", { period: previousLabel })}
          </span>
        ) : (
          <span className={styles.compareLine}>{t("summary.noComparison")}</span>
        )}
      </div>
    </section>
  );
}
