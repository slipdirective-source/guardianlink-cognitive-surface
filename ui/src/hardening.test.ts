// Hardening-pass tests (2026-10-21, board docket via Caleb).
//
// Item 2 — injection through record content: every string the pipeline
//   emits is untrusted content once it is rendered into a DOM. Hostile
//   strings sprayed into every rendered field must come out as inert,
//   verbatim text.
// Item 3 — presentation-layer purity: the complement of fail-closed.
//   The UI must never derive a fact the pipeline did not emit. A
//   differential test mutates one field of a real response at a time
//   and asserts the rendered DOM changes ONLY where that field is
//   projected.
// Item 4 — history persistence: in memory only, by decided policy.
//   Export/import are explicit user actions; nothing is written to
//   browser storage, ever.
// Item 5 — relationship-class visual weights are snapshot-pinned so a
//   future styling pass cannot silently flatten the ordering.

import * as fs from "fs";
import * as path from "path";
import { ClusterOutput, SurfaceResponse } from "../../src/types";
import { AssertedRelation, CandidateAction } from "../../src/reasoner";
import { SurfaceApp, createApp } from "./app";
import { renderRelations } from "./render";
import { ViewId } from "./model";

function setup(): { root: HTMLElement; app: SurfaceApp } {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(root);
  return { root, app };
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ---------------------------------------------------------------------------
// Item 2 — injection through record content
// ---------------------------------------------------------------------------

const P_IMG = `<img src=x onerror=alert(1)>`;
const P_SCRIPT = `<script>alert(2)</script>`;
const P_BREAK = `</section><b data-pwned="1">INJECTED</b>`;
const P_ATTR = `" onmouseover="alert(3)`;
const P_LINK = `<a href="javascript:alert(4)">click</a>`;
const HOSTILE = [P_IMG, P_SCRIPT, P_BREAK, P_ATTR, P_LINK];
const h = (i: number) => HOSTILE[i % HOSTILE.length];

function expectInert(root: HTMLElement) {
  // No element was created from a hostile string.
  expect(root.querySelector("img")).toBeNull();
  expect(root.querySelector("script")).toBeNull();
  expect(root.querySelector("a")).toBeNull();
  expect(root.querySelector("[data-pwned]")).toBeNull();
  // No inline event-handler attribute exists anywhere in the render.
  for (const el of root.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      expect(attr.name.startsWith("on")).toBe(false);
    }
  }
}

function sprayOutput(out: ClusterOutput, seed: number) {
  out.summary = h(seed);
  const sig = out.signals as Record<string, unknown>;
  sig["raw_quotes"] = [h(seed + 1)];
  sig["regularities"] = [h(seed + 2)];
  sig["unknowns"] = [h(seed + 3)];
  sig["urgent_action"] = h(seed + 4);
  sig["trajectory_null_reason"] = h(seed);
  const rels = (sig["asserted_relations"] as AssertedRelation[] | undefined) ?? [];
  rels.forEach((r, i) => {
    r.subject = h(i);
    r.predicate = h(i + 1);
    r.object = h(i + 2);
    r.justification = h(i + 3);
    r.evidence_quotes = [h(i + 4)];
  });
  const acts = (sig["candidate_actions"] as CandidateAction[] | undefined) ?? [];
  acts.forEach((a, i) => {
    a.action = h(i + 1);
    if (a.authority_check) a.authority_check.note = h(i + 2);
  });
  out.evidence.raw.raw_text = h(seed + 2);
  out.evidence.relationship.description = h(seed + 3);
  if (out.evidence.trajectory) {
    (out.evidence.trajectory as unknown as Record<string, unknown>)["statement"] = h(seed + 1);
  }
}

