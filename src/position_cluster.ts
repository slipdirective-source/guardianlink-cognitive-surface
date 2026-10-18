// PositionCluster: computes "Where am I?"
// Uses current state, active delegations, open loops, resource snapshot.
// Emits full evidence bundle. Never infers causality. Trajectory is shallow/optional.

import { SurfaceInput, ClusterOutput, ClusterModule } from "./types";
import { emptyRelationship, TrajectoryEvidence } from "./evidence_bundle";

export const PositionCluster: ClusterModule = {
  id: "position",

  compute(input: SurfaceInput): ClusterOutput {
    const ctx = input.sovereign_context ?? {};

    // Raw layer: minimally processed observations.
    const raw = {
      raw_text: input.raw_text,
      tokens: input.tokens,
      sovereign_context: input.sovereign_context,
      state_snapshot: (ctx["state_snapshot"] as Record<string, unknown>) ?? null,
      delegations: (ctx["delegations"] as unknown[] | Record<string, unknown>) ?? null,
      open_loops: (ctx["open_loops"] as unknown[] | Record<string, unknown>) ?? null,
      resources: (ctx["resources"] as Record<string, unknown>) ?? null,
    };

    // Pattern layer: extracted structure only, no causal claims.
    const pattern = {
      state_markers: extractMarkers(input.tokens, ["now", "currently", "active"]),
      delegation_markers: extractMarkers(input.tokens, ["delegate", "authorized", "agent"]),
      loop_markers: extractMarkers(input.tokens, ["pending", "open", "unresolved", "todo"]),
      resource_markers: extractMarkers(input.tokens, ["resource", "capacity", "constraint"]),
      temporal_markers: extractMarkers(input.tokens, ["now", "today", "current"]),
    };

    // Relationship layer: minimal, observed_sequence only.
    const relationship = emptyRelationship();

    // Trajectory layer: shallow continuation, null if insufficient data.
    let trajectory: TrajectoryEvidence | null = null;
    const hasState = raw.state_snapshot !== null;
    if (hasState) {
      trajectory = {
        projection: { continuation: "current state persists short-term" },
        assumptions: { no_intervention: true },
        horizon: "short",
        confidence: 0.3,
      };
    }

    // Uncertainty from completeness of context and clarity of input.
    const uncertainty = computeUncertainty(input, pattern);

    const summary = buildSummary(raw, pattern);

    return {
      summary,
      signals: {
        state_markers: pattern.state_markers,
        delegation_markers: pattern.delegation_markers,
        loop_markers: pattern.loop_markers,
        resource_markers: pattern.resource_markers,
      },
      uncertainty,
      evidence: { raw, pattern, relationship, trajectory },
    };
  },

  confidence(input: SurfaceInput): number {
    let score = 0.5;
    if (input.sovereign_context !== null) score += 0.2;
    if (input.tokens.length > 3) score += 0.1;
    if (input.raw_text.length > 10) score += 0.1;
    return Math.min(1.0, Math.max(0.0, score));
  },
};

function extractMarkers(tokens: string[], keywords: string[]): Record<string, unknown> {
  const found: Record<string, unknown> = {};
  const lower = tokens.map((t) => t.toLowerCase());
  for (const kw of keywords) {
    if (lower.includes(kw)) found[kw] = true;
  }
  return found;
}

function computeUncertainty(input: SurfaceInput, pattern: Record<string, unknown>): number {
  let uncertainty = 0.2; // base
  if (input.sovereign_context === null) uncertainty += 0.2;
  if (input.tokens.length < 3) uncertainty += 0.1;
  return Math.min(1.0, uncertainty);
}

function buildSummary(
  raw: Record<string, unknown>,
  pattern: Record<string, unknown>
): string {
  const parts: string[] = ["Current position:"];
  if (raw["state_snapshot"]) parts.push("state available");
  if (raw["delegations"]) parts.push("delegations active");
  if (raw["open_loops"]) parts.push("open loops present");
  if (raw["resources"]) parts.push("resources tracked");
  return parts.join(" ");
}
