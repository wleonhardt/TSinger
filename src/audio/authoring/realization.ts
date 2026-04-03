import type { CompiledSection } from "../metadata";
import type { PatternNoteDraft } from "./types";
import {
  type BarRole,
  getBeatInBar,
  getBarIndex,
  isStrongBeat,
  resolveBarRole,
  type RhythmRole,
} from "./rhythm";
import type { MeterSpec } from "./timing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RealizationRule = {
  /** Fraction of onsets to retain per bar (0–1). Default 1. */
  onsetRetention?: number;
  /** Bias toward keeping strong-beat onsets when thinning (0–1). Default 0.5. */
  strongBeatBias?: number;
  /** Multiplier for note lengths. Default 1. */
  lengthScale?: number;
  /** Additional length multiplier for notes on strong beats. */
  strongBeatLengthScale?: number;
  /** Suppress onsets before this fraction of each bar (0–1). */
  suppressBefore?: number;
  /** Suppress onsets after this fraction of each bar (0–1). */
  suppressAfter?: number;
  /** Merge short notes toward the strongest beat and lengthen the landing. */
  simplify?: boolean;
};

export type RealizationSpec = {
  arrival?: RealizationRule;
  departure?: RealizationRule;
  continuation?: RealizationRule;
  transition?: RealizationRule;
  cadence?: RealizationRule;
  pickup?: RealizationRule;
};

// ---------------------------------------------------------------------------
// Defaults by rhythm role
// ---------------------------------------------------------------------------

