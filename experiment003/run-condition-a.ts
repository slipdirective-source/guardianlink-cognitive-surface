// Experiment 003 — Condition A runner (complete system).
//
// For each frozen case: the composed record is presented through the
// system's own channels exactly as SPEC.md freezes — stamped entries
// as raw_text lines plus the same entries as sovereign_context
// timeline — put to the REAL app (SurfaceApp over the shipped pipeline
// + renderer, under jsdom). The output per case is the pipeline's
// answer_text verbatim PLUS structured extracts of the rendered UI
// (uncertainty panel, relationship cards, agency gates, trajectory
// block), because the claim under test covers the complete system,
// rendering included.
//
// Usage (via run-condition-a.js): node run-condition-a.js <outFile>

import { JSDOM } from "jsdom";
import * as fs from "fs";
import * as path from "path";

const dom = new JSDOM("<!DOCTYPE html><body><div id=\"app\"></div></body>", {
  url: "http://localhost/",
});
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.FormData = dom.window.FormData;
g.HTMLElement = dom.window.HTMLElement;
g.HTMLInputElement = dom.window.HTMLInputElement;
g.HTMLFormElement = dom.window.HTMLFormElement;

import { createApp } from "../ui/src/app";
import { LensId } from "../ui/src/model";

interface ExpCase {
  id: string;
  category: string;
  question_type: string;
  question: string;
  entries: { date: string; origin: string; text: string }[];
}

const cases = (
  JSON.parse(fs.readFileSync(path.join(__dirname, "cases.json"), "utf8")) as {
    cases: ExpCase[];
  }
).cases;

function composedInput(c: ExpCase): { text: string; context: Record<string, unknown> } {
  const lines = c.entries.map((e) => `[${e.date} · ${e.origin}] ${e.text}`);
  return {
    text: lines.join("\n") + "\n\n" + c.question,
    context: { timeline: c.entries.map((e) => ({ when: e.date, event: e.text })) },
  };
}

function textOf(el: Element | null): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function extractUi(root: HTMLElement, app: ReturnType<typeof createApp>, _lens: LensId) {
  // The complete system is all of its views over the same entry: the
  // uncertainty panel from home, relationship cards from the
  // relationships lens, actions from the agency lens, the trajectory
  // block from the trajectory lens.
  app.setView("home");
  const panel = root.querySelector("[data-uncertainty-panel]");
  const states: Record<string, string[]> = {};
  panel?.querySelectorAll("[data-uncertainty-state]").forEach((s) => {
    const items = [...s.querySelectorAll("li")].map((li) => textOf(li));
    states[s.getAttribute("data-uncertainty-state")!] = items;
  });
  const uncertaintyPanel = {
    value: panel?.getAttribute("data-uncertainty-value") ?? null,
    sources: textOf(root.querySelector(".uncertainty-sources")),
    states,
  };
  app.setView("relationships");
  const relCards = [...root.querySelectorAll(".rel-card")].map((card) => ({
    relationship_class: card.getAttribute("data-relationship-class"),
    weight: card.getAttribute("data-rel-weight"),
    text: textOf(card),
  }));
  app.setView("agency");
  const actions = [...root.querySelectorAll(".action")].map((a) => ({
    gate: a.getAttribute("data-gate"),
    executable: a.getAttribute("data-executable"),
    basis: a.getAttribute("data-authority-basis"),
    text: textOf(a),
  }));
  app.setView("trajectory");
  const traj = root.querySelector(".projection");
  const trajectoryBlock = traj
    ? { kind: traj.getAttribute("data-trajectory"), text: textOf(traj) }
    : null;
  return { uncertaintyPanel, relCards, actions, trajectoryBlock };
}

function systemOutputText(
  inputText: string,
  answerText: string,
  ui: ReturnType<typeof extractUi>
): string {
  const parts: string[] = [];
  parts.push("=== COMPOSED INPUT (the record as presented) ===\n" + inputText);
  parts.push("=== PIPELINE ANSWER (verbatim) ===\n" + answerText);
  const p = ui.uncertaintyPanel;
  parts.push(
    "=== RENDERED UI — UNCERTAINTY PANEL ===\n" +
      `cross-cut value: ${p.value}\n${p.sources}\n` +
      Object.entries(p.states)
        .map(([k, items]) => `${k.toUpperCase()}: ${items.length ? items.join(" | ") : "— none —"}`)
        .join("\n")
  );
  parts.push(
    "=== RENDERED UI — RELATIONSHIP CARDS ===\n" +
      (ui.relCards.length
        ? ui.relCards.map((c) => `[class ${c.relationship_class} · evidential weight ${c.weight}/4] ${c.text}`).join("\n")
        : "— no relationship cards rendered —")
  );
  parts.push(
    "=== RENDERED UI — AGENCY ACTIONS ===\n" +
      (ui.actions.length
        ? ui.actions.map((a) => `[gate: ${a.gate} · executable: ${a.executable} · basis: ${a.basis}] ${a.text}`).join("\n")
        : "— no agency actions rendered —")
  );
  parts.push(
    "=== RENDERED UI — TRAJECTORY BLOCK ===\n" +
      (ui.trajectoryBlock ? `[${ui.trajectoryBlock.kind}] ${ui.trajectoryBlock.text}` : "— no trajectory block —")
  );
  return parts.join("\n\n");
}

function main(): void {
  const outFile = process.argv[2] ?? "condition-a-outputs.json";
  const results = cases.map((c) => {
    const { text, context } = composedInput(c);
    const root = document.createElement("div");
    document.body.appendChild(root);
    const app = createApp(root);
    const entry = app.ask(text, c.question_type, { sovereignContext: context });
    const ui = extractUi(root, app, c.question_type as LensId);
    const r = entry.response;
    return {
      case_id: c.id,
      category: c.category,
      question_type: c.question_type,
      input_text: text,
      primary_cluster: r.cluster_id,
      uncertainty: r.uncertainty,
      uncertainty_sources: r.uncertainty_sources,
      answer_text: r.answer_text,
      ui,
      system_output_text: systemOutputText(text, r.answer_text, ui),
      reasoner_backend: "deterministic (src/deterministic_reasoner.ts, shipped in repo, reproducible)",
    };
  });
  fs.writeFileSync(path.join(__dirname, outFile), JSON.stringify(results, null, 2));
  console.log(`wrote ${results.length} condition-A outputs to ${outFile}`);
}

main();
