// Tamper-evident history tests (sprint "trust at the edges", item 2).
//
// The chain's contract:
//  - SHA-256 is the published algorithm (vectors).
//  - Entries chain at admission; a clean record verifies, and the UI
//    displays its status as record metadata.
//  - Import verifies BEFORE applying: a flipped byte or a reordering
//    refuses the import wholesale and leaves the current record
//    untouched (fail closed, never partial).
//  - A valid v2 export round-trips to a byte-stable downgraded fixed
//    point (board round 2: import downgrades provenance — the first
//    re-export differs by design; see provenance.test.ts).
//  - v1 exports import as legacy-unchained: displayed as
//    legacy-unverified, never silently upgraded (legacy entries stay
//    chain-less through re-export; new entries anchor to the legacy
//    boundary).
//  - A mutated in-memory entry verifies as broken, and a broken chain
//    can never display as consistent. (The status was renamed
//    "verified" -> "consistent" in board round 2: the chain claims
//    consistency, not authenticity, and the name now says so.)

import { SurfaceApp, createApp } from "./app";
import { LEGACY_ANCHOR, verifyChain } from "./model";
import { sha256Hex } from "./sha256";

function setup(): { root: HTMLElement; app: SurfaceApp } {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(root);
  return { root, app };
}

describe("sha256", () => {
  test("published test vectors", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    expect(
      sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")
    ).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
    expect(sha256Hex("a".repeat(1_000_000))).toBe(
      "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"
    );
  });
});

describe("chaining at admission", () => {
  test("entries link in order and the record verifies", () => {
    const { root, app } = setup();
    const e1 = app.ask("My dog bit three people last month.", "relationships");
    const e2 = app.ask("Downtown hiring is up 3% this year.", "position");
    const e3 = app.ask("Ice cream sales and drowning deaths both peak in July.", "relationships");
    expect(e1.chain?.prev).toBe("guardianlink-record-genesis");
    expect(e2.chain?.prev).toBe(e1.chain?.hash);
    expect(e3.chain?.prev).toBe(e2.chain?.hash);
    expect(verifyChain(app.entries)).toBe("consistent");
    expect(app.chainStatus()).toBe("consistent");
    const status = root.querySelector("[data-chain-status]");
    expect(status?.getAttribute("data-chain-status")).toBe("consistent");
    expect(status?.textContent).toContain("hash chain consistent");
  });
});

describe("import verification fails closed", () => {
  test("one flipped byte in an exported entry refuses the import; current record untouched", () => {
    const { app } = setup();
    app.ask("My dog bit three people last month.", "relationships");
    const exported = app.exportRecord();
    const tampered = exported.replace("bit three people", "bit four people");
    expect(tampered).not.toBe(exported);

    const { app: target } = setup();
    target.ask("Ice cream sales and drowning deaths both peak in July.", "relationships");
    const before = target.exportRecord();
    expect(() => target.importRecord(tampered)).toThrow(/hash chain verification failed/);
    expect(target.exportRecord()).toBe(before);
    expect(target.entries).toHaveLength(1);
    expect(target.chainStatus()).toBe("consistent");
  });

  test("reordered entries refuse the import", () => {
    const { app } = setup();
    app.ask("My dog bit three people last month.", "relationships");
    app.ask("Downtown hiring is up 3% this year.", "position");
    const parsed = JSON.parse(app.exportRecord());
    parsed.entries.reverse();
    const reordered = JSON.stringify(parsed, null, 2);

    const { app: target } = setup();
    expect(() => target.importRecord(reordered)).toThrow(/hash chain verification failed/);
    expect(target.entries).toHaveLength(0);
  });

  test("a v2 entry missing its chain link refuses the import", () => {
    const { app } = setup();
    app.ask("My dog bit three people last month.", "relationships");
    const parsed = JSON.parse(app.exportRecord());
    delete parsed.entries[0].chain;
    const { app: target } = setup();
    expect(() => target.importRecord(JSON.stringify(parsed))).toThrow(
      /without a hash-chain link/
    );
    expect(target.entries).toHaveLength(0);
  });

  // NAMED CHANGE (board round 2, Fix A — import provenance
  // downgrade): this test previously asserted export -> import ->
  // export is byte-identical. Under the downgrade that is no longer
  // the contract for a first import: the importing system did not
  // witness the entries, so their effective origin becomes "import"
  // and the file's stamps move to claimed provenance — the re-export
  // differs from the original in exactly those fields. The new
  // contract: the downgrade is a FIXED POINT (a second
  // export -> import -> export is byte-identical), and the chain
  // stays consistent across it. The downgrade's full semantics are
  // pinned in provenance.test.ts.
  test("valid v2 export round-trips to a byte-stable downgraded fixed point", () => {
    const { app } = setup();
    app.ask("My dog bit three people last month.", "relationships");
    app.submitEntry({
      kind: "observation",
      origin: "sovereign_dictation",
      text: "The kiln was installed on Tuesday.",
    });
    const exported = app.exportRecord();
    const { app: target } = setup();
    target.importRecord(exported);
    const downgraded = target.exportRecord();
    expect(downgraded).not.toBe(exported);
    expect(target.chainStatus()).toBe("consistent");
    const { app: target2 } = setup();
    target2.importRecord(downgraded);
    expect(target2.exportRecord()).toBe(downgraded);
    expect(target2.chainStatus()).toBe("consistent");
  });
});

