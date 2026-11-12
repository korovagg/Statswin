import React from "react";
import { useId, useMemo, useRef, useState } from "react";
import styles from "../css/app.module.scss";
import { ChartPoint } from "../types";
import { useI18n } from "../utils/i18n";
import { formatMinSec } from "../utils/format";
import { useElementSize } from "../utils/useElementSize";

type Props = {
  data: ChartPoint[];
  titleKey?: string;
};

const PADDING_LEFT = 44;
const PADDING_RIGHT = 8;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 22;
const MIN_BAR_WIDTH = 24;
/** Approximate width of one 10px label character, used for label slotting. */
const LABEL_CHAR_WIDTH = 6;
/** Bars never exceed this width, so single-point ranges stay readable. */
const MAX_BAR_WIDTH = 56;

/**
 * Responsive bar chart.
 *
 * - Width and height follow the container through a ResizeObserver;
 * - X labels are thinned out when bars get narrower than MIN_BAR_WIDTH;
 * - Y axis shows 0 / 50% / max with horizontal guides;
 * - gradient ids are unique per instance (`useId`), so two charts never clash;
 * - renders an explicit empty state instead of a blank frame.
 */
export function StatsChart({ data, titleKey }: Props) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(containerRef);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, "");

  const chartWidth = Math.max(320, width);
  const chartHeight = Math.max(180, Math.min(320, height));
  const maxMs = useMemo(() => (data.length ? Math.max(...data.map((point) => point.ms)) : 0), [data]);
  const hasData = maxMs > 0;

  const plotWidth = chartWidth - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = chartHeight - PADDING_TOP - PADDING_BOTTOM;
  const barW = data.length ? plotWidth / data.length : plotWidth;
  const barPadding = Math.min(barW * 0.18, 6);
  // Keep at least MIN_LABEL_GAP pixels between rendered labels.
  const longestLabel = data.reduce((max, point) => Math.max(max, point.label.length), 0);
  const labelSlotWidth = Math.max(MIN_BAR_WIDTH, longestLabel * LABEL_CHAR_WIDTH + 10);
  const labelStep = Math.max(1, Math.ceil(labelSlotWidth / Math.max(barW, 1)));

  const gridLines = [
    { ratio: 0, label: "0" },
    { ratio: 0.5, label: formatMinSec(maxMs / 2) },
    { ratio: 1, label: formatMinSec(maxMs) },
  ];

  return (
    <div className={`${styles.card} ${styles.chartWrapper}`} ref={containerRef}>
      <div className={styles.chartTitle}>
        {t(titleKey ?? "chart.title.monthDays")} <span className={styles.chartUnit}>({t("chart.timeUnit.minsec")})</span>
      </div>

      {!hasData ? (
        <div className={styles.emptyChart} role="status">
          {t("chart.empty")}
        </div>
      ) : (
        <svg width={chartWidth} height={chartHeight} role="img" aria-label={t(titleKey ?? "chart.title.monthDays")}>
          <defs>
            <linearGradient id={`bar-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--sw-accent)", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "var(--sw-accent)", stopOpacity: 0.55 }} />
            </linearGradient>
          </defs>

          {gridLines.map((line) => {
            const y = PADDING_TOP + plotHeight * (1 - line.ratio);
            return (
              <g key={line.ratio}>
                <line
                  x1={PADDING_LEFT}
                  y1={y}
                  x2={chartWidth - PADDING_RIGHT}
                  y2={y}
                  stroke="var(--sw-chart-grid)"
                  strokeDasharray={line.ratio === 0 ? undefined : "3 4"}
                />
                <text x={PADDING_LEFT - 6} y={y + 3} fontSize="10" textAnchor="end" fill="var(--sw-muted)">
                  {line.label}
                </text>
              </g>
            );
          })}

          {data.map((point, index) => {
            const x = PADDING_LEFT + index * barW + barPadding / 2;
            const h = maxMs > 0 ? (point.ms / maxMs) * plotHeight : 0;
            const y = PADDING_TOP + plotHeight - h;
            const w = Math.max(1, barW - barPadding);
            const showLabel = index % labelStep === 0;
            // A single bar would otherwise stretch across the whole plot; keep
            // bars visually consistent with multi-point charts.
            const barWidth = Math.min(w, MAX_BAR_WIDTH);
            const barX = x + (w - barWidth) / 2;
            const highlighted = hoverIndex === index;
            return (
              <g
                key={`${index}-${point.label}`}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex((prev) => (prev === index ? null : prev))}
              >
                <rect
                  x={barX}
                  y={y}
                  width={barWidth}
                  height={Math.max(h, point.ms > 0 ? 2 : 0)}
                  rx={Math.min(4, barWidth / 2)}
                  fill={`url(#bar-${gradientId})`}
                  opacity={hoverIndex == null || highlighted ? 1 : 0.55}
                >
                  <title>{`${point.label}: ${formatMinSec(point.ms)}`}</title>
                </rect>
                {highlighted && (
                  <g>
                    <rect
                      x={Math.min(Math.max(barX + barWidth / 2 - 54, PADDING_LEFT), chartWidth - PADDING_RIGHT - 108)}
                      y={Math.max(y - 26, 2)}
                      width={108}
                      height={20}
                      rx={6}
                      fill="var(--sw-surface-2)"
                      stroke="var(--sw-border)"
                    />
                    <text
                      x={Math.min(Math.max(barX + barWidth / 2, PADDING_LEFT + 54), chartWidth - PADDING_RIGHT - 54)}
                      y={Math.max(y - 12, 16)}
                      fontSize="10"
                      fontWeight="600"
                      textAnchor="middle"
                      fill="var(--sw-text)"
                    >
                      {`${point.label} · ${formatMinSec(point.ms)}`}
                    </text>
                  </g>
                )}
                {showLabel && (
                  <text
                    x={barX + barWidth / 2}
                    y={chartHeight - 6}
                    fontSize="10"
                    textAnchor="middle"
                    fill="var(--sw-muted)"
                  >
                    {point.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
