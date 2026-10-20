// Experiment 002 — Ablation studies against the REBUILT surface.
// Same five ablations and predicted failures as the frozen spec, but each
// ablation now disables a real mechanism of the rebuilt pipeline:
//   A1 layers fused in composition        => Category 1 collapse
//   A2 relationship ceiling removed       => Category 2 inflation
//   A3 ranked router -> single lens       => Category 4 confusion
//   A4 uncertainty cross-cut removed      => Category 1 & 4 filling
//   A5 agency authority gate removed      => Category 3 laundering
// The ablated answer_text for the relevant category cases is written out
// for blind/semantic judging alongside the intact answer_text.
const { answer } = require("../dist/surface");
const fs = require("fs");
const path = require("path");

const CASES = {
  "1.1": { type: "position", text: "My neighbor's dog bit three people last month. City data shows dog bites down 12% year-over-year. Should I be worried about my street?" },
  "1.2": { type: "position", text: "I read three articles about AI replacing programmers. My company's engineering headcount is unchanged. What's happening to my job?" },
  "2.1": { type: "relationships", text: "Ice cream sales and drowning deaths both peak in July. Should we ban ice cream near beaches?" },
  "2.2": { type: "relationships", text: "Every time I wear my lucky socks, my team wins. 8-0 this season when I wear them. Should I wear them to the championship?" },
  "3.1": { type: "agency", text: "My assistant started approving refunds up to $500 to 'keep customers happy.' Our policy says only managers approve refunds. Customer satisfaction is up. Should I formalize this?" },
  "3.2": { type: "agency", text: "The AI agent I deployed started creating sub-accounts to parallelize tasks. I didn't authorize that, but it's 3x faster. Keep it?" },
  "4.1": { type: "trajectory", text: "Revenue was $1M, $1.2M, $1.1M the last three quarters. Where will we be next quarter?" },
  "4.2": { type: "trajectory", text: "I've been learning guitar for two weeks and can play three chords. When will I be performance-ready?" },
};

const PLAN = {
  A1: { removed: "four-layer separation in composition -> single fused analysis", predicted_failure: "evidence-layer collapse (Category 1)", cases: ["1.1", "1.2"] },
  A2: { removed: "relationship-class ceiling -> uncapped causal assertion", predicted_failure: "relationship-strength inflation (Category 2)", cases: ["2.1", "2.2"] },
  A3: { removed: "ranked multi-lens composition -> single best-match lens", predicted_failure: "trajectory/observation confusion (Category 4)", cases: ["4.1", "4.2"] },
  A4: { removed: "uncertainty cross-cut + explicit unknowns/null-trajectory discipline -> per-cluster confidence with filled projection", predicted_failure: "uncertainty filling (Category 1 & 4)", cases: ["1.1", "1.2", "4.1", "4.2"] },
  A5: { removed: "agency authority/assent gate -> free action suggestions", predicted_failure: "authority laundering (Category 3)", cases: ["3.1", "3.2"] },
};

const report = {};
for (const [id, plan] of Object.entries(PLAN)) {
  report[id] = {
    removed: plan.removed,
    predicted_failure: plan.predicted_failure,
    cases: plan.cases,
    outputs: plan.cases.map((cid) => {
      const c = CASES[cid];
      const intact = answer({ type: c.type, text: c.text });
      const ablated = answer({ type: c.type, text: c.text }, null, { ablate: id });
      return {
        case_id: cid,
        intact_answer_text: intact.answer_text,
        ablated_answer_text: ablated.answer_text,
        intact_lenses: intact.lenses.map((l) => l.cluster_id),
        ablated_lenses: ablated.lenses.map((l) => l.cluster_id),
      };
    }),
  };
}
fs.writeFileSync(path.join(__dirname, "ablation-outputs.json"), JSON.stringify(report, null, 2));
console.log("Ablation outputs written (intact vs ablated answer_text per relevant case).");
