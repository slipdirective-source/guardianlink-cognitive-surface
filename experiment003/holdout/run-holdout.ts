// Experiment 003 — HOLDOUT runner (complete system, mechanic B).
//
// Evaluation code, frozen with the mapping doc at experiment003/holdout/.
// NOT part of the SUT; the SUT (src/, ui/src/) is pinned at b5fa86ea7e
// and is not modified by this runner.
//
// Per case, exactly per the mapping doc:
//  - each entry is admitted individually through the real capture layer
//    (SurfaceApp.submitEntry) under the section-3 clock protocol: the
//    process Date is stubbed (covering BOTH new Date() and Date.now())
//    to the entry's observed_at for its admission; asserted_at is set
//    from the case through the boundary field;
//  - the probe is the final admission: the composed record (stamped
//    lines `[asserted date · origin] text` + sovereign_context
//    timeline built from the admitted record) put to the app via ask()
//    with the stub set to T = 2026-10-21T12:00:00.000Z;
//  - the real Date is restored in a finally after each case;
//  - every admission is recorded to the admission log
//    {case_id, seq, injected_now, asserted_at, origin, entry_id,
//    entry_at}.
//  - H15 is admitted through the real importRecord path from an export
//    file produced by a throwaway source app running the same shipped
//    code, its provenance claiming direct local observation.
//
// Output per case mirrors run-condition-a.ts extraction (answer_text
// verbatim + uncertainty panel, relationship cards, agency actions,
// trajectory block from the rendered UI) and adds the record layer
// (per-entry stamps, meta lines, hash-chain status) that mechanic B
// puts under test.
//
// Usage (via run-holdout.js): node run-holdout.js <h|h1>

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

import { createApp } from "../../ui/src/app";
import {
  LensId,
  RecordEntry,
  authorityPresentation,
  primaryView,
} from "../../ui/src/model";

// ---------------- injected clock (environmental, section 3) --------
const RealDate = Date;
let fakeNow = "2026-10-21T12:00:00.000Z";
class FakeDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(fakeNow);
    else super(...(args as [string]));
  }
  static now(): number {
    return new RealDate(fakeNow).getTime();
  }
}
function setClock(iso: string): void {
  fakeNow = iso;
  (globalThis as { Date: unknown }).Date = FakeDate;
}
function restoreClock(): void {
  (globalThis as { Date: unknown }).Date = RealDate;
}

// ---------------- case schema ---------------------------------------
interface HoldoutEntry {
  text: string;
  origin: string;
  asserted_at: string;
  observed_at: string;
}
interface HoldoutCase {
  id: string;
  bucket?: string;
  question_type: string;
  question: string;
  entries?: HoldoutEntry[];
  import?: {
    entry_text: string;
    claimed_origin: string;
    source_observed_at: string;
  };
  enriched_capture?: boolean;
}
interface CasesFile {
  slice: string;
  T: string;
  probe_now: string;
  cases: HoldoutCase[];
}

