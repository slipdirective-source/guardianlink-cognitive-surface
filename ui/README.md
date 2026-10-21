# Cognitive Surface — Front End

The human-facing surface of the trajectory system. It is **not** an
AI-control dashboard: it maintains a structured representation of where
the user is, how they got there, what is interacting with what, where
they are going, and what they can do about it — derived from the record,
rendered through five lenses.

## Run it

```bash
npm install
npm run build:ui     # esbuild bundle -> ui/dist/bundle.js + bundle.css
npm run serve:ui     # zero-dependency static server, http://localhost:4173/
```

Or serve the `ui/` directory with any static file server after
`npm run build:ui`. The built bundle is committed (`ui/dist/`), so a
fresh checkout also runs without a build step.

Verify the built artifact headlessly:

```bash
npm run smoke:ui     # jsdom: boots the bundle, loads fixture 5.1, switches lenses
```

## How it works

- **The record.** Every question put to the surface calls the real
  pipeline — `answer()` in `src/surface.ts`, deterministic backend —
  with `lensThreshold: 0`, so all five lenses are composed for every
  entry. The response enters the record; the UI renders the record.
  There is no mock data path. Fixtures are question texts only (the
  frozen Experiment 001/002 corpus in `ui/src/fixtures.ts`), each run
  live through the pipeline, plus one labeled demo sovereign context.
- **Home = "You, now."** The latest entry: urgent action first when one
  exists (Category 5 requirement), current position, a seven-capability
  strip, authority-checked actions, the uncertainty panel, and the
  primary lens's peelable evidence.
- **Five questions as lenses, not tabs.** Where am I? / How did I get
  here? / What is interacting with what? / Where am I going? / What can
  I do about it? Switching lens re-renders the *same* record entry
  through that cluster's projection. Nothing is re-fetched or recomputed.
- **Peelable layers.** Every lens view carries its EvidenceBundle as
  four sibling sections — raw / pattern / relationship / trajectory —
  each independently peelable, never nested, never fused.
- **Relationship classes carry ordered visual weight** (1–4):
  `observed_sequence` < `statistical_association` < `candidate_causal`
  (dashed, muted) < `demonstrated_intervention` (solid, saturated).
  A candidate never renders with demonstrated weight.
- **Agency gate is visible.** Each candidate action renders its
  authority basis and gate state. `sovereign_decision_required` renders
  as REQUIRES SOVEREIGN ASSENT — with no button and
  `data-executable="false"`. Unauthorized actions found in the record
  are flagged, not normalized.
- **Uncertainty is first-class.** Every view carries the cross-cut
  panel: value, sources, and five distinct epistemic states — known
  (quoted), inferred (pattern), suspected (candidate / low-confidence),
  cannot distinguish (unknowns), lacks evidence (incl. the explicit
  trajectory null reason).

## Ingestion — decided policy (2026-10-21)

**Decision:** entries enter the record through one capture layer (the
entry form in the UI, `submitEntry` in `ui/src/app.ts`), and the
capture layer — never the entry's own content — stamps three boundary
facts on every entry: **kind** (`question` | `observation`), **origin**
(`manual_entry` | `sovereign_dictation` | `fixture` | `import`), and
**timestamp** (`at`, taken when the entry is admitted). Content that
claims a different source or time is recorded as content, verbatim,
and moves nothing.

**What the pipeline is allowed to assume about an entry:** exactly
that a stated source produced this text at the stamped time. An entry
is a *claim from its stamped source*, admitted to the **raw layer
only**. Ingestion confers no pattern, relationship, or trajectory
status — layer promotion is the pipeline's work, under the validator's
ceilings, exactly as for any other input. The stamps are **provenance,
not verification**: the system records who said it and when; it does
not thereby believe it. A dictated observation and a typed one carry
the same epistemic weight — none beyond raw.

**Entry kinds:** a *question* is put to its lens; an *observation* is
a statement admitted as position evidence (the position lens reads
"where am I?" over the stated fact). Both flow through `answer()`
identically — there is no side channel for observations.

**Legacy entries:** exports that predate the stamps can still be
imported; an entry without stamps is stamped `origin: import` on
admission (its capture was not witnessed here) and `kind: question`.
Entries that carry stamps keep them — the stamp belongs to the entry,
not to the file it traveled in.

_Sprint "trust at the edges", item 1 (Caleb, 2026-10-21). Pinned by
`ui/src/ingestion.test.ts`: hostile content claiming a forged
source/timestamp lands in the text only, both kinds produce full
multi-lens responses, the form's controls never live inside a gated
action node._

