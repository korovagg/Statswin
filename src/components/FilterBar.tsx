import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PeriodType, PeriodRange } from "../types/period";
import { fromISODateLocal, getMonthLabels, rangeForMonth, rangeForYear, toISODateLocal } from "../utils/dateRanges";
import { SERVICE_START_YEAR } from "../config";
import { SettingsIcon } from "./icons/SettingsIcon";
import { useI18n } from "../utils/i18n";
import { InfoIcon } from "./icons/InfoIcon";
import styles from "../css/app.module.scss";

/**
 * Component FilterBar:
 * Renders the period presets, the year/month/custom sub-panels and the
 * settings/info triggers exactly once.
 *
 * It is rendered inline in the app header (no portal): the previous portal
 * implementation duplicated the toolbar and therefore duplicated every modal id.
 */
interface FilterBarProps {
  period: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  customRange: PeriodRange;
  onCustomRangeChange: (range: PeriodRange) => void;
  onOpenSettings: () => void;
  onOpenInfo: () => void;
}

export default function FilterBar(props: FilterBarProps) {
  const { period, onPeriodChange, customRange, onCustomRangeChange, onOpenSettings, onOpenInfo } = props;
  const { t, lang } = useI18n();

  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const schedule = () => {
      const now = new Date();
      const nextYear = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 1, 0);
      timerRef.current = window.setTimeout(() => {
        setCurrentYear(new Date().getFullYear());
        schedule();
      }, Math.max(1000, nextYear.getTime() - now.getTime()));
    };
    schedule();
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let year = SERVICE_START_YEAR; year <= currentYear; year += 1) years.push(year);
    return years.reverse();
  }, [currentYear]);

  const monthLabels = useMemo(() => getMonthLabels(lang), [lang]);

  const handlePresetClick = (next: PeriodType) => {
    onPeriodChange(next);
    if (next === PeriodType.Year) {
      const year = new Date().getFullYear();
      setSelectedYear(year);
      onCustomRangeChange(rangeForYear(year));
    } else if (next === PeriodType.Month) {
      const now = new Date();
      setSelectedYear(now.getFullYear());
      setSelectedMonth(now.getMonth());
      onCustomRangeChange(rangeForMonth(now.getFullYear(), now.getMonth()));
    }
  };

  const handleDateChange = (which: "start" | "end", value: string) => {
    const parsed = fromISODateLocal(value, which);
    if (parsed == null) return;
    let start = which === "start" ? parsed : customRange.start;
    let end = which === "end" ? parsed : customRange.end;
    if (start > end) {
      [start, end] = [end, start];
    }
    onPeriodChange(PeriodType.Custom);
    onCustomRangeChange({ start, end });
  };

  const PresetButton = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      className={`${styles.filterButton} ${active ? styles.filterActive : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
  );

  const presets: Array<{ period: PeriodType; labelKey: string }> = [
    { period: PeriodType.Today, labelKey: "period.today" },
    { period: PeriodType.Yesterday, labelKey: "period.yesterday" },
    { period: PeriodType.Week, labelKey: "period.week" },
    { period: PeriodType.Month, labelKey: "period.month" },
    { period: PeriodType.Year, labelKey: "period.year" },
    { period: PeriodType.Custom, labelKey: "period.custom" },
  ];

  return (
    <div className={styles.filterBar} role="toolbar" aria-label={t("filter.ariaToolbar")}>
      <div className={styles.filterButtons}>
        {presets.map(({ period: preset, labelKey }) => (
          <PresetButton
            key={preset}
            active={period === preset}
            label={t(labelKey)}
            onClick={() => handlePresetClick(preset)}
          />
        ))}
      </div>

      <button
        type="button"
        className={styles.iconButton}
        onClick={onOpenInfo}
        aria-label={t("filter.info")}
        aria-haspopup="dialog"
        aria-controls="statswin-info-modal"
      >
        <InfoIcon />
      </button>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onOpenSettings}
        aria-label={t("filter.settings")}
        aria-haspopup="dialog"
        aria-controls="statswin-settings-modal"
      >
        <SettingsIcon />
      </button>

      {period === PeriodType.Year && (
        <div className={styles.filterPanel} role="group" aria-label={t("period.year")}>
          <div className={styles.filterRow}>
            {availableYears.map((year) => (
              <PresetButton
                key={year}
                active={selectedYear === year}
                label={String(year)}
                onClick={() => {
                  setSelectedYear(year);
                  onCustomRangeChange(rangeForYear(year));
                }}
              />
            ))}
          </div>
        </div>
      )}

      {period === PeriodType.Month && (
        <div className={styles.filterPanel} role="group" aria-label={t("period.month")}>
          <div className={styles.filterRow}>
            {monthLabels.map((label, index) => (
              <PresetButton
                key={`${index}-${label}`}
                active={selectedMonth === index}
                label={label}
                onClick={() => {
                  setSelectedMonth(index);
                  onCustomRangeChange(rangeForMonth(selectedYear, index));
                }}
              />
            ))}
          </div>
        </div>
      )}

      {period === PeriodType.Custom && (
        <div className={styles.filterPanel}>
          <div className={styles.dateInputs}>
            <label>
              {t("filter.date.start")}
              <input
                type="date"
                value={toISODateLocal(customRange.start)}
                onChange={(event) => handleDateChange("start", event.target.value)}
              />
            </label>
            <label>
              {t("filter.date.end")}
              <input
                type="date"
                value={toISODateLocal(customRange.end)}
                onChange={(event) => handleDateChange("end", event.target.value)}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
