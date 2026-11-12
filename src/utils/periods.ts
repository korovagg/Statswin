import { PeriodType, PeriodRange } from "../types/period";
import { ChartSeries } from "../types";
import { getDefaultRangeForPeriod, getPreviousRange } from "../utils/dateRanges";
import { buildChartSeries, pickGranularity } from "../utils/storage";
import type { Locale } from "../utils/i18n";

/**
 * Single source of truth for "what the chart shows for this period".
 *
 * Today/Yesterday → hourly buckets, Week/Month → days, Year → months,
 * Custom → automatic (days, months or years depending on the span).
 */
export function getChartSeries(period: PeriodType, range: PeriodRange, lang: Locale): ChartSeries {
  const isSingleDay = period === PeriodType.Today || period === PeriodType.Yesterday;
  const granularity = pickGranularity(range, isSingleDay);
  return buildChartSeries(range, granularity, lang);
}

/**
 * Translation key describing the chart for the current period.
 */
export function getChartTitleKey(period: PeriodType, range: PeriodRange): string {
  switch (period) {
    case PeriodType.Today:
      return "chart.title.todayHours";
    case PeriodType.Yesterday:
      return "chart.title.yesterdayHours";
    case PeriodType.Week:
      return "chart.title.weekDays";
    case PeriodType.Month:
      return "chart.title.monthDays";
    case PeriodType.Year:
      return "chart.title.yearMonths";
    case PeriodType.Custom: {
      const granularity = pickGranularity(range, false);
      if (granularity === "year") return "chart.title.yearMonths";
      if (granularity === "month") return "chart.title.custom";
      return "chart.title.monthDays";
    }
    default:
      return "chart.title.monthDays";
  }
}

/**
 * Translation key for the label of the comparison period.
 */
export function getPreviousPeriodLabelKey(period: PeriodType): string {
  switch (period) {
    case PeriodType.Today:
      return "period.previous.today";
    case PeriodType.Yesterday:
      return "period.previous.yesterday";
    case PeriodType.Week:
      return "period.previous.week";
    case PeriodType.Month:
      return "period.previous.month";
    case PeriodType.Year:
      return "period.previous.year";
    case PeriodType.Custom:
    default:
      return "period.previous.custom";
  }
}

/**
 * The range displayed by the summary for a preset period.
 */
export function resolvePeriodRange(period: PeriodType, customRange: PeriodRange): PeriodRange {
  if (period === PeriodType.Month || period === PeriodType.Year || period === PeriodType.Custom) {
    return customRange;
  }
  return getDefaultRangeForPeriod(period);
}

/**
 * Comparison range for the summary tile.
 */
export function resolvePreviousRange(period: PeriodType, range: PeriodRange): PeriodRange {
  return getPreviousRange(range, period);
}
