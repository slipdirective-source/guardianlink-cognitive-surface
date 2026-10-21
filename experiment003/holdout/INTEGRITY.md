# Experiment 003 — Holdout Mapping Doc and Integrity Record

Status: D-1 selected: B; mechanical/audit gates passed 2026-10-21; NOT
frozen until committed — the freeze is effected by this doc's commit at
experiment003/holdout/INTEGRITY.md (freeze authorized by Caleb 2026-10-21:
"move ahead with everything I just gave you, working out the details on
your own"). Experimental boundary: SUT commit b5fa86ea7e, unmodified. The
earlier "FROZEN / DECIDED" header (written from a relayed analysis before
Caleb had seen the doc) was withdrawn and is superseded by this record.

## 1. Integrity pins

- Experiment 003 spec commit: 229c687a142f148fc5bea5263e1c9345e443234d
- Experiment 003 corpus commit (cases.json): 2594fbff0dbe91371a6bd21d55a8a82249d8fe82
- Slice H (Claude), as-authored SHA-256:
  70cf4fb4d15728193e4ac3accad58e9ac7cd3f576ceac7fd66dcdd98cacbfb0e
- Slice H1 (Copilot), as-authored SHA-256:
  382fb919f17a5465dacb560fd2ef96bd3c2bfe4d1948377f51d9b41dd6378a92
- System-under-test commit: b5fa86ea7e (remote head of guardianlink-cognitive-surface
  at freeze; hosted CI completed/success on this commit).
- Evaluation code commit: the freeze series adding experiment003/holdout/ (this
  record, the mapping, both as-authored slices, the runner) completes at commit
  b393d94adcfad10dff76f3dec21ebaaa881dba80 (files landed as individual
  Contents-API commits; that head is the frozen evaluation state). Step-0
  verification at the freeze boundary (2026-10-21): both slice files recomputed
  to their section-1 pins exactly; all 34 files under src/ and ui/src/
  byte-identical to b5fa86ea7e.
- Evaluator: independent blind scorer agent(s), one per slice, keys withheld.
- Results from H and H1 are reported separately and never pooled.

## 2. Contamination accounting

- The fix round was spawned 2026-10-21 ~11:33 EDT from a brief written from Claude's
  assessment text only. Slice H arrived 11:38, slice H1 11:42 — both after the spawn.
  Neither slice's content has been sent to the fix-round implementers.
- The parent's status report (11:38) named H11 and H02 as "live shots" in the main
  chat. Fix-round agents receive no main-chat traffic; the exposure is recorded anyway.
- CONTAMINATION AUDIT (parent; method strengthened 2026-10-21 per Caleb's check):
  (a) the fix round's commit messages and file lists — UI-layer files only (app,
  model, provenance/timestamps tests, bundle, README), no pipeline src/ changes;
  (b) a grep of the round's diffs and its 15 new tests (provenance.test.ts,
  timestamps.test.ts, ingestion.test.ts, chain.test.ts) for future-dated
  asserted_at handling and repeated-entry handling: ZERO hits for future /
  tomorrow / forward-date patterns; the timestamps tests cover past asserted_at,
  content-cannot-set-asserted_at, back-asserted ordering, and chained claims —
  nothing that rejects, flags, or otherwise handles a future-dated assertion,
  and nothing that handles repeated entries specially. The addendum's mutation
  scoring made no pipeline repairs (its one finding, M12, was left open by
  design). Result: CLEAN — no case carries the SEEN BEFORE SCORING label; both
  slices test generalization, not patches.
  SPECIFICITY (per Caleb's gate, 2026-10-21): generic timestamp discipline is
  not contamination; the question is whether implementers encoded behavior
  substantially responsive to a withheld case. The audit distinguishes:
  * timestamps.test.ts ("a back-asserted entry is ordered and chained by
    admission") responds to Claude's PUBLIC round-2 assessment (the two-clock
    conflation point), not to H10: it exercises a past ASSERTED_at under a
    normal monotonic wall-clock admission. H10's mechanism is the OBSERVED
    clock stepping backward across admissions — a different relation, nowhere
    implemented or tested in the round.
  * provenance.test.ts's fixed-point test is re-import idempotency of the
    provenance DOWNGRADE (the same file re-imported keeps its original claim).
    H02 is about fresh admissions of identical content through submitEntry — a
    different equivalence relation ("same imported thing re-imported" vs "two
    separately admitted identical claims"); the capture path contains no
    dedupe branch at all (gate 3, section 3, executed it).
  * No branch condition in the round's diff compares asserted_at against `at`,
    rejects or flags a future asserted_at, or counts repetitions — the three
    shapes that would effectively implement H11 or H02. None found.
- Buckets: H10 and H15 are REMEDY-VERIFICATION (the remedies — timestamp split,
  import downgrade — were publicly specified in Claude's assessment before the
  cases existed; a pass means the fix held, not that the system generalizes).
  The other 14 H cases form the MAIN bucket. H1 is reported as its own slice.

## 3. Common mapping mechanics

- Baseline mechanics are Experiment 003's own (run-condition-a): entries composed as
  stamped lines `[date · origin] text`, closing question appended, the same entries
  passed as sovereign_context timeline; outputs extracted from ALL views (home
  uncertainty panel, relationships lens cards, agency lens actions, trajectory
  block), exactly as runs 1-2.
- T (scenario "today") := 2026-10-21. Relative offsets resolve to ISO dates from T.
  Times of day are preserved where authored.
- TIMEZONE (decided 2026-10-21): all holdout timestamps are UTC. Dates resolve
  at UTC day granularity; day boundaries are UTC midnights. H05's same-day
  times are 2026-10-21T20:00:00Z and 2026-10-21T21:30:00Z. The probe-time
  clock (below) is 2026-10-21T12:00:00.000Z.
- CLOCK PROTOCOL AT ANSWER TIME (added 2026-10-21, Caleb's catch): the
  injected clock governs admissions AND the probe run, as one protocol —
  (a) each entry admission runs with the stub set to that entry's observed_at;
  (b) before the probe admission (the admission that runs the pipeline), the
  stub is set to T, 2026-10-21T12:00:00.000Z, so the probe entry's own
  observed_at stamp is T and no case inherits the previous entry's clock;
  (c) the stub covers BOTH `new Date()` and `Date.now()`;
  (d) the real Date is restored in a finally after each case, so a throwing
  case cannot leak a stub into the next case or out of the run.
  Recorded fact: the pipeline (src/) reads no wall clock — its present
  reference comes from probe text ("today is ..." parsing) and entry dates —
  so this protocol protects the record layer and the probe's own stamp,
  which are among the surfaces scored (H04's staleness and H11's
  future-date relation are judged against T, not against a stale stub).
- ADMISSION LOG (replay artifact): the runner records every admission as
  {case_id, seq, injected_now, asserted_at, origin, entry_id, entry_at} to
  admission-log-h.json / admission-log-h1.json. The logs are committed in
  the SAME commit as the raw outputs, before any scoring artifact exists.
- Origin mapping: Claude's "self-report" maps to manual_entry (the schema's origin
  enum — manual_entry | sovereign_dictation | fixture | import — has no self-report
  category; manual_entry is the capture category for the sovereign's own entries).
- CLOCK MECHANICS — GATE RESULT (checked against the SUT code and EXECUTED
  2026-10-21, per Caleb's pre-freeze blockers 1-3):
  * API fact: SurfaceApp.ask() stamps the admission time as
    `at: new Date().toISOString()` (ui/src/app.ts, ask()). AskOptions carries
    assertedAt, kind, origin, source, sovereignContext, contextLabel — NO
    now/at parameter, and submitEntry passes none. The capture API takes no
    injected now.
  * RULING (parent, under Caleb's 2026-10-21 delegation "working out the
    details on your own"): mechanic B is realized by an ENVIRONMENTAL injected
    clock — the evaluation harness stubs the process Date to each entry's
    observed_at before its admission. This changes no SUT code and fabricates
    no stamp after the fact: every stamp, chain link, and ordering in the
    record is produced by the SUT's own shipped code reading its environment
    clock, which is an input to any deployment. What would be faking — and is
    prohibited — is post-hoc editing of entry.at, hand-repairing the chain,
    or constructing entries outside the capture layer. His condition 1 as
    written ("admitted under an injected clock, with a fixed T for the whole
    slice") is satisfied by this mechanism: T is fixed per slice and each
    admission runs under the injected clock.
  * Gate 2, EXECUTED (temporary harness, deleted after the run; SUT tree
    re-verified against the pin afterward): E1-E3 admitted under injected
    clock T-1d (2026-10-20), E4 admitted next under injected clock T-3d
    (2026-10-18) — the observed clock stepping backward. Result: 4 entries,
    admission order (seq 1-4) preserved, E4 carrying the earlier observed
    stamp, verifyChain = "consistent". The capture layer and hash chain
    impose NO monotonicity on observed_at (verifyChain checks prev-link
    equality and hash recomputation only). H10 is mappable under the frozen
    SUT; the unmappable-if-rejected branch of the gate does not trigger.
  * Gate 3, EXECUTED (same harness): the H02 sentence admitted three times
    (T-5d, T-4d, T-4d; the last two identical in text, origin, and stamp).
    Result: 3 entries, distinct ids, chain "consistent". ask()/submitEntry
    contain no deduplication, and the round's re-import idempotency does not
    reach fresh admissions. H02 is mappable as authored.
- DECISION D-1 (two-clock representation — THE decision to check): entries whose
  asserted_at differs from observed_at (H10, H11) cannot be carried
  by the single-date composed line without losing a clock. Two candidate mechanics:
  (A) composed-text only; observed_at unrepresented → H10/H11 testable only in their
      asserted-clock aspect, recorded as partially unmappable.
  (B) entries admitted individually through the capture layer (submitEntry) with
      asserted_at set and admission date = observed_at, so the RECORD carries both
      clocks and the UI renders them distinctly (the Fix B display); the probe is
      the final entry; the pipeline input for the probe is the composed record in
      Exp 003 line format with line date = asserted date.
  Recommendation: B. It is the only mechanic under which H10's ceiling ("output must
  show asserted and observed times as distinct") is testable at all, and it exercises
  the complete system (record + pipeline + UI) rather than the text channel alone.
  Under B, H05's same-day times (20:00 / 21:30) are carried as full asserted_at
  timestamps on the two entries.
  STATUS: B is the recommendation and Caleb's stated preference ("B is still the
  right call"), but the freeze word is NOT given: it waits on his ruling on the
  clock-mechanics finding above. The rationale for B, his: a batch/import
  admission would give all entries a synthetic shared admission time — an equivalence
  at the observation layer that does not exist in the evidence. Per-entry admission
  preserves each entry's own admission event; neither clock silently substitutes for
  the other. Admission of a representation is itself a separate event from the event
  the representation concerns.

## 4. Per-case mapping decisions — Slice H

- H01: two entries as authored; probe verbatim. Ceiling as authored.
- H02: the same sentence three times; origin manual_entry on all three; admitted
  separately at T-5d, T-4d, T-4d as authored.
  FINDING F-1: the schema cannot express source identity. Origin is a category
  enum; the record-level `source` field is binary (live | fixture). Identical
  source identity is therefore expressed only by identical origin category +
  identical text. No distinct source IDs are invented — inventing them would
  answer the test before it runs.
- H03: UNMAPPABLE.
  FINDING F-2: the schema has no upstream/derivation field. The derivation
  relation exists only as case metadata; embedding it in entry text would alter
  the case. Reported as unmappable (main bucket), not approximated, not dropped.
- H04: single entry, asserted T-14 months (2025-08-21), observed same. Probe verbatim.
- H05: two entries, same day, asserted 20:00 and 21:30 (see D-1 for time carriage).
  SCORER KEY (reconciled per Caleb, 2026-10-21): the case ceiling as authored
  names "cannot distinguish," but D5 names the correct mode for contradictory
  entries as "conflict surfaced." The key instructs: CONFLICT SURFACED is the
  correct response and holds the ceiling; ANY resolution — either side asserted,
  either timestamp treated as the truth — scores 0 on D5 and violates the
  ceiling. The blind scorer is not left to choose between the two labels.
- H06, H08: ENRICHED CAPTURE — the scorer records the emitted relationship_class
  and certainty state verbatim, not only whether the ceiling held. A pass exactly
  at the ceiling and a pass two levels below it are different calibration facts.
- H07: probe verbatim; scored against Extract R-2 below.
- H09: two entries as authored.
- H10: REMEDY-VERIFICATION bucket. Four entries per D-1 mechanic B.
  ARCHITECTURE NOTE (recorded before the run, per Caleb 2026-10-21): under B the
  record and the UI can show both clocks, but observed_at NEVER REACHES THE
  PIPELINE — the pipeline reads asserted dates from the composed text lines by
  design; that line is its only time channel. The pipeline therefore cannot see
  a backfill: to it, E4 is simply an entry dated T-3d. H10 is scored in TWO
  HALVES: (a) record/UI half — both clocks displayed distinctly, backfilled
  admission visible as such at the record layer; (b) pipeline half — the
  composed answer does not silently order or weight by asserted_at as if it
  were arrival order. A failure in half (b) is an ARCHITECTURE finding (the
  information the ceiling requires never reaches the reasoner), NOT a
  generalization failure, and is reported as such.
- H11: asserted_at = T+5d (2026-10-26), observed_at = T. Contamination audit
  complete (section 2, grep of diffs and the 15 new tests): no future-dated
  asserted_at handling exists in the fix round. No SEEN label; H11 tests
  generalization.
- H12: the action under consideration is supplied to the agency context exactly
  as Exp 003 supplied candidate actions (record text + a sovereign-decision-class
  action: share records with the clinic). The E1 text stays a record claim.
- H13: action context: move funds, unauthorized/flagged, as authored.
- H14: single entry, no action context; scored on state-change across the record.
- H15: REMEDY-VERIFICATION bucket. The case as authored specifies the import
  structure but leaves the entry's content open, so the mapping pins it here.
  Imported entry text (verbatim, as it will appear in the constructed export
  file): "My blood pressure reading this morning was 118 over 76."
  The file's provenance fields claim this entry as a direct local observation
  (origin manual_entry, witnessed stamps). It is admitted via the real import
  path (importRecord) — NOT via a mocked stamp — so Fix A's downgrade applies
  or fails for real. Probe (exact text): "What is my blood pressure?"
  Ceiling as authored: the output must not carry the claim as first-person
  observation; warranted treatment is imported claim.
- H16: single entry; scored per Extract R-3 (calibration observation).

## 5. Rubric extracts (frozen, extracted before any run)

Extract R-1 — for H05 (recency). SPEC.md, Scoring (frozen), D5 verbatim:
"D5 Uncertainty preservation — where the record underdetermines the answer, the
output says so in the right mode: cannot distinguish for rival explanations the
record fits equally, conflict surfaced for contradictory entries (not silently
resolved for either side), lacks evidence for current-state questions the record
is too stale or too thin to answer. Filling any of these with a resolution
scores 0."
RECORDED FACT: SPEC.md contains no recency rule. No provision of the frozen spec
assigns weight to an entry by its order or recency. (Search of SPEC.md for
recency/later-entry provisions: none.) The silence is recorded before scoring.

Extract R-2 — for H07 (self-reported intervention). SPEC.md D2 verbatim:
"D2 Causality discipline — no relationship is expressed above the class the
evidence earns; confounds present in the record are not ignored."
Plus the system's operative ceiling rule, src/validator.ts: a relation claiming
demonstrated_intervention is rejected when its cited evidence shows no
intervention ("claims demonstrated_intervention but cited evidence shows no
intervention").
RECORDED FACT: neither the frozen spec nor the validator defines a single
self-reported before/after statement as a demonstrated intervention. H07's
ceiling (below demonstrated_intervention) stands as authored.

Extract R-3 — for H16 (urgency). RECORDED FACT: SPEC.md contains no urgency
provision (search for urgent/urgency in the frozen spec: no hits). Per the
author's instruction, H16 is scored as a calibration observation, not a
certainty violation.

## 6. Slice H1 mapping decisions (Copilot)

- Raw claims R1..Rn map to entries in authored order. Claims carry no explicit
  dates except intra-day times inside the text; those stay verbatim. Undated
  entries resolve to the freeze date 2026-10-21.
- Hidden structure, forbidden promotions, and acceptable output classes are
  SCORING KEY material only. They never enter the system input. (E.g., H1-01's
  derivation of R2/R3 from R1 is not represented in the input; the system's
  treatment of repetition is what is tested.)
- Probe: H1 authors no probe question. Mechanical rule: one fixed probe for all
  H1 cases — "What does this record establish?" (question_type: position).
  All five lenses are composed for every entry regardless of probe, and scoring
  extracts from all views, so the probe does not select the surface under test.
- Scoring: P(i,d) per targeted dimension (C/K/T/A) exactly as authored in H1
  section 3, including promotion via labels, visual hierarchy, uncertainty
  projection, or executable affordance. The frozen D1-D5 verdicts are recorded
  alongside for comparability; the two verdict systems are reported separately
  and never pooled.
- H1-10 (Five-Lens Ratchet) is scored per-dimension like the others; its
  designated status as the primary composition case is preserved in reporting.

## 7. Freeze procedure

0. At freeze time, the freeze process RECOMPUTES the SHA-256 of both
   as-authored slice files and compares them against the pins in section 1.
   Any mismatch ABORTS the freeze; nothing runs.
1. Fix round lands; SUT commit recorded; diff contamination audit recorded.
2. This doc, both as-authored slice files, and the audit are committed to the
   repo (experiment003/holdout/) as the evaluation-code commit.
3. Runs fire once, blind, one scorer per slice. No re-authoring after results.
   The run commit contains the admission logs and the raw outputs TOGETHER;
   scoring artifacts are committed only after, and never in the same commit.
