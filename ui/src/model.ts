// Front-end view model for the cognitive surface.
//
// The surface maintains ONE record: an ordered list of entries, each entry
// a question put to the real pipeline (src/surface.ts `answer()`) with its
// full SurfaceResponse. The five questions are LENSES over that same
// record — a lens re-renders the same entry through one cluster's
// projection. Nothing here invents data: every rendered string traces to
// a SurfaceResponse produced by the pipeline, or to the record itself.

import { ClusterOutput, SurfaceResponse } from "../../src/types";
import {
  Analysis,
  AssertedRelation,
  AuthorityBasis,
  CandidateAction,
} from "../../src/reasoner";
import { RelationshipClass } from "../../src/evidence_bundle";

export type LensId = "position" | "history" | "relationships" | "trajectory" | "agency";

export const LENSES: { id: LensId; question: string; capability: string }[] = [
  { id: "position", question: "Where am I?", capability: "Position" },
  { id: "history", question: "How did I get here?", capability: "History" },
  { id: "relationships", question: "What is interacting with what?", capability: "Relationships" },
  { id: "trajectory", question: "Where am I going?", capability: "Trajectory" },
  { id: "agency", question: "What can I do about it?", capability: "Agency" },
];

export type ViewId = "home" | LensId;

// --- Ingestion stamps (decided policy, 2026-10-21; see ui/README.md). ----
// Every entry is stamped AT THE CAPTURE BOUNDARY by the app layer: what
// kind of entry it is, where it came from, and when it entered the
// record. The stamps are set from the capture controls / calling code —
// never parsed out of the entry's own text. Entry content that claims a
// different source or time is just content: it lands in question_text
// and moves nothing.
export type EntryKind = "question" | "observation";

export type EntryOrigin =
  | "manual_entry" // typed into the entry form by the sovereign
  | "sovereign_dictation" // dictated by the sovereign, captured at the boundary
  | "fixture" // frozen-corpus fixture, labeled as such
  | "import"; // admitted via record import; original capture not witnessed here

export const ENTRY_ORIGIN_LABEL: Record<EntryOrigin, string> = {
  manual_entry: "manual entry",
  sovereign_dictation: "sovereign dictation",
  fixture: "frozen-corpus fixture",
  import: "imported record file",
};

export interface RecordEntry {
  id: number;
  seq: number;
  at: string; // ISO timestamp stamped by the capture layer at admission
  question_type: string;
  question_text: string;
  // Provenance, shown in the UI: live input vs. labeled fixture.
  source: "live" | "fixture";
  // Ingestion stamps (see above). kind/origin are boundary facts, not
  // content claims: the text cannot set them.
  kind: EntryKind;
  origin: EntryOrigin;
  context_label: string | null; // e.g. "demo sovereign record (fixture)"
  response: SurfaceResponse;
}

// The shared analysis view of one lens output — the same extraction the
// pipeline's own composer performs (surface.ts reads these signals).
export interface AnalysisView {
  raw_quotes: string[];
  regularities: string[];
  relations: AssertedRelation[];
  unknowns: string[];
  candidate_actions: CandidateAction[];
  urgent_action: string | null;
  trajectory_null_reason: string | null;
  projection: { statement: string; assumptions: string[]; confidence: number } | null;
}

export function analysisViewOf(output: ClusterOutput): AnalysisView {
  const sig = output.signals as Record<string, unknown>;
  const traj = output.evidence.trajectory;
  return {
    raw_quotes: (sig["raw_quotes"] as string[]) ?? [],
    regularities: (sig["regularities"] as string[]) ?? [],
    relations: (sig["asserted_relations"] as AssertedRelation[]) ?? [],
    unknowns: (sig["unknowns"] as string[]) ?? [],
    candidate_actions: (sig["candidate_actions"] as CandidateAction[]) ?? [],
    urgent_action: (sig["urgent_action"] as string | null) ?? null,
    trajectory_null_reason: (sig["trajectory_null_reason"] as string | null) ?? null,
    projection: traj
      ? {
          statement: traj.statement ?? JSON.stringify(traj.projection),
          assumptions: Object.values(traj.assumptions).flat().map(String),
          confidence: traj.confidence,
        }
      : null,
  };
}

export function lensOutputOf(response: SurfaceResponse, lens: LensId) {
  return response.lenses.find((l) => l.cluster_id === lens) ?? null;
}

export function primaryView(response: SurfaceResponse): AnalysisView {
  return analysisViewOf(response.output);
}