// ---------------- UI extraction (verbatim from run-condition-a.ts) --
function textOf(el: Element | null): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function extractUi(root: HTMLElement, app: ReturnType<typeof createApp>, _lens: LensId) {
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

// ---------------- record-layer capture -------------------------------
function lineDate(e: RecordEntry): string {
  return (e.asserted_at ?? e.at).slice(0, 10);
}

function actionsOf(e: RecordEntry) {
  return primaryView(e.response).candidate_actions.map((a) => {
    const p = authorityPresentation(a);
    return { action: a.action, gate: p.gate, executable: p.executable, basis: a.authority_check?.basis ?? null };
  });
}

interface AdmissionRow {
  case_id: string;
  seq: number;
  injected_now: string;
  asserted_at: string | null;
  origin: string;
  entry_id: number;
  entry_at: string;
  via: string;
  claimed_origin?: string | null;
}

// ---------------- per-case run ---------------------------------------
function runCase(
  c: HoldoutCase,
  probeNow: string
): { output: Record<string, unknown>; log: AdmissionRow[] } {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(root);
  const log: AdmissionRow[] = [];
  try {
    if (c.import) {
      // H15: build a real export in a throwaway source app (same
      // shipped code), the entry captured there as a direct local
      // observation; then admit it to the SUT app via importRecord.
      setClock(c.import.source_observed_at);
      const srcRoot = document.createElement("div");
      document.body.appendChild(srcRoot);
      const srcApp = createApp(srcRoot);
      srcApp.submitEntry({
        kind: "observation",
        text: c.import.entry_text,
        origin: c.import.claimed_origin as never,
      });
      const fileJson = srcApp.exportRecord();
      srcRoot.remove();
      setClock(probeNow);
      app.importRecord(fileJson);
      const e = app.entries[app.entries.length - 1];
      log.push({
        case_id: c.id,
        seq: e.seq,
        injected_now: probeNow,
        asserted_at: e.asserted_at ?? null,
        origin: e.origin,
        entry_id: e.id,
        entry_at: e.at,
        via: "importRecord",
        claimed_origin: e.claimed_origin ?? null,
      });
    } else {
      for (const spec of c.entries ?? []) {
        setClock(spec.observed_at);
        const e = app.submitEntry({
          kind: "observation",
          text: spec.text,
          origin: spec.origin as never,
          assertedAt: spec.asserted_at,
        });
        log.push({
          case_id: c.id,
          seq: e.seq,
          injected_now: spec.observed_at,
          asserted_at: e.asserted_at ?? null,
          origin: e.origin,
          entry_id: e.id,
          entry_at: e.at,
          via: "submitEntry",
        });
      }
    }

    // Composed probe input from the ADMITTED record (mechanic B).
    const recordEntries = [...app.entries];
    const lines = recordEntries.map(
      (e) => `[${lineDate(e)} · ${e.origin}] ${e.question_text}`
    );
    const composedText = lines.join("\n") + "\n\n" + c.question;
    const context = {
      timeline: recordEntries.map((e) => ({
        when: lineDate(e),
        event: e.question_text,
      })),
    };

    setClock(probeNow);
    const probe = app.ask(composedText, c.question_type, {
      sovereignContext: context,
    });
    log.push({
      case_id: c.id,
      seq: probe.seq,
      injected_now: probeNow,
      asserted_at: probe.asserted_at ?? null,
      origin: probe.origin,
      entry_id: probe.id,
      entry_at: probe.at,
      via: "probe",
    });

    const ui = extractUi(root, app, c.question_type as LensId);
    const r = probe.response;

    // Record layer: per-entry meta lines from the rendered home view.
    app.setView("home");
    const metas: Record<number, string> = {};
    for (const e of app.entries) {
      app.selectEntry(e.id);
      metas[e.id] = textOf(root.querySelector(".entry-meta"));
    }
    app.selectEntry(probe.id);

    const output: Record<string, unknown> = {
      case_id: c.id,
      bucket: c.bucket ?? null,
      question_type: c.question_type,
      input_text: composedText,
      probe_entry_at: probe.at,
      primary_cluster: r.cluster_id,
      uncertainty: r.uncertainty,
      uncertainty_sources: r.uncertainty_sources,
      answer_text: r.answer_text,
      urgent_action: primaryView(r).urgent_action,
      ui,
      system_output_text: systemOutputText(composedText, r.answer_text, ui),
      record_layer: {
        chain_status: app.chainStatus(),
        entries: app.entries.map((e) => ({
          id: e.id,
          seq: e.seq,
          at: e.at,
          asserted_at: e.asserted_at ?? null,
          origin: e.origin,
          claimed_origin: e.claimed_origin ?? null,
          claimed_at: e.claimed_at ?? null,
          kind: e.kind,
          question_text: e.question_text,
          meta_line: metas[e.id] ?? null,
          actions: actionsOf(e),
        })),
      },
      reasoner_backend:
        "deterministic (src/deterministic_reasoner.ts, shipped in repo, reproducible)",
    };
    return { output, log };
  } finally {
    restoreClock();
    root.remove();
  }
}

function main(): void {
  const slice = (process.argv[2] ?? "").toLowerCase();
  if (slice !== "h" && slice !== "h1") {
    throw new Error("usage: node run-holdout.js <h|h1>");
  }
  const casesFile = JSON.parse(
    fs.readFileSync(path.join(__dirname, `holdout-cases-${slice}.json`), "utf8")
  ) as CasesFile;
  const outputs: Record<string, unknown>[] = [];
  const admissionLog: AdmissionRow[] = [];
  for (const c of casesFile.cases) {
    const { output, log } = runCase(c, casesFile.probe_now);
    outputs.push(output);
    admissionLog.push(...log);
    console.log(`ran ${c.id}`);
  }
  fs.writeFileSync(
    path.join(__dirname, `raw-outputs-${slice}.json`),
    JSON.stringify(outputs, null, 2)
  );
  fs.writeFileSync(
    path.join(__dirname, `admission-log-${slice}.json`),
    JSON.stringify(admissionLog, null, 2)
  );
  console.log(
    `wrote ${outputs.length} holdout outputs + ${admissionLog.length} admission rows for slice ${slice.toUpperCase()}`
  );
}

main();
