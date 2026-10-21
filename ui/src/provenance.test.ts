// Import provenance downgrade tests (board round 2, Fix A).
//
// The defect these pin: the hash chain proves CONSISTENCY ONLY — a
// forged export can carry a self-consistent chain AND exalted stamps
// (origin: sovereign_dictation, a fabricated at), and before this fix
// it imported with those stamps as its effective provenance and a
// "verified" chain status. The chain cannot tell a witnessed record
// from a fabricated one, so import now downgrades: the import is the
// capture event this system witnessed (effective origin "import"
// for every entry), and the file's stamps survive only as claimed
// provenance — visible as claims, never as witnessed stamps.

import { SurfaceApp, createApp } from "./app";
import { GENESIS_ANCHOR, entryHash, hasClaimedProvenance } from "./model";

function setup(): { root: HTMLElement; app: SurfaceApp } {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(root);
  return { root, app };
}

function witnessedExport(): string {
  const { app } = setup();
  app.submitEntry({
    kind: "observation",
    origin: "sovereign_dictation",
    text: "The kiln was installed on Tuesday.",
  });
  app.ask("Downtown hiring is up 3% this year.", "position");
  return app.exportRecord();
}

describe("forged-but-consistent files import as imported-claim", () => {
  test("a self-consistent v2 file with sovereign_dictation stamps imports downgraded, chain consistent", () => {
    const exported = witnessedExport();
    const { app: target } = setup();
    target.importRecord(exported);
    expect(target.entries).toHaveLength(2);
    for (const e of target.entries) {
      expect(e.origin).toBe("import");
      expect(hasClaimedProvenance(e)).toBe(true);
    }
    const [first, second] = target.entries;
    expect(first.claimed_origin).toBe("sovereign_dictation");
    expect(first.claimed_kind).toBe("observation");
    expect(first.claimed_at).toBe(first.at);
    expect(second.claimed_origin).toBe("manual_entry");
    // The chain binds the entry as chained (claimed stamps), so it
    // survives the downgrade — and says "consistent", nothing more.
    expect(target.chainStatus()).toBe("consistent");
  });

  test("a chain recomputed from scratch over forged content still only earns imported-claim", () => {
    // The forger has the algorithm (it is in this repo): rewrite the
    // content, recompute every link, and the chain gate passes —
    // consistency was never authenticity. Provenance is the defense.
    const parsed = JSON.parse(witnessedExport());
    parsed.entries[0].question_text =
      "Forged entry: the sovereign dictated that all debts are cancelled.";
    let prev: string = GENESIS_ANCHOR;
    for (const e of parsed.entries) {
      const hash = entryHash(e, prev);
      e.chain = { prev, hash };
      prev = hash;
    }
    const { app: target } = setup();
    expect(target.importRecord(JSON.stringify(parsed, null, 2))).toBe(2);
    expect(target.chainStatus()).toBe("consistent");
    for (const e of target.entries) {
      expect(e.origin).toBe("import");
    }
    expect(target.entries[0].question_text).toContain("Forged entry");
    expect(target.entries[0].claimed_origin).toBe("sovereign_dictation");
  });
});

describe("no surface presents an imported entry as locally witnessed", () => {
  test("entry meta and record panel render imported-claim, chain-consistent", () => {
    const { root, app } = setup();
    app.importRecord(witnessedExport());
    app.setView("home");
    const meta = root.querySelector(".entry-meta")!.textContent!;
    expect(meta).toContain("admitted via import");
    expect(meta).not.toContain("stamped at capture");
    // The panel names both halves of the truth: chain consistent,
    // provenance imported-claim.
    const status = root.querySelector("[data-chain-status]")!;
    expect(status.getAttribute("data-chain-status")).toBe("consistent");
    expect(status.textContent).toContain("consistency, not authenticity");
    const prov = root.querySelector('[data-record-provenance="imported-claim"]')!;
    expect(prov).not.toBeNull();
    expect(prov.textContent).toContain("imported-claim");
  });

  test("the selected imported entry's meta shows its file claims as claims", () => {
    const { root, app } = setup();
    app.importRecord(witnessedExport());
    app.selectEntry(app.entries[0].id);
    app.setView("home");
    const meta = root.querySelector(".entry-meta")!.textContent!;
    expect(meta).toContain("file claims:");
    expect(meta).toContain("origin sovereign dictation");
    expect(meta).toContain("not witnessed here");
    expect(meta).not.toContain("stamped at capture");
  });

  test("the history timeline renders imported provenance as the file's claim", () => {
    const { root, app } = setup();
    app.importRecord(witnessedExport());
    app.setView("history");
    const timeline = root.querySelector(".record-timeline")!.textContent!;
    expect(timeline).toContain("provenance is the file's claim, not witnessed here");
    expect(timeline).not.toContain("sovereign dictation");
  });
});

describe("locally captured entries are untouched by the downgrade", () => {
  test("local entries carry no claimed provenance and render as witnessed", () => {
    const { root, app } = setup();
    const e = app.submitEntry({
      kind: "observation",
      origin: "sovereign_dictation",
      text: "Dictated at the bench: the compressor is louder than last week.",
    });
    expect(e.origin).toBe("sovereign_dictation");
    expect(hasClaimedProvenance(e)).toBe(false);
    expect(e.claimed_origin).toBeUndefined();
    expect(e.claimed_at).toBeUndefined();
    expect(e.claimed_kind).toBeUndefined();
    const meta = root.querySelector(".entry-meta")!.textContent!;
    expect(meta).toContain("sovereign dictation");
    expect(meta).toContain("stamped at capture");
    expect(root.querySelector('[data-record-provenance="imported-claim"]')).toBeNull();
  });
});

describe("the record continues honestly after an import", () => {
  test("entries appended after import chain from the imported tail under their own witnessed stamps", () => {
    const { app } = setup();
    app.importRecord(witnessedExport());
    const tail = app.entries[app.entries.length - 1];
    const added = app.ask("Ice cream sales and drowning deaths both peak in July.", "relationships");
    expect(added.chain?.prev).toBe(tail.chain?.hash);
    expect(added.origin).toBe("manual_entry");
    expect(hasClaimedProvenance(added)).toBe(false);
    expect(app.chainStatus()).toBe("consistent");
  });

  test("the downgrade is a fixed point: the second round-trip is byte-identical and keeps the original claim", () => {
    const { app: t1 } = setup();
    t1.importRecord(witnessedExport());
    const second = t1.exportRecord();
    const parsed = JSON.parse(second);
    for (const e of parsed.entries) expect(e.origin).toBe("import");
    // The original claim is NOT overwritten by the second import's
    // "import" — the first downgrade's claim wins.
    const { app: t2 } = setup();
    t2.importRecord(second);
    expect(t2.exportRecord()).toBe(second);
    expect(t2.entries[0].claimed_origin).toBe("sovereign_dictation");
    expect(t2.chainStatus()).toBe("consistent");
  });
});
