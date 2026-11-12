/* eslint-disable no-console */
/**
 * Screenshot generator.
 *
 * Renders the production bundle in a stubbed Spotify shell and captures the
 * screens referenced by the README. Requires `npm run build-local` first.
 */
const fs = require("fs");
const path = require("path");
const { ensureVendorBundle, harnessUrl } = require("./harness");

async function main() {
  const { chromium } = require("playwright");

  const repoRoot = process.cwd();
  if (!fs.existsSync(path.join(repoRoot, "dist", "index.js"))) {
    console.error("dist/index.js missing. Run: npm run build-local");
    process.exit(1);
  }
  await ensureVendorBundle();

  const outDir = path.join(repoRoot, "docs", "screens");
  fs.mkdirSync(outDir, { recursive: true });

  const shots = [
    { file: "today-dark.png", query: "theme=dark&lang=en", width: 1280, height: 800 },
    {
      file: "year-light.png",
      query: "theme=light&lang=en",
      width: 1280,
      height: 800,
      period: "Year",
    },
    {
      file: "tops-dark.png",
      query: "theme=dark&lang=en",
      width: 1280,
      height: 1100,
      scrollToTops: true,
    },
    {
      file: "settings-dark.png",
      query: "theme=dark&lang=en",
      width: 1280,
      height: 800,
      openSettings: true,
    },
    { file: "period-menu-dark.png", query: "theme=dark&lang=en", width: 1280, height: 560, openMenu: "Period selection" },
    { file: "year-select-dark.png", query: "theme=dark&lang=en", width: 1280, height: 560, period: "Year", openSelect: "Year" },
    { file: "sort-menu-dark.png", query: "theme=dark&lang=en", width: 1280, height: 900, scrollToTops: true, openSelect: "Sort" },
    { file: "custom-dark.png", query: "theme=dark&lang=en", width: 1280, height: 560, period: "Custom" },
    { file: "settings-general-dark.png", query: "theme=dark&lang=ru", width: 1280, height: 700, openSettings: true, settingsTab: "Общие" },
    { file: "today-narrow.png", query: "theme=dark&lang=en", width: 768, height: 1024 },
  ];

  const browser = await chromium.launch();
  try {
    for (const shot of shots) {
      const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(harnessUrl(shot.query));
      await page.waitForSelector("text=Statswin", { timeout: 20000 });

      if (shot.period) {
        await page.getByRole("button", { name: "Period selection" }).first().click();
        await page.getByRole("option", { name: shot.period, exact: true }).click();
      }
      if (shot.openMenu) {
        await page.getByRole("button", { name: shot.openMenu === true ? "Period selection" : shot.openMenu }).first().click();
        await page.waitForSelector('[role="listbox"]');
      }
      if (shot.openSelect) {
        await page.getByRole("button", { name: shot.openSelect }).first().click();
        await page.waitForSelector("[role='listbox']");
      }
      if (shot.openSettings) {
        const settingsName = shot.query.includes("lang=ru") ? "Настройки" : "Settings";
        await page.getByRole("button", { name: settingsName }).first().click();
        await page.waitForSelector("#statswin-settings-modal");
        if (shot.settingsTab) {
          await page.getByRole("tab", { name: shot.settingsTab }).click();
        }
      }
      if (shot.scrollToTops) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      }
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(outDir, shot.file), fullPage: !shot.scrollToTops });
      await page.close();
      if (errors.length > 0) {
        console.error(`page errors while capturing ${shot.file}:`, errors);
        process.exitCode = 1;
      }
      console.log(`captured ${shot.file}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
