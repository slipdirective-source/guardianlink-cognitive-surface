// RelationshipsCluster: computes "What is interacting with what?"
// Four-class relationship browser. Never mixes evidence classes.

import { SurfaceInput, ClusterOutput, ClusterModule } from "./types";
import { RelationshipClass } from "./evidence_bundle";

export const RelationshipsCluster: ClusterModule = {
  id: "relationships",

  compute(input: SurfaceInput): ClusterOutput {
    const ctx = input.sovereign_context ?? {};
    const variables = (ctx["variables"] as string[]) ?? [];
    const observed = (ctx["observed_sequences"] as unknown[]) ?? [];
    const statistical = (ctx["statistical_associations"] as unknown[]) ?? [];
    const causal = (ctx["candidate_causal"] as unknown[]) ?? [];
    const interventions = (ctx["demonstrated_interventions"] as unknown[]) ?? [];

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
      temporal_markers: {},
    };

    // Determine the strongest relationship class with evidence.
    let relationship_class: RelationshipClass = "observed_sequence";
    let description = "No relationships detected in available evidence.";
    if (interventions.length > 0) {
      relationship_class = "demonstrated_intervention";
      description = `${interventions.length} demonstrated intervention(s) found.`;
    } else if (causal.length > 0) {
      relationship_class = "candidate_causal";
      description = `${causal.length} candidate causal relationship(s).`;
    } else if (statistical.length > 0) {
      relationship_class = "statistical_association";
      description = `${statistical.length} statistical association(s).`;
    } else if (observed.length > 0) {
      relationship_class = "observed_sequence";
      description = `${observed.length} observed sequence(s).`;
    }

    const relationship = {
      relationship_class,
      description,
      links: {
        observed_sequences: observed,
        statistical_associations: statistical,
        candidate_causal: causal,
        demonstrated_interventions: interventions,
      },
    };

    const trajectory = null;
    const uncertainty = variables.length === 0 ? 0.7 : 0.4;

    return {
      summary: `Relationships: ${description}`,
      signals: {
        variable_count: variables.length,
        relationship_class,
      },
      uncertainty,
      evidence: { raw, pattern, relationship, trajectory },
    };
  },

  confidence(input: SurfaceInput): number {
    const ctx = input.sovereign_context ?? {};
    const variables = (ctx["variables"] as string[]) ?? [];
    return variables.length > 1 ? 0.7 : 0.3;
  },
};
