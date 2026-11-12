import React from "react";
import { useMemo, useState } from "react";
import styles from "../css/app.module.scss";
import { Session } from "../types";
import { PeriodRange } from "../types/period";
import { useI18n } from "../utils/i18n";
import { TopItem, TopSort, aggregateTop } from "../utils/topAggregators";
import { formatDateRange, formatDuration } from "../utils/format";
import { openUri } from "./shared";

type Props = {
  sessions: Session[];
  topRange: PeriodRange;
};

/**
 * Top tracks panel. Aggregation is centralized in `aggregateTop`, so plays are
 * counted once per `playId` and the list is sorted exactly once.
 */
export function TopTracks({ sessions, topRange }: Props) {
  const { t, lang } = useI18n();
  const [sortBy, setSortBy] = useState<TopSort>("plays");
  const [expanded, setExpanded] = useState(false);

  const items = useMemo(() => aggregateTop(sessions, "track", sortBy), [sessions, sortBy]);
  const visible = expanded ? items : items.slice(0, 5);

  return (
    <section className={styles.topInner}>
      <div className={styles.topHeaderRow}>
        <h2 className={styles.topTitle}>{t("top.tracks.title")}</h2>
        <div className={styles.dateRangeSmall}>{formatDateRange(topRange.start, topRange.end, lang)}</div>
        <select
          className={styles.sortSelect}
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value === "time" ? "time" : "plays")}
          aria-label={t("top.sort.label")}
        >
          <option value="plays">{t("top.sort.plays")}</option>
          <option value="time">{t("top.sort.time")}</option>
        </select>
      </div>

      <div className={styles.topList}>
        {visible.map((item, index) => (
          <TopRow key={item.key} item={item} index={index} onOpen={() => openUri(item.uri)} />
        ))}
        {items.length === 0 && <div className={styles.emptyState}>{t("top.empty")}</div>}
        {items.length > 5 && (
          <button
            type="button"
            className={styles.topToggle}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? t("top.showLess") : t("top.showMore")}
          </button>
        )}
      </div>
    </section>
  );
}

function TopRow({ item, index, onOpen }: { item: TopItem; index: number; onOpen: () => void }) {
  return (
    <button type="button" className={styles.topRow} onClick={onOpen} aria-label={`${item.name} — ${item.subtitle}`}>
      <div className={styles.topAvatar} aria-hidden>
        {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <div className={styles.topAvatarFallback} />}
      </div>
      <div className={styles.topIndex}>{index + 1}</div>
      <div className={styles.topMeta}>
        <div className={styles.topPrimary}>{item.name}</div>
        <div className={styles.topSecondary}>{item.subtitle}</div>
      </div>
      <div className={styles.topCounters}>
        <div className={styles.topCounter}>{item.plays}</div>
        <div className={styles.topTime}>{formatDuration(item.ms, "ms")}</div>
      </div>
    </button>
  );
}
