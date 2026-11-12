import React, { useEffect, useMemo, useRef, useState } from "react";
import { PeriodType, PeriodRange } from "../types/period";
import { fromISODateLocal, getMonthLabels, rangeForMonth, rangeForYear, toISODateLocal } from "../utils/dateRanges";
import { SERVICE_START_YEAR } from "../config";
import { useI18n } from "../utils/i18n";
import { ChevronDownIcon } from "./icons";
import { Select, SelectOption } from "./Select";
import styles from "../css/app.module.scss";

/**
 * Period selector.
 *
 * Layout contract (keeps the header on a single visual line):
 *  - a compact preset trigger ("Today ▾") opens a popover with every period;
 *  - the sub-controls (year, month, custom dates) replace the trigger in place
 *    instead of wrapping onto a second row;
 *  - the app-level actions (Info / Settings) live in the app header, not here.
 */
interface FilterBarProps {
  period: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  customRange: PeriodRange;
  onCustomRangeChange: (range: PeriodRange) => void;
}

const PRESETS: Array<{ period: PeriodType; labelKey: string }> = [
  { period: PeriodType.Today, labelKey: "period.today" },
  { period: PeriodType.Yesterday, labelKey: "period.yesterday" },
  { period: PeriodType.Week, labelKey: "period.week" },
  { period: PeriodType.Month, labelKey: "period.month" },
  { period: PeriodType.Year, labelKey: "period.year" },
  { period: PeriodType.Custom, labelKey: "period.custom" },
];

export default function FilterBar(props: FilterBarProps) {
  const { period, onPeriodChange, customRange, onCustomRangeChange } = props;
  const { t, lang } = useI18n();

  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date(customRange.start).getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date(customRange.start).getMonth());
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const timerRef = useRef<number | null>(null);

  // Re-arm the rollover timer once per year instead of polling.
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

  // Keep the year/month sub-panels in sync with the range chosen elsewhere
  // (for example when the summary resets the range on period entry).
  useEffect(() => {
    const start = new Date(customRange.start);
    setSelectedYear(start.getFullYear());
    setSelectedMonth(start.getMonth());
  }, [customRange.start]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let year = SERVICE_START_YEAR; year <= currentYear; year += 1) years.push(year);
    return years.reverse();
  }, [currentYear]);

  const monthLabels = useMemo(() => getMonthLabels(lang), [lang]);

  const yearOptions = useMemo<SelectOption[]>(
    () => availableYears.map((year) => ({ value: String(year), label: String(year) })),
    [availableYears]
  );

  const monthOptions = useMemo<SelectOption[]>(
    () => monthLabels.map((label, index) => ({ value: String(index), label })),
    [monthLabels]
  );
  const currentPresetLabel = t(PRESETS.find((preset) => preset.period === period)?.labelKey ?? "period.today");

  const selectPeriod = (next: PeriodType) => {
    setMenuOpen(false);
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
    if (start > end) [start, end] = [end, start];
    onPeriodChange(PeriodType.Custom);
    onCustomRangeChange({ start, end });
  };

  return (
    <div className={styles.periodControl} ref={rootRef}>
      <div className={styles.segmented} role="group" aria-label={t("filter.ariaToolbar")}>
        <button
          ref={triggerRef}
          type="button"
          className={`${styles.chip} ${styles.chipTrigger} ${menuOpen ? styles.chipActive : ""}`}
          aria-haspopup="listbox"
          aria-label={t("filter.ariaToolbar")}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {currentPresetLabel}
          <ChevronDownIcon className={styles.chipIcon} />
        </button>

        {period === PeriodType.Year && (
          <Select
            className={styles.inlineSelect}
            ariaLabel={t("period.year")}
            value={String(selectedYear)}
            options={yearOptions}
            onChange={(next) => {
              const year = Number(next);
              setSelectedYear(year);
              onCustomRangeChange(rangeForYear(year));
            }}
          />
        )}

        {period === PeriodType.Month && (
          <>
            <Select
              className={styles.inlineSelect}
              ariaLabel={t("filter.date.year")}
              value={String(selectedYear)}
              options={yearOptions}
              onChange={(next) => {
                const year = Number(next);
                setSelectedYear(year);
                onCustomRangeChange(rangeForMonth(year, selectedMonth));
              }}
            />
            <Select
              className={styles.inlineSelect}
              ariaLabel={t("period.month")}
              value={String(selectedMonth)}
              options={monthOptions}
              onChange={(next) => {
                const month = Number(next);
                setSelectedMonth(month);
                onCustomRangeChange(rangeForMonth(selectedYear, month));
              }}
            />
          </>
        )}

        {period === PeriodType.Custom && (
          <div className={styles.dateRange}>
            <input
              type="date"
              className={styles.dateInput}
              value={toISODateLocal(customRange.start)}
              aria-label={t("filter.date.start")}
              onChange={(event) => handleDateChange("start", event.target.value)}
            />
            <span className={styles.dateSeparator} aria-hidden>
              –
            </span>
            <input
              type="date"
              className={styles.dateInput}
              value={toISODateLocal(customRange.end)}
              aria-label={t("filter.date.end")}
              onChange={(event) => handleDateChange("end", event.target.value)}
            />
          </div>
        )}
      </div>

      {menuOpen && (
        <ul className={styles.menu} role="listbox" aria-label={t("filter.ariaToolbar")} tabIndex={-1}>
          {PRESETS.map((preset) => {
            const selected = preset.period === period;
            return (
              <li key={preset.period}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`${styles.menuItem} ${selected ? styles.menuItemActive : ""}`}
                  onClick={() => selectPeriod(preset.period)}
                >
                  {t(preset.labelKey)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
