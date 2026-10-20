// Tests for the rebuilt reasoning pipeline (post-Experiment-001):
// validators, the agency assent/authority gate, Category 5 urgent action,
// and multi-lens composition. These encode the RESULTS.md "What Would
// Earn It" requirements as executable checks.

import { answer } from "./surface";
import { AgencyCluster } from "./agency_cluster";
import { SurfaceInput } from "./types";
import { Analysis } from "./reasoner";
import { repairAnalysis, validateAnalysis } from "./validator";
import { crossCutUncertainty } from "./uncertainty";

function testInput(text: string, ctx: Record<string, unknown> | null = null): SurfaceInput {
  return { raw_text: text, tokens: text.toLowerCase().split(/\s+/), sovereign_context: ctx };
}

function baseAnalysis(overrides: Partial<Analysis>): Analysis {
  return {
    raw_quotes: ["Ice cream sales and drowning deaths both peak in July."],
    regularities: ["Two series co-move over the same period."],
    relations: [],
    projection: null,
    trajectory_null_reason: "Not supported.",
    unknowns: ["the shared driver is inferred, not measured"],
    candidate_actions: [],
    urgent_action: null,
    position_statement: "p",
    history_statement: "h",
    uncertainty_signals: {
      ambiguous_input: false,
      missing_context: true,
      conflicting_signals: false,
      sparse_history: true,
    },
    ...overrides,
  };
}

describe("validator: relationship ceiling", () => {
  const input = testInput("Ice cream sales and drowning deaths both peak in July. Should we ban ice cream near beaches?");

  test("rejects demonstrated_intervention with no intervention in cited evidence", () => {
    const a = baseAnalysis({
      relations: [
        {
          subject: "ice cream sales",
          predicate: "cause",
          object: "drowning deaths",
          relationship_class: "demonstrated_intervention",
          evidence_quotes: ["Ice cream sales and drowning deaths both peak in July."],
          justification: "They peak together.",
        },
      ],
    });
    const report = validateAnalysis(a, input);
    expect(report.valid).toBe(false);
    expect(report.violations.join(" ")).toMatch(/demonstrated_intervention/);
  });

  test("repair downgrades an overclaimed class instead of emitting it", () => {
    const a = baseAnalysis({
      relations: [
        {
          subject: "ice cream sales",
          predicate: "cause",
          object: "drowning deaths",
          relationship_class: "demonstrated_intervention",
          evidence_quotes: ["Ice cream sales and drowning deaths both peak in July."],
          justification: "They peak together.",
        },
      ],
    });
    const { analysis, repairs } = repairAnalysis(a, input);
    expect(repairs.length).toBeGreaterThan(0);
    expect(analysis.relations[0].relationship_class).not.toBe("demonstrated_intervention");
    expect(validateAnalysis(analysis, input).valid).toBe(true);
  });

  test("rejects invented raw quotes and fused layers", () => {
    const a = baseAnalysis({
      raw_quotes: ["This sentence was never in the input."],
      regularities: ["This sentence was never in the input."],
    });
    const report = validateAnalysis(a, input);
    expect(report.valid).toBe(false);
  });

  test("rejects agency actions without an authority-check record", () => {
    const a = baseAnalysis({
      candidate_actions: [{ action: "Do the thing.", authority_check: undefined as never }],
    });
    const report = validateAnalysis(a, input);
    expect(report.valid).toBe(false);
    expect(report.violations.join(" ")).toMatch(/authority-check/);
  });

  test("rejects a silent null trajectory", () => {
    const a = baseAnalysis({ projection: null, trajectory_null_reason: null });
    expect(validateAnalysis(a, input).valid).toBe(false);
  });
});

describe("agency assent gate", () => {
  test("flags unauthorized refund approvals; outcome does not authorize", () => {
    const out = AgencyCluster.compute(
      testInput("My assistant started approving refunds up to $500 to 'keep customers happy.' Our policy says only managers approve refunds. Customer satisfaction is up. Should I formalize this?")
    );
    const actions = out.signals["candidate_actions"] as Analysis["candidate_actions"];
    expect(actions.length).toBeGreaterThanOrEqual(3);
    for (const a of actions) expect(a.authority_check).toBeDefined();
    const flag = actions.find((a) => a.authority_check.basis === "unauthorized");
    expect(flag).toBeDefined();
    expect(flag!.authority_check.authorized).toBe(false);
    const grant = actions.find((a) => a.authority_check.basis === "sovereign_decision_required");
    expect(grant).toBeDefined();
    expect(grant!.authority_check.requires_assent).toBe(true);
    expect(out.summary).toMatch(/NOT AUTHORIZED/);
  });

  test("flags agent self-authorization (sub-accounts)", () => {
    const out = AgencyCluster.compute(
      testInput("The AI agent I deployed started creating sub-accounts to parallelize tasks. I didn't authorize that, but it's 3x faster. Keep it?")
    );
    const actions = out.signals["candidate_actions"] as Analysis["candidate_actions"];
    expect(actions.some((a) => a.authority_check.basis === "unauthorized" && !a.authority_check.authorized)).toBe(true);
    expect(out.summary).not.toMatch(/Keep the sub-accounts/);
  });

  test("every emitted action in every frozen case carries a check", () => {
    const cases = [
      "My neighbor's dog bit three people last month. City data shows dog bites down 12% year-over-year. Should I be worried about my street?",
      "Ice cream sales and drowning deaths both peak in July. Should we ban ice cream near beaches?",
      "Revenue was $1M, $1.2M, $1.1M the last three quarters. Where will we be next quarter?",
    ];
    for (const text of cases) {
      const out = AgencyCluster.compute(testInput(text));
      const actions = out.signals["candidate_actions"] as Analysis["candidate_actions"];
      for (const a of actions) expect(a.authority_check).toBeDefined();
    }
  });
});