## Record persistence — decided policy (2026-10-21)

**Decision:** the record lives **in memory only**. Persistence happens
exclusively through explicit, user-invoked **export** (download the
record as a JSON file) and **import** (load a previously exported
file). The app writes **nothing** to `localStorage`, `sessionStorage`,
or IndexedDB, at any point.

**Rationale:** the timeline is longitudinal personal data. Silent
browser persistence would keep that data alive outside any deliberate
act of the sovereign — a policy-enforcement gap outside the fail-closed
story this system is built on. If the record is to survive a reload,
carrying it across is an act, not an accident: the user exports it,
holds the file, and imports it. Reloading without importing starts
empty, and that emptiness is the correct default.

**Mechanics:** the export envelope is
`{format: "guardianlink-cognitive-surface/record", version: 2, entries}`
— a pure function of the record, so export → import → export is
byte-identical. Import validates the envelope and every entry's shape
before applying anything; a malformed file changes nothing. (The live
pipeline response also embeds cluster objects with functions in
`ranked_clusters`; the export is the record's data projection —
rendering consumes only data fields.)

## Tamper-evident history — decided policy (2026-10-21)

The record is hash-chained (version 2 above). Every entry admitted
carries `chain: { prev, hash }`, computed at admission in the capture
layer: `prev` is the previous entry's hash (or a distinguished
anchor) and `hash` is SHA-256 over `prev` plus the entry's
**canonical projection** — a fixed-key-order JSON of the entry's
evidentiary content: its stamps (`seq`, `at`, `kind`, `origin`), its
`question_type` / `question_text` / `source` / `context_label`, and
the pipeline's `answer_text` and cross-cut uncertainty value. The
full response object travels in the export for inspection but is not
itself hash-stable JSON; because the backend is deterministic, the
answer text + uncertainty pin the response's substance. SHA-256 is
implemented in `ui/src/sha256.ts` (synchronous, zero dependencies —
WebCrypto is async-only) and pinned against published test vectors.

- Import verifies a v2 file's whole chain on the entries exactly as
  they appear in the file, before applying or normalizing anything.
  Any mismatch — a flipped byte, a reordered entry, a missing link —
  **refuses the import wholesale**: the current record is untouched
  and the error is surfaced. There is no partial import.
- **v1 decision:** v1 exports (no chain data) remain importable as
  **legacy-unchained** records. Their status is displayed as
  `legacy-unverified` and they are **never silently upgraded**:
  legacy entries stay chain-less through re-export. Entries appended
  after a legacy import chain onto a distinguished legacy anchor
  (`guardianlink-record-legacy-anchor`), so the boundary between
  unverified history and chained history is itself in the chain.
- **Display:** the record panel shows the live verification status
  (`data-chain-status`): `verified`, `legacy-unverified`, or
  `broken`. Verification is recomputed from the entries, never
  stored as a claim — a mutated entry verifies as broken, and a
  broken chain can never render as verified.

_Docket: front-end hardening pass, board docket (Claude) via Caleb,
2026-10-21. The same pass added: the structural no-affordance test for
gated agency actions, the record-content injection tests, the
presentation-purity differential tests, and the snapshot pin on
relationship-class visual weights (see `ui/src/hardening.test.ts`)._

## Tests

`npm test` runs two Jest projects: `pipeline` (src/, node) and `ui`
(ui/src/, jsdom). The UI tests encode the scope claims as assertions:
lens switching preserves the record entry, layers are siblings and
unfused, pattern holds no verbatim raw quote, relationship weights are
strictly ordered, assent-required actions are non-executable and
buttonless, the uncertainty panel carries all five states with the
cross-cut value, urgent action leads the home view for both Category 5
fixtures, and a novel live question renders output byte-identical to a
direct `answer()` call. A second suite (`ui/src/hardening.test.ts`)
pins the hardening properties: gated actions contain no interactive
affordance at all (and clicks inside them change nothing), hostile
strings in any rendered field stay inert and verbatim, single-field
mutations of a response change the render only where that field is
projected, the record never touches browser storage and round-trips
byte-identically through export/import, and the relationship-class
visual weights are snapshot-pinned.

CI runs `npx tsc --noEmit` (pipeline), `npm test` (both projects),
`npx tsc -p tsconfig.ui.json --noEmit`, and `npm run build:ui`.
