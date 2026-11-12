/**
 * Compatibility facade over the schema v3 storage layer.
 *
 * Components and services import from `utils/storage`; the heavy lifting lives
 * in `services/storageV3`.
 */
export type {
  Session,
  StoredSession,
  TrackInfo,
  TrackRecord,
  DailyRollup,
  DayAggregate,
  ChartPoint,
} from "../types";

export {
  addSession,
  aggregateMsByDay,
  buildChartSeries,
  clearAllSessions,
  earliestDataTimestamp,
  flushStorage,
  getSessionsInRange,
  getTotalMsInRange,
  handleExternalStorageChange,
  hasDetailedSessionsSince,
  importBackupEnvelope,
  loadDailyRollups,
  loadSessions,
  loadTrackRegistry,
  mergeSessions,
  migrateV2ToV3,
  parseImportPayload,
  pickGranularity,
  rangeTouchesRollups,
  replaceSessions,
  trimSessionsOlderThan,
} from "../services/storageV3";
