/* eslint-disable no-console */
/**
 * Counter checks.
 *
 * Exercises the aggregation rules on the compiled sources by extracting the pure
 * helpers (they have no runtime dependencies) and asserting the arithmetic that
 * users see in the UI:
 *   - a play is one `playId`, a seek does not create a new one;
 *   - skipped plays (< 10 s) still count toward the track/artist totals;
 *   - the "previous period" range has the same length as the current one;
 *   - local date helpers never shift a day.
 *
 * Run with: npm run test:counters
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = process.cwd();
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "statswin-counters-"));

function bundle(entry) {
  const outfile = path.join(outDir, `${path.basename(entry, path.extname(entry))}.cjs`);
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules", "esbuild", "bin", "esbuild"),
      path.join(root, entry),
      "--bundle",
      "--format=cjs",
      "--platform=node",
      `--outfile=${outfile}`,
      "--log-level=error",
    ],
    { stdio: "pipe" }
  );
  return require(outfile);
}

const counters = bundle("src/utils/topAggregators.ts");
const ranges = bundle("src/utils/dateRanges.ts");

const DAY = 24 * 60 * 60 * 1000;

function session(start, end, uri, playId, artist = "Artist") {
  return {
    start,
    end,
    playId,
    track: { uri, name: uri, artist, artistUri: `${uri}:artist` },
  };
}

test("skipped plays still count as unique tracks and artists", () => {
  const base = Date.UTC(2026, 0, 5, 10, 0, 0);
  const sessions = [
    session(base, base + 3000, "spotify:track:skip", "p1", "Skipper"),
    session(base + 10_000, base + 200_000, "spotify:track:full", "p2", "Full"),
  ];

  const totals = counters.aggregateTotals(sessions);
  assert.equal(totals.skippedCount, 1);
  assert.equal(totals.tracksCount, 2);
  assert.equal(totals.artistsCount, 2);
});

test("segments of the same play are summed, a seek is not a new play", () => {
  const base = Date.UTC(2026, 0, 5, 10, 0, 0);
  const sessions = [
    session(base, base + 6000, "spotify:track:a", "same-play"),
    session(base + 60_000, base + 200_000, "spotify:track:a", "same-play"),
  ];

  const groups = counters.groupPlays(sessions);
  assert.equal(groups.size, 1);
  const group = [...groups.values()][0];
  assert.equal(group.ms, 6000 + 140_000);
  assert.equal(group.skipped, false);

  const top = counters.aggregateTop(sessions, "track", "plays");
  assert.equal(top.length, 1);
  assert.equal(top[0].plays, 1);
});

test("artist identity ignores case but keeps different URIs apart", () => {
  const base = Date.UTC(2026, 0, 5, 10, 0, 0);
  const sessions = [
    session(base, base + 200_000, "spotify:track:a", "p1", "Daft Punk"),
    session(base + 300_000, base + 500_000, "spotify:track:b", "p2", "daft punk"),
  ];
  const top = counters.aggregateTop(sessions, "artist", "plays");
  assert.equal(top.length, 2);
});

test("custom comparison range has the same length as the current range", () => {
  const start = new Date(2026, 2, 1, 0, 0, 0, 0).getTime();
  const end = new Date(2026, 2, 10, 23, 59, 59, 999).getTime();
  const previous = ranges.getPreviousRange({ start, end }, "custom");

  assert.equal(previous.end - previous.start + 1, end - start + 1);
  assert.ok(previous.end < start);
});

test("previous calendar week is Mon-Sun and does not overlap", () => {
  const thursday = new Date(2026, 2, 5, 12, 0, 0, 0);
  const week = ranges.getWeekRangeForDate(thursday);
  const previous = ranges.getPreviousRange(week, "week");

  assert.equal(new Date(week.start).getDay(), 1, "week starts on Monday");
  assert.equal(previous.end, week.start - 1);
  assert.equal(previous.end - previous.start + 1, 7 * DAY);
});

test("local ISO date helpers never shift a day", () => {
  const ts = new Date(2026, 0, 1, 0, 30, 0, 0).getTime();
  assert.equal(ranges.toISODateLocal(ts), "2026-01-01");
  const endOfDay = ranges.fromISODateLocal("2026-01-01", "end");
  assert.ok(endOfDay != null);
  assert.equal(new Date(endOfDay).getDate(), 1);
  assert.equal(new Date(endOfDay).getHours(), 23);
});

test("period periods resolve to non-overlapping ranges", () => {
  const today = ranges.getDefaultRangeForPeriod("today");
  const previous = ranges.getPreviousRange(today, "today");
  assert.equal(previous.end, today.start - 1);
});
