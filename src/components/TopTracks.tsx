import React, { useMemo, useState } from "react";
import styles from "../css/app.module.scss";
import { Session } from "../types";
import { PeriodRange } from "../types/period";
import { useI18n } from "../utils/i18n";
import { TopItem, TopSort, aggregateTop } from "../utils/topAggregators";
import { formatDuration } from "../utils/format";
import { openUri } from "./shared";
import { Select } from "./Select";

type Props = {
  sessions: Session[];
  topRange: PeriodRange;
};

/**
 * Top tracks panel. Aggregation is centralized in `aggregateTop`, so plays are
 * counted once per `playId` and the list is sorted exactly once.
 */
export function TopTracks({ sessions, topRange }: Props) {
  const { t } = useI18n();
  const [sortBy, setSortBy] = useState<TopSort>("plays");
  const [expanded, setExpanded] = useState(false);

  const items = useMemo(() => aggregateTop(sessions, "track", sortBy), [sessions, sortBy]);
  const visible = expanded ? items : items.slice(0, 5);
  const hasRows = items.length > 0;

  return (
    <Panel
      title={t("top.tracks.title")}
      sortBy={sortBy}
      onSortChange={setSortBy}
      hasRows={hasRows}
      coverUrl={visible[0]?.imageUrl}
      topRange={topRange}
    >
      {visible.map((item, index) => (
        <TopRow
          key={item.key}
          item={item}
          index={index}
          subtitle={item.subtitle}
          onOpen={() => openUri(item.uri)}
        />
      ))}
      {!hasRows && <div className={styles.emptyState}>{t("top.empty")}</div>}
      {items.length > 5 && (
        <button
          type="button"
          className={styles.panelToggle}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? t("top.showLess") : t("top.showMore")}
        </button>
      )}
    </Panel>
  );
}

function TopRow({
  item,
  index,
  subtitle,
  onOpen,
}: {
  item: TopItem;
  index: number;
  subtitle: string;
  onOpen: () => void;
}) {
  return (
    <button type="button" className={styles.listRow} onClick={onOpen} aria-label={`${item.name} - ${subtitle}`}>
      <span className={styles.listRank}>{index + 1}</span>
      <span className={styles.listThumb} aria-hidden>
        {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : null}
      </span>
      <span className={styles.listText}>
        <span className={styles.listTitle}>{item.name}</span>
        <span className={styles.listSubtitle}>{subtitle}</span>
      </span>
      <span className={styles.listPlays}>{item.plays}</span>
      <span className={styles.listTime}>{formatDuration(item.ms, "ms")}</span>
    </button>
  );
}

/**
 * Shared panel chrome for the two top lists: hero header with a collage of the
 * first cover, title, period caption and a compact sort menu.
 */
export function Panel({
  title,
  sortBy,
  onSortChange,
  hasRows,
  coverUrl,
  topRange,
  children,
}: {
  title: string;
  sortBy: TopSort;
  onSortChange: (next: TopSort) => void;
  hasRows: boolean;
  /** Album art of the first row, used as the panel hero image. */
  coverUrl?: string;
  topRange: PeriodRange;
  children: React.ReactNode;
}) {
  const { t, lang } = useI18n();
  const caption = new Date(topRange.start).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <span className={`${styles.panelArt} ${hasRows ? "" : styles.panelArtEmpty}`} aria-hidden>
          {coverUrl ? <img src={coverUrl} alt="" loading="lazy" /> : null}
        </span>
        <span className={styles.panelHeaderText}>
          <span className={styles.panelTitle}>{title}</span>
          <span className={styles.panelCaption}>{caption}</span>
        </span>
        <Select
          className={styles.panelSort}
          size="small"
          ariaLabel={t("top.sort.label")}
          value={sortBy}
          options={[
            { value: "plays", label: t("top.sort.plays") },
            { value: "time", label: t("top.sort.time") },
          ]}
          onChange={(next) => onSortChange(next === "time" ? "time" : "plays")}
        />
      </header>
      <div className={styles.listBody}>{children}</div>
    </section>
  );
}
