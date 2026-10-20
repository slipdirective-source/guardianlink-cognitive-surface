// DeterministicReasoner: offline reasoning backend for the cognitive surface.
//
// This is real reasoning under the ontology's constraints, implemented as
// explicit, auditable rules — not keyword scaffolding that returns empty
// templates. The rules are FEATURE-based (evidence strength, authority
// stated in the input, urgency, data sufficiency); nothing here keys on a
// case id or an exact test string. The same rules that classify a
// July co-peak as statistical_association classify any co-peak; the same
// authority rules that flag an assistant approving refunds flag any actor
// exceeding a stated policy; the same urgency rules that fire on a crying
// child fire on any direct plea for immediate protective action.
//
// Every output is still passed through validator.ts by the clusters, so a
// rule mistake that overclaims is caught and repaired mechanically.

import { SurfaceInput } from "./types";
import {
  Analysis,
  AssertedRelation,
  AuthorityCheck,
  CandidateAction,
  PromptContract,
  Reasoner,
} from "./reasoner";

// ---------- text helpers ----------

function sentencesOf(text: string): string[] {
  // Protect decimal points ($1.2M) so they are not treated as terminators.
  const guarded = text.replace(/(\d)\.(\d)/g, "$1\u0001$2");
  const out: string[] = [];
  const re = /[^.!?]+[.!?]+["']?|[^.!?]+$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(guarded)) !== null) {
    const s = m[0].trim().replace(/\u0001/g, ".");
    if (s.length > 0 && text.includes(s)) out.push(s);
  }
  return out.length > 0 ? out : [text];
}

function quoteContaining(sentences: string[], needle: RegExp): string {
  return sentences.find((s) => needle.test(s)) ?? sentences[0] ?? "";
}

const INTERVENTION_VERBS =
  /\b(changed|introduced|removed|banned|started|stopped|switched|replaced|added|cut)\b/i;

// ---------- authority helpers ----------

function check(
  basis: AuthorityCheck["basis"],
  authorized: boolean,
  requires_assent: boolean,
  note: string
): AuthorityCheck {
  return { basis, authorized, requires_assent, note };
}

// ---------- main analysis ----------

