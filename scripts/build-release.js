/* eslint-disable no-console */
/**
 * Prepares a distributable CustomApp folder and zip.
 *
 * Layout produced:
 *   release/statswin/{index.js, extension.js, style.css, manifest.json, package.json}
 *   release/statswin-v<version>.zip   (same files, under a top-level statswin/ folder)
 *
 * `dist/` comes from `npm run build-local` (spicetify-creator) and already
 * contains a valid Spicetify runtime manifest; it is reused as-is.
 */
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function requireFile(file, hint) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required build output: ${path.relative(process.cwd(), file)}`);
    if (hint) console.error(hint);
    process.exit(1);
  }
}

function readVersion(pkgPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function zipFolder(sourceDir, entryPrefix, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve(archive.pointer()));
    output.on("error", reject);
    archive.on("warning", (error) => {
      if (error.code === "ENOENT") console.warn(error.message);
      else reject(error);
    });
    archive.on("error", reject);
    archive.pipe(output);
    for (const entry of fs.readdirSync(sourceDir)) {
      archive.file(path.join(sourceDir, entry), { name: `${entryPrefix}/${entry}` });
    }
    archive.finalize();
  });
}

async function buildRelease() {
  const repoRoot = process.cwd();
  const dist = path.join(repoRoot, "dist");
  requireFile(path.join(dist, "index.js"), "Run: npm run build-local");
  requireFile(path.join(dist, "extension.js"), "Run: npm run build-local");
  requireFile(path.join(dist, "manifest.json"), "Run: npm run build-local");

  const releaseRoot = path.join(repoRoot, "release");
  const appDir = path.join(releaseRoot, "statswin");
  fs.rmSync(appDir, { recursive: true, force: true });
  ensureDir(appDir);

  const files = ["index.js", "extension.js", "style.css", "manifest.json"];
  for (const file of files) {
    const source = path.join(dist, file);
    if (!fs.existsSync(source)) {
      if (file === "style.css") {
        fs.writeFileSync(path.join(appDir, file), "/* Statswin CustomApp styles */\n");
        continue;
      }
      console.error(`Expected ${file} in dist/.`);
      process.exit(1);
    }
    fs.copyFileSync(source, path.join(appDir, file));
  }

  const version = readVersion(path.join(repoRoot, "package.json"));
  fs.writeFileSync(
    path.join(appDir, "package.json"),
    `${JSON.stringify({ name: "statswin", version, private: true }, null, 2)}\n`,
    "utf8"
  );

  const zipPath = path.join(releaseRoot, `statswin-v${version}.zip`);
  const size = await zipFolder(appDir, "statswin", zipPath);

  console.log(`Release folder: ${path.relative(repoRoot, appDir)}`);
  console.log(`Zip:            ${path.relative(repoRoot, zipPath)} (${(size / 1024).toFixed(1)} KiB)`);
  console.log("Contents:");
  for (const file of fs.readdirSync(appDir)) {
    console.log(` - ${file}`);
  }
}

buildRelease().catch((error) => {
  console.error(error);
  process.exit(1);
});
