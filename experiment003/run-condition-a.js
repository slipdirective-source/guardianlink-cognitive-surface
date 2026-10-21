// Experiment 003 — Condition A runner wrapper.
// Bundles run-condition-a.ts (app + pipeline + renderer) with esbuild
// for node, then executes it. Usage: node run-condition-a.js <outFile>
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const out = process.argv[2] ?? "condition-a-outputs.json";
const bundle = path.join(__dirname, ".runner.bundle.cjs");
execFileSync(
  path.join(__dirname, "..", "node_modules", ".bin", "esbuild"),
  [
    path.join(__dirname, "run-condition-a.ts"),
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
