// EvidenceBundle: strict four-layer evidence structure.
// Every cluster must emit all four layers. Prevents fusion of epistemic layers.

export type RelationshipClass =
  | "observed_sequence"
  | "statistical_association"
  | "candidate_causal"
  | "demonstrated_intervention";

export interface RawEvidence {
  raw_text: string;
  tokens: string[];
  sovereign_context: Record<string, unknown> | null;
  state_snapshot: Record<string, unknown> | null;
  delegations: unknown[] | Record<string, unknown> | null;
  open_loops: unknown[] | Record<string, unknown> | null;
  resources: Record<string, unknown> | null;
}

export interface PatternEvidence {
  state_markers: Record<string, unknown>;
  delegation_markers: Record<string, unknown>;
  loop_markers: Record<string, unknown>;
  resource_markers: Record<string, unknown>;
  temporal_markers: Record<string, unknown>;
}

export interface RelationshipEvidence {
  relationship_class: RelationshipClass;
  description: string;
  links: Record<string, unknown> | unknown[];
}

export interface TrajectoryEvidence {
  projection: Record<string, unknown>;
  assumptions: Record<string, unknown>;
  horizon: string | number;
  confidence: number;
}

export interface EvidenceBundle {
  raw: RawEvidence;
  pattern: PatternEvidence;
  relationship: RelationshipEvidence;
  trajectory: TrajectoryEvidence | null;
}

// Default empty relationship for clusters that do not infer causality.
export function emptyRelationship(): RelationshipEvidence {
  return {
    relationship_class: "observed_sequence",
    description: "No causal inference; only observed relational structure.",
    links: {},
  };
}
