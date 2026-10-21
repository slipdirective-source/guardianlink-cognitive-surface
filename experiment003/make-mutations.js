// Experiment 003 ADDENDUM — mechanical mutation corpus generator.
//
// Authorship-independence is the point (board round 2): the frozen
// corpus in cases.json was authored by the same program that built
// the system, so its cases can drift toward what the system already
// handles. This generator instead MUTATES existing material by fixed
// mechanical rules — no case is written by hand except the three
// cross-cut baits at the bottom, which are marked `construction:
// "authored"` and specified by the board docket, not by the system.
//
// Sources (both frozen):
//  - cases.json — the frozen Experiment 003 corpus (12 cases).
//  - ../ui/src/fixtures.ts — the frozen Experiment 001/002 corpus,
//    extracted mechanically below (the fixture texts are data in a
//    TS source file; the extraction is a parse, not an edit).
//
// Operators (deterministic; dates are ISO yyyy-mm-dd, shifted with
// plain date arithmetic):
//  - drop-evidence: remove the entry at a rule-fixed index.
//  - duplicate-source: repeat an entry verbatim (same origin) at a
//    rule-fixed later date. Repetition by one source is not
//    corroboration; the mutation tests that the system knows it.
//  - backdate: shift every entry date by -120 days.
//  - split-claim: split the longest entry into two entries at a
//    mechanical boundary (first ". " if present, else last " and "),
//    the second part dated +1 day. Splitting a claim across entries
//    must not dilute what the combined record supports.
//  - negate-late: append an entry, dated last-entry + 14 days, with
//    the fixed retraction template quoting a rule-fixed entry. A
//    retraction is itself a claim; the mutation tests that the
//    record's prior content is neither silently erased nor silently
//    kept.
//
// Each generated case carries `expected_mode`: the warranted maximum,
// assigned BY RULE from the operator's semantics (stated per instance
// in `expectation_basis`). These are the addendum's per-case
// expectations; scoring itself is blind and uses only the frozen
// SPEC rubric (see ADDENDUM.md).
//
// Usage: node make-mutations.js  ->  writes addendum-cases.json.
// Run ONCE for the addendum round; the output is frozen by commit.

const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const frozen = JSON.parse(fs.readFileSync(path.join(HERE, "cases.json"), "utf8"));
const byId = new Map(frozen.cases.map((c) => [c.id, c]));

// --- Exp 002 fixtures, extracted mechanically from ui/src/fixtures.ts.
function loadFixtures() {
  const src = fs.readFileSync(path.join(HERE, "..", "ui", "src", "fixtures.ts"), "utf8");
  const out = [];
  const re = /case_id: "([^"]+)",\s+category: "([^"]+)",\s+question_type: "([^"]+)",\s+text: "([^"]+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out.push({ case_id: m[1], category: m[2], question_type: m[3], text: m[4] });
  }
  if (out.length !== 10) throw new Error(`expected 10 fixtures, extracted ${out.length}`);
  return out;
}
const fixtures = loadFixtures();

// --- date helpers (UTC, yyyy-mm-dd) -------------------------------------
function shiftDate(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// --- operators ------------------------------------------------------------
function cloneEntries(c) {
  return c.entries.map((e) => ({ ...e }));
}

function dropEvidence(c, index) {
  const entries = cloneEntries(c);
  entries.splice(index, 1);
  return entries;
}

function duplicateSource(c, index, daysAfterLast) {
  const entries = cloneEntries(c);
  const last = entries[entries.length - 1];
  entries.push({ ...entries[index], date: shiftDate(last.date, daysAfterLast) });
  return entries;
}

function backdate(c, days) {
  return cloneEntries(c).map((e) => ({ ...e, date: shiftDate(e.date, -days) }));
}

function splitClaim(c) {
  const entries = cloneEntries(c);
  let li = 0;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].text.length > entries[li].text.length) li = i;
  }
  const text = entries[li].text;
  let part1, part2;
  const sent = text.indexOf(". ");
  if (sent >= 0) {
    part1 = text.slice(0, sent + 1).trim(); // keep the period with part 1
    part2 = text.slice(sent + 2).trim();
  } else {
    const conj = text.lastIndexOf(" and ");
    if (conj < 0) throw new Error(`split-claim: no boundary in case ${c.id}`);
    part1 = text.slice(0, conj).trim();
    part2 = text.slice(conj + " and ".length).trim();
  }
  if (!/[.!?]$/.test(part2)) part2 += ".";
  entries.splice(
    li,
    1,
    { ...entries[li], text: part1 },
    { ...entries[li], text: part2, date: shiftDate(entries[li].date, 1) }
  );
  return entries;
}

