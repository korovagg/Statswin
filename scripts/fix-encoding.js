/* eslint-disable no-console */
/**
 * Post-build normalizer for `dist/`.
 *
 * `spicetify-creator` writes files with the platform default encoding, which
 * turns non-ASCII characters into mojibake on Windows (cp1251). The bundles are
 * therefore re-read as cp1251 and written back as UTF-8. The step is idempotent:
 * files that already contain valid UTF-8 Cyrillic are left untouched.
 */
const fs = require("fs");
const path = require("path");

const DIST = path.join(process.cwd(), "dist");
const TEXT_EXTENSIONS = new Set([".js", ".css", ".json"]);

const utf8Strict = new TextDecoder("utf-8", { fatal: true });

function normalize(file) {
  const raw = fs.readFileSync(file);
  let decoded;
  try {
    decoded = utf8Strict.decode(raw);
  } catch {
    decoded = raw.toString("latin1");
  }
  // cp1251 has no multi-byte sequences, so a latin1 round-trip is lossless.
  const cyrillic = (decoded.match(/[\u0400-\u04FF]/g) || []).length;
  if (cyrillic === 0) return false;
  const fixed = Buffer.from(decoded, "latin1").toString("utf8");
  if (fixed.includes("\uFFFD")) return false;
  fs.writeFileSync(file, fixed, "utf8");
  return true;
}

if (!fs.existsSync(DIST)) {
  console.error("dist/ not found. Run: npm run build-local");
  process.exit(1);
}

let fixed = 0;
for (const entry of fs.readdirSync(DIST)) {
  const file = path.join(DIST, entry);
  if (!fs.statSync(file).isFile()) continue;
  if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
  if (normalize(file)) {
    fixed += 1;
    console.log(`normalized ${entry}`);
  }
}
console.log(`Encoding check complete (${fixed} file(s) fixed).`);
