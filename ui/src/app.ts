// Surface application: owns the record and the view state, calls the
// real pipeline, and re-renders. Lens switching changes only the view —
// the record (and each entry's SurfaceResponse) is untouched, which is
// what "lenses, not tabs" means mechanically.

import { answer } from "../../src/surface";
import { LensId, RecordEntry, ViewId } from "./model";
import { esc, layerKey, renderApp } from "./render";
import {
  CORPUS_FIXTURES,
  DEMO_CONTEXT_LABEL,
  DEMO_SOVEREIGN_CONTEXT,
} from "./fixtures";

export interface AskOptions {
  sovereignContext?: Record<string, unknown> | null;
  contextLabel?: string | null;
  source?: "live" | "fixture";
}

// --- Record persistence policy (decided 2026-10-21, board docket via
// Caleb; see ui/README.md). The record lives IN MEMORY ONLY. Nothing is
// written to localStorage, sessionStorage, or IndexedDB — silent browser
// persistence of longitudinal personal data would sit outside the
// fail-closed story. The record crosses a reload only through an
// explicit, user-invoked export (a JSON file the user downloads) and an
// explicit import of such a file.
export const RECORD_EXPORT_FORMAT = "guardianlink-cognitive-surface/record";
export const RECORD_EXPORT_VERSION = 1;

export interface RecordExport {
  format: typeof RECORD_EXPORT_FORMAT;
  version: typeof RECORD_EXPORT_VERSION;
  entries: RecordEntry[];
}

export class SurfaceApp {
  entries: RecordEntry[] = [];
  view: ViewId = "home";
  private selectedId: number | null = null;
  private expanded = new Set<string>();
  private nextSeq = 1;

  constructor(private root: HTMLElement) {
    this.bindEvents();
    this.render();
  }

  get selected(): RecordEntry | null {
    return this.entries.find((e) => e.id === this.selectedId) ?? null;
  }

  // Put a question to the record through the real pipeline. All five
  // lenses are composed for every entry (lensThreshold 0) so that lens
  // switching is a pure re-render of this same response.
  ask(text: string, type: string, opts: AskOptions = {}): RecordEntry {
    const response = answer(
      { type, text },
      opts.sovereignContext ?? null,
      { lensThreshold: 0 }
    );
    const entry: RecordEntry = {
      id: this.nextSeq,
      seq: this.nextSeq,
      at: new Date().toISOString(),
      question_type: type,
      question_text: text,
      source: opts.source ?? "live",
      context_label: opts.contextLabel ?? null,
      response,
    };
    this.nextSeq += 1;
    this.entries.push(entry);
    this.selectedId = entry.id;
    // Raw layer starts peeled in every lens; the rest start covered.
    for (const l of response.lenses) {
      this.expanded.add(layerKey(entry.id, l.cluster_id as LensId, "raw"));
    }
    this.render();
    return entry;
  }

  loadFixture(caseId: string): RecordEntry {
    const f = CORPUS_FIXTURES.find((c) => c.case_id === caseId);
    if (!f) throw new Error(`unknown fixture ${caseId}`);
    return this.ask(f.text, f.question_type, { source: "fixture" });
  }

  loadDemoContext(): RecordEntry {
    return this.ask("How did I get here?", "history", {
      sovereignContext: DEMO_SOVEREIGN_CONTEXT,
      contextLabel: DEMO_CONTEXT_LABEL,
      source: "fixture",
    });
  }

  // Serialize the record for explicit export. Pure function of the
  // record: two exports of the same record are byte-identical, and an
  // export -> import -> export round-trip is byte-identical.
  exportRecord(): string {
    const payload: RecordExport = {
      format: RECORD_EXPORT_FORMAT,
      version: RECORD_EXPORT_VERSION,
      entries: this.entries,
    };
    return JSON.stringify(payload, null, 2);
  }