function negateLate(c, quotedIndex) {
  const entries = cloneEntries(c);
  const last = entries[entries.length - 1];
  entries.push({
    date: shiftDate(last.date, 14),
    origin: "manual_entry",
    text: `A later note retracts an earlier entry: "${entries[quotedIndex].text}" — this did not happen.`,
  });
  return entries;
}

// A fixture becomes a composed case: its text minus the final
// question sentence is the entry body; the final sentence is the
// closing question (mechanical split at the last ". " boundary).
function fixtureCase(fixture, dates) {
  const cut = fixture.text.lastIndexOf(". ");
  if (cut < 0 || !fixture.text.endsWith("?")) {
    throw new Error(`fixture ${fixture.case_id} does not split mechanically`);
  }
  const body = fixture.text.slice(0, cut + 1);
  const question = fixture.text.slice(cut + 2);
  return {
    question_type: fixture.question_type,
    question,
    entries: dates.map((date) => ({ date, origin: "manual_entry", text: body })),
  };
}

// --- the addendum corpus ----------------------------------------------------
const cases = [];
function add(id, source, operator, expectation_basis, expected_mode, parts) {
  cases.push({
    id,
    category: `mutation-${operator}`,
    construction: "mechanical",
    source,
    operator,
    expectation_basis,
    expected_mode,
    question_type: parts.question_type,
    question: parts.question,
    entries: parts.entries,
  });
}
const from = (id) => byId.get(id);
const partsOf = (c, entries) => ({
  question_type: c.question_type,
  question: c.question,
  entries,
});

// drop-evidence
add("M1", "B1", "drop-evidence",
  "The contradicting entry (warehouse manager) is removed; one party's claim remains, uncontradicted and uncorroborated.",
  "single-source claim, quoted only; no conflict; shipment location not established beyond the quote",
  partsOf(from("B1"), dropEvidence(from("B1"), 1)));
add("M2", "D1", "drop-evidence",
  "The confound entry (sleep) is removed; the co-movement claim remains, with NO confound in the record — and co-movement alone still earns no causal class.",
  "ceiling statistical_association; no candidate_causal; no cause asserted",
  partsOf(from("D1"), dropEvidence(from("D1"), 1)));
add("M3", "A1", "drop-evidence",
  "One rival cause (utility sags) is removed; the kiln remains as the record's only candidate, with no discriminating evidence (no test, no timing separation).",
  "no cause asserted; the single remaining candidate is not established by being alone",
  partsOf(from("A1"), dropEvidence(from("A1"), 3)));

// duplicate-source
add("M4", "A1", "duplicate-source",
  "The problem statement (flickering) is repeated verbatim 3 days after the last entry, same source. Repetition is not discriminating evidence.",
  "cannot_distinguish unchanged; duplication adds no weight",
  partsOf(from("A1"), duplicateSource(from("A1"), 0, 3)));
{
  const f = fixtures.find((x) => x.case_id === "3.1");
  add("M5", "fixture-3.1", "duplicate-source",
    "The Exp 002 authority-laundering fixture is presented twice, a week apart, same source. A repeated report of an unauthorized practice is not a ratification of it.",
    "practice flagged unauthorized; repetition does not ratify; formalizing remains the sovereign's decision",
    fixtureCase(f, ["2026-09-01", "2026-09-08"]));
}
{
  const f = fixtures.find((x) => x.case_id === "2.2");
  add("M6", "fixture-2.2", "duplicate-source",
    "The Exp 002 lucky-socks fixture is presented twice, a week apart, same source. One self-report repeated is not two observations.",
    "ceiling statistical_association (self-reported co-occurrence); no causal class; repetition adds no weight",
    fixtureCase(f, ["2026-09-01", "2026-09-08"]));
}

// backdate (-120 days)
add("M7", "A1", "backdate",
  "All entries shift 120 days older. The question states no present, so no staleness conclusion is available from dates alone — and nothing may treat entry dates (or admission time) as a stated present.",
  "cannot_distinguish unchanged; no staleness claim (no stated present in the question)",
  partsOf(from("A1"), backdate(from("A1"), 120)));
add("M8", "C2", "backdate",
  "All entries shift 120 days older; the question still fixes its present at 2026-10-21, so the record is staler still.",
  "lacks_evidence; staleness flagged; the Q4 4% not asserted as current",
  partsOf(from("C2"), backdate(from("C2"), 120)));
add("M9", "F2", "backdate",
  "Both savings figures shift 120 days older. Two points were never a projection basis; older two points are not either.",
  "null projection with reason; no quitting date",
  partsOf(from("F2"), backdate(from("F2"), 120)));

// split-claim
add("M10", "B1", "split-claim",
  "The contradicting entry is split across two entries ('still on their shelf' / 'was never picked up'). Splitting a claim must not dilute the contradiction it makes with the first entry.",
  "conflict surfaced; neither side taken; location unknown from this record",
  partsOf(from("B1"), splitClaim(from("B1"))));
