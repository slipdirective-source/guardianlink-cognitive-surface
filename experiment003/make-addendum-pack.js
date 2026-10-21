// Experiment 003 ADDENDUM — blind scoring pack builder.
// Condition A only (addendum-condition-a-outputs.json): each output's
// system_output_text (composed input + pipeline answer + rendered-UI
// extracts) is presented under a masked id (P01..P16), order shuffled
// with the recorded seed. The key (addendum-scoring-keys.json) maps
// masked ids to case ids and must NOT be shown to the scorer.
// Usage: node make-addendum-pack.js [seed]
const fs = require("fs");
const path = require("path");

const SEED = Number(process.argv[2] ?? 20261023);

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

const outputs = JSON.parse(
  fs.readFileSync(path.join(__dirname, "addendum-condition-a-outputs.json"), "utf8")
);

// Fisher-Yates shuffle with the seeded RNG.
const order = outputs.map((_, i) => i);
for (let i = order.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [order[i], order[j]] = [order[j], order[i]];
}

const pack = [];
const keys = {};
order.forEach((srcIdx, n) => {
  const blindId = `P${String(n + 1).padStart(2, "0")}`;
  const o = outputs[srcIdx];
  keys[blindId] = o.case_id;
  pack.push({ blind_id: blindId, system_output_text: o.system_output_text });
});

fs.writeFileSync(
  path.join(__dirname, "addendum-scoring-pack.json"),
  JSON.stringify({ seed: SEED, items: pack }, null, 2) + "\n"
);
fs.writeFileSync(
  path.join(__dirname, "addendum-scoring-keys.json"),
  JSON.stringify({ seed: SEED, keys }, null, 2) + "\n"
);
console.log(`wrote pack of ${pack.length} masked outputs (seed ${SEED})`);
