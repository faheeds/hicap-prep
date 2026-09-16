// One-shot verification script for PF Tier 1 integrity.
// Run: node pf-verify.mjs
//
// Checks every item in the 20-item pool:
//   1. Correct answer has exactly 2^n dots (n = fold count).
//   2. No two of the four options share the same coordinate set.

// ---------- Copy of the production math (keep in sync with app.html) ----------
function pfMirror(pt, fold) {
  if (fold === "v")  return { x: 120 - pt.x, y: pt.y };
  if (fold === "h")  return { x: pt.x, y: 120 - pt.y };
  if (fold === "d")  return { x: pt.y, y: pt.x };
  if (fold === "ad") return { x: 120 - pt.y, y: 120 - pt.x };
  return pt;
}
function pfDedupe(pts) {
  const seen = new Set(); const out = [];
  for (const p of pts) { const k = p.x + "," + p.y; if (!seen.has(k)) { seen.add(k); out.push(p); } }
  return out;
}
function pfUnfold(dot, folds) {
  let pts = [dot];
  for (const f of folds) pts = pfDedupe(pts.concat(pts.map(p => pfMirror(p, f))));
  return pts;
}

// Canonical representation for set comparison (sorted "x,y" strings joined).
function canonKey(pts) {
  return pts.map(p => `${p.x},${p.y}`).sort().join("|");
}

// ---------- Current Tier 1 configs (mirrors pfBuildTier1 in app.html) ---------
const configs = [
  // Single-fold vertical (idx 0-4)
  { folds: ["v"], d: { x: 85, y: 25 } },
  { folds: ["v"], d: { x: 95, y: 50 } },
  { folds: ["v"], d: { x: 85, y: 95 } },
  { folds: ["v"], d: { x: 100, y: 100 } },
  { folds: ["v"], d: { x: 75, y: 35 } },
  // Single-fold horizontal (idx 5-9)
  { folds: ["h"], d: { x: 25, y: 30 } },
  { folds: ["h"], d: { x: 90, y: 25 } },
  { folds: ["h"], d: { x: 20, y: 20 } },
  { folds: ["h"], d: { x: 35, y: 45 } },
  { folds: ["h"], d: { x: 95, y: 35 } },
  // Double-fold v+h (idx 10-15)
  { folds: ["v", "h"], d: { x: 85, y: 20 } },
  { folds: ["v", "h"], d: { x: 100, y: 40 } },
  { folds: ["v", "h"], d: { x: 75, y: 25 } },
  { folds: ["v", "h"], d: { x: 20, y: 85 } },
  { folds: ["v", "h"], d: { x: 35, y: 100 } },
  { folds: ["v", "h"], d: { x: 45, y: 95 } },
  // Triple-fold v+h+d (idx 16-19)
  { folds: ["v", "h", "d"], d: { x: 100, y: 40 }, dis3Dot: { x: 95,  y: 45 } },
  { folds: ["v", "h", "d"], d: { x: 95,  y: 45 }, dis3Dot: { x: 100, y: 40 } },
  { folds: ["v", "h", "d"], d: { x: 102, y: 35 }, dis3Dot: { x: 100, y: 40 } },
  { folds: ["v", "h", "d"], d: { x: 100, y: 32 }, dis3Dot: { x: 95,  y: 45 } },
];

// Build options exactly as pfBuildTier1 does.
function buildOptions(c, idx) {
  const correct = pfUnfold(c.d, c.folds);
  const n = c.folds.length;
  let dis1, dis2, dis3;
  if (n === 1) {
    const primary = c.folds[0];
    const wrong = primary === "v" ? "h" : "v";
    dis1 = [c.d];
    dis2 = pfUnfold(c.d, [wrong]);
    dis3 = pfUnfold(c.d, ["v", "h"]);
  } else if (n === 2) {
    dis1 = [c.d];
    dis2 = pfUnfold(c.d, ["v"]);
    dis3 = pfUnfold(c.d, ["v", "d"]);
  } else {
    dis1 = pfUnfold(c.d, ["v"]);
    dis2 = pfUnfold(c.d, ["v", "h"]);
    dis3 = pfUnfold(c.dis3Dot, c.folds);
  }
  const raw = [dis1, correct, dis2, dis3];
  const rot = idx % 4;
  return { options: raw.slice(rot).concat(raw.slice(0, rot)), correctPos: (1 - rot + 4) % 4 };
}

// ---------- Run checks --------------------------------------------------------
let totalFails = 0;

for (let idx = 0; idx < configs.length; idx++) {
  const c = configs[idx];
  const { options, correctPos } = buildOptions(c, idx);
  const correct = options[correctPos];
  const n = c.folds.length;
  const expectedDots = Math.pow(2, n);

  const itemLabel = `Item ${idx + 1} [folds=${c.folds.join("+")} d=(${c.d.x},${c.d.y})]`;
  let itemFailed = false;

  // Check 1: correct answer has 2^n dots.
  if (correct.length !== expectedDots) {
    console.error(`FAIL ${itemLabel}: correct answer has ${correct.length} dots, expected ${expectedDots} (2^${n})`);
    itemFailed = true;
  }

  // Check 2: no two options share the same canonical dot set.
  const keys = options.map(canonKey);
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (keys[i] === keys[j]) {
        const role = (i === correctPos ? "correct" : `distractor${i}`) + " vs " +
                     (j === correctPos ? "correct" : `distractor${j}`);
        console.error(`FAIL ${itemLabel}: options ${i} and ${j} (${role}) share identical dot set:`);
        console.error(`       ${keys[i]}`);
        itemFailed = true;
      }
    }
  }

  if (!itemFailed) {
    // Show a brief summary for passing items.
    const dotCounts = options.map(o => o.length);
    console.log(`pass  ${itemLabel}: dots=[${dotCounts}] correct@${correctPos}`);
  } else {
    totalFails++;
  }
}

console.log("");
if (totalFails === 0) {
  console.log("All 20 items passed.");
} else {
  console.log(`${totalFails} item(s) failed.`);
  process.exit(1);
}
