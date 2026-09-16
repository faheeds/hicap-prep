// PWA installability tests (Epic 8, E8-1).
// Structural checks: manifest validity, service worker registration,
// icon file existence, and manifest link in HTML files.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");
const src = path.join(root, "src");

const APP     = readFileSync(path.join(src, "app.html"), "utf-8");
const LANDING = readFileSync(path.join(src, "landing.html"), "utf-8");
const SW      = readFileSync(path.join(src, "sw.js"), "utf-8");
const MANIFEST = JSON.parse(readFileSync(path.join(src, "manifest.webmanifest"), "utf-8"));

// ---------------------------------------------------------------------------
// manifest.webmanifest
// ---------------------------------------------------------------------------
test("manifest: has name and short_name", () => {
  assert.ok(MANIFEST.name, "name is required");
  assert.ok(MANIFEST.short_name, "short_name is required");
});

test("manifest: display is standalone", () => {
  assert.equal(MANIFEST.display, "standalone");
});

test("manifest: start_url points to app.html", () => {
  assert.match(MANIFEST.start_url, /app\.html/);
});

test("manifest: has theme_color and background_color", () => {
  assert.ok(MANIFEST.theme_color, "theme_color is required");
  assert.ok(MANIFEST.background_color, "background_color is required");
});

test("manifest: has at least two icons (192 and 512)", () => {
  const sizes = (MANIFEST.icons || []).map((i) => i.sizes);
  assert.ok(sizes.some((s) => s.includes("192")), "192×192 icon missing");
  assert.ok(sizes.some((s) => s.includes("512")), "512×512 icon missing");
});

test("manifest: icons reference PNG files that exist on disk", () => {
  for (const icon of MANIFEST.icons || []) {
    const iconPath = path.join(src, icon.src.replace(/^\//, ""));
    assert.ok(existsSync(iconPath), `icon file not found: ${icon.src}`);
  }
});

// ---------------------------------------------------------------------------
// HTML files link the manifest
// ---------------------------------------------------------------------------
test("app.html: links manifest.webmanifest", () => {
  assert.match(APP, /rel="manifest"/);
  assert.match(APP, /manifest\.webmanifest/);
});

test("app.html: has theme-color meta tag", () => {
  assert.match(APP, /name="theme-color"/);
});

test("landing.html: links manifest.webmanifest", () => {
  assert.match(LANDING, /rel="manifest"/);
  assert.match(LANDING, /manifest\.webmanifest/);
});

test("landing.html: has theme-color meta tag", () => {
  assert.match(LANDING, /name="theme-color"/);
});

// ---------------------------------------------------------------------------
// Service worker registration in HTML
// ---------------------------------------------------------------------------
test("app.html: registers service worker", () => {
  assert.match(APP, /serviceWorker/);
  assert.match(APP, /serviceWorker.*register|register.*serviceWorker/s);
  assert.match(APP, /sw\.js/);
});

test("landing.html: registers service worker", () => {
  assert.match(LANDING, /serviceWorker/);
  assert.match(LANDING, /sw\.js/);
});

// ---------------------------------------------------------------------------
// Service worker (sw.js) structural checks
// ---------------------------------------------------------------------------
test("sw: defines CACHE_NAME", () => {
  assert.match(SW, /CACHE_NAME/);
});

test("sw: has install event listener that precaches app shell", () => {
  assert.match(SW, /addEventListener.*install/);
  assert.match(SW, /app\.html/);
  assert.match(SW, /addAll/);
});

test("sw: has activate event listener that cleans old caches", () => {
  assert.match(SW, /addEventListener.*activate/);
  assert.match(SW, /caches\.delete|caches\.keys/);
});

test("sw: has fetch event listener", () => {
  assert.match(SW, /addEventListener.*fetch/);
});

test("sw: does not cache Supabase API calls", () => {
  assert.match(SW, /supabase\.co/);
});

test("sw: skips non-GET requests", () => {
  assert.match(SW, /request\.method.*GET|GET.*request\.method/);
});

test("sw: uses skipWaiting and clients.claim for immediate activation", () => {
  assert.match(SW, /skipWaiting/);
  assert.match(SW, /clients\.claim/);
});

// ---------------------------------------------------------------------------
// Icon files exist on disk
// ---------------------------------------------------------------------------
test("icon-192.png exists in src/", () => {
  assert.ok(existsSync(path.join(src, "icon-192.png")));
});

test("icon-512.png exists in src/", () => {
  assert.ok(existsSync(path.join(src, "icon-512.png")));
});

test("icon-192.png is a valid PNG (magic bytes)", () => {
  const buf = readFileSync(path.join(src, "icon-192.png"));
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  assert.equal(buf[0], 0x89);
  assert.equal(buf[1], 0x50); // P
  assert.equal(buf[2], 0x4e); // N
  assert.equal(buf[3], 0x47); // G
});

test("icon-512.png is a valid PNG (magic bytes)", () => {
  const buf = readFileSync(path.join(src, "icon-512.png"));
  assert.equal(buf[0], 0x89);
  assert.equal(buf[1], 0x50);
  assert.equal(buf[2], 0x4e);
  assert.equal(buf[3], 0x47);
});
