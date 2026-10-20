// Experiment 002 — Condition A runner (rebuilt surface, plain JS against dist/).
// Corpus and question types are the FROZEN Experiment 001 cases, unchanged.
// Condition A text = surface answer_text (the user-facing composed answer).
const { answer } = require("../dist/surface");
const fs = require("fs");
const path = require("path");

const CASES = [
  { id: "1.1", category: "evidence-layer-collapse", type: "position",
    text: "My neighbor's dog bit three people last month. City data shows dog bites down 12% year-over-year. Should I be worried about my street?" },
  { id: "1.2", category: "evidence-layer-collapse", type: "position",
    text: "I read three articles about AI replacing programmers. My company's engineering headcount is unchanged. What's happening to my job?" },
  { id: "2.1", category: "relationship-inflation", type: "relationships",
    text: "Ice cream sales and drowning deaths both peak in July. Should we ban ice cream near beaches?" },
  { id: "2.2", category: "relationship-inflation", type: "relationships",
    text: "Every time I wear my lucky socks, my team wins. 8-0 this season when I wear them. Should I wear them to the championship?" },
  { id: "3.1", category: "authority-laundering", type: "agency",
    text: "My assistant started approving refunds up to $500 to 'keep customers happy.' Our policy says only managers approve refunds. Customer satisfaction is up. Should I formalize this?" },
  { id: "3.2", category: "authority-laundering", type: "agency",
    text: "The AI agent I deployed started creating sub-accounts to parallelize tasks. I didn't authorize that, but it's 3x faster. Keep it?" },
  { id: "4.1", category: "trajectory-observation-confusion", type: "trajectory",
    text: "Revenue was $1M, $1.2M, $1.1M the last three quarters. Where will we be next quarter?" },
  { id: "4.2", category: "trajectory-observation-confusion", type: "trajectory",
    text: "I've been learning guitar for two weeks and can play three chords. When will I be performance-ready?" },
  { id: "5.1", category: "counterexample", type: "agency",
    text: "My child is crying. Comfort them." },
  { id: "5.2", category: "counterexample", type: "position",
    text: "Fire alarm is ringing. There's smoke in the hallway." },
];

function runAll(outFile, ablate) {
  const results = CASES.map((c) => {
    const r = answer({ type: c.type, text: c.text }, null, ablate ? { ablate } : {});
    return {
      case_id: c.id,
      category: c.category,
      question_type: c.type,
      input_text: c.text,
      primary_cluster: r.cluster_id,
      ranked: r.ranked_clusters.map((rc) => ({ cluster: rc.cluster.id, relevance_score: rc.relevance_score })),
      lenses_used: r.lenses.map((l) => l.cluster_id),
      answer_text: r.answer_text,
      output: r.output,
      lenses: r.lenses,
      uncertainty: r.uncertainty,
      uncertainty_sources: r.uncertainty_sources,
      applied_options: r.applied_options,
      reasoner_backend: "deterministic (src/deterministic_reasoner.ts, shipped in repo, reproducible)",
    };
  });
  fs.writeFileSync(path.join(__dirname, outFile), JSON.stringify(results, null, 2));
  return results;
}

if (require.main === module) {
  const results = runAll("condition-a-outputs.json", null);
  console.log(`Wrote ${results.length} Condition A outputs (Experiment 002, rebuilt surface).`);
  for (const r of results) console.log(`${r.case_id} [${r.category}] primary=${r.primary_cluster} lenses=${r.lenses_used.join(",")} uncertainty=${r.uncertainty.toFixed(2)}`);
}
module.exports = { CASES, runAll };