  // Load a record previously produced by exportRecord(). Replaces the
  // in-memory record wholesale; validates the envelope and the entry
  // shape before applying anything (a bad file changes nothing).
  importRecord(json: string): number {
    const parsed = JSON.parse(json) as Partial<RecordExport>;
    if (
      parsed.format !== RECORD_EXPORT_FORMAT ||
      parsed.version !== RECORD_EXPORT_VERSION ||
      !Array.isArray(parsed.entries)
    ) {
      throw new Error("not a cognitive-surface record export");
    }
    for (const e of parsed.entries) {
      if (
        typeof e?.id !== "number" ||
        typeof e?.seq !== "number" ||
        typeof e?.question_text !== "string" ||
        typeof e?.response !== "object" ||
        e.response === null
      ) {
        throw new Error("record export contains a malformed entry");
      }
    }
    const entries = parsed.entries as RecordEntry[];
    this.entries = entries;
    this.selectedId = entries.length ? entries[entries.length - 1].id : null;
    this.nextSeq = entries.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
    this.expanded = new Set<string>();
    for (const entry of entries) {
      for (const l of entry.response.lenses) {
        this.expanded.add(layerKey(entry.id, l.cluster_id as LensId, "raw"));
      }
    }
    this.render();
    return entries.length;
  }

  // Browser download of exportRecord(). Guarded so non-browser hosts
  // (tests, SSR) can call the click path without a Blob URL API.
  downloadRecord(): void {
    const blob = new Blob([this.exportRecord()], { type: "application/json" });
    if (typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "guardianlink-record.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  setView(view: ViewId): void {
    this.view = view;
    this.render();
  }

  selectEntry(id: number): void {
    if (this.entries.some((e) => e.id === id)) {
      this.selectedId = id;
      this.render();
    }
  }

  toggleLayer(key: string): void {
    if (this.expanded.has(key)) this.expanded.delete(key);
    else this.expanded.add(key);
    this.render();
  }

  isExpanded(key: string): boolean {
    return this.expanded.has(key);
  }

  render(): void {
    this.root.innerHTML = renderApp({
      entries: this.entries,
      selected: this.selected,
      view: this.view,
      expanded: this.expanded,
    });
    const holder = this.root.querySelector("#fixture-buttons");
    if (holder) {
      holder.innerHTML = CORPUS_FIXTURES.map(
        (f) =>
          `<button data-action="fixture" data-case-id="${esc(f.case_id)}">${esc(f.case_id)} · ${esc(f.category)}</button>`
      ).join("");
    }
  }

  private bindEvents(): void {
    this.root.addEventListener("click", (ev) => {
      const el = (ev.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!el) return;
      const action = el.dataset.action;
      if (action === "view") this.setView(el.dataset.view as ViewId);
      else if (action === "select-entry") this.selectEntry(Number(el.dataset.entryId));
      else if (action === "peel") this.toggleLayer(el.dataset.layerKey as string);
      else if (action === "fixture") this.loadFixture(el.dataset.caseId as string);
      else if (action === "fixture-demo-context") this.loadDemoContext();
      else if (action === "export-record") this.downloadRecord();
    });
    this.root.addEventListener("change", (ev) => {
      const input = ev.target as HTMLInputElement;
      if (!input.matches("[data-import-file]")) return;
      const file = input.files?.[0];
      if (!file) return;
      void file.text().then((text) => {
        try {
          this.importRecord(text);
        } catch {
          // A malformed import changes nothing (validated before apply).
          // The record on screen is untouched; no silent partial state.
        }
        input.value = "";
      });
    });
    this.root.addEventListener("submit", (ev) => {
      const form = ev.target as HTMLFormElement;
      if (form.id !== "ask-form") return;
      ev.preventDefault();
      const data = new FormData(form);
      const text = String(data.get("qtext") ?? "").trim();
      if (!text) return;
      const type = String(data.get("qtype") ?? "position");
      const demo = data.get("demo_context") === "on";
      this.ask(text, type, {
        sovereignContext: demo ? DEMO_SOVEREIGN_CONTEXT : null,
        contextLabel: demo ? DEMO_CONTEXT_LABEL : null,
      });
      this.view = "home";
      this.render();
    });
  }
}

export function createApp(root: HTMLElement): SurfaceApp {
  return new SurfaceApp(root);
}
