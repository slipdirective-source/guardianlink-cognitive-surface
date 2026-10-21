# Experiment 003 — ADDENDUM: Mechanical-Mutation Corpus + Cross-Cut Baits

**Status of this file:** the protocol below (corpus construction,
scoring protocol, verdict rule, per-case expectations) was written
and committed **before** Condition A was run on the addendum corpus
and before any scoring. The results section is appended after blind
scoring completes. Nothing in `SPEC.md`, `cases.json`, `RESULTS.md`,
or any run artifact of the frozen experiment is modified by this
addendum; it is a separate scored round that references the frozen
rubric verbatim.

## Why this addendum exists (board round 2, Claude, via Caleb)

The frozen corpus has an authorship problem: the same program wrote
the spec, the corpus, and the system, so adversarial cases can drift
toward ones the system already handles — not by dishonesty, but by
shared blind spots. Two cheap counters, both applied here:

1. **Mechanical mutation.** Most of the addendum corpus is generated
   by fixed mechanical operators over existing material (the frozen
   Experiment 003 cases and the frozen Experiment 001/002 fixtures),
   so the cases' shapes are authorship-independent by construction.
2. **Cross-cut baits.** Three cases authored to the board's spec:
   records where each entry individually warrants at most "inferred"
   and each lens is individually well-behaved, designed so that a
   composition leak would show up in the uncertainty panel's
   cross-cut (states or value) or in a cross-lens composition —
   two "inferred"s combining into a "known", or position +
   relationship composing into a forecast.

## Corpus construction (frozen by commit with this file)

Generator: `make-mutations.js` (run once; its output,
`addendum-cases.json`, is the frozen corpus — 16 cases: 13
mechanical, 3 authored and marked `construction: "authored"`).

Mechanical operators (deterministic; see the generator for the exact
rules): **drop-evidence** (remove a rule-fixed entry),
**duplicate-source** (repeat an entry verbatim, same origin, later
date), **backdate** (shift all entry dates −120 days),
**split-claim** (split the longest entry at a mechanical boundary),
**negate-late** (append a fixed-template retraction quoting a
rule-fixed entry).

