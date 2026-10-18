// AgencyCluster: computes "What can I do about it?"
// Leverage map, intervention designer, authority console, acceptance register.

import { SurfaceInput, ClusterOutput, ClusterModule } from "./types";
import { emptyRelationship } from "./evidence_bundle";

export const AgencyCluster: ClusterModule = {
  id: "agency",

  compute(input: SurfaceInput): ClusterOutput {
    const ctx = input.sovereign_context ?? {};
    const leveragePoints = (ctx["leverage_points"] as unknown[]) ?? [];
    const interventions = (ctx["available_interventions"] as unknown[]) ?? [];
    const delegations = (ctx["delegations"] as unknown[]) ?? [];
    const immutable = (ctx["immutable_factors"] as unknown[]) ?? [];

    const raw = {
      raw_text: input.raw_text,
      tokens: input.tokens,
      sovereign_context: input.sovereign_context,
      state_snapshot: null,
      delegations: delegations as unknown[] | Record<string, unknown>,
      open_loops: null,
      resources: null,
    };

    const pattern = {
      state_markers: {},
      delegation_markers: extractAgency(input.tokens),
      loop_markers: {},
      resource_markers: {},
      temporal_markers: {},
    };

    const relationship = emptyRelationship();
    const trajectory = null;

    const uncertainty =
      leveragePoints.length === 0 && interventions.length === 0 ? 0.7 : 0.3;

    return {
      summary:
        `Agency: ${leveragePoints.length} leverage point(s), ` +
        `${interventions.length} intervention(s), ` +
        `${immutable.length} immutable factor(s)`,
      signals: {
        leverage_count: leveragePoints.length,
        intervention_count: interventions.length,
        delegation_count: Array.isArray(delegations) ? delegations.length : 0,
        immutable_count: immutable.length,
      },
      uncertainty,
      evidence: { raw, pattern, relationship, trajectory },
    };
  },

  confidence(input: SurfaceInput): number {
    const ctx = input.sovereign_context ?? {};
    const leverage = (ctx["leverage_points"] as unknown[]) ?? [];
    return leverage.length > 0 ? 0.7 : 0.4;
  },
};

function extractAgency(tokens: string[]): Record<string, unknown> {
  const markers: Record<string, unknown> = {};
  const lower = tokens.map((t) => t.toLowerCase());
  for (const kw of ["can", "do", "change", "control", "influence", "delegate", "revoke"]) {
    if (lower.includes(kw)) markers[kw] = true;
  }
  return markers;
}
