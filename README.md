# GuardianLink Cognitive Surface

Human-facing cognitive surface for GuardianLink: trajectory estimation as a user instrument, not an AI control dashboard.

## Architecture

The surface is organized around five questions (lenses, not tabs):
- Where am I? → Position cluster
- How did I get here? → History cluster
- What is interacting with what? → Relationships + Patterns clusters
- Where am I going? → Trajectory cluster
- What can I do about it? → Agency cluster

Uncertainty is a cross-cutting layer, not a separate cluster.

## Evidence Layers

Every cluster emits a full EvidenceBundle with four layers:
- raw: minimally processed observations
- pattern: detected regularities
- relationship: proposed relational interpretation (with relationship_class)
- trajectory: forward projection (or null)

This prevents fusion of epistemic layers. The UI renders them separately.

## Relationship Classes

- observed_sequence: X occurred, Y followed
- statistical_association: X and Y move together
- candidate_causal: changing X may affect Y
- demonstrated_intervention: X was changed, Y changed under comparable conditions