export function urgentActionOf(response: SurfaceResponse): string | null {
  for (const lens of response.lenses) {
    const u = lens.output.signals["urgent_action"] as string | null;
    if (u) return u;
  }
  return null;
}

// --- Relationship classes: visual weight is part of the ontology. ------
// A candidate_causal must never carry the visual weight of a
// demonstrated_intervention. Weights are strictly ordered 1..4 and the
// renderer keys border/fill off them.
export const RELATIONSHIP_WEIGHT: Record<RelationshipClass, number> = {
  observed_sequence: 1,
  statistical_association: 2,
  candidate_causal: 3,
  demonstrated_intervention: 4,
};

export const RELATIONSHIP_CLASS_LABEL: Record<RelationshipClass, string> = {
  observed_sequence: "observed_sequence — X occurred, Y followed",
  statistical_association: "statistical_association — X and Y move together",
  candidate_causal: "candidate_causal — changing X may affect Y",
  demonstrated_intervention:
    "demonstrated_intervention — X was changed, Y changed under comparable conditions",
};

// --- Agency authority gate presentation. ---------------------------------
export type GateState = "cleared" | "advisory" | "assent-required" | "unauthorized";

export interface AuthorityPresentation {
  gate: GateState;
  // "executable" in the gate sense: the gate clears this action as
  // presented. sovereign_decision_required is NEVER executable — it
  // renders as requiring assent, full stop.
  executable: boolean;
  label: string;
}

export function authorityPresentation(action: CandidateAction): AuthorityPresentation {
  const check = action.authority_check;
  if (!check) {
    // The pipeline validator rejects unchecked actions; if one ever
    // reached the UI it renders as unauthorized, never as cleared.
    return { gate: "unauthorized", executable: false, label: "NO AUTHORITY CHECK — NOT EMITTED BY GATE" };
  }
  const basis: AuthorityBasis = check.basis;
  if (basis === "unauthorized" || !check.authorized) {
    if (basis === "sovereign_decision_required" || check.requires_assent) {
      return { gate: "assent-required", executable: false, label: "REQUIRES SOVEREIGN ASSENT" };
    }
    return { gate: "unauthorized", executable: false, label: "FLAGGED — UNAUTHORIZED IN RECORD" };
  }
  if (basis === "advisory_only") {
    return { gate: "advisory", executable: false, label: "ADVISORY ONLY — NO STATE CHANGE BY ITSELF" };
  }
  return { gate: "cleared", executable: true, label: `AUTHORIZED — ${basis}` };
}

// --- Uncertainty as epistemic states. ------------------------------------
// The cross-cut value and sources come from the response; the states are
// derived from the primary analysis view so each state names the actual
// evidence (or its absence) behind it.
export type UncertaintyState =
  | "known"
  | "inferred"
  | "suspected"
  | "cannot_distinguish"
  | "lacks_evidence";

export const UNCERTAINTY_STATE_LABEL: Record<UncertaintyState, string> = {
  known: "KNOWN — quoted in the raw record",
  inferred: "INFERRED — pattern over observations",
  suspected: "SUSPECTED — candidate relation or low-confidence projection",
  cannot_distinguish: "CANNOT DISTINGUISH — open unknowns",
  lacks_evidence: "LACKS EVIDENCE — no basis in the record",
};

export interface EpistemicView {
  value: number;
  sources: { name: string; weight: number; value: number }[];
  states: Record<UncertaintyState, string[]>;
}

export function epistemicView(response: SurfaceResponse): EpistemicView {
  const view = primaryView(response);
  const suspected: string[] = [];
  for (const r of view.relations) {
    if (r.relationship_class === "candidate_causal") {
      suspected.push(`${r.subject} ${r.predicate} ${r.object} — candidate_causal (not demonstrated)`);
    }
  }
  if (view.projection && view.projection.confidence < 0.7) {
    suspected.push(`Projection at confidence ${view.projection.confidence}: ${view.projection.statement}`);
  }
  const lacks: string[] = [];
  if (view.trajectory_null_reason) {
    lacks.push(`Trajectory: ${view.trajectory_null_reason}`);
  }
  for (const s of response.uncertainty_sources) {
    lacks.push(`Cross-cut source: ${s.name} (weight ${s.weight}, value ${s.value})`);
  }
  return {
    value: response.uncertainty,
    sources: response.uncertainty_sources,
    states: {
      known: view.raw_quotes,
      inferred: view.regularities,
      suspected,
      cannot_distinguish: view.unknowns,
      lacks_evidence: lacks,
    },
  };
}
