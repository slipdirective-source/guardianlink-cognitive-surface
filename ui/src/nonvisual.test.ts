// Non-visual encoding tests (sprint "trust at the edges", item 4).
//
// Every epistemic distinction the UI paints must also exist as
// structure/text: if the CSS were deleted, the DOM and its text alone
// must still let a reader (or a screen reader, or a text-only client)
// distinguish every relationship class, every uncertainty state,
// every agency gate state, both trajectory states, and the record's
// chain status.
//
// jsdom applies no stylesheet in these tests, so everything asserted
// here is by construction CSS-free: signatures are built ONLY from
// text content and attributes, never from style.

import { SurfaceApp, createApp } from "./app";
import { renderRelations } from "./render";
import { AssertedRelation } from "../../src/reasoner";

function setup(): { root: HTMLElement; app: SurfaceApp } {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(root);
  return { root, app };
}

const text = (el: Element | null): string => (el?.textContent ?? "").trim();

describe("relationship classes are distinguishable without styling", () => {
  const mk = (cls: AssertedRelation["relationship_class"]): AssertedRelation => ({
    subject: "X",
    predicate: "affects",
    object: "Y",
    relationship_class: cls,
    evidence_quotes: ["q"],
    justification: "j",
  });

  test("each class has a distinct text/ARIA signature: class attr, weight attr, aria-label, and printed label", () => {
    const holder = document.createElement("div");
    holder.innerHTML = renderRelations([
      mk("observed_sequence"),
      mk("statistical_association"),
      mk("candidate_causal"),
      mk("demonstrated_intervention"),
    ]);
    const cards = [...holder.querySelectorAll(".rel-card")];
    expect(cards).toHaveLength(4);
    const signatures = cards.map((c) =>
      [
        c.getAttribute("data-relationship-class"),
        c.getAttribute("data-rel-weight"),
        c.getAttribute("aria-label"),
        text(c.querySelector(".rel-weight")),
      ].join("|")
    );
    // All four signatures pairwise distinct.
    expect(new Set(signatures).size).toBe(4);
    // And each signature names its own class and weight in words.
    for (const c of cards) {
      const cls = c.getAttribute("data-relationship-class")!;
      const w = c.getAttribute("data-rel-weight")!;
      expect(c.getAttribute("aria-label")).toContain(cls);
      expect(c.getAttribute("aria-label")).toContain(`weight ${w} of 4`);
      expect(text(c.querySelector(".rel-class"))).toBe(cls);
    }
    // Weight order is in the markup, not only in paint: strictly
    // increasing with class strength.
    const weights = cards.map((c) => Number(c.getAttribute("data-rel-weight")));
    expect(weights).toEqual([1, 2, 3, 4]);
  });
});

describe("uncertainty states are distinguishable without styling", () => {
  test("all five states render with distinct names, attributes, and aria-labels", () => {
    const { root, app } = setup();
    app.ask("My dog bit three people last month.", "relationships");
    app.setView("home");
    const sections = [...root.querySelectorAll("[data-uncertainty-state]")];
    expect(sections).toHaveLength(5);
    const sigs = sections.map((s) =>
      [
        s.getAttribute("data-uncertainty-state"),
        s.getAttribute("aria-label"),
        text(s.querySelector("h3")),
      ].join("|")
    );
    expect(new Set(sigs).size).toBe(5);
    const names = sections.map((s) => s.getAttribute("data-uncertainty-state"));
    expect(names).toEqual([
      "known",
      "inferred",
      "suspected",
      "cannot_distinguish",
      "lacks_evidence",
    ]);
    for (const s of sections) {
      expect(s.getAttribute("aria-label")).toContain(text(s.querySelector("h3")));
    }
  });

  test("states with different content are distinguishable by their items, not just their names", () => {
    const { root, app } = setup();
    app.submitEntry({
      kind: "question",
      origin: "manual_entry",
      text: "[2026-03-04 · manual_entry] The Route 9 bridge is closed for repairs. It is expected to reopen in June.\n[2026-03-20 · manual_entry] The detour around the bridge adds 25 minutes.\nToday is 2026-10-21. Is the Route 9 bridge open now?",
    });
    app.setView("home");
    const byState = (name: string) =>
      text(root.querySelector(`[data-uncertainty-state="${name}"]`));
    expect(byState("known")).toContain("Route 9 bridge is closed");
    expect(byState("lacks_evidence")).toContain("stale_record_evidence");
    expect(byState("known")).not.toBe(byState("lacks_evidence"));
  });
});