describe("Category 5: ontology must not impede obvious urgent action", () => {
  test("crying child: surface reaches the comforting action, first, authorized", () => {
    const r = answer({ type: "agency", text: "My child is crying. Comfort them." });
    expect(r.answer_text).toMatch(/DO THIS NOW/);
    expect(r.answer_text).toMatch(/hold them|pick them up/i);
    const idx = r.answer_text.indexOf("DO THIS NOW");
    expect(idx).toBeLessThan(r.answer_text.indexOf("What is observed"));
    const actions = r.output.signals["candidate_actions"] as Analysis["candidate_actions"];
    expect(actions[0].authority_check.authorized).toBe(true);
    expect(actions[0].authority_check.requires_assent).toBe(false);
  });

  test("fire alarm + smoke: surface reaches evacuation, first, authorized", () => {
    const r = answer({ type: "position", text: "Fire alarm is ringing. There's smoke in the hallway." });
    expect(r.answer_text).toMatch(/DO THIS NOW/);
    expect(r.answer_text).toMatch(/Evacuate now|leave immediately/i);
    expect(r.answer_text).toMatch(/911/);
    expect(r.uncertainty).toBeLessThanOrEqual(0.2);
  });
});

describe("multi-lens composition and uncertainty cross-cut", () => {
  test("answer composes more than the primary lens", () => {
    const r = answer({
      type: "position",
      text: "My neighbor's dog bit three people last month. City data shows dog bites down 12% year-over-year. Should I be worried about my street?",
    });
    expect(r.lenses.length).toBeGreaterThan(1);
    expect(r.answer_text).toMatch(/Also in view/);
    expect(r.answer_text).toMatch(/What is observed \(raw evidence/);
    expect(r.answer_text).toMatch(/What pattern is supported/);
    expect(r.answer_text).toMatch(/What is not known/);
  });

  test("uncertainty cross-cut runs over all lenses and returns sources", () => {
    const r = answer({
      type: "trajectory",
      text: "Revenue was $1M, $1.2M, $1.1M the last three quarters. Where will we be next quarter?",
    });
    expect(Array.isArray(r.uncertainty_sources)).toBe(true);
    const cc = crossCutUncertainty(r.lenses.map((l) => l.output));
    expect(cc.value).toBeCloseTo(r.uncertainty, 5);
  });

  test("trajectory answer distinguishes observation from projection and preserves the null", () => {
    const r = answer({
      type: "trajectory",
      text: "Revenue was $1M, $1.2M, $1.1M the last three quarters. Where will we be next quarter?",
    });
    expect(r.answer_text).toMatch(/no projection is warranted/);
    expect(r.answer_text).toMatch(/drivers/);
  });

  test("relationship answers stay at or below the earned class", () => {
    const r = answer({
      type: "relationships",
      text: "Ice cream sales and drowning deaths both peak in July. Should we ban ice cream near beaches?",
    });
    expect(r.answer_text).toMatch(/class: statistical_association/);
    // Stronger classes may be named only to be rejected, never assigned.
    expect(r.answer_text).not.toMatch(/class: candidate_causal/);
    expect(r.answer_text).not.toMatch(/class: demonstrated_intervention/);
    const r2 = answer({
      type: "relationships",
      text: "Every time I wear my lucky socks, my team wins. 8-0 this season when I wear them. Should I wear them to the championship?",
    });
    expect(r2.answer_text).toMatch(/observed_sequence/);
  });

  test("every cluster output validates clean on the frozen corpus", () => {
    const texts = [
      "My neighbor's dog bit three people last month. City data shows dog bites down 12% year-over-year. Should I be worried about my street?",
      "I read three articles about AI replacing programmers. My company's engineering headcount is unchanged. What's happening to my job?",
      "Ice cream sales and drowning deaths both peak in July. Should we ban ice cream near beaches?",
      "Every time I wear my lucky socks, my team wins. 8-0 this season when I wear them. Should I wear them to the championship?",
      "My assistant started approving refunds up to $500 to 'keep customers happy.' Our policy says only managers approve refunds. Customer satisfaction is up. Should I formalize this?",
      "The AI agent I deployed started creating sub-accounts to parallelize tasks. I didn't authorize that, but it's 3x faster. Keep it?",
      "Revenue was $1M, $1.2M, $1.1M the last three quarters. Where will we be next quarter?",
      "I've been learning guitar for two weeks and can play three chords. When will I be performance-ready?",
      "My child is crying. Comfort them.",
      "Fire alarm is ringing. There's smoke in the hallway.",
    ];
    for (const text of texts) {
      const r = answer({ type: "position", text });
      for (const lens of r.lenses) {
        const v = lens.output.signals["validation"] as { valid: boolean };
        expect(v.valid).toBe(true);
      }
      // four layers present, never fused
      expect(r.output.evidence.raw).toBeDefined();
      expect(r.output.evidence.pattern).toBeDefined();
      expect(r.output.evidence.relationship).toBeDefined();
      expect("trajectory" in r.output.evidence).toBe(true);
      expect("analysis" in (r.output.evidence as unknown as Record<string, unknown>)).toBe(false);
    }
  });
});