describe("v1 legacy imports", () => {
  function makeV1(app: SurfaceApp): string {
    const parsed = JSON.parse(app.exportRecord());
    parsed.version = 1;
    for (const e of parsed.entries) delete e.chain;
    return JSON.stringify(parsed, null, 2);
  }

  test("v1 imports as legacy-unchained, displays legacy-unverified, and is never silently upgraded", () => {
    const { app: source } = setup();
    source.ask("My dog bit three people last month.", "relationships");
    const v1 = makeV1(source);

    const { root, app } = setup();
    expect(app.importRecord(v1)).toBe(1);
    expect(app.chainStatus()).toBe("legacy-unverified");
    const status = root.querySelector("[data-chain-status]");
    expect(status?.getAttribute("data-chain-status")).toBe("legacy-unverified");
    expect(status?.textContent).toContain("legacy");

    // New entries chain onto the legacy boundary anchor.
    const added = app.ask("Downtown hiring is up 3% this year.", "position");
    expect(added.chain?.prev).toBe(LEGACY_ANCHOR);
    expect(app.chainStatus()).toBe("legacy-unverified");

    // Re-export: the legacy entry is STILL chain-less (trust not
    // upgraded), the new entry keeps its chain.
    const reexported = JSON.parse(app.exportRecord());
    expect(reexported.version).toBe(2);
    expect(reexported.entries[0].chain).toBeUndefined();
    expect(reexported.entries[1].chain?.prev).toBe(LEGACY_ANCHOR);
  });

  test("v1 bytes are refused if relabeled v2 (the file claims a chain it does not have)", () => {
    const { app: source } = setup();
    source.ask("My dog bit three people last month.", "relationships");
    const parsed = JSON.parse(makeV1(source));
    parsed.version = 2;
    const { app } = setup();
    expect(() => app.importRecord(JSON.stringify(parsed))).toThrow(
      /without a hash-chain link/
    );
  });
});

describe("broken chains in memory", () => {
  test("mutating an entry's content breaks verification and the display", () => {
    const { root, app } = setup();
    const e = app.ask("My dog bit three people last month.", "relationships");
    app.ask("Downtown hiring is up 3% this year.", "position");
    expect(app.chainStatus()).toBe("consistent");
    e.question_text = "My dog bit four people last month.";
    expect(verifyChain(app.entries)).toBe("broken");
    expect(app.chainStatus()).toBe("broken");
    app.setView("home"); // force re-render
    const status = root.querySelector("[data-chain-status]");
    expect(status?.getAttribute("data-chain-status")).toBe("broken");
    expect(status?.textContent).toContain("BROKEN");
    expect(status?.textContent).not.toContain("hash chain consistent");
  });
});
