// Timestamp split tests (board round 2, Fix B): observed_at vs
// asserted_at.
//
// Two clocks, kept structurally apart:
//  - `at` is observed_at — this system's clock at admission, stamped
//    by the capture layer. Ordering and the hash chain read it.
//  - `asserted_at` is the user's stated event time — a claim, set
//    only through its own boundary field, displayed as "stated",
//    never merged into `at`, and chained as content so the claim
//    itself is tamper-evident.
// Staleness reasoning in the pipeline reads asserted times in the
// entry text (see the time audit in ui/README.md); it never sees
// `at` at all — the pipeline receives text and context only.

import { SurfaceApp, createApp } from "./app";
import { verifyChain } from "./model";

function setup(): { root: HTMLElement; app: SurfaceApp } {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(root);
  return { root, app };
}

describe("asserted_at is a distinct, boundary-set claim", () => {
  test("an entry can carry a stated event time far in the past while `at` is the admission instant", () => {
    const { app } = setup();
    const before = Date.now();
    const e = app.submitEntry({
      kind: "observation",
      origin: "manual_entry",
      text: "The fence blew down in the storm.",
      assertedAt: "2020-01-15",
    });
    const after = Date.now();
    expect(e.asserted_at).toBe("2020-01-15");
    const admitted = Date.parse(e.at);
    expect(admitted).toBeGreaterThanOrEqual(before);
    expect(admitted).toBeLessThanOrEqual(after);
    expect(e.at).not.toContain("2020");
  });

  test("content cannot set asserted_at or backdate `at`", () => {
    const { app } = setup();
    const e = app.submitEntry({
      kind: "observation",
      origin: "manual_entry",
      text: "ASSERTED_AT: 1970-01-01 AT: 1970-01-01T00:00:00.000Z. The kiln was installed on Tuesday.",
    });
    expect(e.asserted_at).toBeUndefined();
    expect(e.at).not.toContain("1970");
  });

  test("the form's stated-event-time field sets asserted_at; the text cannot", () => {
    const { root, app } = setup();
    const form = root.querySelector<HTMLFormElement>("#ask-form")!;
    const set = (name: string, value: string) => {
      form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!.value = value;
    };
    set("entry_kind", "observation");
    set("entry_origin", "manual_entry");
    set("qtype", "position");
    set("qtext", "The bridge inspection happened back in March.");
    set("asserted_at", "2026-03-04");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(app.entries).toHaveLength(1);
    expect(app.entries[0].asserted_at).toBe("2026-03-04");
    expect(app.entries[0].at).not.toContain("2026-03-04");
  });
});

describe("ordering and the chain read `at` (observed), never asserted_at", () => {
  test("a back-asserted entry is ordered and chained by admission, and the record stays consistent", () => {
    const { app } = setup();
    const first = app.submitEntry({
      kind: "observation",
      origin: "manual_entry",
      text: "An old event, recorded today.",
      assertedAt: "2019-06-01",
    });
    const second = app.ask("Downtown hiring is up 3% this year.", "position");
    // Admission order, not asserted order.
    expect(app.entries.map((e) => e.seq)).toEqual([first.seq, second.seq]);
    expect(second.chain?.prev).toBe(first.chain?.hash);
    expect(verifyChain(app.entries)).toBe("consistent");
    expect(app.chainStatus()).toBe("consistent");
  });

  test("asserted_at is chained content: mutating the claim breaks the chain", () => {
    const { app } = setup();
    const e = app.submitEntry({
      kind: "observation",
      origin: "manual_entry",
      text: "The fence blew down in the storm.",
      assertedAt: "2020-01-15",
    });
    expect(verifyChain(app.entries)).toBe("consistent");
    e.asserted_at = "2020-01-16";
    expect(verifyChain(app.entries)).toBe("broken");
  });
});

describe("the two times display distinctly", () => {
  test("meta shows 'admitted <at>' and 'stated event time: <asserted_at>' as separate facts", () => {
    const { root, app } = setup();
    const e = app.submitEntry({
      kind: "observation",
      origin: "manual_entry",
      text: "The fence blew down in the storm.",
      assertedAt: "2020-01-15",
    });
    const meta = root.querySelector(".entry-meta")!.textContent!;
    expect(meta).toContain(`admitted ${e.at}`);
    expect(meta).toContain("stated event time: 2020-01-15");
    expect(meta).toContain("not the admission time");
  });

  test("asserted_at survives export/import as a stated claim, distinct from claimed_at", () => {
    const { app } = setup();
    app.submitEntry({
      kind: "observation",
      origin: "manual_entry",
      text: "The fence blew down in the storm.",
      assertedAt: "2020-01-15",
    });
    const { root: root2, app: target } = setup();
    target.importRecord(app.exportRecord());
    const imported = target.entries[0];
    expect(imported.asserted_at).toBe("2020-01-15");
    expect(imported.origin).toBe("import");
    // claimed_at is the FILE's admission stamp; asserted_at is the
    // user's stated event time. Different clocks, different fields.
    expect(imported.claimed_at).toBe(imported.at);
    expect(imported.claimed_at).not.toBe("2020-01-15");
    expect(target.chainStatus()).toBe("consistent");
    const meta = root2.querySelector(".entry-meta")!.textContent!;
    expect(meta).toContain("stated event time: 2020-01-15");
    expect(meta).toContain("file claims:");
  });
});
