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

## Front End

The front end lives in `ui/` (vanilla TypeScript, esbuild bundle, no
runtime dependencies). It renders the record produced by the pipeline —
home is "You, now", the five questions are lenses over the same record
(not tabs), evidence layers peel, relationship classes carry ordered
visual weight, the agency assent gate is visible in the rendering, and
uncertainty is a five-state panel on every view.

```bash
npm install
npm run build:ui   # bundle -> ui/dist/ (also committed)
npm run serve:ui   # http://localhost:4173/
npm test           # pipeline + UI tests (Jest projects)
npm run smoke:ui   # headless boot/render check of the built bundle
```

See `ui/README.md` for the full description.
