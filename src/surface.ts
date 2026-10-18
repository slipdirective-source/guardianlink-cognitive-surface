// Surface API: the public "answer" function.
// Routes question → builds input → runs clusters → computes uncertainty → returns response.

import { SurfaceInput, SurfaceResponse } from "./types";
import { Question, routeQuestion } from "./router";
import { computeUncertainty } from "./uncertainty";

export function answer(
  question: Question,
  sovereignContext: Record<string, unknown> | null = null
): SurfaceResponse {
  const input: SurfaceInput = {
    raw_text: question.text,
    tokens: question.text.toLowerCase().split(/\s+/),
    sovereign_context: sovereignContext,
  };

  const ranked = routeQuestion(question, input);
  const primary = ranked[0];

  const output = primary.cluster.compute(input);
  const uncertainty = computeUncertainty([output]);

  return {
    cluster_id: primary.cluster.id,
    output,
    uncertainty,
    ranked_clusters: ranked,
  };
}