export function defaultRealization(
  rhythmRole: RhythmRole | undefined,
): RealizationSpec {
  switch (rhythmRole) {
    case "anchor":
      return {
        arrival: { strongBeatLengthScale: 1.12 },
        transition: { lengthScale: 0.92, onsetRetention: 0.85 },
        cadence: {
          simplify: true,
          onsetRetention: 0.7,
          strongBeatLengthScale: 1.2,
        },
        pickup: { suppressBefore: 0.6 },
      };
    case "flow":
      return {
        arrival: { strongBeatLengthScale: 1.08, strongBeatBias: 0.65 },
        continuation: { lengthScale: 0.94 },
        transition: { onsetRetention: 0.75, lengthScale: 0.9 },
        cadence: {
          simplify: true,
          onsetRetention: 0.6,
          strongBeatLengthScale: 1.15,
        },
        pickup: { suppressBefore: 0.5 },
      };
    case "response":
      return {
        arrival: { strongBeatBias: 0.3 },
        transition: { onsetRetention: 0.7 },
        cadence: { onsetRetention: 0.5, strongBeatBias: 0.7 },
        pickup: { suppressBefore: 0.5 },
      };
    case "cadence":
      return {
        arrival: { strongBeatLengthScale: 1.1 },
        cadence: { simplify: true, strongBeatLengthScale: 1.25 },
      };
    case "pickup":
      return {
        pickup: { suppressBefore: 0.55 },
      };
    case "suspension":
      return {
        arrival: { strongBeatLengthScale: 1.06 },
        cadence: { lengthScale: 1.1, onsetRetention: 0.7 },
        transition: { lengthScale: 1.05 },
      };
    case "ornament":
    case "punctuation":
      return {
        arrival: { onsetRetention: 0.65 },
        transition: { onsetRetention: 0.55 },
        cadence: { onsetRetention: 0.25, strongBeatBias: 0.8 },
        pickup: { suppressBefore: 0.65 },
      };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function deterministicValue(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

/**
 * Sparse motif protection: limits how many notes can be removed based on
 * the total count of notes in the bar.
 *   1 note  → 0 removable (never thin)
 *   2 notes → 0 removable (preserve both)
 *   3 notes → 1 removable (at most)
 *   4+ notes → normal (no extra constraint)
 */
function sparseMotifMaxRemovable(noteCount: number): number {
  if (noteCount <= 2) return 0;
  if (noteCount === 3) return 1;
  return noteCount; // no additional cap
}

/**
 * Weighted target selection for simplification. Scores each note by:
 *   - velocity (authored emphasis)
 *   - length (longer = more deliberate)
 *   - last-in-bar position (composers often place the arrival last)
 *   - chord-tone intent (toneIntent === "chord")
 *   - metric strength (isStrongBeat — contributes but doesn't dominate)
 */
function selectSimplifyTarget(
  drafts: PatternNoteDraft[],
  meter: MeterSpec,
): PatternNoteDraft {
  let bestDraft = drafts[drafts.length - 1]!;
  let bestScore = -Infinity;
  const lastBeat = drafts[drafts.length - 1]!.beat;

  for (const draft of drafts) {
    const velocity = draft.velocity ?? 0.5;
    const length = draft.length;
    const isLast = Math.abs(draft.beat - lastBeat) < 0.01;
    const isChordTone = draft.toneIntent === "chord";
    const strong = isStrongBeat(draft.beat, meter);

    // Weighted score: velocity and length dominate (authored intent),
    // metric strength is a bonus not a gate, last-in-bar breaks ties.
    const score =
      velocity * 0.35 +
      Math.min(length, 2) * 0.25 +
      (strong ? 0.15 : 0) +
      (isLast ? 0.15 : 0) +
      (isChordTone ? 0.1 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestDraft = draft;
    }
  }

  return bestDraft;
}

function getRuleForBarRole(
  spec: RealizationSpec,
  barRole: BarRole | undefined,
): RealizationRule | undefined {
  if (!barRole) {
    return undefined;
  }
  switch (barRole) {
    case "arrival":
      return spec.arrival;
    case "departure":
      return spec.departure;
    case "continuation":
      return spec.continuation;
    case "transition":
      return spec.transition;
    case "cadence":
      return spec.cadence;
    case "pickup":
      return spec.pickup;
    default:
      return undefined;
  }
}

function applyRuleToBarDrafts(
  drafts: PatternNoteDraft[],
  rule: RealizationRule,
  meter: MeterSpec,
  barIndex: number,
  salt: string,
): PatternNoteDraft[] {
  if (drafts.length === 0) {
    return drafts;
  }

  let result = [...drafts];

  // 1. Bar-fraction suppression
  if (rule.suppressBefore !== undefined && rule.suppressBefore > 0) {
    const cutoffBeat = rule.suppressBefore * meter.beatsPerBar;
    result = result.filter(
      (draft) => getBeatInBar(draft.beat, meter) >= cutoffBeat - 0.01,
    );
  }

  if (rule.suppressAfter !== undefined && rule.suppressAfter < 1) {
    const cutoffBeat = rule.suppressAfter * meter.beatsPerBar;
    result = result.filter(
      (draft) => getBeatInBar(draft.beat, meter) <= cutoffBeat + 0.01,
    );
  }

  if (result.length === 0) {
    return result;
  }

  // 2. Onset thinning (with sparse motif protection)
  const retention = rule.onsetRetention ?? 1;
  if (retention < 1 && result.length > 1) {
    // Sparse motif protection: limit how many notes can be removed
    const maxRemovable = sparseMotifMaxRemovable(result.length);
    const rawTarget = Math.max(1, Math.round(result.length * retention));
    const targetCount = Math.max(result.length - maxRemovable, rawTarget);
    if (targetCount < result.length) {
      const bias = rule.strongBeatBias ?? 0.5;
      const scored = result.map((draft) => {
        const strong = isStrongBeat(draft.beat, meter);
        const beatBonus = strong ? bias : 1 - bias;
        const noise = deterministicValue(
          `${salt}:${barIndex}:${draft.beat.toFixed(3)}`,
        );
        return { draft, score: beatBonus * 0.65 + noise * 0.35 };
      });
      scored.sort((left, right) => right.score - left.score);
      result = scored
        .slice(0, targetCount)
        .map((item) => item.draft)
        .sort((left, right) => left.beat - right.beat);
    }
  }

  // 3. Length scaling
  const lengthScale = rule.lengthScale ?? 1;
  const strongScale = rule.strongBeatLengthScale ?? 1;
  if (lengthScale !== 1 || strongScale !== 1) {
    result = result.map((draft) => {
      const scale =
        lengthScale * (isStrongBeat(draft.beat, meter) ? strongScale : 1);
      return scale !== 1 ? { ...draft, length: draft.length * scale } : draft;
    });
  }

  // 4. Simplification — gather toward the authored landing and lengthen it
  if (rule.simplify && result.length > 1) {
    // Sparse motif protection for simplify
    const maxDrop = sparseMotifMaxRemovable(result.length);
    if (maxDrop === 0) {
      // Can't remove any notes — skip simplification entirely,
      // but still apply the landing lengthening to the best candidate.
      const target = selectSimplifyTarget(result, meter);
      result = result.map((draft) =>
        draft === target
          ? {
              ...draft,
              length: Math.max(
                draft.length,
                (meter.beatsPerBar - getBeatInBar(draft.beat, meter)) * 0.85,
              ),
            }
          : draft,
      );
    } else {
      const target = selectSimplifyTarget(result, meter);
      const beatInBar = getBeatInBar(target.beat, meter);
      const remainingBeats = meter.beatsPerBar - beatInBar;

      // Keep notes before the target, trim notes after it (up to maxDrop)
      const before = result.filter(
        (draft) => draft.beat < target.beat - 0.01,
      );
      const after = result.filter(
        (draft) => draft.beat > target.beat + 0.01,
      );

      // Only drop notes after the target, and respect maxDrop
      const totalToDrop = Math.min(after.length, maxDrop);
      const keptAfter = after.slice(0, after.length - totalToDrop);

      result = [
        ...before.map((draft) => ({
          ...draft,
          length: Math.min(
            draft.length,
            Math.max(0.15, (target.beat - draft.beat) * 0.5),
          ),
        })),
        {
          ...target,
          length: Math.max(target.length, remainingBeats * 0.85),
        },
        ...keptAfter,
      ];
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function realizeDrafts(
  drafts: PatternNoteDraft[],
  spec: RealizationSpec,
  meter: MeterSpec,
  sections: CompiledSection[],
  salt: string,
): PatternNoteDraft[] {
  const barGroups = new Map<number, PatternNoteDraft[]>();
  for (const draft of drafts) {
    const bar = getBarIndex(draft.beat, meter);
    if (!barGroups.has(bar)) {
      barGroups.set(bar, []);
    }
    barGroups.get(bar)!.push(draft);
  }

  // First pass: apply per-bar realization
  const barResults = new Map<number, PatternNoteDraft[]>();
  const barOriginalCounts = new Map<number, number>();

  for (const [barIndex, barDrafts] of barGroups) {
    barOriginalCounts.set(barIndex, barDrafts.length);
    const section =
      sections.find(
        (candidate) =>
          barIndex >= candidate.startBar && barIndex < candidate.endBar,
      ) ?? null;
    const barRole = resolveBarRole(section);
    const rule = getRuleForBarRole(spec, barRole);

    if (rule && Object.keys(rule).length > 0) {
      barResults.set(
        barIndex,
        applyRuleToBarDrafts(barDrafts, rule, meter, barIndex, salt),
      );
    } else {
      barResults.set(barIndex, barDrafts);
    }
  }

  // Second pass: section-level density safeguard
  // Prevent structural voids — if a bar was reduced to 0 notes but the
  // original had content, restore at least 1 note (the highest-velocity one).
  // Also detect consecutive sparse bars within the same section.
  for (const section of sections) {
    let consecutiveEmpty = 0;
    for (let bar = section.startBar; bar < section.endBar; bar++) {
      const original = barOriginalCounts.get(bar) ?? 0;
      const realized = barResults.get(bar);
      const realizedCount = realized?.length ?? 0;

      if (original > 0 && realizedCount === 0) {
        consecutiveEmpty += 1;
        // Restore the single highest-velocity note from the original
        const originals = barGroups.get(bar) ?? [];
        const best = originals.reduce(
          (a, b) => ((a.velocity ?? 0.5) >= (b.velocity ?? 0.5) ? a : b),
          originals[0]!,
        );
        barResults.set(bar, [best]);
      } else if (
        original > 0 &&
        realizedCount === 1 &&
        consecutiveEmpty >= 1
      ) {
        // One note after a gap — the gap was already patched above,
        // but mark consecutive-empty reset
        consecutiveEmpty = 0;
      } else {
        consecutiveEmpty = 0;
      }
    }
  }

  const realized: PatternNoteDraft[] = [];
  for (const barDrafts of barResults.values()) {
    realized.push(...barDrafts);
  }

  return realized.sort((left, right) => left.beat - right.beat);
}
