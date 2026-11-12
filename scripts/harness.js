/* Shared screenshot harness plumbing (used by scripts/screenshots.js). */
const fs = require("fs");
const path = require("path");

const HARNESS_DIR = path.resolve(__dirname, "..", "tools", "screenshot-harness");
const VENDOR_DIR = path.join(HARNESS_DIR, "vendor");

/**
 * Bundles React + ReactDOM into a single browser global (`vendor/react.js`).
 *
 * Spicetify provides `React`/`ReactDOM` to the app bundle; the harness has to
 * emulate that, and the packages no longer ship UMD builds.
 */
async function ensureVendorBundle() {
  const vendorFile = path.join(VENDOR_DIR, "react.js");
  const template = path.join(HARNESS_DIR, "react-entry.template.js");
  const entryFile = path.join(HARNESS_DIR, "react-entry.generated.js");
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
  if (!fs.existsSync(template)) {
    throw new Error(`Missing harness template: ${path.relative(process.cwd(), template)}`);
  }
  fs.copyFileSync(template, entryFile);

  const esbuild = require("esbuild");
  await esbuild.build({
    entryPoints: [entryFile],
    outfile: vendorFile,
    bundle: true,
    format: "iife",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  fs.rmSync(entryFile, { force: true });
  return vendorFile;
}

/**
 * Returns the file:// URL of the harness page.
 */
function harnessUrl(query) {
  const page = path.join(HARNESS_DIR, "index.html");
  return `file:///${page.replace(/\\/g, "/")}${query ? `?${query}` : ""}`;
}

module.exports = { ensureVendorBundle, harnessUrl, HARNESS_DIR };