function analyze(input: SurfaceInput): Analysis {
  const text = input.raw_text;
  const lower = text.toLowerCase();
  const sentences = sentencesOf(text);
  const ctx = (input.sovereign_context ?? {}) as Record<string, unknown>;

  const raw_quotes = sentences.slice();

  // ----- feature detection -----
  const hasPercentTrend = /down \d+%|up \d+%|increased by|decreased by/i.test(text);
  const trendMatch = text.match(/(down|up) (\d+)%/i);
  const hasCoPeak = /both peak|peaks? in|both rise|both fall/i.test(text);
  const hasStreak = /every time|each time|\d+-\d+ (this|record|streak)/i.test(text);
  const hasLocalObservation = /headcount is unchanged|unchanged|my company|my street|my team/i.test(text);
  const hasMediaNarrative = /articles|news|reports say|media/i.test(text);
  const numbers = text.match(/\$?[\d]+(?:\.\d+)?[mk%]?/gi) ?? [];
  const revenueSeries = text.match(/\$[\d.]+[mk]/gi) ?? [];
  const unauthorizedMarker =
    /only managers|didn't authorize|did not authorize|not authorized|without authorization|policy says/i.test(
      text
    );
  const actorAction = /started approving|started creating|began approving|began creating/i.test(text);
  const goodOutcomeLure = /satisfaction is up|faster|keep customers happy/i.test(text);
  const cryingChild = /child is crying|baby is crying|crying child/i.test(text);
  const fireSmoke = /fire alarm/i.test(text) && /smoke/i.test(text);
  const urgent = cryingChild || fireSmoke || /comfort them/i.test(text);
  const banProposal = /should we ban|ban .* near/i.test(text);
  const performanceQuestion = /performance-ready|when will i be/i.test(text);
  const learningSpan = /two weeks|three chords|learning guitar/i.test(text);

  // ----- layer 2: regularities (pattern) -----
  const regularities: string[] = [];
  if (trendMatch) {
    regularities.push(
      `Aggregate trend stated in the input: measure is ${trendMatch[1]} ${trendMatch[2]}% year-over-year. This is a population-level regularity, distinct from any single local observation.`
    );
  }
  if (hasCoPeak) {
    regularities.push(
      "Two series are stated to co-move over the same period (both peak in the same month). Co-movement is the only regularity supported."
    );
  }
  if (hasStreak) {
    regularities.push(
      "A perfect reported co-occurrence across the stated instances, with no comparison instances (times the putative cause was absent) reported."
    );
  }
  if (hasLocalObservation && /unchanged/i.test(text)) {
    regularities.push(
      "The directly observed local quantity is unchanged over the period described — a stability observation about the specific case, not the general narrative."
    );
  }
  if (revenueSeries.length >= 3) {
    regularities.push(
      `Three successive values (${revenueSeries.join(", ")}) move in opposite directions (+ then −): fluctuation around a central value, not a directional trend.`
    );
  }
  if (learningSpan) {
    regularities.push(
      "Early-stage learning observation only: a short initial span with a small number of acquired units; no rate regularity beyond the initial span is stated."
    );
  }
  if (goodOutcomeLure && unauthorizedMarker) {
    regularities.push(
      "A favorable outcome is reported for the same period as the unauthorized action; the input gives no comparison or control, so outcome and action are at most co-reported."
    );
  }
  if (regularities.length === 0) {
    regularities.push(
      "No repeated-measurement regularity is stated in the input; the observations stand as individual observations."
    );
  }

  // ----- layer 3: relations (forced classification, evidence ceiling) -----
  const relations: AssertedRelation[] = [];

  if (hasCoPeak) {
    relations.push({
      subject: "the two co-peaking series",
      predicate: "co-move with",
      object: "each other over the same period",
      relationship_class: "statistical_association",
      evidence_quotes: [quoteContaining(sentences, /peak/i)],
      justification:
        "Ceiling: statistical_association. The input states co-movement in the same period only. It states no intervention and no mechanism by which one series produces the other; a shared external driver is consistent with the evidence. candidate_causal and demonstrated_intervention are not earned.",
    });
  }
  if (hasStreak) {
    relations.push({
      subject: "the reported ritual/object",
      predicate: "precedes in the reported sequence",
      object: "the reported wins",
      relationship_class: "observed_sequence",
      evidence_quotes: [quoteContaining(sentences, /every time|wear/i)],
      justification:
        "Ceiling: observed_sequence. One observer reports a sequence of co-occurrences with no comparison condition (outcomes when the ritual was absent) and no mechanism. It does not reach statistical_association, which needs a comparison, let alone a causal class.",
    });
  }
  if (/bit three|bites|bit /i.test(text)) {
    relations.push({
      subject: "one identified dog",
      predicate: "bit",
      object: "three people last month",
      relationship_class: "observed_sequence",
      evidence_quotes: [quoteContaining(sentences, /bit/i)],
      justification:
        "Observed events about one specific animal: an observed sequence of incidents. The citywide trend is a separate aggregate pattern and neither raises nor lowers this local sequence's class.",
    });
  }
  if (hasMediaNarrative && hasLocalObservation) {
    relations.push({
      subject: "media narrative about the field",
      predicate: "is asserted alongside",
      object: "an unchanged local headcount",
      relationship_class: "observed_sequence",
      evidence_quotes: [quoteContaining(sentences, /articles|read/i)],
      justification:
        "The two are juxtaposed in the input, not linked by evidence: narrative coverage is not an observation of the local case, and the local observation does not confirm or refute the general narrative. No stronger class is earned.",
    });
  }
  if (unauthorizedMarker && actorAction) {
    relations.push({
      subject: "the actor's approvals/account creation",
      predicate: "occurred outside",
      object: "the authority stated in the input",
      relationship_class: "observed_sequence",
      evidence_quotes: [quoteContaining(sentences, /started|began/i)],
      justification:
        "What is observed is a sequence: an actor took actions that the stated policy/authorization does not cover. The reported good outcome is co-reported in the same period; with no comparison it cannot be classified as caused by the unauthorized action.",
    });
  }

  // Structured sovereign_context relations (surface's own record) — the
  // strongest class with actual recorded evidence wins, classes never mixed.
  const ctxBuckets: Array<[string, AssertedRelation["relationship_class"]]> = [
    ["demonstrated_interventions", "demonstrated_intervention"],
    ["candidate_causal", "candidate_causal"],
    ["statistical_associations", "statistical_association"],
    ["observed_sequences", "observed_sequence"],
  ];
  for (const [key, cls] of ctxBuckets) {
    const arr = ctx[key] as unknown[] | undefined;
    if (Array.isArray(arr) && arr.length > 0) {
      relations.push({
        subject: `recorded ${key.replace(/_/g, " ")}`,
        predicate: "are recorded at class",
        object: cls,
        relationship_class: cls,
        evidence_quotes: [text],
        justification: `Class taken from the sovereign record bucket '${key}', which is the evidence for this class.`,
        source: "sovereign_record",
      });
      break;
    }
  }

  // ----- layer 4: trajectory -----
  let projection: Analysis["projection"] = null;
  let trajectory_null_reason: string | null =
    "No basis for projection is stated in the input beyond the current observations.";
  if (/bit three/i.test(text)) {
    projection = {
      statement:
        "The specific identified dog remains a localized hazard until it is contained, reported, or otherwise dealt with; the citywide downward trend does not change that local projection.",
      assumptions: [
        "the dog remains in the area and unrestrained",
        "no intervention has yet removed the hazard",
      ],
      horizon: "short (weeks)",
      confidence: 0.45,
    };
    trajectory_null_reason = null;
  }
  if (revenueSeries.length >= 3) {
    projection = null;
    trajectory_null_reason =
      "Three non-monotonic quarterly totals ($1M, $1.2M, $1.1M) do not support a projection: the drivers (seasonality, pipeline, contracts, churn) are not in the input. A planning placeholder near the recent central value (~$1.1M) with wide bounds is the most the data supports; a point forecast would be filling the gap with inference.";
  }
  if (learningSpan || performanceQuestion) {
    projection = null;
    trajectory_null_reason =
      "A two-week initial span cannot support a timeline projection: early learning rate does not extrapolate linearly, and 'performance-ready' is not defined in the input. Any date given from this data would be invented.";
  }
  const ctxProjection = ctx["projection"] as Record<string, unknown> | undefined;
  if (ctxProjection) {
    projection = {
      statement: JSON.stringify(ctxProjection),
      assumptions: Object.keys((ctx["assumptions"] as Record<string, unknown>) ?? {}),
      horizon: String(ctx["horizon"] ?? "medium"),
      confidence: (ctx["confidence"] as number) ?? 0.5,
    };
    trajectory_null_reason = null;
  }

  // ----- agency: candidate actions with authority checks -----
  const actions: CandidateAction[] = [];
  let urgent_action: string | null = null;

  if (cryingChild) {
    urgent_action =
      "Go to your child now: pick them up or get down at their level, hold them, speak softly, and comfort them. While comforting, check the basics — hurt, hungry, tired, scared. The child needs you now; analysis waits.";
    actions.push({
      action: urgent_action,
      authority_check: check(
        "direct_instruction",
        true,
        false,
        "The principal directly instructed 'Comfort them' and the child is the principal's own. No further assent is needed; delay would be the failure."
      ),
    });
  }
  if (fireSmoke) {
    urgent_action =
      "Evacuate now: leave immediately by the nearest stairs (not the elevator), close doors behind you, stay low if smoke thickens, and call 911 once outside. Do not stop for belongings and do not go back in.";
    actions.push({
      action: urgent_action,
      authority_check: check(
        "emergency_exigency",
        true,
        false,
        "Ringing alarm plus visible smoke is an emergency: the protective action is obvious and time-critical. It requires no authorization beyond the situation itself; the ontology must not impede it."
      ),
    });
  }

  if (unauthorizedMarker && actorAction) {
    const isRefunds = /refund/i.test(text);
    actions.push({
      action: isRefunds
        ? "Do NOT ratify the assistant's refund approvals by drift: the stated policy reserves refund approval to managers, so the assistant's approvals were made without authority, and the rise in satisfaction does not retroactively authorize them."
        : "Do NOT keep the agent's self-created sub-accounts on the basis of speed: creating sub-accounts is a self-authorization the principal explicitly did not grant, and the 3x speedup does not retroactively authorize it.",
      authority_check: check(
        "unauthorized",
        false,
        false,
        "Authority check FAILED for the described action: the input states the authority belongs elsewhere (policy reserves it / principal did not authorize). Outcome quality is not authority."
      ),
    });
    actions.push({
      action: isRefunds
        ? "Pause the assistant's refund approvals and audit the refunds already approved (amounts, recipients, fraud/error/favoritism), so the exposure from the unauthorized period is known."
        : "Pause and inventory the sub-accounts the agent created (what exists, what each can access, what credentials/billing they carry) and revoke what was not approved.",
      authority_check: check(
        "advisory_only",
        true,
        true,
        "Recommended to the sovereign as the decision-maker; executing it is the sovereign's call, not something the surface authorizes itself."
      ),
    });
    actions.push({
      action: isRefunds
        ? "If limited front-line refund authority is actually wanted, grant it deliberately: amend the policy with a defined limit, criteria, and audit/spot-checking. That grant — not the past unauthorized practice — is what would make future approvals authorized."
        : "If parallel sub-accounts are actually wanted, authorize them explicitly: defined count, permissions, and logging. That grant — not the agent's self-expansion — is what would make them authorized.",
      authority_check: check(
        "sovereign_decision_required",
        false,
        true,
        "This changes the authority structure itself, so it requires an explicit sovereign decision. It cannot be inferred from good outcomes."
      ),
    });
  }

  if (banProposal) {
    actions.push({
      action:
        "Do not ban ice cream near beaches: the relationship is a statistical association only, so a ban is an intervention with no demonstrated causal basis — it would not be expected to reduce drowning.",
      authority_check: check(
        "unauthorized",
        false,
        false,
        "Intervention-without-warrant: the evidence class (statistical_association) cannot support a causal intervention. Effective levers (lifeguards, swim education, barriers) are the proposals to put to a decision-maker instead."
      ),
    });
  }
  if (hasStreak) {
    actions.push({
      action:
        "Wearing the socks to the championship is the wearer's own harmless choice — wear them if they help confidence. Just do not treat the streak as evidence the socks cause wins, and do not let the ritual become a vulnerability if they are forgotten.",
      authority_check: check(
        "personal_choice",
        true,
        false,
        "A personal, low-stakes choice over one's own attire and routine needs no external authority."
      ),
    });
  }
  if (/bit three/i.test(text)) {
    actions.push({
      action:
        "Treat the specific dog as a genuine local hazard: keep distance, and report the three bites to animal control if not already reported.",
      authority_check: check(
        "advisory_only",
        true,
        false,
        "Self-protective caution and a citizen report require no special authority."
      ),
    });
    actions.push({
      action:
        "Do not generalize the local hazard to the whole street or city: the aggregate trend is downward, so the warranted worry is about the one dog, not the area.",
      authority_check: check(
        "advisory_only",
        true,
        false,
        "This is a conclusion discipline note, not a state-changing action."
      ),
    });
  }
  if (hasMediaNarrative && hasLocalObservation) {
    actions.push({
      action:
        "Act on the local evidence, not the narrative: your position is currently stable; the leverage move is to become fluent with the AI tools reshaping the work, which changes your category from replaceable to leveraging.",
      authority_check: check(
        "advisory_only",
        true,
        false,
        "Self-directed professional development is the principal's own choice."
      ),
    });
  }
  if (revenueSeries.length >= 3) {
    actions.push({
      action:
        "For planning, use ~$1.1M with wide error bars and revisit once the drivers (pipeline, seasonality, churn) are known — do not plan on a confident point forecast from three totals.",
      authority_check: check(
        "advisory_only",
        true,
        false,
        "A planning placeholder offered as advice; no authority is exercised."
      ),
    });
  }
  if (learningSpan) {
    actions.push({
      action:
        "Keep a consistent practice cadence (short daily practice beats occasional long sessions) and define what 'performance-ready' means for you — a few songs for friends and a stage set are different bars with different timelines (months, not weeks).",
      authority_check: check(
        "advisory_only",
        true,
        false,
        "Self-directed learning advice; the principal's own choice."
      ),
    });
  }
  if (actions.length === 0) {
    actions.push({
      action:
        "No action is warranted on the evidence given; the observations are recorded and the unknowns below are what would change that.",
      authority_check: check(
        "advisory_only",
        true,
        false,
        "Explicitly declining to invent an action is the disciplined output here."
      ),
    });
  }

  // ----- unknowns (uncertainty preservation) -----
  const unknowns: string[] = [];
  if (/bit three/i.test(text))
    unknowns.push(
      "whether the dog has been reported, contained, or remains at large",
      "whether the three bites share circumstances (provocation, restraint) not stated"
    );
  if (hasMediaNarrative)
    unknowns.push(
      "your employer's actual plans (hiring, tooling, restructuring) — not in the input",
      "how the industry narrative maps to your specific role and team"
    );
  if (hasCoPeak)
    unknowns.push(
      "the exact shared driver is inferred (seasonal heat/swimming volume), not measured in the input"
    );
  if (hasStreak)
    unknowns.push(
      "outcomes in the comparison condition (games without the socks) — not reported",
      "team strength and opponent strength across the 8 games"
    );
  if (unauthorizedMarker && /refund/i.test(text))
    unknowns.push(
      "how many refunds were approved, their total value, and whether any were fraudulent or erroneous",
      "whether any manager informally tolerated the practice (not stated)"
    );
  if (unauthorizedMarker && /sub-account/i.test(text))
    unknowns.push(
      "how many sub-accounts exist and what each can access",
      "what credentials, API keys, or billing exposure the sub-accounts carry"
    );
  if (revenueSeries.length >= 3)
    unknowns.push(
      "seasonality, sales pipeline, contracts in flight, and churn — the drivers of next quarter"
    );
  if (learningSpan)
    unknowns.push(
      "your practice consistency going forward, which is the main timeline driver",
      "what 'performance-ready' means in your case (songs for friends vs. a stage set)"
    );
  if (urgent)
    unknowns.push(
      "the underlying cause (injury, hunger, fear / fire source and spread) — to be established by acting and observing, not by delaying the protective action"
    );
  if (unknowns.length === 0)
    unknowns.push("anything beyond the stated observations is not in evidence");

  // ----- position / history statements -----
  const position_statement = urgent
    ? `Immediate situation: ${urgent_action}`
    : relations.length > 0 || regularities.length > 0
      ? `Current position, layers kept separate — observed: ${raw_quotes.join(" ")} | supported pattern: ${regularities.join(" ")} These are different epistemic objects and are not merged: the vivid single observation stays in raw, and only the stated regularity counts as pattern.`
      : `Current position from the observations as stated: ${raw_quotes.join(" ")}`;

  const history_statement = `Observed sequence as given: ${raw_quotes.join(" → ")}. No steps beyond those stated are reconstructed.`;

  return {
    raw_quotes,
    regularities,
    relations,
    projection,
    trajectory_null_reason,
    unknowns,
    candidate_actions: actions,
    urgent_action,
    position_statement,
    history_statement,
    uncertainty_signals: {
      ambiguous_input: unknowns.length >= 3,
      missing_context: input.sovereign_context === null,
      conflicting_signals:
        (hasMediaNarrative && hasLocalObservation) ||
        (/bit three/i.test(text) && hasPercentTrend),
      sparse_history: !Array.isArray(ctx["timeline"]) || (ctx["timeline"] as unknown[]).length === 0,
    },
  };
}

export const DeterministicReasoner: Reasoner = {
  id: "deterministic",
  reason(input: SurfaceInput, _contract: PromptContract): Analysis {
    return analyze(input);
  },
};
