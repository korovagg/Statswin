import React, { useMemo, useState } from "react";
import { Session } from "../types";
import { PeriodRange } from "../types/period";
import { useI18n } from "../utils/i18n";
import { TopSort, aggregateTop } from "../utils/topAggregators";
import { formatDuration } from "../utils/format";
import { openUri, searchFor } from "./shared";
import { Panel } from "./TopTracks";
import styles from "../css/app.module.scss";

type Props = {
  sessions: Session[];
  topRange: PeriodRange;
};

/**
 * Top artists panel.
 *
 * Artist identity is normalized in `aggregateTop` (`lowercase name + URI`), so
 * "Daft Punk" / "daft punk" no longer split plays and listening time.
 */
export function TopArtists({ sessions, topRange }: Props) {
  const { t } = useI18n();
  const [sortBy, setSortBy] = useState<TopSort>("plays");
  const [expanded, setExpanded] = useState(false);

  const items = useMemo(() => aggregateTop(sessions, "artist", sortBy), [sessions, sortBy]);
  const visible = expanded ? items : items.slice(0, 5);
  const hasRows = items.length > 0;

  return (
    <Panel
      title={t("top.artists.title")}
      sortBy={sortBy}
      onSortChange={setSortBy}
      hasRows={hasRows}
      coverUrl={visible[0]?.imageUrl}
      topRange={topRange}
    >
      {visible.map((item, index) => (
        <button
          key={item.key}
          type="button"
          className={styles.listRow}
          onClick={() => (item.uri ? openUri(item.uri) : searchFor(item.name))}
          aria-label={item.name}
        >
          <span className={styles.listRank}>{index + 1}</span>
          <span className={`${styles.listThumb} ${styles.listThumbRound}`} aria-hidden>
            {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : null}
          </span>
          <span className={styles.listText}>
            <span className={styles.listTitle}>{item.name}</span>
            <span className={styles.listSubtitle}>{t("top.artists.subtitle")}</span>
          </span>
          <span className={styles.listPlays}>{item.plays}</span>
          <span className={styles.listTime}>{formatDuration(item.ms, "ms")}</span>
        </button>
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
