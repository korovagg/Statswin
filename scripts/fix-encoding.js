/* eslint-disable no-console */
/**
 * Post-build encoding normalizer and safety check for `dist/`.
 *
 * `spicetify-creator` writes files with the platform default encoding, which
 * turns non-ASCII characters into mojibake on Windows (cp1251). Files that
 * contain Cyrillic but are not valid UTF-8 are re-decoded and written back as
 * UTF-8. The step is idempotent and refuses to write when the result still
 * contains replacement characters or control bytes, so a broken bundle can
 * never silently reach a release.
 */
const fs = require("fs");
const path = require("path");

const DIST = path.join(process.cwd(), "dist");
const TEXT_EXTENSIONS = new Set([".js", ".css", ".json"]);
const utf8Strict = new TextDecoder("utf-8", { fatal: true });

function isUtf8(raw) {
  try {
    utf8Strict.decode(raw);
    return true;
  } catch {
    return false;
  }
}

function normalize(file) {
  const raw = fs.readFileSync(file);
  if (isUtf8(raw)) return { fixed: false, broken: false };

  const fixed = Buffer.from(raw.toString("latin1"), "utf8");
  if (fixed.includes("\uFFFD")) return { fixed: false, broken: true };
  fs.writeFileSync(file, fixed);
  return { fixed: true, broken: false };
}

function check(file) {
  const text = fs.readFileSync(file, "utf8");
  const invalid = [...text].filter((char) => {
    const code = char.codePointAt(0) ?? 0;
    return (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0xfffd;
  });
  return invalid.length;
}

if (!fs.existsSync(DIST)) {
  console.error("dist/ not found. Run: npm run build-local");
  process.exit(1);
}

let fixed = 0;
const broken = [];
for (const entry of fs.readdirSync(DIST)) {
  const file = path.join(DIST, entry);
  if (!fs.statSync(file).isFile() || !TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
  const result = normalize(file);
  if (result.fixed) {
    fixed += 1;
    console.log(`normalized ${entry}`);
  }
  if (result.broken) broken.push(entry);
}

for (const entry of broken) {
  const count = check(path.join(DIST, entry));
  console.error(`dist/${entry} is not valid UTF-8 (${count} invalid characters).`);
}
if (broken.length > 0) {
  console.error("Encoding check failed; fix the sources and rebuild.");
  process.exit(1);
}

console.log(`Encoding check complete (${fixed} file(s) normalized).`);
