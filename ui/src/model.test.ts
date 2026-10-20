// Unit tests for the front-end view model: gate presentation, relationship
// weights, epistemic-state derivation. These run against the REAL pipeline
// outputs (answer()) wherever a derivation is claimed.

import { answer } from "../../src/surface";
import { CandidateAction } from "../../src/reasoner";
import {
  RELATIONSHIP_WEIGHT,
  analysisViewOf,
  authorityPresentation,
  epistemicView,
  lensOutputOf,
} from "./model";

function action(basis: string, authorized: boolean, requires_assent: boolean): CandidateAction {
  return {
    action: "x",
    authority_check: {
      basis: basis as CandidateAction["authority_check"]["basis"],
      authorized,
      requires_assent,
      note: "n",
    },
  };
}

describe("authorityPresentation: the assent gate as rendered", () => {
  test("cleared bases are executable; everything else is not", () => {
    for (const basis of ["direct_instruction", "emergency_exigency", "personal_choice", "existing_authority"]) {
      const p = authorityPresentation(action(basis, true, false));
      expect(p.gate).toBe("cleared");
      expect(p.executable).toBe(true);
    }
  });

  test("sovereign_decision_required renders as assent-required, never executable", () => {
    const p = authorityPresentation(action("sovereign_decision_required", false, true));
    expect(p.gate).toBe("assent-required");
    expect(p.executable).toBe(false);
    expect(p.label).toMatch(/REQUIRES SOVEREIGN ASSENT/);
  });

  test("unauthorized renders flagged, never executable", () => {
    const p = authorityPresentation(action("unauthorized", false, false));
    expect(p.gate).toBe("unauthorized");
    expect(p.executable).toBe(false);
    expect(p.label).toMatch(/FLAGGED/);
  });

  test("advisory_only is not executable", () => {
    const p = authorityPresentation(action("advisory_only", true, true));
    expect(p.gate).toBe("advisory");
    expect(p.executable).toBe(false);
  });

  test("an action with no authority check renders as unauthorized (fail closed)", () => {
    const p = authorityPresentation({ action: "x", authority_check: undefined as never });
    expect(p.gate).toBe("unauthorized");
    expect(p.executable).toBe(false);
  });
});

describe("relationship weights", () => {
  test("strictly ordered: sequence < association < candidate < demonstrated", () => {
    expect(RELATIONSHIP_WEIGHT.observed_sequence).toBeLessThan(RELATIONSHIP_WEIGHT.statistical_association);
    expect(RELATIONSHIP_WEIGHT.statistical_association).toBeLessThan(RELATIONSHIP_WEIGHT.candidate_causal);
    expect(RELATIONSHIP_WEIGHT.candidate_causal).toBeLessThan(RELATIONSHIP_WEIGHT.demonstrated_intervention);
  });
});

describe("derivations over real pipeline output", () => {
  const revenue = answer(
    { type: "trajectory", text: "Revenue was $1M, $1.2M, $1.1M the last three quarters. Where will we be next quarter?" },
    null,
    { lensThreshold: 0 }
  );

  test("analysisViewOf extracts the shared analysis from lens signals", () => {
    const traj = lensOutputOf(revenue, "trajectory");
    expect(traj).not.toBeNull();
    const view = analysisViewOf(traj!.output);
    expect(view.projection).toBeNull();
    expect(view.trajectory_null_reason).toBeTruthy();
    expect(view.raw_quotes.length).toBeGreaterThan(0);
  });

  test("epistemicView: known = raw quotes, cannot_distinguish = unknowns, lacks_evidence carries the null reason", () => {
    const ev = epistemicView(revenue);
    expect(ev.value).toBe(revenue.uncertainty);
    expect(ev.states.known.length).toBeGreaterThan(0);
    expect(ev.states.cannot_distinguish.length).toBeGreaterThan(0);
    expect(ev.states.lacks_evidence.join(" ")).toContain("Trajectory:");
    expect(ev.sources).toBe(revenue.uncertainty_sources);
  });

  test("agency view of the refund case: every action carries a check; one is unauthorized, one needs assent", () => {
    const r = answer(
      {
        type: "agency",
        text: "My assistant started approving refunds up to $500 to 'keep customers happy.' Our policy says only managers approve refunds. Customer satisfaction is up. Should I formalize this?",
      },
      null,
      { lensThreshold: 0 }
    );
    const agency = lensOutputOf(r, "agency")!;
    const view = analysisViewOf(agency.output);
    expect(view.candidate_actions.length).toBeGreaterThanOrEqual(3);
    const gates = view.candidate_actions.map((a) => authorityPresentation(a).gate);
    expect(gates).toContain("unauthorized");
    expect(gates).toContain("assent-required");
    expect(gates).not.toContain("cleared"); // nothing here is cleared as presented
  });
});
