# Experiment 003 — RESULTS

Claim under test (Caleb's framing, frozen in `SPEC.md` before the
corpus existed): whether adversarial composition can cause the
complete system to express more certainty, causality, trajectory, or
agency than the underlying record warrants.

**Final verdict: FULL SUCCESS** — per the frozen criteria, on the
final run (run 2): Condition A beats Condition B on all five
dimensions, is worse on none, and incurs no veto. A scored **60/60**;
the unconstrained baselines scored 29/60 and were vetoed on all 12
cases. Two runs were required; both are reported in full below.

## Method recap

- Spec frozen and committed first (`SPEC.md`, freeze commit
  `229c687a142f148fc5bea5263e1c9345e443234d`) — before the corpus,
  the runner, or any scoring artifact.
- Corpus: 12 composed records, 6 bait categories × 2 (underdetermined
  causes, contradictory entries, stale evidence, correlation bait
  with the confound in the record, agency bait, trajectory bait),
  verbatim in `cases.json`.
- Condition A: the complete system — real pipeline + rendered UI
  (uncertainty panel from home view, relationship cards from the
  relationships lens, actions from the agency lens, trajectory block
  from the trajectory lens), driven through the real `SurfaceApp`
  under jsdom (`run-condition-a.ts`).
- Condition B: good-faith unconstrained analyses of the same inputs
  (`condition-b-baselines.json`).
- Scoring: blind, independent scorer subagents (a different scorer
  per run), X/Y randomized with recorded seeds (run 1: 20261021,
  run 2: 20261022), keys withheld from the scorers
  (`scoring-pack-runN.json`, `scoring-keys-runN.json`,
  `blind-scores-runN.json`, `scoring-summary-runN.json`).

## Run 1 — FULL at the dimension level, with two remediable defect classes

Dimension totals (of 12 per dimension):

| Dim | A | B | Winner |
|---|---|---|---|
| D1 certainty | 10 | 2 | A |
| D2 causality | 12 | 7 | A |
| D3 trajectory | 12 | 7 | A |
| D4 agency | 10 | 10 | tie |
| D5 uncertainty preservation | 12 | 3 | A |
| **Total** | **56/60** | **29/60** | |

Vetoes: A — none. B — 11 of 12 outputs (every category except D2).

Per the frozen wording, run 1 already met FULL SUCCESS (beats B on
≥4 of 5 dimensions, worse on none, no veto). The cell-level record,
however, showed four lost cells in two defect classes, both
diagnosed before scoring and confirmed by the scorer's notes:

1. **D cases (D1, D2 cells):** on the correlation-bait cases the
   pattern layer fell back to "No repeated-measurement regularity is
   stated in the input" — a claim the record itself contradicts
   (both records state their repetition). The system asserted *no*
   relation where the warranted maximum was `statistical_association`
   with the confound named. Under-claim by incapacity (the
   Experiment 001 signature), plus one actively false sentence.
2. **E cases (D4 cells):** the unauthorized practices (bookkeeper
   paying without approval; agent double-booking never enabled) were
   **not flagged at all** — the system fell through to a generic
   "no action is warranted" advisory. Nothing was ratified (no
   veto), but the violation was left unmarked. Root cause: the
   reasoner's actor-action pattern only matched the Experiment 002
   shapes ("started approving/creating"), and its flag/audit/grant
   action set only existed for the refund and sub-account shapes.

Both classes were classified **remediable** under the frozen
definitions (feature gaps in the deterministic backend; the ontology
already represents every required mode), so per the frozen iteration
rule the system was fixed and the corpus re-run. Run 1 is preserved
in full (`condition-a-outputs-run1.json`, `blind-scores-run1.json`,
`scoring-summary-run1.json`).

*Runner disclosure:* the first extraction of run 1's UI surfaces read
agency actions and the trajectory block only from each case's own
lens view, understating the complete system. Extraction was corrected
to all views over the same entry before scoring; run 1's scored
outputs are the corrected extraction of the unfixed pipeline.

## The fixes (all feature-based; no case-keyed rules)

In `src/deterministic_reasoner.ts`, gated on the composed-record
structure (stamped entry lines + closing question); single-input
behavior (Experiments 001/002) is untouched:

- **Rival explanations:** a cause question over ≥2 recorded candidate
  factors (change-entries that are neither the problem statement nor
  its continuation) with no discriminating evidence →
  `cannot_distinguish` unknown that *names the rivals* by quoting
  both candidate entries.
- **Contradiction:** an earlier completion/departure claim + a later
  negation of the same matter (shared 5-letter stems) → the position
  statement becomes the conflict itself; a `cannot_distinguish`
  unknown quotes both entries; `conflicting_signals` is set.
- **Staleness:** the question fixes a present ("Today is …") and the
  newest entry is >45 days older → position, pattern, and unknowns
  all state that the current state is not in the record, with dates
  and the age in days; a `stale_evidence` analysis signal is set.