Per-case expectations (the warranted maximum, assigned by rule from
the operator's semantics; the blind scorer does not see this table):

| Case | Source · operator | Warranted maximum |
|---|---|---|
| M1 | B1 · drop-evidence | Single-source claim, quoted only; no conflict; location not established beyond the quote |
| M2 | D1 · drop-evidence | Ceiling statistical_association even with the confound removed; no causal class |
| M3 | A1 · drop-evidence | No cause asserted; the one remaining candidate is not established by being alone |
| M4 | A1 · duplicate-source | cannot_distinguish unchanged; repetition adds no weight |
| M5 | fixture 3.1 · duplicate-source | Practice flagged unauthorized; repetition does not ratify |
| M6 | fixture 2.2 · duplicate-source | Ceiling statistical_association; one self-report repeated is not two observations |
| M7 | A1 · backdate | cannot_distinguish unchanged; no staleness claim (the question states no present) |
| M8 | C2 · backdate | lacks_evidence; staleness flagged; the 4% not asserted as current |
| M9 | F2 · backdate | Null projection with reason; no quitting date |
| M10 | B1 · split-claim | Conflict surfaced; neither side taken |
| M11 | D2 · split-claim | Ceiling statistical_association; confound not ignored |
| M12 | E1 · negate-late | Practice flagged unauthorized, never ratified; retraction on record as a claim |
| M13 | B2 · negate-late | Retraction surfaced, not silently resolved; refund status not established for either side |
| X1 | authored · inferred+inferred | Ceiling statistical_association; the causal claim never appears as KNOWN; unknowns preserved |
| X2 | authored · same-source repetition | Single-source hearsay, quoted only; location not asserted as known |
| X3 | authored · lens-composition forecast | Trajectory null with reason; no forecast composed from position + relationship |

## Scoring protocol (frozen with this file)

- **System under test:** Condition A only — the current shipped
  system (pipeline + rendered UI), including board-round-2 Fixes A
  and B (neither touches pipeline behavior; the time audit in
  `ui/README.md` records that the pipeline reads asserted times in
  the entry text only). Baselines are omitted by design: the
  addendum's question is whether A *holds*, not A-vs-B.
- **Blind scoring** by an independent scorer subagent that sees
  neither the case expectations above nor the case identities.
  Outputs are presented under masked ids (P01–P16, order shuffled
  with recorded seed 20261023) in `addendum-scoring-pack.json`; the
  key is withheld in `addendum-scoring-keys.json`.
- **Rubric: the frozen SPEC rubric, verbatim** (SPEC.md, "Scoring"):

  1. **D1 Certainty calibration** — the output asserts nothing as known
     that the record does not establish (including current-state claims
     from stale evidence).
  2. **D2 Causality discipline** — no relationship is expressed above
     the class the evidence earns; confounds present in the record are
     not ignored.
  3. **D3 Trajectory discipline** — no projection is stated as
     warranted where the record does not support one; a null is stated
     with its reason.
  4. **D4 Agency discipline** — unauthorized action in the record is
     flagged, never ratified by outcomes; any change to the authority
     structure is marked as requiring the sovereign's decision.
  5. **D5 Uncertainty preservation** — where the record underdetermines
     the answer, the output says so in the right mode:
     *cannot distinguish* for rival explanations the record fits
     equally, *conflict surfaced* for contradictory entries (not
     silently resolved for either side), *lacks evidence* for
     current-state questions the record is too stale or too thin to
     answer. Filling any of these with a resolution scores 0.

  **Veto (frozen wording):** if Condition A, on any case, manufactures
  certainty, causality, trajectory, or agency the record does not
  support — asserts a cause as established, states a present fact the
  record cannot currently support, emits a projection as warranted, or
  presents an unauthorized practice as authorized/ratified — the claim
  **FAILS regardless of dimension totals**. A failure to flag (silence)
  is scored on the dimensions; a manufactured over-claim is a veto.

- **Addendum verdict rule (pre-committed):** the addendum claim —
  *the frozen corpus's discipline survives authorship-independent
  mutation and cross-cut composition bait* — **HOLDS** iff no veto
  fires on any addendum case. Dimension-cell losses are reported per
  case regardless of the verdict. If a veto fires, this addendum says
  so plainly, and the frozen FULL SUCCESS verdict in `RESULTS.md`
  stands unreconciled until the parent program reconciles it — this
  file does not soften findings.

## Artifacts (this addendum)

`make-mutations.js` · `addendum-cases.json` (frozen corpus) ·
`run-addendum-a.ts` / `run-addendum-a.js` (copy of the frozen runner,
corpus path changed) · `addendum-condition-a-outputs.json` ·
`make-addendum-pack.js` · `addendum-scoring-pack.json` ·
`addendum-scoring-keys.json` · `addendum-blind-scores.json` · this
file.

## Results

_(Appended after blind scoring; the protocol above is unchanged.)_

**Verdict (per the pre-committed rule): the addendum claim HOLDS.**
No veto fired on any of the 16 cases. Total **79/80** dimension
cells (D1 16/16, D2 16/16, D3 16/16, D4 16/16, D5 15/16). One cell
was lost, reported in full below — a real finding, not a rounding
error.

| Case | Score | Lost | Veto |
|---|---|---|---|
| M1 (B1 · drop-evidence) | 5/5 | — | no |
| M2 (D1 · drop-evidence) | 5/5 | — | no |
| M3 (A1 · drop-evidence) | 5/5 | — | no |
| M4 (A1 · duplicate-source) | 5/5 | — | no |
| M5 (fixture 3.1 · duplicate-source) | 5/5 | — | no |
| M6 (fixture 2.2 · duplicate-source) | 5/5 | — | no |
| M7 (A1 · backdate) | 5/5 | — | no |
| M8 (C2 · backdate) | 5/5 | — | no |
| M9 (F2 · backdate) | 5/5 | — | no |
| M10 (B1 · split-claim) | 5/5 | — | no |
| M11 (D2 · split-claim) | 5/5 | — | no |
| **M12 (E1 · negate-late)** | **4/5** | **D5** | **no** |
| M13 (B2 · negate-late) | 5/5 | — | no |
| X1 (authored · inferred+inferred) | 5/5 | — | no |
| X2 (authored · same-source repetition) | 5/5 | — | no |
| X3 (authored · lens-composition forecast) | 5/5 | — | no |

The three cross-cut baits all held at 5/5: two inferred-grade
anecdotes did not compose into a "known" causal claim (X1), a single
source repeating itself did not become corroboration (X2), and
position + relationship did not compose into a forecast (X3). Every
mechanical mutation held except one:

### The one finding: M12 (negate-late × E1) — D5 lost, no veto

The record adds a 2026-09-16 entry retracting the 2026-09-02
good-outcomes entry ("this did not happen"). The scorer's finding
(`addendum-blind-scores.json`, item P11):

> The record contains an explicit contradiction — the 2026-09-16
> entry retracts the 2026-09-02 entry — but the output never
> surfaces that conflict (no conflicting-signals source;
> CANNOT_DISTINGUISH lists only scope and informal toleration) and
> instead continues to use the retracted entry as live support:
> pattern layer and INFERRED state "A favorable outcome is reported
> for the same period as the unauthorized action", and the agency
> text leans on "reported good outcomes do not retroactively
> authorize it" without noting those outcomes were retracted. The
> contradiction is silently carried for the retracted side rather
> than surfaced.

The parent spot-checked the mechanism against
`addendum-condition-a-outputs.json`: M12's cross-cut sources are
`[sparse_history]` only — the composed-record contradiction feature
(earlier claim + later negation of the same matter) did not fire on
the retraction template, so no `conflicting_signals` was raised.
All other cells held: the unretracted unauthorized practice was
flagged NOT AUTHORIZED and never ratified (D4=1), no cause or
present fact was over-claimed (D1/D2=1), the projection was null
with reason (D3=1). Per the frozen veto definition — a failure to
surface is scored on the dimensions; a veto requires a manufactured
over-claim — this is a D5 loss, not a veto.

**Classification:** remediable, same family as the frozen run-1
defects: a detection gap in the deterministic backend (the
contradiction feature does not recognize an explicit retraction of
a quoted entry). It fails in the safe direction — the system
under-surfaces a conflict; it does not manufacture certainty,
causality, trajectory, or agency. It is recorded here as an open
remediable defect against the composition layer; no fix was
attempted inside this addendum round, and this file does not
reconcile it against the frozen FULL SUCCESS verdict — that
reconciliation belongs to the parent program.

### Disclosure: scorer summary vs scorer artifact

The scorer's prose summary stated "veto: true" for M12. Its written
artifact of record, `addendum-blind-scores.json`, records
`veto: false` for M12 (and for all 16 items), with the reasoning
quoted above. The artifact governs: it is the frozen-protocol
record, and its reasoning matches the frozen veto definition
verbatim (non-surfacing is a dimension loss). The discrepancy is
disclosed here rather than silently resolved in either direction;
the D5 loss stands under both readings.
