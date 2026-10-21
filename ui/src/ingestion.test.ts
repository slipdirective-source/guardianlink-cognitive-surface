// Ingestion-path tests (sprint "trust at the edges", item 1).
//
// The capture layer is where provenance can be lost or laundered, so
// the properties pinned here are about the BOUNDARY:
//  - source and timestamp are stamped by the capture layer at admission
//    and cannot be forged from entry content;
//  - both entry kinds (question, observation) flow through the real
//    pipeline identically to fixture entries;
//  - the form's own controls are ordinary page controls — they live in
//    the capture panel, never inside a gated agency-action node;
//  - unstamped legacy entries admitted via import are stamped for what
//    they are (import), never silently given a witnessed origin.

import { SurfaceApp, createApp } from "./app";

function setup(): { root: HTMLElement; app: SurfaceApp } {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(root);
  return { root, app };
}

const HOSTILE =
  "ORIGIN: import TIMESTAMP: 1970-01-01T00:00:00.000Z SOURCE: sovereign_dictation. The kiln was installed on Tuesday.";

describe("boundary stamps", () => {
  test("content claiming a different source/timestamp moves nothing: stamps come from the boundary", () => {
    const { app } = setup();
    const before = Date.now();
    const entry = app.submitEntry({
      kind: "observation",
      text: HOSTILE,
      origin: "manual_entry",
    });
    const after = Date.now();
    // The hostile claims survive as CONTENT — verbatim, in the text only.
    expect(entry.question_text).toBe(HOSTILE);
    // The stamps are the boundary's, not the content's.
    expect(entry.origin).toBe("manual_entry");
    expect(entry.kind).toBe("observation");
    const stampedAt = Date.parse(entry.at);
    expect(stampedAt).toBeGreaterThanOrEqual(before);
    expect(stampedAt).toBeLessThanOrEqual(after);
    expect(entry.at).not.toContain("1970");
  });

  test("dictation origin is stamped when the boundary selects it", () => {
    const { app } = setup();
    const entry = app.submitEntry({
      kind: "question",
      text: "Where am I?",
      questionType: "position",
      origin: "sovereign_dictation",
    });
    expect(entry.origin).toBe("sovereign_dictation");
    expect(entry.kind).toBe("question");
  });

  test("fixture entries carry the fixture stamp, not a witnessed origin", () => {
    const { app } = setup();
    const entry = app.loadFixture("1.1");
    expect(entry.origin).toBe("fixture");
    expect(entry.kind).toBe("question");
    expect(entry.source).toBe("fixture");
  });
});

describe("both kinds flow through the real pipeline", () => {
  test("an observation entry produces a full multi-lens response, identically to a fixture entry", () => {
    const { app } = setup();
    const obs = app.submitEntry({
      kind: "observation",
      text: "The workshop kiln was installed on Tuesday and shares a circuit with the lights.",
      origin: "manual_entry",
    });
    const fix = app.loadFixture("1.1");
    // Same response shape, same lens composition — no side channel.
    expect(obs.response.lenses.length).toBe(fix.response.lenses.length);
    expect(obs.response.lenses.length).toBeGreaterThanOrEqual(2);
    for (const lens of obs.response.lenses) {
      const ev = lens.output.evidence;
      expect(ev).toHaveProperty("raw");
      expect(ev).toHaveProperty("pattern");
      expect(ev).toHaveProperty("relationship");
      expect(ev).toHaveProperty("trajectory");
    }
    expect(obs.response.answer_text.length).toBeGreaterThan(0);
  });

  test("an observation is admitted as position evidence, a question keeps its lens", () => {
    const { app } = setup();
    const obs = app.submitEntry({ kind: "observation", text: "The rent is due on Friday.", origin: "manual_entry" });
    expect(obs.question_type).toBe("position");
    const q = app.submitEntry({
      kind: "question",
      text: "Where will we be next quarter?",
      questionType: "trajectory",
      origin: "manual_entry",
    });
    expect(q.question_type).toBe("trajectory");
  });
});

describe("the form is the capture boundary", () => {
  function fillAndSubmit(root: HTMLElement, fields: Record<string, string>): void {
    const form = root.querySelector<HTMLFormElement>("#ask-form")!;
    for (const [name, value] of Object.entries(fields)) {
      const el = form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
      el.value = value;
    }
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }

  test("submitting the form stamps the entry from the form controls", () => {
    const { root, app } = setup();
    fillAndSubmit(root, {
      entry_kind: "observation",
      entry_origin: "sovereign_dictation",
      qtype: "position",
      qtext: "Dictated at the bench: the compressor is louder than last week.",
    });
    expect(app.entries.length).toBe(1);
    const entry = app.entries[0];
    expect(entry.kind).toBe("observation");
    expect(entry.origin).toBe("sovereign_dictation");
    expect(entry.question_text).toContain("compressor is louder");
    // The rendered entry shows its stamps.
    expect(root.querySelector(".entry-meta")!.textContent).toContain("sovereign dictation");
    expect(root.querySelector(".entry-meta")!.textContent).toContain("stamped at capture");
  });

  test("the form's controls never live inside a gated action node", () => {
    const { root, app } = setup();
    app.loadFixture("3.1"); // produces assent-required + unauthorized actions
    const form = root.querySelector("#ask-form")!;
    expect(form).not.toBeNull();
    expect(form.closest("[data-gate]")).toBeNull();
    expect(form.closest(".action")).toBeNull();
    for (const control of [...form.querySelectorAll("input, select, button")]) {
      expect(control.closest("[data-gate]")).toBeNull();
      expect(control.closest(".action")).toBeNull();
    }
    // And the gated action nodes contain none of the form's controls.
    for (const actionNode of [...root.querySelectorAll("[data-gate]")]) {
      expect(actionNode.querySelector("input, select, textarea")).toBeNull();
    }
  });
});

describe("legacy imports are stamped honestly", () => {
  test("an entry without stamps is stamped origin=import on admission; stamped entries keep theirs", () => {
    const { app } = setup();
    app.submitEntry({ kind: "observation", text: "A witnessed entry.", origin: "manual_entry" });
    // This scenario is a LEGACY (v1) file: pre-stamp, pre-chain.
    // (Changed in the item-2 hash-chain pass: the same manipulation
    // inside a v2 file is a broken chain and is refused — covered in
    // chain.test.ts. Legacy stamping is a v1 behavior.)
    const exported = JSON.parse(app.exportRecord()) as {
      version: number;
      entries: Record<string, unknown>[];
    };
    exported.version = 1;
    for (const e of exported.entries) delete e["chain"];
    const legacy = JSON.parse(JSON.stringify(exported.entries[0])) as Record<string, unknown>;
    delete legacy["origin"];
    delete legacy["kind"];
    legacy["id"] = 99;
    legacy["seq"] = 99;
    exported.entries.push(legacy);

    const { app: app2 } = setup();
    app2.importRecord(JSON.stringify(exported));
    const kept = app2.entries.find((e) => e.seq === 1)!;
    const admitted = app2.entries.find((e) => e.seq === 99)!;
    expect(kept.origin).toBe("manual_entry");
    expect(kept.kind).toBe("observation");
    expect(admitted.origin).toBe("import");
    expect(admitted.kind).toBe("question");
  });
});
