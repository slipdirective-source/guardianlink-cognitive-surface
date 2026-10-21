// Experiment 003 ADDENDUM — Condition A runner wrapper (copy of the frozen wrapper; corpus is addendum-cases.json).
// Bundles run-addendum-a.ts (app + pipeline + renderer) with esbuild
// for node, then executes it. Usage: node run-addendum-a.js <outFile>
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const out = process.argv[2] ?? "addendum-condition-a-outputs.json";
const bundle = path.join(__dirname, ".runner.bundle.cjs");
execFileSync(
  path.join(__dirname, "..", "node_modules", ".bin", "esbuild"),
  [
    path.join(__dirname, "run-addendum-a.ts"),
    "--bundle",
    "--platform=node",
    "--format=cjs",
    "--external:jsdom",
    `--outfile=${bundle}`,
  ],
  { stdio: "inherit" }
);
try {
  execFileSync("node", [bundle, out], { stdio: "inherit" });
} finally {
  fs.rmSync(bundle, { force: true });
}
