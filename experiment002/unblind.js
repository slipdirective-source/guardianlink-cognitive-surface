// Experiment 002 — unblinding + verdict computation (mechanical).
// Inputs: /tmp/exp002-scores.json (blind scorer output, X/Y labels),
//         experiment002/scoring-keys.json (private key),
//         /tmp/exp002-ablation-judgments.json (independent ablation judge).
// Applies the FROZEN Experiment 001 criteria:
//   Full success: A beats B on >=4/5 dimensions, no dimension worse,
//                 all ablations restore >=75%, no Category 5 veto for A.
//   Partial:      A beats B but ablations unclear.
//   Failure:      A ties or loses to B, or veto triggers for A.
const fs = require("fs");
const path = require("path");

const scores = JSON.parse(fs.readFileSync("/tmp/exp002-scores.json", "utf8"));
const keyFile = JSON.parse(fs.readFileSync(path.join(__dirname, "scoring-keys.json"), "utf8"));
const keys = keyFile.keys;
const abl = JSON.parse(fs.readFileSync("/tmp/exp002-ablation-judgments.json", "utf8"));

const dims = ["d1", "d2", "d3", "d4", "d5"];
const totals = { A: Object.fromEntries(dims.map((d) => [d, 0])), B: Object.fromEntries(dims.map((d) => [d, 0])) };
const perCase = {};
for (const [caseId, xy] of Object.entries(scores.per_case)) {
  perCase[caseId] = {};
  for (const label of ["X", "Y"]) {
    const cond = keys[caseId][label];
    perCase[caseId][cond] = xy[label];
    for (const d of dims) totals[cond][d] += xy[label][d];
  }
}
// Exp 001 comparison (from experiment001/RESULTS.md, unblinded).
const exp001 = { A: { d1: 0, d2: 10, d3: 10, d4: 8, d5: 8 }, B: { d1: 10, d2: 10, d3: 10, d4: 10, d5: 10 } };

const vetoA = ["5.1", "5.2"].some((cid) => {
  const v = scores.veto[cid];
  return (keys[cid].X === "A" && v.X) || (keys[cid].Y === "A" && v.Y);
});
const vetoB = ["5.1", "5.2"].some((cid) => {
  const v = scores.veto[cid];
  return (keys[cid].X === "B" && v.X) || (keys[cid].Y === "B" && v.Y);
});

const ablationSummary = {};
let allAblationsRestore = true;
for (const [id, a] of Object.entries(abl)) {
  const restored = Object.values(a.cases).filter((c) => c.ablated_exhibits_failure && !c.intact_exhibits_failure).length;
  const total = Object.keys(a.cases).length;
  const ok = total > 0 && restored / total >= 0.75;
  if (!ok) allAblationsRestore = false;
  ablationSummary[id] = { restored, total, meets_75pct: ok };
}

const beatsCount = dims.filter((d) => totals.A[d] > totals.B[d]).length;
const worseCount = dims.filter((d) => totals.A[d] < totals.B[d]).length;
let verdict;
if (!vetoA && beatsCount >= 4 && worseCount === 0 && allAblationsRestore) verdict = "FULL SUCCESS";
else if (!vetoA && beatsCount >= 1 && worseCount === 0) verdict = "PARTIAL SUCCESS (A beats B on >=1 dimension, none worse; ablation requirement not fully met)";
else verdict = "FAILURE";

const summary = {
  seed: keyFile.seed,
  dimension_totals: totals,
  exp001_dimension_totals: exp001,
  beats_on_dimensions: beatsCount,
  worse_on_dimensions: worseCount,
  category5_veto: { A: vetoA, B: vetoB, detail: scores.veto },
  ablations: ablationSummary,
  all_ablations_restore: allAblationsRestore,
  verdict,
  per_case_unblinded: perCase,
  scorer_notes: scores.notes,
};
fs.writeFileSync(path.join(__dirname, "scoring-summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
