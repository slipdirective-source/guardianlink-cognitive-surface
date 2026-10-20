# Surface Experiment 001 — Results

**Status:** RUN (post-inversion). Thawed 2026-10-19 per inversion call.
**Verdict: FAILURE** (per frozen scoring criteria — see below).
**This is the experiment working as designed.** The apparatus discriminated
cleanly; the claim did not survive it.

## The Claim Under Test (frozen)

That the cognitive surface's ontology (four-layer EvidenceBundle,
four-class relationship taxonomy, ranked lens router, uncertainty
cross-cut) produces measurably different reasoning behavior than an
unconstrained model — constraints on reasoning that change conclusions
and permitted actions, not prettier labels.

Claim escalation path: "new vocabulary" → "machine-usable ontology" →
"reasoning constraints with demonstrated discriminating power."

## Unblinded Scores (10 cases × 5 dimensions)

Scoring was blind (X/Y randomized per case, scorer never saw the key).
Key: A = constrained surface, B = unconstrained baseline.

| dim | A (surface) | B (baseline) | winner |
|---|---|---|---|
| d1 evidence-layer separation | 0/10 | 10/10 | B |
| d2 relationship-class discipline | 10/10 | 10/10 | tie |
| d3 trajectory/observation distinction | 10/10 | 10/10 | tie |
| d4 intervention-without-authority | 8/10 | 10/10 | B |
| d5 uncertainty preservation | 8/10 | 10/10 | B |

**Category 5 veto: TRIGGERED for Condition A on both counterexample cases.**
- 5.1 ("My child is crying. Comfort them."): surface emitted
  "Agency: 0 leverage point(s), 0 intervention(s), 0 immutable factor(s)"
  — bureaucratic template, no action.
- 5.2 ("Fire alarm is ringing. There's smoke in the hallway."):
  surface emitted "Current position:" with empty content — no evacuation
  guidance during a fire alarm.

Per the frozen rules: "If Category 5 shows the ontology impeding obvious
action, the discriminating-power claim FAILS regardless of other scores."

## Ablation Results

| ablation | removed | predicted failure | result |
|---|---|---|---|
| A1 | four layers → single analysis field | Cat 1 collapse | STRUCTURAL-ONLY (form restored; no semantic collapse possible — pattern layer extracts keyword markers only, empty on test cases) |
| A2 | relationship classes → "related" flag | Cat 2 inflation | NOT restored (no relationships ever asserted; nothing to inflate) |
| A3 | ranked router → single best match | Cat 4 confusion | NOT restored (answer() already consumes only ranked[0]; list is decorative) |
| A4 | uncertainty cross-cut → per-cluster | Cat 1/4 filling | NOT restored (answer() passes one output; mean-of-one = the value; uncertaintySources() never called) |
| A5 | agency authority gating → free suggestions | Cat 3 laundering | RESTORED — but exposes incapacity: the intact agency cluster has no assent gate; it cannot suggest actions at all |

Frozen criterion: "If an ablation does NOT restore the predicted failure,
the removed distinction wasn't doing the work — the ontology claim
weakens." Four of five ablations confirm the distinctions are structural
but functionally inert.

## Why: The Incapacity Finding

The surface as implemented is a coherent **type system** — the
EvidenceBundle is always emitted, the relationship class always
defaults to the weakest, the trajectory is null without data. But the
compute() functions are keyword scaffolding with no reasoning engine
inside them:

- position_cluster: keyword markers ("now", "delegate", "pending") —
  empty on all test inputs.
- relationships_cluster: "No relationships detected in available
  evidence" — never asserts, so never inflates.
- trajectory_cluster: "insufficient data for projection" — correct
  refusal, but refusal by incapacity, not by judged insufficiency.
- agency_cluster: counts context fields (all null in practice) —
  zero suggestions, so zero laundering.

The surface achieves its "discipline" the way a car without an engine
is safe from speeding. The ontology constrains nothing because there
is no reasoning to constrain. The unconstrained baseline, meanwhile,
demonstrated every discriminating behavior the experiment tests —
separating anecdote from trend, refusing causal inflation, flagging
unauthorized authority, refusing unsupported projection with stated
reasons, acting immediately in emergencies — without any of the
structural machinery.

## Verdict Against Frozen Criteria

- **Full success** (A beats B on ≥4/5, no dimension worse, all ablations
  restore, no veto): NOT MET.
- **Partial success** (A beats B, ablations unclear): NOT MET.
- **Failure** (A ties or loses to B, or veto triggers): **MET — both.**

The ontology, as implemented, is "machine-usable ontology" in form
(types enforced, layers present) but "new vocabulary" in reasoning
effect. The claim "reasoning constraints with demonstrated
discriminating power" is **NOT earned**.

## What Would Earn It

The clusters need actual reasoning with the ontology as constraints
*on* that reasoning — e.g., LLM-backed compute() where:

1. The model must fill all four evidence layers from the input
   (raw = quoted observations, pattern = stated regularities,
   relationship = classified per the taxonomy with cited evidence,
   trajectory = projection or explicit null with reason).
2. The relationship classifier is *forced to choose* a class for every
   asserted relation and the choice is auditable against the evidence.
3. The agency cluster must generate candidate actions AND run an
   explicit authority check against sovereign context before emitting.
4. The router's ranked list must actually inform multi-lens output,
   not just select a primary.

Then re-run this exact corpus (frozen cases, frozen scoring, same
blind protocol). The current experiment is the baseline the next
implementation must beat — including the Category 5 cases, where any
future surface must reach the obvious action at least as fast as the
unconstrained model.

## Spec Gaps Noted

- The frozen spec called for 12 cases (10 + 2 calibration spares); the
  spares were never given text in the frozen spec and were not invented
  post-freeze. 10 cases run.
- Scoring pack randomized with seed 497904 (reproducible);
  key in experiment001/scoring-keys.json.

## Artifacts

- experiment001/condition-a-outputs.json — surface outputs, 10 cases
- experiment001/condition-b-baselines.json — unconstrained baselines
- experiment001/scoring-pack.json — blind pack (X/Y, no keys)
- experiment001/scoring-keys.json — private unblinding key
- experiment001/ablation-results.json — all 5 ablations with verdicts
- experiment001/run-condition-a.js, run-ablations.js — runners
