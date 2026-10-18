// Tests for the five question clusters.

import { PositionCluster } from "./position_cluster";
import { HistoryCluster } from "./history_cluster";
import { RelationshipsCluster } from "./relationships_cluster";
import { TrajectoryCluster } from "./trajectory_cluster";
import { AgencyCluster } from "./agency_cluster";
import { routeQuestion } from "./router";
import { answer } from "./surface";
import { SurfaceInput } from "./types";

function testInput(text: string, ctx: Record<string, unknown> | null = null): SurfaceInput {
  return {
    raw_text: text,
    tokens: text.toLowerCase().split(/\s+/),
    sovereign_context: ctx,
  };
}

// Position cluster tests
describe("PositionCluster", () => {
  test("has correct id", () => {
    expect(PositionCluster.id).toBe("position");
  });

  test("emits full evidence bundle", () => {
    const output = PositionCluster.compute(testInput("where am I now"));
    expect(output.evidence.raw).toBeDefined();
    expect(output.evidence.pattern).toBeDefined();
    expect(output.evidence.relationship).toBeDefined();
    // trajectory may be null, but key must exist
    expect("trajectory" in output.evidence).toBe(true);
  });

  test("relationship class defaults to observed_sequence", () => {
    const output = PositionCluster.compute(testInput("where am I"));
    expect(output.evidence.relationship.relationship_class).toBe("observed_sequence");
  });

  test("uncertainty in valid range", () => {
    const output = PositionCluster.compute(testInput("where am I now"));
    expect(output.uncertainty).toBeGreaterThanOrEqual(0);
    expect(output.uncertainty).toBeLessThanOrEqual(1);
  });
});

// History cluster tests
describe("HistoryCluster", () => {
  test("has correct id", () => {
    expect(HistoryCluster.id).toBe("history");
  });

  test("handles empty timeline", () => {
    const output = HistoryCluster.compute(testInput("how did I get here"));
    expect(output.uncertainty).toBeGreaterThan(0.5);
  });

  test("uses timeline when provided", () => {
    const ctx = { timeline: [{ event: "a" }, { event: "b" }], decisions: [] };
    const output = HistoryCluster.compute(testInput("how did I get here", ctx));
    expect(output.signals["event_count"]).toBe(2);
  });
});

// Relationships cluster tests
describe("RelationshipsCluster", () => {
  test("has correct id", () => {
    expect(RelationshipsCluster.id).toBe("relationships");
  });

  test("defaults to observed_sequence with no data", () => {
    const output = RelationshipsCluster.compute(testInput("what interacts"));
    expect(output.evidence.relationship.relationship_class).toBe("observed_sequence");
  });

  test("escalates to demonstrated_intervention", () => {
    const ctx = { demonstrated_interventions: [{ x: "a", y: "b" }] };
    const output = RelationshipsCluster.compute(testInput("what interacts", ctx));
    expect(output.evidence.relationship.relationship_class).toBe("demonstrated_intervention");
  });

  test("never mixes evidence classes", () => {
    const ctx = {
      observed_sequences: [1],
      statistical_associations: [2],
      candidate_causal: [3],
      demonstrated_interventions: [4],
    };
    const output = RelationshipsCluster.compute(testInput("test", ctx));
    // Should pick the strongest, not mix
    expect(output.evidence.relationship.relationship_class).toBe("demonstrated_intervention");
    const links = output.evidence.relationship.links as Record<string, unknown[]>;
    expect(links["observed_sequences"]).toHaveLength(1);
    expect(links["demonstrated_interventions"]).toHaveLength(1);
  });
});

// Trajectory cluster tests
describe("TrajectoryCluster", () => {
  test("has correct id", () => {
    expect(TrajectoryCluster.id).toBe("trajectory");
  });

  test("returns null trajectory without projection", () => {
    const output = TrajectoryCluster.compute(testInput("where am I going"));
    expect(output.evidence.trajectory).toBeNull();
  });

  test("emits trajectory with projection", () => {
    const ctx = { projection: { direction: "up" }, confidence: 0.7 };
    const output = TrajectoryCluster.compute(testInput("where am I going", ctx));
    expect(output.evidence.trajectory).not.toBeNull();
    expect(output.evidence.trajectory!.confidence).toBe(0.7);
  });
});

// Agency cluster tests
describe("AgencyCluster", () => {
  test("has correct id", () => {
    expect(AgencyCluster.id).toBe("agency");
  });

  test("counts leverage points", () => {
    const ctx = { leverage_points: ["a", "b"], available_interventions: ["c"] };
    const output = AgencyCluster.compute(testInput("what can I do", ctx));
    expect(output.signals["leverage_count"]).toBe(2);
    expect(output.signals["intervention_count"]).toBe(1);
  });
});

// Router tests
describe("routeQuestion", () => {
  test("returns ranked list, not single match", () => {
    const input = testInput("where am I going");
    const ranked = routeQuestion({ type: "trajectory", text: "where am I going" }, input);
    expect(Array.isArray(ranked)).toBe(true);
    expect(ranked.length).toBe(5); // all five clusters
    // Sorted descending
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i-1].relevance_score).toBeGreaterThanOrEqual(ranked[i].relevance_score);
    }
  });

  test("primary cluster matches question type", () => {
    const input = testInput("where am I");
    const ranked = routeQuestion({ type: "position", text: "where am I" }, input);
    expect(ranked[0].cluster.id).toBe("position");
  });
});

// Surface API tests
describe("answer", () => {
  test("returns surface response with all fields", () => {
    const response = answer({ type: "position", text: "where am I now" });
    expect(response.cluster_id).toBeDefined();
    expect(response.output).toBeDefined();
    expect(response.uncertainty).toBeDefined();
    expect(response.ranked_clusters).toBeDefined();
  });

  test("evidence bundle present in output", () => {
    const response = answer({ type: "history", text: "how did I get here" });
    expect(response.output.evidence.raw).toBeDefined();
    expect(response.output.evidence.pattern).toBeDefined();
    expect(response.output.evidence.relationship).toBeDefined();
  });
});
