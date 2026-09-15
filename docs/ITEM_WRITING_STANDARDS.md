# Item-Writing Standards — HiCap Prep

This is the rubric every future question-authoring pass should follow, across every
subtest and every grade. It exists because the original 540-question bank was
authored fast, without one — and that's exactly how Figure Classification Tier 1
ended up with 6 of 20 items sharing an identical rule and an identical explanation
sentence. The Paper Folding pilot (Tier 1, fold-count variety + shared-dot-count
distractors) is what following this rubric actually looks like; this document
generalizes that discipline so it doesn't have to be rediscovered per-subtest.

---

## 1. Deep structure vs. surface dressing

Every item has two layers:
- **Surface dressing** — which specific shapes, words, or numbers appear.
- **Deep structure** — the actual reasoning rule being tested.

**Swapping surface dressing while reusing deep structure is not a new item.**
"● is round, the others are edged" and "★ is round, the others are edged" are the
*same item* wearing different clothes. A pool needs deep-structure variety, not
just surface variety — this is the single rule that would have caught the FC bug
on sight.

**Hard cap: no single deep-structure rule may account for more than ~15% of a
pool** (3 of 20 at current pool size). If a rule type is this generative that it's
tempting to lean on it more, that's a sign to invent more rule types, not to
relax the cap.

## 2. Distractors represent misconceptions, not noise

Every wrong answer should be wrong *for a specific, nameable reason* — ideally
one that maps to a real mistake a student would actually make. "Obviously silly"
distractors don't test anything; "plausible but wrong for a clear reason"
distractors do.

The Paper Folding pilot's distractor rule is the model: at every fold count, at
least one wrong option shares the correct answer's *dot count*, so a student
can't shortcut by counting alone — they have to actually track the fold
geometry. Every subtest should have an equivalent "can't be gamed by the cheap
heuristic" rule:

- **Verbal analogies/classification:** at least one distractor should share a
  surface-level association with the stem (same topic, common co-occurrence)
  without satisfying the actual relationship — this defeats "pick the word that
  feels related" without reasoning through the relationship itself.
- **Number series/analogies:** at least one distractor should be reachable by a
  *plausible but wrong* rule (e.g., the right operation applied to the wrong
  term, or an off-by-one), not just a random number.
- **Nonverbal (Figure Matrices/Classification):** at least one distractor should
  match the correct answer on *some* attributes (same shape family, same count)
  while differing on the one that actually matters — this defeats "pick the one
  that looks most similar" without applying the actual transformation rule.

## 3. No positional or length cues

- Rotate the correct answer's position across items in a pool — don't let "C" be
  right an unusual number of times.
- Don't make the correct option systematically longer/more detailed than
  distractors (a classic test-taking shortcut that has nothing to do with the
  underlying skill).
- Avoid absolute language ("always," "never") in verbal distractors that lets a
  test-savvy kid eliminate options without reasoning about content.

## 4. One unambiguous key

Before an item ships: could a reasonable, careful test-taker defend a different
answer? If yes, the item is broken regardless of how elegant the intended rule
is. This is especially a risk in nonverbal items where two attributes change at
once — confirm the *stated* rule is the only one that fits every option, not
just the one you had in mind when writing it.

## 5. Construct validity — test the reasoning, not reading/memory

An item should fail (or succeed) based on the target reasoning skill, not on an
unrelated skill riding along with it:
- Verbal items shouldn't require rare vocabulary *and* the relationship
  reasoning at the same time, at lower tiers — isolate one increasing variable
  at a time (see the grade-progression model below).
- Nonverbal items should avoid culture-specific symbols; geometric primitives
  only.
- Quantitative items shouldn't require reading comprehension beyond what's
  needed to state the pattern.

## 6. Format diversity, and matching the visual medium to the content

Paper Folding's biggest quality problem wasn't difficulty — it was that a
described fold ("a square is folded in half...") asks a student to *simulate*
spatial reasoning through *reading comprehension*, which isn't the same skill
the real test measures. Any subtest where the shapes themselves are the content
should render as real inline SVG, not Unicode glyphs standing in for shapes or
sentences standing in for diagrams. Glyphs are an acceptable placeholder during
authoring, not a shipped end state.

---

## Grade-progression model (for Epic 5 — grades 3–11)

The original build (Level 13 / grade 7) content, if extended to other grades by
just swapping in bigger numbers or rarer words, will **not** produce real
difficulty differentiation — a rushed grade-9 pool built that way would just be
grade-7 content with a thesaurus pass. Genuine grade progression comes from
increasing the *number of things a student must hold and combine at once*, not
just the size or rarity of the pieces.

