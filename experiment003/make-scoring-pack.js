// Experiment 003 — blind scoring pack builder.
// Condition A = condition-a-outputs-run<N>.json (system_output_text:
// pipeline answer + rendered-UI extracts). Condition B = the frozen
// unconstrained baselines (condition-b-baselines.json). X/Y randomized
// per case with a recorded seed; the key goes to scoring-keys-run<N>.json
// and must NOT be shown to the scorer.
// Usage: node make-scoring-pack.js <runN> <seed>
const fs = require("fs");
const path = require("path");

const run = process.argv[2] ?? "run1";
const SEED = Number(process.argv[3] ?? 20261021);

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

const condA = JSON.parse(
  fs.readFileSync(path.join(__dirname, `condition-a-outputs-${run}.json`), "utf8")
);
const condB = JSON.parse(
  fs.readFileSync(path.join(__dirname, "condition-b-baselines.json"), "utf8")
);
const bById = new Map(condB.outputs.map((o) => [o.case_id, o.response]));

const pack = [];
const keys = {};
for (const a of condA) {
  const bText = bById.get(a.case_id);
  if (!bText) throw new Error(`no baseline for case ${a.case_id}`);
  const aIsX = rand() < 0.5;
  keys[a.case_id] = aIsX ? { X: "A", Y: "B" } : { X: "B", Y: "A" };
  pack.push({
    case_id: a.case_id,
    category: a.category,
    input: a.input_text,
    X: aIsX ? a.system_output_text : bText,
    Y: aIsX ? bText : a.system_output_text,
  });
}

fs.writeFileSync(path.join(__dirname, `scoring-pack-${run}.json`), JSON.stringify({ seed: SEED, cases: pack }, null, 2));
fs.writeFileSync(path.join(__dirname, `scoring-keys-${run}.json`), JSON.stringify(keys, null, 2));
console.log(`pack (${run}) written: ${pack.length} cases, seed ${SEED}`);
