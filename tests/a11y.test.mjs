// Accessibility guards. Not a full WCAG audit — a targeted regression suite
// for the specific issues fixed in the E4-3-flavored a11y pass, so a future
// commit can't silently reintroduce them.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const HTML_PATH = new URL("../src/app.html", import.meta.url);

let dom, window, doc;

async function boot() {
  const html = readFileSync(HTML_PATH, "utf-8");
  dom = new JSDOM(html, {
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true,
    url: HTML_PATH.href,
  });
  window = dom.window;
  window.alert = () => { throw new Error("native alert blocked"); };
  window.confirm = () => { throw new Error("native confirm blocked"); };
  window.prompt = () => { throw new Error("native prompt blocked"); };
  await new Promise((r) => setTimeout(r, 300));
  doc = window.document;
}

before(boot);
after(() => dom.window.close());

test("a11y: no stale --forest color references (was removed in the E4-7 palette rewrite)", () => {
  const src = readFileSync(HTML_PATH, "utf-8");
  const bad = src.match(/var\(--forest\)/g);
  assert.ok(!bad, `found ${bad ? bad.length : 0} stale var(--forest) reference(s)`);
});

test("a11y: no <a onclick> tag without href (not keyboard-focusable)", () => {
  const src = readFileSync(HTML_PATH, "utf-8");
  // Match <a ... onclick=...> that does NOT contain href=
  const anchors = src.match(/<a\s+(?![^>]*\bhref=)[^>]*\bonclick=/g);
  assert.ok(!anchors, `found ${anchors ? anchors.length : 0} <a onclick> without href — should be <button>`);
});

test("a11y: focus-visible rule exists for buttons and other custom controls", () => {
  const src = readFileSync(HTML_PATH, "utf-8");
  // Loose match — any rule that mentions :focus-visible on a button or radio/tab role.
  assert.match(src, /button:focus-visible[\s\S]{0,200}outline:\s*2px\s+solid\s+var\(--flare\)/,
    "focus-visible outline rule must apply to buttons — otherwise custom-styled buttons show no keyboard-focus indicator");
});

test("a11y: prefers-reduced-motion media query suppresses animations", () => {
  const src = readFileSync(HTML_PATH, "utf-8");
  assert.match(src, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(src, /prefers-reduced-motion[\s\S]{0,300}animation-duration:\s*0\.01ms/i);
});

test("a11y: shell renders <main> landmark for primary content", () => {
  const main = doc.querySelector("main");
  assert.ok(main, "shell must include a <main> element");
  assert.ok(main.classList.contains("view"), "main should carry the view class");
});

test("a11y: modal overlay carries role=dialog + aria-modal + aria-labelledby", () => {
  // Fire a confirm modal and inspect the DOM the render loop produced.
  window.showConfirm("Test", () => {});
  const dlg = doc.querySelector('.modal-box[role="dialog"]');
  assert.ok(dlg, "modal must have role=dialog");
  assert.equal(dlg.getAttribute("aria-modal"), "true");
  assert.equal(dlg.getAttribute("aria-labelledby"), "modalMsg");
  assert.ok(doc.getElementById("modalMsg"), "the referenced label element must exist");
  window.closeModal();
});

test("a11y: segmented pickers use role=radiogroup / role=radio (not the wrong listbox/option pair)", () => {
  // Force the roster add-student form open so its segmented picker renders.
  window.S.mode = "student"; window.S.view = "roster"; window.startAddStudent();
  window.render();
  const rg = doc.querySelector('.segmented[role="radiogroup"]');
  assert.ok(rg, "expected a role=radiogroup on the segmented picker");
  const radios = rg.querySelectorAll('[role="radio"]');
  assert.ok(radios.length >= 1, "radiogroup must contain role=radio children");
  radios.forEach((r) => assert.ok(r.hasAttribute("aria-checked"),
    "each role=radio must carry aria-checked, not aria-selected"));
});

test("a11y: PIN keypad buttons carry aria-label for every digit + delete", () => {
  window.S.mode = "parent"; window.S.view = "parent-gate"; window.S.parentUnlocked = false;
  window.render();
  const digits = ["0","1","2","3","4","5","6","7","8","9"];
  for (const d of digits) {
    const btn = doc.querySelector(`.keypad button[aria-label="Digit ${d}"]`);
    assert.ok(btn, `keypad button for digit ${d} must expose an aria-label`);
  }
  const del = doc.querySelector('.keypad button[aria-label="Delete last digit"]');
  assert.ok(del, "delete key must expose an aria-label");
});

test("a11y: running-mock timer bar exposes role=timer with aria-label and aria-live=off (no per-second spam)", () => {
  const src = readFileSync(HTML_PATH, "utf-8");
  // Rendered dynamically only when a mock is running, so grep the template.
  assert.match(src, /class="timerbar"[^>]*role="timer"/);
  assert.match(src, /role="timer"[^>]*aria-live="off"/);
  assert.match(src, /aria-label="Mock test time remaining"/);
});

test("a11y: chip-student header button has an aria-label describing its action", () => {
  const src = readFileSync(HTML_PATH, "utf-8");
  // Template inspection — the chip only renders when a student is picked.
  assert.match(src, /class="chip-student"[^>]*aria-label="Signed in as[^"]+Tap to switch student\./);
});

test("a11y: badge locked label uses --neutral-600 (>=4.5:1 on --bg), not --neutral-500 (~3:1)", () => {
  const src = readFileSync(HTML_PATH, "utf-8");
  // Locate the .badge.locked .lbl rule and check the color token.
  const m = src.match(/\.badge\.locked \.lbl\{color:var\((--neutral-\d+)\)/);
  assert.ok(m, "expected a .badge.locked .lbl color rule");
  assert.equal(m[1], "--neutral-600",
    "--neutral-500 fails 4.5:1 contrast on --bg for 10px text; must use --neutral-600 or darker");
});
