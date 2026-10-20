// Experiment 002 — blind scoring pack builder.
// Condition B = the FROZEN Experiment 001 baselines, reused verbatim
// (experiment001/condition-b-baselines.json). Condition A = rebuilt surface
// answer_text. X/Y randomized per case with a recorded seed; the key is
// written to scoring-keys.json and must NOT be shown to the scorer.
const fs = require("fs");
const path = require("path");

const SEED = 20261020;
// Deterministic PRNG (mulberry32) so the randomization is reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

const condA = JSON.parse(fs.readFileSync(path.join(__dirname, "condition-a-outputs.json"), "utf8"));
const condB = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "experiment001", "condition-b-baselines.json"), "utf8"));
const bById = new Map(condB.outputs.map((o) => [o.case_id, o.response]));

const pack = [];
const keys = {};
for (const a of condA) {
  const bText = bById.get(a.case_id);
  const aIsX = rand() < 0.5;
  pack.push({
    case_id: a.case_id,
    category: a.category,
    input_text: a.input_text,
    question_type: a.question_type,
    X: aIsX ? a.answer_text : bText,
    Y: aIsX ? bText : a.answer_text,
  });
  keys[a.case_id] = aIsX ? { X: "A", Y: "B" } : { X: "B", Y: "A" };
}
fs.writeFileSync(path.join(__dirname, "scoring-pack.json"), JSON.stringify(pack, null, 2));
fs.writeFileSync(path.join(__dirname, "scoring-keys.json"), JSON.stringify({ seed: SEED, keys }, null, 2));
console.log(`Scoring pack written: ${pack.length} cases, seed ${SEED}. Key stored separately (do not show scorer).`);
