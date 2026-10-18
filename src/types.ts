import { EvidenceBundle } from "./evidence_bundle";

export interface SurfaceInput {
  raw_text: string;
  tokens: string[];
  sovereign_context: Record<string, unknown> | null;
}

export interface ClusterOutput {
  summary: string;
  signals: Record<string, unknown>;
  uncertainty: number; // 0..1
  evidence: EvidenceBundle;
}

export interface ClusterModule {
  id: string;
  compute(input: SurfaceInput): ClusterOutput;
  confidence(input: SurfaceInput): number; // 0..1
}

export interface RankedCluster {
  cluster: ClusterModule;
  relevance_score: number; // 0..1
}

export interface SurfaceResponse {
  cluster_id: string;
  output: ClusterOutput;
  uncertainty: number;
  ranked_clusters: RankedCluster[];
}