describe("item 2: record content is an untrusted-string surface", () => {
  test("hostile question text through the REAL pipeline renders as inert, verbatim text", () => {
    const { root, app } = setup();
    app.ask(`${P_IMG} Did the kiln crack along the rim?`, "position");
    expectInert(root);
    const quotes = [...root.querySelectorAll("[data-raw-quote]")].map((q) => q.textContent);
    expect(quotes.join(" ")).toContain("<img src=x onerror=alert(1)>");
    const pre = root.querySelector("details.composed pre")!;
    expect(pre.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  test("hostile strings in EVERY rendered field render inert and verbatim, in every view", () => {
    const { root, app } = setup();
    const entry = app.loadFixture("3.1");
    const resp = entry.response;
    entry.question_text = `${P_IMG} ${P_ATTR}`;
    entry.context_label = P_SCRIPT;
    resp.answer_text = HOSTILE.join("\n");
    resp.uncertainty_sources = resp.uncertainty_sources.length
      ? resp.uncertainty_sources.map((s, i) => ({ ...s, name: h(i) }))
      : [{ name: P_IMG, weight: 1, value: 1 }];
    sprayOutput(resp.output, 0);
    resp.lenses.forEach((l, i) => sprayOutput(l.output, i + 1));

    app.setView("home");
    expectInert(root);
    // the "verbatim" audit block is byte-verbatim, hostile text included
    expect(root.querySelector("details.composed pre")!.textContent).toBe(resp.answer_text);
    expect(root.querySelector(".question-text")!.textContent).toBe(entry.question_text);
    const expectedUrgent = resp.lenses[0].output.signals["urgent_action"] as string;
    expect(root.querySelector("[data-urgent-action]")!.textContent).toContain(expectedUrgent);

    app.setView("agency");
    expectInert(root);
    app.setView("relationships");
    expectInert(root);
    app.setView("trajectory");
    expectInert(root);
    app.setView("history");
    expectInert(root);
  });

  test("attribute-breakout attempt through relationship_class stays inside its attribute, verbatim", () => {
    const { root, app } = setup();
    const entry = app.loadFixture("2.1");
    const relOut = entry.response.lenses.find((l) => l.cluster_id === "relationships")!.output;
    const rels = (relOut.signals as Record<string, unknown>)["asserted_relations"] as AssertedRelation[];
    expect(rels.length).toBeGreaterThan(0);
    rels[0].relationship_class = P_ATTR as AssertedRelation["relationship_class"];
    app.setView("relationships");
    expectInert(root);
    const card = root.querySelector(".rel-card")!;
    // the payload survived as the attribute's literal value — escaping
    // preserved it as data, and it did not break out into a handler
    expect(card.getAttribute("data-relationship-class")).toBe(P_ATTR);
    expect(card.getAttribute("onmouseover")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Item 3 — presentation-layer purity (differential)
//
// Sanctioned presentation derivations (the allowlist — everything else
// the UI renders is a direct projection of an emitted field):
//   - ordering: lenses and ranked text follow the pipeline's own order;
//   - number formatting: toFixed(2) on emitted values;
//   - RELATIONSHIP_WEIGHT / class labels / gate labels: static maps
//     keyed by emitted enum values;
//   - epistemic-state strings: emitted fields composed into sentences
//     (subject/predicate/object, source name/weight/value);
//   - capability-strip aggregations: counts and joins over emitted
//     arrays (actions, gates, uncertainty sources);
//   - static presentation copy for empty states ("— none —", etc.).
// A mutation's diff must stay inside the projections of the mutated
// field. Any hit outside them means the UI computed something of its
// own — the test fails, by design.
// ---------------------------------------------------------------------------

interface Hit {
  path: string;
  kind: string;
}

const KEY_ATTRS = [
  "data-layer",
  "data-authority-basis",
  "data-relationship-class",
  "data-uncertainty-state",
  "data-capability",
  "data-section",
  "data-lens-view",
  "data-trajectory",
  "data-entry-id",
  "data-authority-basis",
];

function seg(el: Element, idx: number): string {
  let s = el.tagName.toLowerCase();
  const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean)[0];
  if (cls) s += `.${cls}`;
  if (el.hasAttribute("data-uncertainty-panel")) s += "[data-uncertainty-panel]";
  for (const a of KEY_ATTRS) {
    const v = el.getAttribute(a);
    if (v !== null) {
      s += `[${a}="${v}"]`;
      break;
    }
  }
  return `${s}[${idx}]`;
}

function diffDom(a: Node, b: Node, at: string, hits: Hit[]): void {
  if (a.nodeType === 3 || b.nodeType === 3) {
    if (a.nodeType !== b.nodeType || a.textContent !== b.textContent) {
      hits.push({ path: at, kind: "text" });
    }
    return;
  }
  const ea = a as Element;
  const eb = b as Element;
  if (ea.tagName !== eb.tagName) {
    hits.push({ path: at, kind: "tag" });
    return;
  }
  const names = new Set([
    ...[...ea.attributes].map((x) => x.name),
    ...[...eb.attributes].map((x) => x.name),
  ]);
  for (const name of names) {
    if (ea.getAttribute(name) !== eb.getAttribute(name)) {
      hits.push({ path: at, kind: `attr:${name}` });
    }
  }
  const ca = [...ea.childNodes];
  const cb = [...eb.childNodes];
  if (ca.length !== cb.length) hits.push({ path: at, kind: "structure" });
  let elIdx = -1;
  const n = Math.min(ca.length, cb.length);
  for (let i = 0; i < n; i++) {
    const child = ca[i];
    if (child.nodeType === 1) elIdx += 1;
    const childPath =
      child.nodeType === 1 ? `${at} > ${seg(child as Element, elIdx)}` : `${at} > #text`;
    diffDom(child, cb[i], childPath, hits);
  }
}

function renderPair(
  fixture: string,
  view: ViewId,
  mutate: (resp: SurfaceResponse) => void
): Hit[] {
  // Both apps load the same fixture; the entry timestamp is pinned to
  // the same instant so the ONLY difference between the two renders is
  // the mutation under test.
  const AT = "2026-10-21T00:00:00.000Z";
  const a = setup();
  a.app.loadFixture(fixture).at = AT;
  a.app.setView(view);
  const domA = a.root.cloneNode(true) as HTMLElement;

  const b = setup();
  const entry = b.app.loadFixture(fixture);
  entry.at = AT;
  entry.response = clone(entry.response);
  mutate(entry.response);
  b.app.setView(view);
  const domB = b.root.cloneNode(true) as HTMLElement;

  const hits: Hit[] = [];
  diffDom(domA, domB, "root", hits);
  return hits;
}

function expectLocalized(hits: Hit[], allowed: RegExp) {
  expect(hits.length).toBeGreaterThan(0); // the mutation must show up — no vacuous pass
  for (const hit of hits) {
    expect(hit.path).toMatch(allowed);
  }
}

describe("item 3: the UI projects the pipeline's facts — it derives none of its own", () => {
  test("flip relationship_class (statistical_association -> demonstrated_intervention): diffs only inside relation cards", () => {
    const hits = renderPair("2.1", "relationships", (resp) => {
      const out = resp.lenses.find((l) => l.cluster_id === "relationships")!.output;
      const rels = (out.signals as Record<string, unknown>)[
        "asserted_relations"
      ] as AssertedRelation[];
      rels[0].relationship_class = "demonstrated_intervention";
    });
    expectLocalized(hits, /div\.relations/);
  });

  test("flip gate state (sovereign_decision_required -> existing_authority): diffs only inside that action node", () => {
    const hits = renderPair("3.1", "agency", (resp) => {
      const out = resp.lenses.find((l) => l.cluster_id === "agency")!.output;
      const acts = (out.signals as Record<string, unknown>)[
        "candidate_actions"
      ] as CandidateAction[];
      const target = acts.find((x) => x.authority_check.basis === "sovereign_decision_required")!;
      target.authority_check = {
        basis: "existing_authority",
        authorized: true,
        requires_assent: false,
        note: target.authority_check.note,
      };
    });
    expectLocalized(hits, /div\.action\[data-authority-basis="sovereign_decision_required"\]/);
  });

  test("drop one candidate action: diffs only inside the actions section", () => {
    const hits = renderPair("3.1", "agency", (resp) => {
      const out = resp.lenses.find((l) => l.cluster_id === "agency")!.output;
      const sig = out.signals as Record<string, unknown>;
      const acts = sig["candidate_actions"] as CandidateAction[];
      const idx = acts.findIndex((x) => x.authority_check.basis === "sovereign_decision_required");
      acts.splice(idx, 1);
    });
    expectLocalized(hits, /section\.actions/);
  });

  test("null the trajectory: diffs only inside the trajectory layer", () => {
    const hits = renderPair("1.1", "position", (resp) => {
      const out = resp.lenses.find((l) => l.cluster_id === "position")!.output;
      out.evidence.trajectory = null;
    });
    expectLocalized(hits, /\[data-layer="trajectory"\]/);
  });

  test("change the cross-cut uncertainty value: diffs only in the uncertainty panel and the uncertainty capability card", () => {
    const hits = renderPair("4.1", "home", (resp) => {
      resp.uncertainty = resp.uncertainty === 0.99 ? 0.11 : 0.99;
    });
    expectLocalized(hits, /(data-uncertainty-panel|data-capability="uncertainty")/);
  });

  test("drop one uncertainty source: diffs only in the uncertainty panel and the uncertainty capability card", () => {
    const hits = renderPair("4.1", "home", (resp) => {
      resp.uncertainty_sources = resp.uncertainty_sources.slice(0, -1);
    });
    expectLocalized(hits, /(data-uncertainty-panel|data-capability="uncertainty")/);
  });
});

// ---------------------------------------------------------------------------
// Item 4 — history persistence: in memory only (decided policy)
// ---------------------------------------------------------------------------

describe("item 4: the record persists only by explicit export/import — never ambient browser storage", () => {
  test("after full app use, localStorage and sessionStorage hold nothing", () => {
    const { app } = setup();
    app.loadFixture("1.1");
    app.loadFixture("3.1");
    app.ask("The kiln fired twice this week and both loads cracked.", "position");
    app.setView("history");
    app.setView("agency");
    app.loadDemoContext();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  test("a reload without import starts with an empty record", () => {
    const first = setup();
    first.app.loadFixture("1.1");
    first.app.loadFixture("4.1");
    expect(first.app.entries.length).toBe(2);
    // simulated reload: a brand-new app on a brand-new root
    const second = setup();
    expect(second.app.entries.length).toBe(0);
    expect(second.root.textContent).toContain("No entries in the record yet");
  });

  test("export -> import round-trips the record byte-identically", () => {
    const a = setup();
    a.app.loadFixture("1.1");
    a.app.loadFixture("3.1");
    a.app.loadDemoContext();
    const exported = a.app.exportRecord();

    const b = setup();
    const count = b.app.importRecord(exported);
    expect(count).toBe(3);
    // The exported entries are the record's data: parsed back, they are
    // entry-for-entry identical, in the same order. (The live response
    // also embeds cluster objects with functions in ranked_clusters —
    // rendering consumes only their data fields, and the export is the
    // data projection of the record.)
    expect(JSON.parse(b.app.exportRecord()).entries).toEqual(JSON.parse(exported).entries);
    expect(b.app.entries.map((e) => [e.seq, e.question_text])).toEqual(
      a.app.entries.map((e) => [e.seq, e.question_text])
    );
    expect(b.app.exportRecord()).toBe(exported); // byte-identical
    // and the imported record renders the same selected entry
    expect(b.root.querySelector("[data-entry-id]")!.getAttribute("data-entry-id")).toBe(
      a.root.querySelector("[data-entry-id]")!.getAttribute("data-entry-id")
    );
  });

  test("a malformed import throws and changes nothing", () => {
    const { app } = setup();
    app.loadFixture("1.1");
    const before = app.exportRecord();
    expect(() => app.importRecord("{}")).toThrow();
    expect(() => app.importRecord('{"format":"other","version":1,"entries":[]}')).toThrow();
    expect(() =>
      app.importRecord(
        JSON.stringify({
          format: "guardianlink-cognitive-surface/record",
          version: 1,
          entries: [{ id: "not-a-number" }],
        })
      )
    ).toThrow();
    expect(app.exportRecord()).toBe(before);
    expect(app.entries.length).toBe(1);
  });

  test("the export/import controls exist and live outside any action node", () => {
    const { root, app } = setup();
    app.loadFixture("3.1");
    app.setView("agency");
    const exportBtn = root.querySelector('[data-action="export-record"]')!;
    const importInput = root.querySelector("[data-import-file]")!;
    expect(exportBtn).not.toBeNull();
    expect(importInput).not.toBeNull();
    expect(exportBtn.closest(".action")).toBeNull();
    expect(importInput.closest(".action")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Item 5 — snapshot-pin the relationship-class visual weights
// ---------------------------------------------------------------------------

describe("item 5: relationship-class visual weights are pinned", () => {
  const mk = (cls: AssertedRelation["relationship_class"]): AssertedRelation => ({
    subject: "X",
    predicate: "affects",
    object: "Y",
    relationship_class: cls,
    evidence_quotes: ["q"],
    justification: "j",
  });

  test("rendered cards for all four classes match the pinned snapshot (semantic hooks)", () => {
    const holder = document.createElement("div");
    holder.innerHTML = renderRelations([
      mk("observed_sequence"),
      mk("statistical_association"),
      mk("candidate_causal"),
      mk("demonstrated_intervention"),
    ]);
    const hooks = [...holder.querySelectorAll(".rel-card")].map((c) => ({
      tag: c.tagName.toLowerCase(),
      cls: c.getAttribute("class"),
      relationship_class: c.getAttribute("data-relationship-class"),
      rel_weight: c.getAttribute("data-rel-weight"),
    }));
    expect(hooks).toMatchSnapshot("relationship-card-hooks");
    expect(holder.innerHTML).toMatchSnapshot("relationship-cards-html");
  });

  test("the stylesheet keeps the distinction: candidate is dashed, demonstrated is solid 4px, widths never decrease with weight", () => {
    const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
    const rule = (w: number) => {
      const m = css.match(new RegExp(`\\.rel-card\\[data-rel-weight="${w}"\\]\\s*\\{([^}]*)\\}`));
      expect(m).not.toBeNull();
      return m![1];
    };
    const border = (w: number) => {
      const m = rule(w).match(/border:\s*(\d+)px\s+(solid|dashed)/);
      expect(m).not.toBeNull();
      return { px: Number(m![1]), style: m![2] };
    };
    const b1 = border(1);
    const b2 = border(2);
    const b3 = border(3);
    const b4 = border(4);
    expect([b1.px, b2.px, b3.px, b4.px]).toEqual([1, 2, 2, 4]); // never decreases
    expect(b3.style).toBe("dashed"); // candidate_causal: dashed + muted
    expect(rule(3)).toMatch(/opacity/); // the muted treatment
    expect(b4.style).toBe("solid"); // demonstrated_intervention: solid, thickest
    expect(b1.style).toBe("solid");
    expect(b2.style).toBe("solid");
  });
});
