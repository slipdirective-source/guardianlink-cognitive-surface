// Experiment 003 — HOLDOUT runner wrapper.
// Bundles run-holdout.ts (app + pipeline + renderer) with esbuild for
// node, then executes it. Usage: node run-holdout.js <h|h1>
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const slice = process.argv[2] ?? "";
const bundle = path.join(__dirname, ".runner.bundle.cjs");
execFileSync(
  path.join(__dirname, "..", "..", "node_modules", ".bin", "esbuild"),
  [
    path.join(__dirname, "run-holdout.ts"),
    "--bundle",
    "--platform=node",
    "--format=cjs",
    "--external:jsdom",
    `--outfile=${bundle}`,
  ],
  { stdio: "inherit" }
);
try {
  execFileSync("node", [bundle, slice], { stdio: "inherit" });
} finally {
  fs.rmSync(bundle, { force: true });
}