| Subtest family | What should NOT change across grades | What SHOULD scale with grade |
|---|---|---|
| Verbal (SC/VC/VA) | Sentence complexity should stay age-plain even at upper grades — this isn't a reading test | Vocabulary rarity band; abstractness of the relationship (concrete object→function, at lower grades, progressing to abstract trait/emotion/domain-specific relationships at upper grades); number of relationship "steps" implied |
| Quantitative (NS/NP/NA) | Arithmetic itself should stay something the grade has already learned — this isn't a computation-speed test | Number magnitude; number of chained operations; number of unknowns tracked simultaneously; introduction of ratio/proportional reasoning at upper grades |
| Nonverbal (FC/FM/PF) | The shapes/geometry should stay culture-free and simple to *perceive* — this isn't a visual-acuity test | Number of transformation rules applied at once (rotation alone → rotation+size → rotation+size+fill); number of elements in a figure; degree of near-symmetry in distractors (harder items have distractors that are *almost* right) |

**Practical implication for Epic 5:** each grade's Tier 1/2/3 should represent a
progression on these axes *within* that grade — and Tier 1 of a higher grade
should sit meaningfully above Tier 3 of the grade below it, not overlap with it.
Worth an explicit difficulty-anchor check across adjacent grades before calling
a new grade's content bank done, not just an internal Tier 1<2<3 check.

---

## Worked example: Figure Classification, Tier 1, rebuilt (grade 7 / Level 13)

Replaces the previous 20-item pool, which had 6 items sharing one rule and one
verbatim explanation. Same `{q, o, a, e}` shape as existing content — `o` is the
4 displayed items, `a` is the index of the one that doesn't belong. Every item
below is `q: "Which one does NOT belong?"`.

No rule type exceeds 3 of 20 (15% cap). Explanations are never verbatim
duplicates, even within a rule type, because the specific shapes referenced
differ each time.

```json
[
  {"o":["▲","■","◆","●"],"a":3,"e":"● is the only rounded shape; the others are straight-edged polygons."},
  {"o":["★","◆","●","▲"],"a":2,"e":"● is the only rounded shape; the others are straight-edged polygons."},
  {"o":["⬠","■","▲","●"],"a":3,"e":"● is the only rounded shape; the others are straight-edged polygons."},

  {"o":["●","●","○","●"],"a":2,"e":"○ is unfilled (outline); the other three are solid."},
  {"o":["▲","△","▲","▲"],"a":1,"e":"△ is unfilled (outline); the other three are solid."},
  {"o":["■","■","■","□"],"a":3,"e":"□ is unfilled (outline); the other three are solid."},

  {"o":["Small ●","Small ▲","Small ■","Large ★"],"a":3,"e":"Large ★ is the only large shape; the other three are small."},
  {"o":["Large ◆","Large ●","Small ▲","Large ■"],"a":2,"e":"Small ▲ is the only small shape; the other three are large."},
  {"o":["Small ★","Small ★","Large ★","Small ★"],"a":2,"e":"This is the only large star; the other three stars are small — same shape, different size."},

  {"o":["●●","▲▲","■■","★"],"a":3,"e":"★ appears alone; the other three shapes each appear in a pair."},
  {"o":["★","★","★★","★"],"a":2,"e":"★★ is a pair; the other three stars appear alone."},
  {"o":["●●●","▲▲▲","■■■","★★"],"a":3,"e":"★★ has only two; the other three groups have three each."},

  {"o":["→","→","↓","→"],"a":2,"e":"↓ points a different direction; the other three all point right."},
  {"o":["↑","↑","↑","↓"],"a":3,"e":"↓ points a different direction; the other three all point up."},
  {"o":["◀","◀","▶","◀"],"a":2,"e":"▶ points right; the other three point left."},

  {"o":["■","■","◆","■"],"a":2,"e":"◆ is the square rotated 45°; the other three squares sit flat, unrotated."},
  {"o":["▲","▲","▲","▶"],"a":3,"e":"▶ is the triangle rotated 90°; the other three triangles point the same, unrotated way."},

  {"o":["●▲","▲●","●▲","▲▲"],"a":3,"e":"▲▲ breaks the alternating ●▲ / ▲● pattern the other three follow."},
  {"o":["★●★","●★●","★●★","★★★"],"a":3,"e":"★★★ breaks the alternating star/circle pattern the other three follow."},

  {"o":["Large filled ●","Large filled ▲","Large filled ■","Small outline ★"],"a":3,"e":"Small outline ★ differs in two ways at once — size AND fill — while the other three only vary by shape, all large and filled."}
]
```

Rule-type distribution (for the next author to check against, not just this one):
round-vs-edged ×3, fill ×3, size ×3, count ×3, direction ×3, same-shape-rotated
×2, pattern-break ×2, combined-attribute ×1 = 20, no type over the 15% cap.

**Not yet fixed by this pass, flagged rather than silently deferred:** these are
still Unicode glyphs, not real SVG — per §6 above, that's the next thing this
pool needs, the same treatment Paper Folding Tier 1 already got. FC Tiers 2–3
and all of Figure Matrices still use the pre-rubric content and need the same
audit this document just gave Tier 1.
