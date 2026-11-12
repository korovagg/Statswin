/**
 * Preset period identifiers and a millisecond range.
 */
export enum PeriodType {
  Today = "today",
  Yesterday = "yesterday",
  Week = "week",
  Month = "month",
  Year = "year",
  Custom = "custom",
}

export interface PeriodRange {
  start: number;
  end: number;
}
