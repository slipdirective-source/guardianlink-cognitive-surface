// Uncertainty cross-cut: post-processing module, not a cluster.
// Takes cluster outputs, computes weighted mean of uncertainty values.

import { ClusterOutput } from "./types";

export interface UncertaintySource {
  name: string;
  weight: number;
  value: number; // 0..1
}

export function computeUncertainty(outputs: ClusterOutput[]): number {
  if (outputs.length === 0) return 1.0;
  const sum = outputs.reduce((acc, o) => acc + o.uncertainty, 0);
  return sum / outputs.length;
}

export function uncertaintySources(input: {
  ambiguous_input: boolean;
  missing_context: boolean;
  conflicting_signals: boolean;
  low_confidence_tokens: boolean;
  sparse_history: boolean;
}): UncertaintySource[] {
  const sources: UncertaintySource[] = [];
  if (input.ambiguous_input)
    sources.push({ name: "ambiguous_input", weight: 0.25, value: 0.8 });
  if (input.missing_context)
    sources.push({ name: "missing_sovereign_context", weight: 0.25, value: 0.7 });
  if (input.conflicting_signals)
    sources.push({ name: "conflicting_cluster_signals", weight: 0.2, value: 0.6 });
  if (input.low_confidence_tokens)
    sources.push({ name: "low_confidence_tokenization", weight: 0.15, value: 0.5 });
  if (input.sparse_history)
    sources.push({ name: "sparse_history", weight: 0.15, value: 0.6 });
  return sources;
}
