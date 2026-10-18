// HistoryCluster: computes "How did I get here?"
// Navigable timeline with evidence-layer peeling.
// Decision points, contributing factors, structural similarity.

import { SurfaceInput, ClusterOutput, ClusterModule } from "./types";
import { emptyRelationship } from "./evidence_bundle";

export const HistoryCluster: ClusterModule = {
  id: "history",

  compute(input: SurfaceInput): ClusterOutput {
    const ctx = input.sovereign_context ?? {};
    const timeline = (ctx["timeline"] as unknown[]) ?? [];
    const decisions = (ctx["decisions"] as unknown[]) ?? [];

    const raw = {
      raw_text: input.raw_text,
      tokens: input.tokens,
      sovereign_context: input.sovereign_context,
      state_snapshot: null,
      delegations: null,
      open_loops: null,
      resources: null,
    };

    const pattern = {
      state_markers: {},
      delegation_markers: {},
      loop_markers: {},
      resource_markers: {},
      temporal_markers: extractTemporal(input.tokens, timeline),
    };

    const relationship = emptyRelationship();

    // Trajectory: History does not project forward; it provides analogues.
    const trajectory = null;

    const uncertainty = timeline.length === 0 ? 0.8 : 0.3;

    return {
      summary: `History: ${timeline.length} events, ${decisions.length} decision points`,
      signals: {
        event_count: timeline.length,
        decision_count: decisions.length,
        temporal_markers: pattern.temporal_markers,
      },
      uncertainty,
      evidence: { raw, pattern, relationship, trajectory },
    };
  },

  confidence(input: SurfaceInput): number {
    const ctx = input.sovereign_context ?? {};
    const timeline = (ctx["timeline"] as unknown[]) ?? [];
    return timeline.length > 0 ? 0.8 : 0.3;
  },
};

function extractTemporal(tokens: string[], timeline: unknown[]): Record<string, unknown> {
  const markers: Record<string, unknown> = {};
  const lower = tokens.map((t) => t.toLowerCase());
  for (const kw of ["before", "after", "then", "when", "history", "past"]) {
    if (lower.includes(kw)) markers[kw] = true;
  }
  markers["timeline_length"] = timeline.length;
  return markers;
}