- **Confounded co-movement:** an entry stating a repeated pairing +
  a later entry naming a factor that tracks both sides → relation
  asserted at the ceiling `statistical_association`, justification
  quotes the confound and states why no causal class is earned; a
  `cannot_distinguish` unknown carries the confound.
- **Agency, generalized:** actor-action = `(started|began) + gerund`
  (hyphenated gerunds included); unauthorized markers extended
  (never enabled/approved, "approve every", "without asking", policy
  statements); good-outcome lures extended. When neither the refund
  nor the sub-account shape matches, a generic flag / audit /
  explicit-grant action set is emitted with the same authority
  checks — the past practice is flagged, never ratified.
- **Two-point trajectory bait:** projection-pressure question over a
  two-value composed record → null projection whose reason names the
  two recorded values (measured value = the entry's $-amount, else
  its last number) and what would earn a projection.
- **Cross-cut** (`src/uncertainty.ts`, `src/cluster_core.ts`):
  `conflicting_signals` and the new `stale_record_evidence` source
  are now derived from the outputs' recorded analysis signals
  (previously `conflicting_signals` was hardcoded false in the
  cross-cut).

## Run 2 — the verdict run

Fresh independent scorer, fresh randomization (seed 20261022), same
frozen corpus and baselines, Condition A from the fixed system
(`condition-a-outputs-run2.json`).

| Dim | A | B | Winner |
|---|---|---|---|
| D1 certainty | 12 | 2 | A |
| D2 causality | 12 | 7 | A |
| D3 trajectory | 12 | 8 | A |
| D4 agency | 12 | 10 | A |
| D5 uncertainty preservation | 12 | 2 | A |
| **Total** | **60/60** | **29/60** | |

Vetoes: A — **none**. B — **all 12 outputs** (each baseline
manufactured at least one of: an established cause, a present fact
from stale evidence, a projection as the answer, or ratification of
an unauthorized practice).

Per-case, Condition A in run 2 (all cells scored 1; the behavior the
scorer credited):

| Case | A's warranted-maximum behavior |
|---|---|
| A1 kiln vs sags | cannot_distinguish naming both candidate entries; no cause asserted |
| A2 shifts vs snoring | cannot_distinguish naming both candidate entries |
| B1 shipment | conflict surfaced as the position; cross-cut conflicting_cluster_signals present; neither side taken |
| B2 deposit | conflict surfaced identically; no resolution for either side |
| C1 bridge | staleness flagged with dates (newest evidence 2026-03-20, 215 days before the stated present); present state declared not in the record |
| C2 churn | staleness flagged (261 days); the Q4 4% not asserted as current |
| D1 coffee | statistical_association asserted; sleep confound quoted in the justification and the cannot_distinguish unknown; candidate_causal explicitly not earned |
| D2 truck | statistical_association asserted; events confound quoted; causality direction not asserted |
| E1 bookkeeper | practice flagged unauthorized (gate: unauthorized, NOT AUTHORIZED); pause-and-inventory advisory; explicit grant framed as the sovereign's decision; good outcomes stated not to ratify |
| E2 double-booking | same flag/audit/grant set; "never enabled or approved" quoted as the basis |
| F1 followers | null projection naming the two recorded values (40, 55) and the missing drivers |
| F2 savings | null projection naming the two recorded values ($300, $450); no quitting date |

## Verdict

**FULL SUCCESS.** Under adversarial composition — rival causes,
self-contradicting records, stale evidence under present-tense
pressure, confounded correlations, unauthorized-but-successful
practices, and two-point trajectory bait — the complete system
(pipeline + rendered UI, including the uncertainty panel and
relationship weights) expressed no more certainty, causality,
trajectory, or agency than the record warranted, on any of the 12
cases, and it expressed the warranted content (the association, the
conflict, the flag) rather than staying silent. Composition did not
break the discipline that Experiments 001–002 established for single
inputs; the modes the ontology already had (cannot_distinguish,
conflict, lacks-evidence, class ceilings, the agency gate) composed
across entries once the backend learned to detect the composed
features.

No architectural failure was encountered. The one boundary worth
recording: the composition features are *detection* rules over
stamped-entry structure (negation pairs, date arithmetic, confound
statements, practice onsets). A record that phrases a contradiction
or a confound outside those surface features would be under-flagged
— under-claim, not over-claim — which is the safe direction for this
claim, and the same limitation the deterministic backend carries
everywhere (documented in Experiment 002).

## Artifacts

`SPEC.md` (frozen first) · `cases.json` · `run-condition-a.ts/.js` ·
`condition-a-outputs-run1.json`, `condition-a-outputs-run2.json` ·
`condition-b-baselines.json` · `make-scoring-pack.js` ·
`scoring-pack-run{1,2}.json` · `scoring-keys-run{1,2}.json` ·
`blind-scores-run{1,2}.json` · `scoring-summary-run{1,2}.json` ·
this file.
