// TrajectoryCluster: computes "Where am I going?"
// Current projection with uncertainty bounds, branch detection,
// interrogation support, historical analogues.

import { SurfaceInput, ClusterOutput, ClusterModule } from "./types";
import { emptyRelationship, TrajectoryEvidence } from "./evidence_bundle";

export const TrajectoryCluster: ClusterModule = {
  id: "trajectory",

  compute(input: SurfaceInput): ClusterOutput {
    const ctx = input.sovereign_context ?? {};
    const projection = (ctx["projection"] as Record<string, unknown>) ?? null;
    const branches = (ctx["branches"] as unknown[]) ?? [];
    const analogues = (ctx["analogues"] as unknown[]) ?? [];

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
      temporal_markers: extractFuture(input.tokens),
    };

    const relationship = emptyRelationship();

    let trajectory: TrajectoryEvidence | null = null;
    if (projection !== null) {
      trajectory = {
        projection,
        assumptions: (ctx["assumptions"] as Record<string, unknown>) ?? {},
        horizon: (ctx["horizon"] as string | number) ?? "medium",
        confidence: (ctx["confidence"] as number) ?? 0.5,
      };
    }

    const uncertainty = projection === null ? 0.8 : 0.4;

    return {
      summary: projection
        ? `Trajectory: projection available, ${branches.length} branch(es), ${analogues.length} analogue(s)`
        : "Trajectory: insufficient data for projection",
      signals: {
        has_projection: projection !== null,
        branch_count: branches.length,
        analogue_count: analogues.length,
      },
      uncertainty,
      evidence: { raw, pattern, relationship, trajectory },
    };
  },

  confidence(input: SurfaceInput): number {
    const ctx = input.sovereign_context ?? {};
    return ctx["projection"] ? 0.7 : 0.2;
  },
};

function extractFuture(tokens: string[]): Record<string, unknown> {
  const markers: Record<string, unknown> = {};
  const lower = tokens.map((t) => t.toLowerCase());
  for (const kw of ["will", "going", "future", "next", "predict", "project"]) {
    if (lower.includes(kw)) markers[kw] = true;
  }
  return markers;
}