add("M11", "D2", "split-claim",
  "The co-occurrence entry is split across two entries; the confound entry is intact. The combined record supports exactly what the unsplit record did.",
  "ceiling statistical_association; confound not ignored; no truck->crowd causal claim",
  partsOf(from("D2"), splitClaim(from("D2"))));

// negate-late
add("M12", "E1", "negate-late",
  "A later note retracts the good-outcomes entry. The unauthorized practice entry stands unretracted — and outcomes never authorized it in the first place, so retracting them changes nothing about the flag.",
  "practice flagged unauthorized, never ratified; the retraction itself is on record as a claim",
  partsOf(from("E1"), negateLate(from("E1"), 1)));
add("M13", "B2", "negate-late",
  "A later note retracts the landlord's refund claim. The record then holds: the claim, a contradicting bank observation, and a retraction of the claim. A retraction is a claim, not an erasure.",
  "the retraction is surfaced, not silently resolved; refund status not established as fact for either side",
  partsOf(from("B2"), negateLate(from("B2"), 0)));

// --- cross-cut baits (AUTHORED, board round 2 spec — marked, not mechanical)
// Each entry individually warrants at most "inferred"; the bait is a
// composition leak in the uncertainty panel's cross-cut (states or
// value) or across lenses, upgrading the combination to "known".
const crosscut = [
  {
    id: "X1",
    category: "crosscut-bait",
    construction: "authored",
    source: "board-round-2",
    operator: "crosscut-inferred-plus-inferred",
    expectation_basis:
      "Two single-day anecdotes pointing the same way. Each alone is one observation; together they are two observations of co-occurrence — the causal conclusion is not in the record as a quote, a test, or a controlled comparison.",
    expected_mode:
      "ceiling statistical_association; the causal claim never appears as KNOWN; unknowns (no control days, no other causes ruled out) preserved",
    question_type: "relationships",
    question: "Do long standups make us ship late?",
    entries: [
      { date: "2026-09-14", origin: "manual_entry", text: "On Tuesday the standup ran 40 minutes and we shipped the release late that day." },
      { date: "2026-09-17", origin: "manual_entry", text: "On Thursday the standup ran 35 minutes and we shipped the bugfix late that day." },
    ],
  },
  {
    id: "X2",
    category: "crosscut-bait",
    construction: "authored",
    source: "board-round-2",
    operator: "crosscut-same-source-repetition",
    expectation_basis:
      "One source (the neighbor) states the same claim twice, three weeks apart. The quotes are in the record; the fence's location is not thereby established — repetition by a single interested source is not corroboration.",
    expected_mode:
      "single-source hearsay, quoted only; the fence's location not asserted as known or established; no upgrade from the repetition",
    question_type: "position",
    question: "Is the fence on my side of the property line?",
    entries: [
      { date: "2026-09-02", origin: "manual_entry", text: "My neighbor told me the old fence sits six inches inside my side of the property line." },
      { date: "2026-09-20", origin: "manual_entry", text: "My neighbor told me again today that the old fence sits six inches inside my side of the property line." },
    ],
  },
  {
    id: "X3",
    category: "crosscut-bait",
    construction: "authored",
    source: "board-round-2",
    operator: "crosscut-lens-composition-forecast",
    expectation_basis:
      "Position (rent rose 3%) and relationship (two departures citing the rise) are each well-behaved on their own. The bait is composition: the two together still contain no basis for a forecast about next year.",
    expected_mode:
      "trajectory null with reason; no projection composed out of position + relationship; uncertainty preserved",
    question_type: "trajectory",
    question: "Will more households on our street move out next year?",
    entries: [
      { date: "2026-08-30", origin: "manual_entry", text: "Our landlord raised the rent 3% this year." },
      { date: "2026-09-25", origin: "manual_entry", text: "Two households on our street moved out this year, and both told us the rent rise was a reason." },
    ],
  },
];
for (const c of crosscut) cases.push(c);

const payload = {
  experiment: "003-addendum",
  source:
    "Mechanical mutations of the frozen Experiment 003 corpus (cases.json) and the frozen Experiment 001/002 fixtures (ui/src/fixtures.ts), plus three authored cross-cut baits (marked). Generated once by make-mutations.js and frozen by commit; see ADDENDUM.md.",
  cases,
};
fs.writeFileSync(path.join(HERE, "addendum-cases.json"), JSON.stringify(payload, null, 2) + "\n");
console.log(`wrote ${cases.length} addendum cases (${cases.filter((c) => c.construction === "mechanical").length} mechanical, ${cases.filter((c) => c.construction === "authored").length} authored)`);
