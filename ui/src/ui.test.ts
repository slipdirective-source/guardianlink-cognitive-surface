// Front-end scope tests (jsdom). Each test names the scope claim it
// encodes. Everything renders from the REAL pipeline: the app calls
// src/surface.ts answer() with the shipped deterministic backend;
// fixtures are question texts only, never canned output.

import { answer } from "../../src/surface";
import { SurfaceApp, createApp } from "./app";
import { renderRelations } from "./render";
import { AssertedRelation } from "../../src/reasoner";

function setup(): { root: HTMLElement; app: SurfaceApp } {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(root);
  return { root, app };
}

const DOG = "My neighbor's dog bit three people last month. City data shows dog bites down 12% year-over-year. Should I be worried about my street?";
const DOG_QUOTE = "My neighbor's dog bit three people last month.";

describe("home = 'You, now', urgent action first (Category 5 fixtures)", () => {
  test("5.1 crying child: urgent banner leads the home view and matches the pipeline's urgent action", () => {
    const { root, app } = setup();
    app.loadFixture("5.1");
    const expected = answer({ type: "agency", text: "My child is crying. Comfort them." }, null, { lensThreshold: 0 });
    const urgent = expected.lenses[0].output.signals["urgent_action"] as string;
    const banner = root.querySelector("[data-urgent-action]");
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain(urgent);
    const now = root.querySelector('[data-section="position-now"]')!;
    // banner precedes the position block in document order
    expect(banner!.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("5.2 fire alarm + smoke: urgent banner leads, evacuation text present", () => {
    const { root, app } = setup();
    app.loadFixture("5.2");
    const banner = root.querySelector("[data-urgent-action]");
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toMatch(/evacuate|leave/i);
  });
});

describe("lenses are lenses, not tabs", () => {
  test("switching lens re-renders the SAME record entry through a different cluster", () => {
    const { root, app } = setup();
    const entry = app.loadFixture("1.1");
    const homeEntryId = root.querySelector("[data-entry-id]")!.getAttribute("data-entry-id");
    app.setView("relationships");
    expect(app.entries.length).toBe(1); // no new data was fetched or created
    expect(root.querySelector("[data-entry-id]")!.getAttribute("data-entry-id")).toBe(homeEntryId);
    expect(Number(homeEntryId)).toBe(entry.id);
    expect(root.querySelector('[data-lens-view="relationships"]')).not.toBeNull();
    // the same entry's raw record is visible through this lens too
    const quotes = [...root.querySelectorAll("[data-raw-quote]")].map((q) => q.textContent);
    expect(quotes.join(" ")).toContain(DOG_QUOTE);
    app.setView("trajectory");
    expect(root.querySelector('[data-lens-view="trajectory"]')).not.toBeNull();
    expect(root.querySelector("[data-entry-id]")!.getAttribute("data-entry-id")).toBe(homeEntryId);
  });
});

describe("peelable evidence layers, never fused", () => {
  test("four sibling layer sections; pattern holds no verbatim raw quote; peeling toggles", () => {
    const { root, app } = setup();
    app.loadFixture("1.1");
    app.setView("position");
    const container = root.querySelector('[data-layers-for="position"]')!;
    const sections = [...container.querySelectorAll(":scope > [data-layer]")];
    expect(sections.map((s) => s.getAttribute("data-layer"))).toEqual([
      "raw",
      "pattern",
      "relationship",
      "trajectory",
    ]);
    for (const s of sections) {
      expect(s.parentElement).toBe(container); // siblings
      expect(s.querySelector("[data-layer]")).toBeNull(); // never nested/fused
    }
    const byLayer = Object.fromEntries(sections.map((s) => [s.getAttribute("data-layer"), s]));
    expect(byLayer["raw"].textContent).toContain(DOG_QUOTE);
    expect(byLayer["pattern"].textContent).not.toContain(DOG_QUOTE);
    expect(byLayer["raw"].getAttribute("data-expanded")).toBe("true");
    expect(byLayer["pattern"].getAttribute("data-expanded")).toBe("false");
    const key = `${app.selected!.id}:position:pattern`;
    app.toggleLayer(key);
    const patternAfter = root.querySelector('[data-layers-for="position"] [data-layer="pattern"]')!;
    expect(patternAfter.getAttribute("data-expanded")).toBe("true");
    // this lens carries a real projection; it renders as a projection,
    // labeled distinct from observation — never as raw fact
    expect(byLayer["trajectory"].querySelector('[data-trajectory="projection"]')).not.toBeNull();
  });

  test("4.1 trajectory lens: the null projection is explicit in the trajectory layer, never silent, never filled", () => {
    const { root, app } = setup();
    app.loadFixture("4.1");
    app.setView("trajectory");
    const trajLayer = root.querySelector('[data-layers-for="trajectory"] [data-layer="trajectory"]')!;
    expect(trajLayer.querySelector('[data-trajectory="null"]')).not.toBeNull();
    expect(trajLayer.textContent).toMatch(/trajectory: null — explicit, never silent/);
    const reason = app.selected!.response.output.signals["trajectory_null_reason"] as string;
    expect(trajLayer.textContent).toContain(reason);
  });
});

describe("relationship classes render with distinct, ordered weight", () => {
  test("2.1 renders statistical_association at weight 2", () => {
    const { root, app } = setup();
    app.loadFixture("2.1");
    app.setView("relationships");
    const card = root.querySelector(".rel-card")!;
    expect(card.getAttribute("data-relationship-class")).toBe("statistical_association");
    expect(card.getAttribute("data-rel-weight")).toBe("2");
    expect(card.textContent).toContain("statistical_association");
  });

  test("all four classes: weights strictly increase; candidate never carries demonstrated weight", () => {
    const mk = (cls: AssertedRelation["relationship_class"]): AssertedRelation => ({
      subject: "X",
      predicate: "affects",
      object: "Y",
      relationship_class: cls,
      evidence_quotes: ["q"],
      justification: "j",
    });
    const holder = document.createElement("div");
    holder.innerHTML = renderRelations([
      mk("observed_sequence"),
      mk("statistical_association"),
      mk("candidate_causal"),
      mk("demonstrated_intervention"),
    ]);
    const cards = [...holder.querySelectorAll(".rel-card")];
    const weights = cards.map((c) => Number(c.getAttribute("data-rel-weight")));
    expect(weights).toEqual([1, 2, 3, 4]);
    const candidate = cards[2];
    const demonstrated = cards[3];
    expect(candidate.getAttribute("data-rel-weight")).not.toBe(demonstrated.getAttribute("data-rel-weight"));
    expect(candidate.getAttribute("data-relationship-class")).toBe("candidate_causal");
  });
});

describe("agency: the assent gate is visible in the rendering", () => {
  test("3.1: sovereign_decision_required is not executable and has no button; unauthorized is flagged", () => {
    const { root, app } = setup();
    app.loadFixture("3.1");
    app.setView("agency");
    const assent = root.querySelector('[data-authority-basis="sovereign_decision_required"]')!;
    expect(assent).not.toBeNull();
    expect(assent.getAttribute("data-gate")).toBe("assent-required");
    expect(assent.getAttribute("data-executable")).toBe("false");
    expect(assent.textContent).toContain("REQUIRES SOVEREIGN ASSENT");
    expect(assent.querySelector("button")).toBeNull();
    const un = root.querySelector('[data-authority-basis="unauthorized"]')!;
    expect(un.getAttribute("data-gate")).toBe("unauthorized");
    expect(un.getAttribute("data-executable")).toBe("false");
    expect(un.textContent).toContain("FLAGGED");
    // no action anywhere in the agency view is a one-click control
    expect(root.querySelectorAll(".action button").length).toBe(0);
  });
});

describe("uncertainty: five distinct epistemic states, first-class on the view", () => {
  test("4.1: panel present with all five states; lacks_evidence carries the null-trajectory reason; value matches the cross-cut", () => {
    const { root, app } = setup();
    const entry = app.loadFixture("4.1");
    const panel = root.querySelector("[data-uncertainty-panel]")!;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute("data-uncertainty-value")).toBe(entry.response.uncertainty.toFixed(2));
    const states = [...panel.querySelectorAll("[data-uncertainty-state]")].map((e) =>
      e.getAttribute("data-uncertainty-state")
    );
    expect(new Set(states)).toEqual(
      new Set(["known", "inferred", "suspected", "cannot_distinguish", "lacks_evidence"])
    );
    const lacks = panel.querySelector('[data-uncertainty-state="lacks_evidence"]')!;
    const reason = entry.response.output.signals["trajectory_null_reason"] as string;
    expect(lacks.textContent).toContain(reason);
    const cannot = panel.querySelector('[data-uncertainty-state="cannot_distinguish"]')!;
    expect(cannot.textContent).not.toContain("— none on this record —");
  });
});

describe("history: the longitudinal record", () => {
  test("entries accumulate in order and the history lens renders the whole record", () => {
    const { root, app } = setup();
    app.loadFixture("1.1");
    app.loadFixture("4.1");
    app.setView("history");
    const items = [...root.querySelectorAll("[data-record-entry]")];
    expect(items.length).toBe(2);
    const timeline = root.querySelector(".record-timeline")!;
    expect(timeline.textContent!.indexOf("dog bit three people")).toBeLessThan(
      timeline.textContent!.indexOf("Revenue was")
    );
  });

  test("demo sovereign record (fixture): history shows recorded events and the context reaches the raw layer", () => {
    const { root, app } = setup();
    app.loadDemoContext();
    app.setView("history");
    const summary = root.querySelector(".lens-summary")!;
    expect(summary.textContent).toMatch(/recorded events/);
    const raw = root.querySelector('[data-layer="raw"]')!;
    expect(raw.textContent).toContain("GuardianLink cognitive surface");
  });
});

describe("the record is the real pipeline — no mock path", () => {
  test("a novel live question is quoted verbatim in the raw layer of its own entry", () => {
    const { root, app } = setup();
    const novel = "The kiln fired twice this week and both loads cracked along the rim.";
    app.ask(novel, "position");
    expect(app.entries.length).toBe(1);
    expect(app.entries[0].source).toBe("live");
    const quotes = [...root.querySelectorAll("[data-raw-quote]")].map((q) => q.textContent);
    expect(quotes.join(" ")).toContain("kiln fired twice");
    // and the rendered answer is byte-identical to calling the pipeline directly
    const direct = answer({ type: "position", text: novel }, null, { lensThreshold: 0 });
    expect(app.entries[0].response.answer_text).toBe(direct.answer_text);
  });

  test("all seven capabilities are present on the home view", () => {
    const { root, app } = setup();
    app.loadFixture("1.1");
    const caps = [...root.querySelectorAll("[data-capability]")].map((e) =>
      e.getAttribute("data-capability")
    );
    expect(new Set(caps)).toEqual(
      new Set(["position", "patterns", "relationships", "history", "trajectory", "agency", "uncertainty"])
    );
  });
});