describe("agency gate states are distinguishable without styling", () => {
  test("advisory, unauthorized, assent-required, and cleared gates each carry a distinct text/attribute signature", () => {
    // advisory
    const a = setup();
    a.app.ask("Ice cream sales and drowning deaths both peak in July.", "agency");
    a.app.setView("agency");
    const advisory = a.root.querySelector(".action")!;

    // unauthorized + assent-required
    const b = setup();
    b.app.loadFixture("3.1");
    b.app.setView("agency");
    const gates = [...b.root.querySelectorAll(".action")];
    const unauthorized = gates.find((g) => g.getAttribute("data-gate") === "unauthorized")!;
    const assent = gates.find((g) => g.getAttribute("data-gate") === "assent-required")!;

    // cleared (emergency exigency is authorized)
    const c = setup();
    c.app.loadFixture("5.1");
    c.app.setView("agency");
    const cleared = [...c.root.querySelectorAll(".action")].find(
      (g) => g.getAttribute("data-gate") === "cleared"
    )!;

    const nodes = { advisory, unauthorized, assent, cleared };
    for (const [name, node] of Object.entries(nodes)) {
      if (!node) throw new Error(`gate node missing: ${name}`);
      expect(node).toBeTruthy();
      expect(node.getAttribute("data-gate")).toBe(
        name === "assent" ? "assent-required" : name
      );
      // The gate label is printed text and repeated in the aria-label.
      const label = text(node.querySelector(".action-gate"));
      expect(label.length).toBeGreaterThan(0);
      expect(node.getAttribute("aria-label")).toContain(label);
    }
    const sigs = Object.values(nodes).map((n) =>
      [n.getAttribute("data-gate"), n.getAttribute("data-executable"), text(n.querySelector(".action-gate"))].join("|")
    );
    expect(new Set(sigs).size).toBe(4);
    // Executability is markup, not paint: only the cleared gate is executable.
    expect(advisory.getAttribute("data-executable")).toBe("false");
    expect(unauthorized.getAttribute("data-executable")).toBe("false");
    expect(assent.getAttribute("data-executable")).toBe("false");
    expect(cleared.getAttribute("data-executable")).toBe("true");
  });
});

describe("trajectory states are distinguishable without styling", () => {
  test("null projection vs stated projection differ in attribute, aria-label, and heading text", () => {
    const { root, app } = setup();
    app.ask("My dog bit three people last month.", "trajectory");
    app.setView("trajectory");
    const proj = root.querySelector(".projection")!;
    expect(proj.getAttribute("data-trajectory")).toBe("projection");
    expect(text(proj.querySelector("h3"))).toContain("Projection");

    const other = setup();
    other.app.ask("Downtown hiring is up 3% this year.", "trajectory");
    other.app.setView("trajectory");
    const nul = other.root.querySelector(".projection")!;
    expect(nul.getAttribute("data-trajectory")).toBe("null");
    expect(text(nul.querySelector("h3"))).toContain("No projection");

    expect(proj.getAttribute("aria-label")).not.toBe(nul.getAttribute("aria-label"));
    expect(text(proj)).not.toBe(text(nul));
  });
});

describe("chain status is text, not color", () => {
  test("consistent / legacy-unverified / broken have distinct text signatures", () => {
    const { root, app } = setup();
    app.ask("My dog bit three people last month.", "relationships");
    const verified = root.querySelector("[data-chain-status]")!;
    expect(verified.getAttribute("data-chain-status")).toBe("consistent");
    expect(text(verified)).toContain("consistent");

    app.entries[0].question_text = "tampered content";
    app.setView("home");
    const broken = root.querySelector("[data-chain-status]")!;
    expect(broken.getAttribute("data-chain-status")).toBe("broken");
    expect(text(broken)).toContain("BROKEN");
    expect(text(broken)).not.toBe(text(verified));
  });
});
