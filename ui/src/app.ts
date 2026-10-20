// Surface application: owns the record and the view state, calls the
// real pipeline, and re-renders. Lens switching changes only the view —
// the record (and each entry's SurfaceResponse) is untouched, which is
// what "lenses, not tabs" means mechanically.

import { answer } from "../../src/surface";
import { LensId, RecordEntry, ViewId } from "./model";
import { layerKey, renderApp } from "./render";
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
          `<button data-action="fixture" data-case-id="${f.case_id}">${f.case_id} · ${f.category}</button>`
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
