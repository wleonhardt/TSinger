# Symbolic Timing Layer Code Bundle

## /Users/william/Projects/TSinger/src/audio/authoring/timing.ts

```ts
export type MeterSpec = {
  beatsPerBar: number;
  beatUnit: 4 | 8 | 16;
  pickupBeats?: number;
};

export type SwingProfile =
  | { kind: "straight" }
  | { kind: "swing8"; amount?: number }
  | { kind: "swing16"; amount?: number }
  | { kind: "triplet" }
  | { kind: "shuffle"; amount?: number };

export type SubdivisionUnit = 2 | 3 | 4 | 6 | 8 | 12 | 16;

export type BoundaryTarget =
  | { kind: "barStart"; bar: number; label?: string }
  | { kind: "barEnd"; bar: number; label?: string }
  | { kind: "sectionStart"; startBar: number; bars: number; sectionId?: string; label?: string }
  | { kind: "sectionEnd"; startBar: number; bars: number; sectionId?: string; label?: string }
  | { kind: "phraseStart"; bars: number; label?: string }
  | { kind: "phraseEnd"; bars: number; label?: string };

export type TimingIntent =
  | {
      kind: "pickup";
      target: BoundaryTarget;
      distance: Span;
      label?: string;
    }
  | {
      kind: "cadence";
      target: BoundaryTarget;
      label?: string;
    }
  | {
      kind: "repeat";
      startBar: number;
      everyBars: number;
      repetitions: number;
      label?: string;
    };

export type Position = {
  // Bars and beats are one-based for authoring. Subdivision is zero-based within the beat:
  // `{ bar: 3, beat: 2 }` means bar 3 beat 2; `{ bar: 3, beat: 2, subdivision: 1, subdivisionUnit: 2 }`
  // means the "and" of 2 in bar 3. Bar 0 is allowed for pre-phrase pickup space when needed.
  bar: number;
  beat: number;
  subdivision?: number;
  subdivisionUnit?: SubdivisionUnit;
  intent?: TimingIntent;
};

export type Span = {
  bars?: number;
  beats?: number;
  subdivisions?: number;
  subdivisionUnit?: SubdivisionUnit;
};

export type TimingValidationIssue = {
  code: string;
  level: "info" | "warning" | "error";
  message: string;
  beat?: number;
  layerId?: string;
};

export type TimingInsight = {
  kind: "pickup" | "cadence" | "repeat" | "boundary" | "swing";
  message: string;
  beat?: number;
  layerId?: string;
};

export type TimingMetadata = {
  meter: MeterSpec;
  swing: SwingProfile;
  summary: string;
  symbolicPlacementCount: number;
  insights: TimingInsight[];
  issues: TimingValidationIssue[];
};

const DEFAULT_SWING_8 = 0.62;
const DEFAULT_SWING_16 = 0.58;
const TRIPLET_SWING = 2 / 3;
const EPSILON = 1e-6;
const SUBDIVISION_CANDIDATES: SubdivisionUnit[] = [2, 3, 4, 6, 8, 12, 16];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function getSwingRatio(swing: SwingProfile): number {
  switch (swing.kind) {
    case "swing8":
      return clamp(swing.amount ?? DEFAULT_SWING_8, 0.5, 0.75);
    case "swing16":
      return clamp(swing.amount ?? DEFAULT_SWING_16, 0.5, 0.75);
    case "triplet":
      return TRIPLET_SWING;
    case "shuffle":
      return clamp(swing.amount ?? TRIPLET_SWING, 0.5, 0.75);
    case "straight":
    default:
      return 0.5;
  }
}

function warpSwingPair(fraction: number, ratio: number): number {
  if (fraction <= 0.5) {
    return (fraction / 0.5) * ratio;
  }

  return ratio + ((fraction - 0.5) / 0.5) * (1 - ratio);
}

function unwarpSwingPair(fraction: number, ratio: number): number {
  if (fraction <= ratio) {
    return ratio <= EPSILON ? 0 : (fraction / ratio) * 0.5;
  }

  return 0.5 + ((fraction - ratio) / Math.max(EPSILON, 1 - ratio)) * 0.5;
}

function warpBeatFraction(fraction: number, swing: SwingProfile): number {
  const safeFraction = clamp(fraction, 0, 1);

  switch (swing.kind) {
    case "swing16": {
      const ratio = getSwingRatio(swing);
      const cellIndex = safeFraction >= 0.5 ? 1 : 0;
      const cellStart = cellIndex * 0.5;
      const local = (safeFraction - cellStart) / 0.5;
      return cellStart + warpSwingPair(local, ratio) * 0.5;
    }
    case "swing8":
    case "triplet":
    case "shuffle":
      return warpSwingPair(safeFraction, getSwingRatio(swing));
    case "straight":
    default:
      return safeFraction;
  }
}

function unwarpBeatFraction(fraction: number, swing: SwingProfile): number {
  const safeFraction = clamp(fraction, 0, 1);

  switch (swing.kind) {
    case "swing16": {
      const ratio = getSwingRatio(swing);
      const cellIndex = safeFraction >= 0.5 ? 1 : 0;
      const cellStart = cellIndex * 0.5;
      const local = (safeFraction - cellStart) / 0.5;
      return cellStart + unwarpSwingPair(local, ratio) * 0.5;
    }
    case "swing8":
    case "triplet":
    case "shuffle":
      return unwarpSwingPair(safeFraction, getSwingRatio(swing));
    case "straight":
    default:
      return safeFraction;
  }
}

function normalizeSubdivisionUnit(unit: SubdivisionUnit | undefined): SubdivisionUnit {
  return unit ?? 2;
}

function getPositionSubdivision(position: Position): {
  subdivision: number;
  subdivisionUnit: SubdivisionUnit;
} {
  return {
    subdivision: position.subdivision ?? 0,
    subdivisionUnit: normalizeSubdivisionUnit(position.subdivisionUnit),
  };
}

function positionToNotatedBeats(position: Position, meter: MeterSpec): number {
  const subdivision = getPositionSubdivision(position);
  return (
    (position.bar - 1) * meter.beatsPerBar +
    (position.beat - 1) +
    subdivision.subdivision / subdivision.subdivisionUnit
  );
}

function resolveSubdivisionRepresentation(
  fraction: number,
  preferredUnits: SubdivisionUnit[] = SUBDIVISION_CANDIDATES,
): { subdivision?: number; subdivisionUnit?: SubdivisionUnit } {
  const safeFraction = clamp(round(fraction), 0, 1);
  if (safeFraction <= EPSILON) {
    return {};
  }

  for (const unit of preferredUnits) {
    const scaled = safeFraction * unit;
    const roundedValue = Math.round(scaled);
    if (Math.abs(scaled - roundedValue) <= 1e-5 && roundedValue >= 0 && roundedValue < unit) {
      return {
        subdivision: roundedValue,
        subdivisionUnit: unit,
      };
    }
  }

  const fallbackUnit = 16;
  const fallbackValue = Math.round(safeFraction * fallbackUnit);
  if (fallbackValue >= fallbackUnit) {
    return {};
  }

  return {
    subdivision: fallbackValue,
    subdivisionUnit: fallbackUnit,
  };
}

export function normalizeMeter(meter: MeterSpec): MeterSpec {
  return {
    beatsPerBar: Math.max(1, Math.trunc(meter.beatsPerBar)),
    beatUnit: meter.beatUnit,
    pickupBeats:
      meter.pickupBeats !== undefined ? Number(meter.pickupBeats.toFixed(4)) : undefined,
  };
}

export function normalizeSwingProfile(swing?: SwingProfile): SwingProfile {
  if (!swing) {
    return { kind: "straight" };
  }

  switch (swing.kind) {
    case "swing8":
      return { kind: "swing8", amount: getSwingRatio(swing) };
    case "swing16":
      return { kind: "swing16", amount: getSwingRatio(swing) };
    case "shuffle":
      return { kind: "shuffle", amount: getSwingRatio(swing) };
    case "triplet":
      return { kind: "triplet" };
    case "straight":
    default:
      return { kind: "straight" };
  }
}

export function describeSwingProfile(swing?: SwingProfile): string {
  const normalized = normalizeSwingProfile(swing);
  switch (normalized.kind) {
    case "swing8":
      return `swung 8ths (${Math.round(getSwingRatio(normalized) * 100)}/${Math.round((1 - getSwingRatio(normalized)) * 100)})`;
    case "swing16":
      return `swung 16ths (${Math.round(getSwingRatio(normalized) * 100)}/${Math.round((1 - getSwingRatio(normalized)) * 100)})`;
    case "triplet":
      return "triplet grid";
    case "shuffle":
      return `shuffle feel (${Math.round(getSwingRatio(normalized) * 100)}/${Math.round((1 - getSwingRatio(normalized)) * 100)})`;
    case "straight":
    default:
      return "straight grid";
  }
}

export function formatSpan(span: Span): string {
  if (span.bars && !span.beats && !span.subdivisions) {
    return span.bars === 1 ? "1 bar" : `${span.bars} bars`;
  }

  if (span.beats && !span.bars && !span.subdivisions) {
    return span.beats === 1 ? "1 beat" : `${span.beats} beats`;
  }

  if (span.subdivisions && span.subdivisionUnit) {
    if (span.subdivisionUnit === 2 && span.subdivisions === 1) {
      return "1 eighth";
    }
    if (span.subdivisionUnit === 4 && span.subdivisions === 1) {
      return "1 sixteenth";
    }
    return `${span.subdivisions}/${span.subdivisionUnit} of a beat`;
  }

  return `${round(spanToBeats(span, { beatsPerBar: 4, beatUnit: 4 }))} beats`;
}

export function describeBoundaryTarget(target: BoundaryTarget): string {
  const label = target.label ?? ("sectionId" in target ? target.sectionId : undefined);
  if (label) {
    return label;
  }

  switch (target.kind) {
    case "barStart":
      return `bar ${target.bar} start`;
    case "barEnd":
      return `bar ${target.bar} end`;
    case "sectionStart":
      return `section start at bar ${target.startBar}`;
    case "sectionEnd":
      return `section end at bar ${target.startBar + target.bars - 1}`;
    case "phraseStart":
      return "phrase start";
    case "phraseEnd":
      return `phrase end at bar ${target.bars}`;
    default:
      return "boundary";
  }
}

export function positionAtBarBeat(
  bar: number,
  beat: number,
  subdivision = 0,
  subdivisionUnit?: SubdivisionUnit,
): Position {
  return {
    bar,
    beat,
    subdivision: subdivision !== 0 ? subdivision : undefined,
    subdivisionUnit: subdivision !== 0 ? normalizeSubdivisionUnit(subdivisionUnit) : undefined,
  };
}

export function andOf(bar: number, beat: number): Position {
  return positionAtBarBeat(bar, beat, 1, 2);
}

export function lastBeatOfBar(
  bar: number,
  meter: MeterSpec,
  subdivision = 0,
  subdivisionUnit?: SubdivisionUnit,
): Position {
  return positionAtBarBeat(bar, meter.beatsPerBar, subdivision, subdivisionUnit);
}

export function span(
  bars = 0,
  beats = 0,
  subdivisions = 0,
  subdivisionUnit?: SubdivisionUnit,
): Span {
  return {
    bars: bars || undefined,
    beats: beats || undefined,
    subdivisions: subdivisions || undefined,
    subdivisionUnit:
      subdivisions !== 0 ? normalizeSubdivisionUnit(subdivisionUnit) : undefined,
  };
}

export function spanToBeats(
  spanValue: Span,
  meter: MeterSpec,
  _swing?: SwingProfile,
): number {
  const subdivisionUnit = normalizeSubdivisionUnit(spanValue.subdivisionUnit);
  return round(
    (spanValue.bars ?? 0) * meter.beatsPerBar +
      (spanValue.beats ?? 0) +
      (spanValue.subdivisions ?? 0) / subdivisionUnit,
  );
}

export function scaleSpan(spanValue: Span, factor: number): Span {
  const subdivisionUnit = normalizeSubdivisionUnit(spanValue.subdivisionUnit);
  return {
    bars: spanValue.bars !== undefined ? spanValue.bars * factor : undefined,
    beats: spanValue.beats !== undefined ? spanValue.beats * factor : undefined,
    subdivisions:
      spanValue.subdivisions !== undefined ? spanValue.subdivisions * factor : undefined,
    subdivisionUnit:
      spanValue.subdivisions !== undefined ? subdivisionUnit : undefined,
  };
}

export function comparePositions(
  left: Position,
  right: Position,
  meter: MeterSpec,
): number {
  return positionToNotatedBeats(left, meter) - positionToNotatedBeats(right, meter);
}

export function isBarline(position: Position, meter: MeterSpec): boolean {
  const normalized = absoluteBeatToPosition(
    positionToNotatedBeats(position, meter),
    meter,
    { kind: "straight" },
  );
  return normalized.beat === 1 && (normalized.subdivision ?? 0) === 0;
}

export function isLastBeatOfBar(position: Position, meter: MeterSpec): boolean {
  const normalized = absoluteBeatToPosition(
    positionToNotatedBeats(position, meter),
    meter,
    { kind: "straight" },
  );
  return normalized.beat === meter.beatsPerBar && (normalized.subdivision ?? 0) === 0;
}

export function resolvePhraseBoundary(
  target: BoundaryTarget,
  meter: MeterSpec,
): Position {
  switch (target.kind) {
    case "barStart":
      return positionAtBarBeat(target.bar, 1);
    case "barEnd":
      return positionAtBarBeat(target.bar + 1, 1);
    case "sectionStart":
      return positionAtBarBeat(target.startBar, 1);
    case "sectionEnd":
      return positionAtBarBeat(target.startBar + target.bars, 1);
    case "phraseStart":
      return positionAtBarBeat(1, 1);
    case "phraseEnd":
      return positionAtBarBeat(target.bars + 1, 1);
    default:
      return positionAtBarBeat(1, 1);
  }
}

export function cadenceBeat(
  target: BoundaryTarget,
  meter: MeterSpec,
): Position {
  const boundary = resolvePhraseBoundary(target, meter);
  return {
    ...displacePosition(boundary, { beats: -1 }, meter),
    intent: {
      kind: "cadence",
      target,
      label: `Cadence at ${describeBoundaryTarget(target)}`,
    },
  };
}

export function pickupBefore(
  target: BoundaryTarget,
  meter: MeterSpec,
  distance: Span = { subdivisions: 1, subdivisionUnit: 2 },
): Position {
  return {
    ...displacePosition(resolvePhraseBoundary(target, meter), negateSpan(distance), meter),
    intent: {
      kind: "pickup",
      target,
      distance,
      label: `Pickup into ${describeBoundaryTarget(target)}`,
    },
  };
}

function negateSpan(value: Span): Span {
  return {
    bars: value.bars !== undefined ? -value.bars : undefined,
    beats: value.beats !== undefined ? -value.beats : undefined,
    subdivisions: value.subdivisions !== undefined ? -value.subdivisions : undefined,
    subdivisionUnit: value.subdivisionUnit,
  };
}

export function displacePosition(
  position: Position,
  by: Span,
  meter: MeterSpec,
): Position {
  const targetBeats = positionToNotatedBeats(position, meter) + spanToBeats(by, meter);
  return absoluteBeatToPosition(targetBeats, meter, { kind: "straight" });
}

export function addSpan(position: Position, by: Span, meter: MeterSpec): Position {
  return displacePosition(position, by, meter);
}

export function positionToBeats(
  position: Position,
  meter: MeterSpec,
  swing: SwingProfile = { kind: "straight" },
): number {
  const normalizedMeter = normalizeMeter(meter);
  const normalizedSwing = normalizeSwingProfile(swing);
  const notatedBeats = positionToNotatedBeats(position, normalizedMeter);
  const wholeBeat = Math.floor(notatedBeats);
  const fraction = notatedBeats - wholeBeat;
  return round(wholeBeat + warpBeatFraction(fraction, normalizedSwing));
}

export function barBeatToAbsoluteBeat(
  bar: number,
  beat: number,
  meter: MeterSpec,
  swing?: SwingProfile,
): number {
  return positionToBeats(positionAtBarBeat(bar, beat), meter, swing);
}

export function absoluteBeatToPosition(
  beat: number,
  meter: MeterSpec,
  swing: SwingProfile = { kind: "straight" },
  preferredUnits: SubdivisionUnit[] = SUBDIVISION_CANDIDATES,
): Position {
  const normalizedMeter = normalizeMeter(meter);
  const normalizedSwing = normalizeSwingProfile(swing);
  const wholeBeat = Math.floor(beat);
  const fraction = beat - wholeBeat;
  const notatedBeat = wholeBeat + unwarpBeatFraction(fraction, normalizedSwing);
  const barIndex = Math.floor(notatedBeat / normalizedMeter.beatsPerBar);
  const beatWithinBar = notatedBeat - barIndex * normalizedMeter.beatsPerBar;
  const wholeBeatWithinBar = Math.floor(beatWithinBar);
  const fractionalPart = beatWithinBar - wholeBeatWithinBar;
  const subdivision = resolveSubdivisionRepresentation(fractionalPart, preferredUnits);

  return {
    bar: barIndex + 1,
    beat: wholeBeatWithinBar + 1,
    subdivision: subdivision.subdivision,
    subdivisionUnit: subdivision.subdivisionUnit,
  };
}

export function quantizePosition(
  beat: number,
  meter: MeterSpec,
  swing: SwingProfile = { kind: "straight" },
  preferredUnits: SubdivisionUnit[] = SUBDIVISION_CANDIDATES,
): Position {
  return absoluteBeatToPosition(beat, meter, swing, preferredUnits);
}

export function withPosition<T extends object>(
  value: T & { beat?: number; length?: number },
  options: {
    at: Position;
    duration?: number | Span;
    intent?: TimingIntent;
  },
): T & {
  beat: number;
  length: number;
  at: Position;
  duration?: Span;
  timingIntent?: TimingIntent;
} {
  return {
    ...value,
    beat: value.beat ?? 0,
    length:
      typeof options.duration === "number"
        ? options.duration
        : value.length ?? 0,
    at: options.at,
    duration:
      typeof options.duration === "object" ? options.duration : undefined,
    timingIntent: options.intent ?? (value as { timingIntent?: TimingIntent }).timingIntent,
  };
}

export function repeatAcrossBars<
  T extends {
    at?: Position;
    beat: number;
    timingIntent?: TimingIntent;
  },
>(
  items: T[],
  options: {
    startBar: number;
    repetitions: number;
    meter: MeterSpec;
    everyBars?: number;
    label?: string;
  },
): T[] {
  const everyBars = Math.max(1, Math.trunc(options.everyBars ?? 1));
  const repetitions = Math.max(1, Math.trunc(options.repetitions));

  return Array.from({ length: repetitions }, (_, repetitionIndex) =>
    items.map((item, itemIndex) => {
      const barsToMove = options.startBar - 1 + repetitionIndex * everyBars;
      const repeatedIntent =
        repetitionIndex === 0 && itemIndex === 0
          ? {
              kind: "repeat" as const,
              startBar: options.startBar,
              everyBars,
              repetitions,
              label:
                options.label ??
                `Repeats every ${everyBars === 1 ? "bar" : `${everyBars} bars`} for ${repetitions} bars`,
            }
          : item.timingIntent;

      if (item.at) {
        return {
          ...item,
          at: {
            ...addSpan(item.at, { bars: barsToMove }, options.meter),
            intent: item.at.intent,
          },
          timingIntent: repeatedIntent,
        };
      }

      return {
        ...item,
        beat: item.beat + barsToMove * options.meter.beatsPerBar,
        timingIntent: repeatedIntent,
      };
    }),
  ).flat();
}

```

## /Users/william/Projects/TSinger/src/audio/authoring/types.ts

```ts
import type {
  ChordEvent,
  ChordQuality,
  NoteEvent,
  SynthName,
} from "../composition";
import type { CompiledSection, SectionPlanItem, VoiceId } from "../metadata";
import type {
  MeterSpec,
  Position,
  Span,
  SwingProfile,
  TimingIntent,
  TimingMetadata,
} from "./timing";

export type ToneIntent = "chord" | "scale" | "color" | "passing";
export type { SectionPlanItem, VoiceId };
export type {
  MeterSpec,
  Position,
  Span,
  SwingProfile,
  TimingIntent,
  TimingMetadata,
};

export type RegisterRange = {
  min: string;
  max: string;
  anchor?: string;
};

export type HarmonyPlanItem = {
  bar: number;
  root: string;
  quality: ChordQuality;
  lengthBars?: number;
  synth?: SynthName;
  velocity?: number;
  inversion?: number;
  spread?: number;
  tag?: string;
};

export type MotifStep = {
  beat: number;
  length: number;
  offset: number;
  chromaticOffset?: number;
  octaveOffset?: number;
  velocity?: number;
  pan?: number;
  toneIntent?: ToneIntent;
  ornament?: boolean;
  voiceId?: VoiceId;
  timingIntent?: TimingIntent;
};

export type Motif = {
  anchorDegree: number;
  steps: MotifStep[];
};

export type PatternNoteDraft = {
  beat: number;
  length: number;
  at?: Position;
  duration?: Span;
  pitch?: string;
  degree?: number;
  chordDegree?: number;
  chromaticOffset?: number;
  octaveOffset?: number;
  velocity?: number;
  pan?: number;
  toneIntent?: ToneIntent;
  ornament?: boolean;
  glideToDegree?: number;
  voiceId?: VoiceId;
  timingIntent?: TimingIntent;
};

type LayerPlanBase = {
  id?: string;
  synth: SynthName;
  voiceId?: VoiceId;
  register?: RegisterRange;
  velocityScale?: number;
  pan?: number;
  clampToHarmony?: boolean;
  allowOrnaments?: boolean;
};

export type MotifLayerPlan = LayerPlanBase & {
  kind: "motif";
  motif: Motif;
  repeatEveryBeats?: number;
  repeatEvery?: Span;
  repetitions?: number;
  beatOffset?: number;
  positionOffset?: Position;
};

export type DraftLayerPlan = LayerPlanBase & {
  kind: "draft";
  notes: PatternNoteDraft[];
};

export type PhraseLayerPlan = MotifLayerPlan | DraftLayerPlan;

export type ArrangementCurvePoint = {
  beat: number;
  at?: Position;
  value: number;
};

export type ArrangementSpec = {
  densityCurve?: ArrangementCurvePoint[];
  registerCurve?: ArrangementCurvePoint[];
  brightnessCurve?: ArrangementCurvePoint[];
  cadenceCurve?: ArrangementCurvePoint[];
  ornamentBaseProbability?: number;
};

export type PadLayerPlan = {
  id?: string;
  synth: SynthName;
  voiceId?: VoiceId;
  velocityScale?: number;
  overrideHarmony?: HarmonyPlanItem[];
};

export type PhrasePlan = {
  bars: number;
  beatsPerBar: number;
  meter?: MeterSpec;
  swing?: SwingProfile;
  key: {
    root: string;
    scale: string;
  };
  harmony: HarmonyPlanItem[];
  sections?: SectionPlanItem[];
  padLayers?: PadLayerPlan[];
  noteLayers?: PhraseLayerPlan[];
  arrangement?: ArrangementSpec;
};

export type CompiledPhrase = {
  notes: NoteEvent[];
  chords: ChordEvent[];
  sections: CompiledSection[];
  timing?: TimingMetadata;
};

export type ValidationIssue = {
  level: "warning" | "error";
  message: string;
};

```

## /Users/william/Projects/TSinger/src/audio/authoring/compile.ts

```ts
import type { ChordEvent, NoteEvent } from "../composition";
import type { CompiledSection } from "../metadata";
import { midiToNote, noteToMidi, transpose } from "../theory";
import { resolveVoiceId } from "../voiceIdentity";
import {
  getAllowedTonesOverHarmony,
  getChordTones,
  pickColorTone,
  resolveScaleDegreeToPitch,
} from "./harmony";
import {
  getBrightnessAtBeat,
  getCadentialWeightAtBeat,
  getDensityAtBeat,
  getRegisterBiasAtBeat,
  shouldOrnament,
} from "./arrangement";
import { compileSections, findSectionAtBeat } from "./sections";
import {
  addSpan,
  absoluteBeatToPosition,
  type BoundaryTarget,
  cadenceBeat,
  describeBoundaryTarget,
  describeSwingProfile,
  normalizeMeter,
  normalizeSwingProfile,
  positionToBeats,
  resolvePhraseBoundary,
  spanToBeats,
  type MeterSpec,
  type Position,
  type SwingProfile,
  type TimingIntent,
  type TimingMetadata,
} from "./timing";
import {
  type CompiledPhrase,
  type DraftLayerPlan,
  type HarmonyPlanItem,
  type MotifLayerPlan,
  type PadLayerPlan,
  type PatternNoteDraft,
  type PhraseLayerPlan,
  type PhrasePlan,
  type RegisterRange,
  type ValidationIssue,
} from "./types";
import {
  nearestPitchClassInRegister,
  pickNearestMelodicTone,
} from "./voiceLeading";

type ExpandedHarmonySpan = HarmonyPlanItem & {
  startBeat: number;
  endBeat: number;
};

type TimingCompilationState = {
  meter: MeterSpec;
  swing: SwingProfile;
  symbolicPlacementCount: number;
  insights: TimingMetadata["insights"];
  issues: TimingMetadata["issues"];
  seenIntentKeys: Set<string>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function roundToGrid(value: number): number {
  return Number(value.toFixed(4));
}

function createTimingState(plan: PhrasePlan): TimingCompilationState {
  const normalizedMeter = normalizeMeter({
    beatsPerBar: plan.beatsPerBar,
    beatUnit: plan.meter?.beatUnit ?? 4,
    pickupBeats: plan.meter?.pickupBeats,
  });

  return {
    meter: normalizedMeter,
    swing: normalizeSwingProfile(plan.swing),
    symbolicPlacementCount: 0,
    insights: [
      {
        kind: "swing",
        message: `Timing grid: ${normalizedMeter.beatsPerBar}/${normalizedMeter.beatUnit} with ${describeSwingProfile(plan.swing)}.`,
      },
    ],
    issues:
      plan.meter && plan.meter.beatsPerBar !== plan.beatsPerBar
        ? [
            {
              code: "meter-mismatch",
              level: "warning",
              message: `Meter beatsPerBar (${plan.meter.beatsPerBar}) did not match phrase beatsPerBar (${plan.beatsPerBar}); compile used ${plan.beatsPerBar}.`,
            },
          ]
        : [],
    seenIntentKeys: new Set(),
  };
}

function buildTimingMetadata(state: TimingCompilationState): TimingMetadata {
  return {
    meter: state.meter,
    swing: state.swing,
    summary: `${state.meter.beatsPerBar}/${state.meter.beatUnit} meter, ${describeSwingProfile(state.swing)}.`,
    symbolicPlacementCount: state.symbolicPlacementCount,
    insights: state.insights,
    issues: state.issues,
  };
}

function incrementSymbolicCount(
  state: TimingCompilationState,
  enabled: boolean,
): void {
  if (enabled) {
    state.symbolicPlacementCount += 1;
  }
}

function resolveGlobalBeat(
  beat: number,
  at: Position | undefined,
  state: TimingCompilationState,
): number {
  if (at) {
    incrementSymbolicCount(state, true);
    return positionToBeats(at, state.meter, state.swing);
  }

  return beat;
}

function resolveGlobalLength(
  startBeat: number,
  at: Position | undefined,
  length: number,
  duration: PatternNoteDraft["duration"],
  state: TimingCompilationState,
): number {
  if (duration) {
    const startPosition = at ?? absoluteBeatToPosition(startBeat, state.meter, state.swing);
    incrementSymbolicCount(state, true);
    const endPosition = addSpan(startPosition, duration, state.meter);
    return positionToBeats(endPosition, state.meter, state.swing) -
      positionToBeats(startPosition, state.meter, state.swing);
  }

  return length;
}

function resolveLocalBeat(beat: number, state: TimingCompilationState): number {
  return beat;
}

function resolveBoundaryBeat(
  target: BoundaryTarget,
  intentKind: "cadence" | "pickup" | "boundary",
  state: TimingCompilationState,
): number {
  const position =
    intentKind === "cadence"
      ? cadenceBeat(target, state.meter)
      : resolvePhraseBoundary(target, state.meter);
  return positionToBeats(position, state.meter, state.swing);
}

function pushTimingInsight(
  state: TimingCompilationState,
  key: string,
  insight: TimingMetadata["insights"][number],
): void {
  if (state.seenIntentKeys.has(key)) {
    return;
  }

  state.seenIntentKeys.add(key);
  state.insights.push(insight);
}

function pushTimingIssue(
  state: TimingCompilationState,
  issue: TimingMetadata["issues"][number],
): void {
  state.issues.push(issue);
}

function formatBeatForMessage(
  beat: number,
  state: TimingCompilationState,
): string {
  const position = absoluteBeatToPosition(beat, state.meter, state.swing);
  const subdivision =
    position.subdivision !== undefined && position.subdivisionUnit !== undefined
      ? ` + ${position.subdivision}/${position.subdivisionUnit}`
      : "";

  return `bar ${position.bar}, beat ${position.beat}${subdivision}`;
}

function resolvePatternIntent(
  intent: TimingIntent | undefined,
  actualBeat: number,
  layerId: string,
  state: TimingCompilationState,
): void {
  if (!intent) {
    return;
  }

  if (intent.kind === "repeat") {
    pushTimingInsight(
      state,
      `${layerId}:repeat:${intent.startBar}:${intent.everyBars}:${intent.repetitions}:${intent.label ?? ""}`,
      {
        kind: "repeat",
        layerId,
        beat: actualBeat,
        message:
          intent.label ??
          `${layerId} repeats every ${intent.everyBars === 1 ? "bar" : `${intent.everyBars} bars`} for ${intent.repetitions} passes and stays bar-aligned.`,
      },
    );
    return;
  }

  const expectedBeat = resolveBoundaryBeat(intent.target, intent.kind, state);
  const delta = Math.abs(expectedBeat - actualBeat);
  const boundaryText = describeBoundaryTarget(intent.target);

  if (intent.kind === "pickup") {
    const expectedPickupBeat = positionToBeats(
      addSpan(resolvePhraseBoundary(intent.target, state.meter), {
        bars: intent.distance.bars !== undefined ? -intent.distance.bars : undefined,
        beats: intent.distance.beats !== undefined ? -intent.distance.beats : undefined,
        subdivisions:
          intent.distance.subdivisions !== undefined ? -intent.distance.subdivisions : undefined,
        subdivisionUnit: intent.distance.subdivisionUnit,
      }, state.meter),
      state.meter,
      state.swing,
    );
    const pickupDelta = Math.abs(expectedPickupBeat - actualBeat);
    if (pickupDelta <= 0.01) {
      pushTimingInsight(
        state,
        `${layerId}:pickup:${expectedPickupBeat.toFixed(3)}:${intent.label ?? ""}`,
        {
          kind: "pickup",
          layerId,
          beat: actualBeat,
          message:
            intent.label ??
            `${layerId} pickup lands ${intent.distance.subdivisions === 1 && intent.distance.subdivisionUnit === 2 ? "one 8th" : "in pickup space"} before ${boundaryText}.`,
        },
      );
    } else {
      pushTimingIssue(state, {
        code: "pickup-misalignment",
        level: "warning",
        layerId,
        beat: actualBeat,
        message: `${layerId} pickup missed ${boundaryText} by ${pickupDelta.toFixed(3)} beats.`,
      });
    }
    return;
  }

  if (delta <= 0.01) {
    pushTimingInsight(
      state,
      `${layerId}:${intent.kind}:${expectedBeat.toFixed(3)}:${intent.label ?? ""}`,
      {
        kind: intent.kind,
        layerId,
        beat: actualBeat,
        message:
          intent.label ??
          `${layerId} ${intent.kind === "cadence" ? "resolves" : "lands"} on ${boundaryText} as intended.`,
      },
    );
    return;
  }

  pushTimingIssue(state, {
    code: `${intent.kind}-misalignment`,
    level: "warning",
    layerId,
    beat: actualBeat,
    message: `${layerId} ${intent.kind} target missed ${boundaryText} by ${delta.toFixed(3)} beats.`,
  });
}

function normalizeArrangement(
  plan: PhrasePlan,
  state: TimingCompilationState,
): PhrasePlan["arrangement"] {
  if (!plan.arrangement) {
    return plan.arrangement;
  }

  const resolvePoints = (
    points: NonNullable<PhrasePlan["arrangement"]>["densityCurve"],
  ) =>
    points?.map((point) => {
      incrementSymbolicCount(state, point.at !== undefined);
      return {
        ...point,
        beat:
          point.at !== undefined
            ? positionToBeats(point.at, state.meter, state.swing)
            : point.beat,
      };
    });

  return {
    densityCurve: resolvePoints(plan.arrangement.densityCurve),
    registerCurve: resolvePoints(plan.arrangement.registerCurve),
    brightnessCurve: resolvePoints(plan.arrangement.brightnessCurve),
    cadenceCurve: resolvePoints(plan.arrangement.cadenceCurve),
    ornamentBaseProbability: plan.arrangement.ornamentBaseProbability,
  };
}

function normalizeDraftLayer(
  layer: DraftLayerPlan,
  state: TimingCompilationState,
): DraftLayerPlan {
  return {
    ...layer,
    notes: layer.notes.map((note) => {
      const beat = resolveGlobalBeat(note.beat, note.at, state);
      const length = resolveGlobalLength(beat, note.at, note.length, note.duration, state);

      return {
        ...note,
        beat,
        length,
      };
    }),
  };
}

function normalizeMotifLayer(
  layer: MotifLayerPlan,
  state: TimingCompilationState,
): MotifLayerPlan {
  incrementSymbolicCount(state, layer.positionOffset !== undefined);
  incrementSymbolicCount(state, layer.repeatEvery !== undefined);
  const beatOffset =
    (layer.beatOffset ?? 0) +
    (layer.positionOffset
      ? positionToBeats(layer.positionOffset, state.meter, state.swing)
      : 0);

  return {
    ...layer,
    beatOffset,
    repeatEveryBeats:
      layer.repeatEvery !== undefined
        ? spanToBeats(layer.repeatEvery, state.meter, state.swing)
        : layer.repeatEveryBeats,
  };
}

function normalizePhrasePlan(
  plan: PhrasePlan,
  state: TimingCompilationState,
): PhrasePlan {
  return {
    ...plan,
    arrangement: normalizeArrangement(plan, state),
    noteLayers: plan.noteLayers?.map((layer) =>
      layer.kind === "motif"
        ? normalizeMotifLayer(layer, state)
        : normalizeDraftLayer(layer, state),
    ),
  };
}

function validateCompiledTimingBounds(
  notes: NoteEvent[],
  chords: ChordEvent[],
  plan: PhrasePlan,
  state: TimingCompilationState,
): void {
  const phraseBeats = plan.bars * plan.beatsPerBar;
  const allEvents = [
    ...notes.map((note) => ({
      layerId: note.layerId ?? note.synth,
      beat: note.beat,
      endBeat: note.beat + note.length,
      type: "note" as const,
    })),
    ...chords.map((chord) => ({
      layerId: chord.layerId ?? chord.synth,
      beat: chord.beat,
      endBeat: chord.beat + chord.length,
      type: "chord" as const,
    })),
  ];

  for (const event of allEvents) {
    if (event.beat < -0.0001) {
      pushTimingIssue(state, {
        code: "negative-start",
        level: "warning",
        layerId: event.layerId,
        beat: event.beat,
        message: `${event.layerId} starts before the phrase at ${formatBeatForMessage(event.beat, state)}.`,
      });
    }

    if (event.endBeat > phraseBeats + 0.0001) {
      pushTimingIssue(state, {
        code: "phrase-overrun",
        level: "warning",
        layerId: event.layerId,
        beat: event.beat,
        message: `${event.layerId} overruns the phrase boundary by ${(event.endBeat - phraseBeats).toFixed(3)} beats.`,
      });
    }
  }
}

function midpointPitch(register: RegisterRange): string {
  const minMidi = noteToMidi(register.min);
  const maxMidi = noteToMidi(register.max);
  return midiToNote(Math.round((minMidi + maxMidi) / 2));
}

function expandHarmonyPlan(plan: PhrasePlan): ExpandedHarmonySpan[] {
  const sorted = [...plan.harmony].sort((left, right) => left.bar - right.bar);
  const phraseBeats = plan.bars * plan.beatsPerBar;

  return sorted.map((item, index) => {
    const startBeat = item.bar * plan.beatsPerBar;
    const nextBarBeat =
      sorted[index + 1]?.bar !== undefined
        ? sorted[index + 1]!.bar * plan.beatsPerBar
        : phraseBeats;
    const endBeat = item.lengthBars
      ? startBeat + item.lengthBars * plan.beatsPerBar
      : nextBarBeat;

    return {
      ...item,
      startBeat,
      endBeat,
    };
  });
}

function getHarmonyAtBeat(
  harmony: ExpandedHarmonySpan[],
  beat: number,
): ExpandedHarmonySpan {
  return (
    harmony.find((item) => beat >= item.startBeat && beat < item.endBeat) ??
    harmony[harmony.length - 1]!
  );
}

function getRegisterForLayer(
  layer: PhraseLayerPlan,
): RegisterRange {
  return (
    layer.register ?? {
      min: "C4",
      max: "C6",
      anchor: "A4",
    }
  );
}

function getBiasedAnchorPitch(
  register: RegisterRange,
  beat: number,
  plan: PhrasePlan,
  sections: CompiledSection[],
  previousPitch: string | null,
): string {
  const baseAnchor = previousPitch ?? register.anchor ?? midpointPitch(register);
  const registerBias = getRegisterBiasAtBeat(plan.arrangement, beat, sections);
  const brightness = getBrightnessAtBeat(plan.arrangement, beat, sections);
  const shift = Math.round(registerBias * 4 + (brightness - 0.5) * 4);
  const minMidi = noteToMidi(register.min);
  const maxMidi = noteToMidi(register.max);
  const shiftedMidi = clamp(noteToMidi(baseAnchor) + shift, minMidi, maxMidi);

  return midiToNote(shiftedMidi);
}

function coerceIntoRegister(
  pitch: string,
  register: RegisterRange,
  anchorPitch: string,
): string {
  const midi = noteToMidi(pitch);

  if (midi >= noteToMidi(register.min) && midi <= noteToMidi(register.max)) {
    return pitch;
  }

  return nearestPitchClassInRegister(
    noteToMidi(pitch) % 12,
    anchorPitch,
    register.min,
    register.max,
  );
}

function resolveChordDegreePitch(
  chordTones: string[],
  chordDegree: number,
): string {
  const chordLength = chordTones.length;
  const normalizedIndex = modulo(chordDegree, chordLength);
  const octaveCycles = Math.floor((chordDegree - normalizedIndex) / chordLength);

  return transpose(chordTones[normalizedIndex]!, octaveCycles * 12);
}

function pickTargetedHarmonicPitch(
  preferredPitch: string,
  previousPitch: string | null,
  allowedPitches: string[],
  register: RegisterRange,
  toneIntent: PatternNoteDraft["toneIntent"],
): string {
  const allowedInRange = allowedPitches.filter((pitch) => {
    const midi = noteToMidi(pitch);
    return midi >= noteToMidi(register.min) && midi <= noteToMidi(register.max);
  });

  if (allowedInRange.length === 0) {
    return preferredPitch;
  }

  const safePreferredPitch = pickNearestMelodicTone(preferredPitch, allowedInRange, {
    minPitch: register.min,
    maxPitch: register.max,
    anchorPitch: preferredPitch,
    preferDirection: "nearest",
    maxLeapSemitones: Number.POSITIVE_INFINITY,
  });

  if (!previousPitch) {
    return safePreferredPitch;
  }

  const maxLeapSemitones = toneIntent === "passing" ? 7 : 12;
  if (Math.abs(noteToMidi(safePreferredPitch) - noteToMidi(previousPitch)) <= maxLeapSemitones) {
    return safePreferredPitch;
  }

  return pickNearestMelodicTone(previousPitch, allowedInRange, {
    minPitch: register.min,
    maxPitch: register.max,
    anchorPitch: safePreferredPitch,
    preferDirection: toneIntent === "passing" ? "nearest" : "up",
    maxLeapSemitones,
  });
}

function shouldKeepDraft(
  layer: PhraseLayerPlan,
  draft: PatternNoteDraft,
  plan: PhrasePlan,
  sections: CompiledSection[],
): boolean {
  if (!draft.ornament) {
    return true;
  }

  if (layer.allowOrnaments === false) {
    return false;
  }

  if (getDensityAtBeat(plan.arrangement, draft.beat, sections) < 0.45) {
    return false;
  }

  return shouldOrnament(
    plan.arrangement,
    draft.beat,
    `${layer.id ?? layer.synth}:ornament`,
    sections,
  );
}

function resolveGlidePitch(
  draft: PatternNoteDraft,
  plan: PhrasePlan,
  register: RegisterRange,
  anchorPitch: string,
): string | undefined {
  if (draft.glideToDegree === undefined) {
    return undefined;
  }

  return resolveScaleDegreeToPitch(
    plan.key.root,
    plan.key.scale,
    draft.glideToDegree,
    register,
    anchorPitch,
  );
}

function resolveDraftPitch(
  draft: PatternNoteDraft,
  layer: PhraseLayerPlan,
  plan: PhrasePlan,
  span: ExpandedHarmonySpan,
  sections: CompiledSection[],
  previousPitch: string | null,
): { pitch: string; glideTo?: string } | null {
  const register = getRegisterForLayer(layer);
  const anchorPitch = getBiasedAnchorPitch(register, draft.beat, plan, sections, previousPitch);
  const chordTones = getChordTones(span.root, span.quality);
  let resolvedPitch: string | null = null;

  if (draft.pitch) {
    const looksAbsolute = /\d/.test(draft.pitch);
    resolvedPitch = looksAbsolute
      ? draft.pitch
      : nearestPitchClassInRegister(
          noteToMidi(`${draft.pitch}4`) % 12,
          previousPitch ?? anchorPitch,
          register.min,
          register.max,
        );
  } else if (draft.chordDegree !== undefined) {
    const target = resolveChordDegreePitch(chordTones, draft.chordDegree);
    resolvedPitch = nearestPitchClassInRegister(
      noteToMidi(target) % 12,
      previousPitch ?? anchorPitch,
      register.min,
      register.max,
    );
  } else if (draft.degree !== undefined) {
    const scalePitch = resolveScaleDegreeToPitch(
      plan.key.root,
      plan.key.scale,
      draft.degree,
      register,
      previousPitch ?? anchorPitch,
    );
    const chromaticPitch = draft.chromaticOffset
      ? transpose(scalePitch, draft.chromaticOffset)
      : scalePitch;

    if (draft.toneIntent === "color") {
      resolvedPitch =
        pickColorTone({
          chordRoot: span.root,
          chordQuality: span.quality,
          keyRoot: plan.key.root,
          scaleName: plan.key.scale,
          register,
          anchorPitch: chromaticPitch,
          preferBright: getBrightnessAtBeat(plan.arrangement, draft.beat, sections) > 0.55,
        }) ?? chromaticPitch;
    } else if (layer.clampToHarmony || draft.toneIntent === "chord") {
      const allowed = getAllowedTonesOverHarmony(
        span.root,
        span.quality,
        plan.key.root,
        plan.key.scale,
        {
          register,
          includeChordTones: true,
          includeScaleTones: draft.toneIntent !== "chord",
          includeColorTones: draft.toneIntent === "passing",
        },
      );

      resolvedPitch = pickTargetedHarmonicPitch(
        chromaticPitch,
        previousPitch,
        allowed,
        register,
        draft.toneIntent,
      );
    } else {
      resolvedPitch = chromaticPitch;
    }
  }

  if (!resolvedPitch) {
    return null;
  }

  if (draft.octaveOffset) {
    resolvedPitch = transpose(resolvedPitch, draft.octaveOffset * 12);
  }

  resolvedPitch = coerceIntoRegister(
    resolvedPitch,
    register,
    previousPitch ?? anchorPitch,
  );

  return {
    pitch: resolvedPitch,
    glideTo: resolveGlidePitch(draft, plan, register, resolvedPitch),
  };
}

function applyLayerVelocity(
  layer: PhraseLayerPlan,
  draft: PatternNoteDraft,
  plan: PhrasePlan,
  sections: CompiledSection[],
): number {
  const density = getDensityAtBeat(plan.arrangement, draft.beat, sections);
  const cadence = getCadentialWeightAtBeat(plan.arrangement, draft.beat, sections);
  const baseVelocity = draft.velocity ?? 0.5;
  const scale = layer.velocityScale ?? 1;

  return clamp(
    baseVelocity * scale * (0.92 + cadence * 0.12) * Math.min(1.1, 0.85 + density * 0.2),
    0.04,
    1,
  );
}

function compileDraftNotes(
  drafts: PatternNoteDraft[],
  layer: PhraseLayerPlan,
  plan: PhrasePlan,
  harmony: ExpandedHarmonySpan[],
  sections: CompiledSection[],
  layerId: string,
  timingState: TimingCompilationState,
): NoteEvent[] {
  const sortedDrafts = [...drafts].sort((left, right) => left.beat - right.beat);
  const notes: NoteEvent[] = [];
  let previousPitch: string | null = null;

  for (const draft of sortedDrafts) {
    if (!shouldKeepDraft(layer, draft, plan, sections)) {
      continue;
    }

    const span = getHarmonyAtBeat(harmony, draft.beat);
    const resolved = resolveDraftPitch(
      draft,
      layer,
      plan,
      span,
      sections,
      previousPitch,
    );
    if (!resolved) {
      continue;
    }

    const section = findSectionAtBeat(sections, draft.beat);
    const voiceId = resolveVoiceId(
      draft.voiceId ?? layer.voiceId,
      layer.synth,
      { ornament: draft.ornament === true },
    );
    previousPitch = resolved.pitch;
    resolvePatternIntent(draft.timingIntent ?? draft.at?.intent, draft.beat, layerId, timingState);
    notes.push({
      beat: roundToGrid(draft.beat),
      length: roundToGrid(Math.max(0.05, draft.length)),
      pitch: resolved.pitch,
      glideTo: resolved.glideTo,
      synth: layer.synth,
      velocity: roundToGrid(applyLayerVelocity(layer, draft, plan, sections)),
      pan: roundToGrid((draft.pan ?? 0) + (layer.pan ?? 0)),
      voiceId,
      layerId,
      sectionId: section?.id,
      sectionRole: section?.role,
    });
  }

  return notes;
}

export function compileMotifToNotes(
  layer: MotifLayerPlan,
  plan: PhrasePlan,
  harmony: ExpandedHarmonySpan[],
  sections: CompiledSection[],
  layerId: string,
  timingState: TimingCompilationState,
): NoteEvent[] {
  const motifLength = layer.motif.steps.reduce(
    (length, step) => Math.max(length, step.beat + step.length),
    0,
  );
  const repeatEveryBeats = layer.repeatEveryBeats ?? motifLength;
  const repetitions = layer.repetitions ?? 1;
  const beatOffset = layer.beatOffset ?? 0;
  const drafts: PatternNoteDraft[] = [];

  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    for (const step of layer.motif.steps) {
      drafts.push({
        beat: beatOffset + repetition * repeatEveryBeats + step.beat,
        length: step.length,
        degree: layer.motif.anchorDegree + step.offset,
        chromaticOffset: step.chromaticOffset,
        octaveOffset: step.octaveOffset,
        velocity: step.velocity,
        pan: step.pan,
        toneIntent: step.toneIntent,
        ornament: step.ornament,
        voiceId: step.voiceId,
        timingIntent: step.timingIntent,
      });
    }
  }

  return compileDraftNotes(drafts, layer, plan, harmony, sections, layerId, timingState);
}

export function compilePatternLayer(
  layer: DraftLayerPlan,
  plan: PhrasePlan,
  harmony: ExpandedHarmonySpan[],
  sections: CompiledSection[],
  layerId: string,
  timingState: TimingCompilationState,
): NoteEvent[] {
  return compileDraftNotes(layer.notes, layer, plan, harmony, sections, layerId, timingState);
}

export function mergeEventLayers(...layers: NoteEvent[][]): NoteEvent[] {
  return normalizeAndSortEvents(layers.flat());
}

export function normalizeAndSortEvents(events: NoteEvent[]): NoteEvent[] {
  const seen = new Set<string>();

  return [...events]
    .filter((event) => event.length > 0)
    .map((event) => ({
      ...event,
      beat: roundToGrid(event.beat),
      length: roundToGrid(event.length),
      velocity: event.velocity !== undefined ? roundToGrid(event.velocity) : undefined,
      pan: event.pan !== undefined ? roundToGrid(event.pan) : undefined,
    }))
    .sort((left, right) => {
      if (left.beat !== right.beat) {
        return left.beat - right.beat;
      }

      if (left.synth !== right.synth) {
        return left.synth.localeCompare(right.synth);
      }

      return left.pitch.localeCompare(right.pitch);
    })
    .filter((event) => {
      const key = [
        event.beat,
        event.synth,
        event.voiceId ?? "",
        event.layerId ?? "",
        event.pitch,
        event.length,
      ].join("|");
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function normalizeAndSortChords(chords: ChordEvent[]): ChordEvent[] {
  return [...chords]
    .map((chord) => ({
      ...chord,
      beat: roundToGrid(chord.beat),
      length: roundToGrid(chord.length),
      velocity: chord.velocity !== undefined ? roundToGrid(chord.velocity) : undefined,
    }))
    .sort((left, right) => left.beat - right.beat);
}

function getResolvedLayerId(
  layer: Pick<PhraseLayerPlan, "id" | "kind" | "synth"> | Pick<PadLayerPlan, "id" | "synth">,
  index: number,
  prefix: string,
): string {
  return layer.id ?? `${prefix}:${index}:${layer.synth}`;
}

function getSectionMetadata(
  sections: CompiledSection[],
  beat: number,
): Pick<NoteEvent, "sectionId" | "sectionRole"> {
  const section = findSectionAtBeat(sections, beat);

  return {
    sectionId: section?.id,
    sectionRole: section?.role,
  };
}

export function compilePhrasePlan(plan: PhrasePlan): CompiledPhrase {
  const timingState = createTimingState(plan);
  const normalizedPlan = normalizePhrasePlan(plan, timingState);
  const sections = compileSections(normalizedPlan);
  const harmony = expandHarmonyPlan(normalizedPlan);
  const noteLayers = normalizedPlan.noteLayers ?? [];
  const chords: ChordEvent[] =
    normalizedPlan.padLayers && normalizedPlan.padLayers.length > 0
      ? normalizedPlan.padLayers.flatMap((layer) =>
          (layer.overrideHarmony ?? normalizedPlan.harmony).map((item, index, list) => {
            const nextBar = list[index + 1]?.bar;
            const lengthBars =
              item.lengthBars ?? (nextBar !== undefined ? nextBar - item.bar : 1);
            const beat = item.bar * normalizedPlan.beatsPerBar;
            const layerId = getResolvedLayerId(layer, index, "pad");

            return {
              beat,
              length: lengthBars * normalizedPlan.beatsPerBar,
              root: item.root,
              quality: item.quality,
              synth: layer.synth,
              velocity: (item.velocity ?? 0.22) * (layer.velocityScale ?? 1),
              inversion: item.inversion,
              spread: item.spread,
              voiceId: resolveVoiceId(layer.voiceId, layer.synth, { isPad: true }),
              layerId,
              ...getSectionMetadata(sections, beat),
            };
          }),
        )
      : normalizedPlan.harmony
          .filter((item) => item.synth)
          .map((item, index, list) => {
            const nextBar = list[index + 1]?.bar;
            const lengthBars =
              item.lengthBars ?? (nextBar !== undefined ? nextBar - item.bar : 1);
            const beat = item.bar * normalizedPlan.beatsPerBar;

            return {
              beat,
              length: lengthBars * normalizedPlan.beatsPerBar,
              root: item.root,
              quality: item.quality,
              synth: item.synth!,
              velocity: item.velocity,
              inversion: item.inversion,
              spread: item.spread,
              voiceId: resolveVoiceId(undefined, item.synth!, { isPad: true }),
              layerId: `harmony:${index}:${item.synth!}`,
              ...getSectionMetadata(sections, beat),
            };
          });

  const notes = mergeEventLayers(
    ...noteLayers.map((layer, index) => {
      const layerId = getResolvedLayerId(layer, index, layer.kind);
      return layer.kind === "motif"
        ? compileMotifToNotes(layer, normalizedPlan, harmony, sections, layerId, timingState)
        : compilePatternLayer(layer, normalizedPlan, harmony, sections, layerId, timingState);
    }),
  );
  validateCompiledTimingBounds(notes, chords, normalizedPlan, timingState);
  if (timingState.symbolicPlacementCount > 0) {
    timingState.insights.push({
      kind: "boundary",
      message: `${timingState.symbolicPlacementCount} symbolic timing placements were normalized into absolute beat events.`,
    });
  }

  return {
    notes,
    chords: normalizeAndSortChords(chords),
    sections,
    timing: buildTimingMetadata(timingState),
  };
}

export function validateCompiledPhrase(compiled: CompiledPhrase): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const note of compiled.notes) {
    const midi = noteToMidi(note.pitch);
    if (midi < 24 || midi > 100) {
      issues.push({
        level: "warning",
        message: `Pitch ${note.pitch} sits outside the usual instrument range.`,
      });
    }

    const key = `${note.beat}|${note.pitch}|${note.synth}|${note.voiceId ?? ""}|${note.layerId ?? ""}`;
    if (seen.has(key)) {
      issues.push({
        level: "warning",
        message: `Duplicate note event at beat ${note.beat} for ${note.pitch}.`,
      });
    }
    seen.add(key);
  }

  return issues;
}

```

## /Users/william/Projects/TSinger/src/audio/authoring/motifs.ts

```ts
import { spanToBeats, type MeterSpec, type Span } from "./timing";
import type { Motif, MotifStep } from "./types";

type SequenceShift = number | { scaleSteps?: number; semitones?: number };

type AnswerPhraseOptions = {
  scaleSteps?: number;
  semitones?: number;
};

function cloneStep(step: MotifStep): MotifStep {
  return { ...step };
}

function getMotifLength(motif: Motif): number {
  return motif.steps.reduce(
    (length, step) => Math.max(length, step.beat + step.length),
    0,
  );
}

function getShift(shift: SequenceShift): { scaleSteps: number; semitones: number } {
  if (typeof shift === "number") {
    return { scaleSteps: shift, semitones: 0 };
  }

  return {
    scaleSteps: shift.scaleSteps ?? 0,
    semitones: shift.semitones ?? 0,
  };
}

export function sequence(
  motif: Motif,
  shift: SequenceShift,
  repetitions: number,
): Motif {
  const { scaleSteps, semitones } = getShift(shift);
  const motifLength = getMotifLength(motif);
  const repeatedSteps: MotifStep[] = [];

  for (let index = 0; index < repetitions; index += 1) {
    for (const step of motif.steps) {
      repeatedSteps.push({
        ...cloneStep(step),
        beat: step.beat + motifLength * index,
        offset: step.offset + scaleSteps * index,
        chromaticOffset: (step.chromaticOffset ?? 0) + semitones * index,
      });
    }
  }

  return {
    anchorDegree: motif.anchorDegree,
    steps: repeatedSteps,
  };
}

export function invertMotif(motif: Motif, axisPitch: number): Motif {
  return {
    anchorDegree: motif.anchorDegree,
    steps: motif.steps.map((step) => {
      const absoluteDegree = motif.anchorDegree + step.offset;
      const invertedDegree = axisPitch * 2 - absoluteDegree;

      return {
        ...cloneStep(step),
        offset: invertedDegree - motif.anchorDegree,
      };
    }),
  };
}

export function retrograde(motif: Motif): Motif {
  const motifLength = getMotifLength(motif);

  return {
    anchorDegree: motif.anchorDegree,
    steps: [...motif.steps]
      .reverse()
      .map((step) => ({
        ...cloneStep(step),
        beat: motifLength - (step.beat + step.length),
      })),
  };
}

export function augmentRhythm(motif: Motif, factor: number): Motif {
  return {
    anchorDegree: motif.anchorDegree,
    steps: motif.steps.map((step) => ({
      ...cloneStep(step),
      beat: step.beat * factor,
      length: step.length * factor,
    })),
  };
}

export function diminishRhythm(motif: Motif, factor: number): Motif {
  return augmentRhythm(motif, 1 / factor);
}

export function displaceRhythm(motif: Motif, beatOffset: number): Motif {
  return {
    anchorDegree: motif.anchorDegree,
    steps: motif.steps.map((step) => ({
      ...cloneStep(step),
      beat: step.beat + beatOffset,
    })),
  };
}

export function displaceRhythmBySpan(
  motif: Motif,
  displacement: Span,
  meter: MeterSpec,
): Motif {
  return displaceRhythm(motif, spanToBeats(displacement, meter));
}

export function makeAnswerPhrase(
  motif: Motif,
  options: AnswerPhraseOptions = {},
): Motif {
  const scaleSteps = options.scaleSteps ?? 3;
  const semitones = options.semitones ?? 0;

  return {
    anchorDegree: motif.anchorDegree + scaleSteps,
    steps: motif.steps.map((step) => ({
      ...cloneStep(step),
      chromaticOffset: (step.chromaticOffset ?? 0) + semitones,
    })),
  };
}

export function motifLength(motif: Motif): number {
  return getMotifLength(motif);
}

```

## /Users/william/Projects/TSinger/src/audio/authoring/patterns.ts

```ts
import type { ChordEvent, SynthName } from "../composition";
import { transpose } from "../theory";
import {
  addSpan,
  scaleSpan,
  spanToBeats,
  type MeterSpec,
  type Position,
  type Span,
} from "./timing";
import type { HarmonyPlanItem, PatternNoteDraft } from "./types";

type ChordPatternOptions = {
  startBeat?: number;
  start?: Position;
  meter?: MeterSpec;
  beats: number;
  order: number[];
  stepLength?: number;
  stepSpan?: Span;
  noteLength?: number;
  noteSpan?: Span;
  velocity?: number;
  pan?: number;
  octaveOffset?: number;
  toneIntent?: PatternNoteDraft["toneIntent"];
  ornament?: boolean;
};

type SighingFigureOptions = {
  startBeat?: number;
  start?: Position;
  meter?: MeterSpec;
  highDegree: number;
  lowDegree: number;
  stepLength?: number;
  stepSpan?: Span;
  noteLength?: number;
  noteSpan?: Span;
  velocity?: number;
  pan?: number;
};

type TurnFigureOptions = {
  startBeat?: number;
  start?: Position;
  meter?: MeterSpec;
  centerDegree: number;
  stepLength?: number;
  stepSpan?: Span;
  noteLength?: number;
  noteSpan?: Span;
  velocity?: number;
  pan?: number;
};

type PentatonicFlourishOptions = {
  startBeat?: number;
  start?: Position;
  meter?: MeterSpec;
  degrees: number[];
  stepLength?: number;
  stepSpan?: Span;
  noteLength?: number;
  noteSpan?: Span;
  velocity?: number;
  pan?: number;
  ornament?: boolean;
};

type BassPulseOptions = {
  harmony: HarmonyPlanItem[];
  beatsPerBar: number;
  pattern?: Array<{
    beatOffset: number;
    intervalSemitones?: number;
    velocity?: number;
    length?: number;
  }>;
  octaveShift?: number;
};

type BellAccentOptions = {
  accents: Array<{
    beat?: number;
    at?: Position;
    pitch?: string;
    degree?: number;
    length?: number;
    duration?: Span;
    velocity?: number;
    pan?: number;
    ornament?: boolean;
  }>;
};

type PadChordOptions = {
  harmony: HarmonyPlanItem[];
  beatsPerBar: number;
  synth: SynthName;
  velocityScale?: number;
};

function getStartBeat(options: { startBeat?: number }): number {
  return options.startBeat ?? 0;
}

function getStepBeats(stepLength: number | undefined, stepSpan: Span | undefined, meter?: MeterSpec): number {
  if (stepSpan) {
    if (!meter) {
      throw new Error("A meter is required when stepSpan is used.");
    }
    return spanToBeats(stepSpan, meter);
  }

  return stepLength ?? 0.5;
}

function getStartPlacement(
  start: Position | undefined,
  startBeat: number | undefined,
  meter: MeterSpec | undefined,
  offsetBeats: number,
  offsetSpan?: Span,
): Pick<PatternNoteDraft, "beat" | "at"> {
  if (start) {
    if (!meter) {
      throw new Error("A meter is required when a symbolic start position is used.");
    }
    return {
      beat: 0,
      at: addSpan(
        start,
        offsetSpan ?? { beats: offsetBeats },
        meter,
      ),
    };
  }

  return {
    beat: getStartBeat({ startBeat }) + offsetBeats,
  };
}

export function arpeggiateChord({
  startBeat = 0,
  start,
  meter,
  beats,
  order,
  stepLength = 0.5,
  stepSpan,
  noteLength = stepLength * 0.9,
  noteSpan,
  velocity = 0.5,
  pan = 0,
  octaveOffset = 0,
  toneIntent = "chord",
  ornament = false,
}: ChordPatternOptions): PatternNoteDraft[] {
  const resolvedStepLength = getStepBeats(stepLength, stepSpan, meter);
  return order
    .filter((_, index) => index * resolvedStepLength < beats)
    .map((chordDegree, index) => {
      const note = {
        ...getStartPlacement(
          start,
          startBeat,
          meter,
          index * resolvedStepLength,
          stepSpan ? scaleSpan(stepSpan, index) : undefined,
        ),
        length: noteLength,
        chordDegree,
        velocity,
        pan,
        octaveOffset,
        toneIntent,
        ornament,
      } satisfies PatternNoteDraft;

      return noteSpan ? { ...note, duration: noteSpan, length: 0 } : note;
    });
}

export function brokenTriad(
  options: Omit<ChordPatternOptions, "order"> & { order?: number[] },
): PatternNoteDraft[] {
  return arpeggiateChord({
    ...options,
    order: options.order ?? [0, 1, 2, 1],
  });
}

export function sighingFigure({
  startBeat = 0,
  start,
  meter,
  highDegree,
  lowDegree,
  stepLength = 0.5,
  stepSpan,
  noteLength = stepLength * 0.9,
  noteSpan,
  velocity = 0.5,
  pan = 0,
}: SighingFigureOptions): PatternNoteDraft[] {
  const first = {
    ...getStartPlacement(start, startBeat, meter, 0),
    length: noteLength,
    degree: highDegree,
    velocity,
    pan,
    toneIntent: "scale",
  } satisfies PatternNoteDraft;
  const second = {
    ...getStartPlacement(
      start,
      startBeat,
      meter,
      stepLength,
      stepSpan,
    ),
    length: noteLength,
    degree: lowDegree,
    velocity: velocity * 0.92,
    pan,
    toneIntent: "scale",
  } satisfies PatternNoteDraft;

  return [
    noteSpan ? { ...first, duration: noteSpan, length: 0 } : first,
    noteSpan ? { ...second, duration: noteSpan, length: 0 } : second,
  ];
}

export function turnFigure({
  startBeat = 0,
  start,
  meter,
  centerDegree,
  stepLength = 0.25,
  stepSpan,
  noteLength = stepLength * 0.9,
  noteSpan,
  velocity = 0.44,
  pan = 0,
}: TurnFigureOptions): PatternNoteDraft[] {
  const steps: Array<Pick<PatternNoteDraft, "degree" | "velocity" | "pan" | "toneIntent" | "ornament">> = [
    { degree: centerDegree + 1, velocity, pan, toneIntent: "scale", ornament: true },
    { degree: centerDegree, velocity: velocity * 0.96, pan, toneIntent: "scale", ornament: true },
    { degree: centerDegree - 1, velocity: velocity * 0.92, pan, toneIntent: "scale", ornament: true },
    { degree: centerDegree, velocity: velocity * 0.9, pan, toneIntent: "scale", ornament: true },
  ];

  return steps.map((step, index) => {
    const note = {
      ...getStartPlacement(
        start,
        startBeat,
        meter,
        stepLength * index,
        stepSpan ? scaleSpan(stepSpan, index) : undefined,
      ),
      length: noteLength,
      ...step,
    } satisfies PatternNoteDraft;

    return noteSpan ? { ...note, duration: noteSpan, length: 0 } : note;
  });
}

export function pentatonicFlourish({
  startBeat = 0,
  start,
  meter,
  degrees,
  stepLength = 0.5,
  stepSpan,
  noteLength = stepLength * 0.9,
  noteSpan,
  velocity = 0.54,
  pan = 0,
  ornament = false,
}: PentatonicFlourishOptions): PatternNoteDraft[] {
  return degrees.map((degree, index) => ({
    ...getStartPlacement(
      start,
      startBeat,
      meter,
      index * stepLength,
      stepSpan ? scaleSpan(stepSpan, index) : undefined,
    ),
    length: noteSpan ? 0 : noteLength,
    duration: noteSpan,
    degree,
    velocity: velocity - index * 0.01,
    pan,
    toneIntent: "scale",
    ornament,
  }));
}

export function pulseBass({
  harmony,
  beatsPerBar,
  pattern = [
    { beatOffset: 0, intervalSemitones: 0, velocity: 0.46, length: 0.3 },
    { beatOffset: 2, intervalSemitones: 7, velocity: 0.34, length: 0.26 },
  ],
  octaveShift = -12,
}: BassPulseOptions): PatternNoteDraft[] {
  const notes: PatternNoteDraft[] = [];

  for (const chord of harmony) {
    const barStartBeat = chord.bar * beatsPerBar;

    for (const pulse of pattern) {
      const pitch = transpose(
        chord.root,
        octaveShift + (pulse.intervalSemitones ?? 0),
      );
      notes.push({
        beat: barStartBeat + pulse.beatOffset,
        length: pulse.length ?? 0.3,
        pitch,
        velocity: pulse.velocity ?? 0.4,
        toneIntent: "chord",
      });
    }
  }

  return notes;
}

export function sparseBellAccents({
  accents,
}: BellAccentOptions): PatternNoteDraft[] {
  return accents.map((accent) => ({
    beat: accent.at ? 0 : accent.beat ?? 0,
    at: accent.at,
    length: accent.duration ? 0 : accent.length ?? 0.9,
    duration: accent.duration,
    pitch: accent.pitch,
    degree: accent.degree,
    velocity: accent.velocity ?? 0.14,
    pan: accent.pan ?? 0,
    toneIntent: "color",
    ornament: accent.ornament ?? false,
  }));
}

export function padChordHolds({
  harmony,
  beatsPerBar,
  synth,
  velocityScale = 1,
}: PadChordOptions): ChordEvent[] {
  return harmony.map((item, index) => {
    const nextBar = harmony[index + 1]?.bar;
    const lengthBars = item.lengthBars ?? (nextBar !== undefined ? nextBar - item.bar : 1);

    return {
      beat: item.bar * beatsPerBar,
      length: lengthBars * beatsPerBar,
      root: item.root,
      quality: item.quality,
      synth,
      velocity: (item.velocity ?? 0.22) * velocityScale,
      inversion: item.inversion,
      spread: item.spread,
    };
  });
}

```

## /Users/william/Projects/TSinger/src/audio/authoring/index.ts

```ts
export * from "./arrangement";
export * from "./compile";
export * from "./harmony";
export * from "./motifs";
export * from "./offline";
export * from "./patterns";
export * from "./timing";
export * from "./types";
export * from "./voiceLeading";

```

## /Users/william/Projects/TSinger/src/audio/composition.ts

```ts
import type { CompiledSection, SectionRole, VoiceId } from "./metadata";
import type { TimingMetadata } from "./authoring/timing";

export type SynthName =
  | "softLead"
  | "glassBell"
  | "warmPad"
  | "roundBass"
  | "breathingDrone"
  | "pluckyDust";

export type ChordQuality =
  | "major"
  | "minor"
  | "sus2"
  | "sus4"
  | "major7"
  | "minor7"
  | "add9"
  | "minorAdd9";

export type NoteEvent = {
  beat: number;
  length: number;
  pitch: string;
  synth: SynthName;
  velocity?: number;
  glideTo?: string;
  pan?: number;
  voiceId?: VoiceId;
  layerId?: string;
  sectionId?: string;
  sectionRole?: SectionRole;
};

export type ChordEvent = {
  beat: number;
  length: number;
  root: string;
  quality: ChordQuality;
  synth: SynthName;
  velocity?: number;
  inversion?: number;
  spread?: number;
  voiceId?: VoiceId;
  layerId?: string;
  sectionId?: string;
  sectionRole?: SectionRole;
};

export type Phrase = {
  bars: number;
  notes: NoteEvent[];
  chords: ChordEvent[];
};

export type Composition = {
  id: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  key: {
    root: string;
    scale: string;
  };
  phrase: Phrase;
  loop: boolean;
  sections?: CompiledSection[];
  timing?: TimingMetadata;
};

```

## /Users/william/Projects/TSinger/src/audio/presets/helpers.ts

```ts
import {
  addSpan,
  spanToBeats,
  type MeterSpec,
  type Span,
} from "../authoring/timing";
import type { Motif, MotifStep, PatternNoteDraft, VoiceId } from "../authoring/types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mapMotifSteps(
  motif: Motif,
  mapper: (step: MotifStep, index: number) => MotifStep,
): Motif {
  return {
    anchorDegree: motif.anchorDegree,
    steps: motif.steps.map((step, index) => mapper({ ...step }, index)),
  };
}

export function scaleMotifVelocities(motif: Motif, scale: number): Motif {
  return mapMotifSteps(motif, (step) => ({
    ...step,
    velocity:
      step.velocity !== undefined
        ? clamp(step.velocity * scale, 0.04, 1)
        : step.velocity,
  }));
}

export function placeDraftNotes(
  notes: PatternNoteDraft[],
  options: {
    beatOffset?: number;
    spanOffset?: Span;
    meter?: MeterSpec;
    velocityScale?: number;
    panShift?: number;
    lengthScale?: number;
  } = {},
): PatternNoteDraft[] {
  const {
    beatOffset = 0,
    spanOffset,
    meter,
    velocityScale = 1,
    panShift = 0,
    lengthScale = 1,
  } = options;
  const symbolicBeatOffset =
    spanOffset && meter ? spanToBeats(spanOffset, meter) : 0;

  return notes.map((note) => ({
    ...note,
    beat: note.beat + beatOffset + symbolicBeatOffset,
    at: note.at && spanOffset && meter ? addSpan(note.at, spanOffset, meter) : note.at,
    length: note.length * lengthScale,
    velocity:
      note.velocity !== undefined
        ? clamp(note.velocity * velocityScale, 0.04, 1)
        : note.velocity,
    pan: note.pan !== undefined ? note.pan + panShift : note.pan,
  }));
}

export function withVoiceId<T>(
  voiceId: VoiceId,
  items: T[],
): Array<T & { voiceId: VoiceId }> {
  return items.map((item) => ({
    ...item,
    voiceId:
      item && typeof item === "object" && "voiceId" in (item as object)
        ? ((item as { voiceId?: VoiceId }).voiceId ?? voiceId)
        : voiceId,
  }));
}

```

## /Users/william/Projects/TSinger/src/audio/presets/glassGarden.ts

```ts
import { compilePhrasePlan } from "../authoring/compile";
import {
  displaceRhythm,
  makeAnswerPhrase,
  retrograde,
} from "../authoring/motifs";
import { arpeggiateChord, sparseBellAccents } from "../authoring/patterns";
import {
  cadenceBeat,
  pickupBefore,
  positionAtBarBeat,
  repeatAcrossBars,
  span,
  withPosition,
} from "../authoring/timing";
import type {
  HarmonyPlanItem,
  Motif,
  PatternNoteDraft,
  PhrasePlan,
} from "../authoring/types";
import type { Composition } from "../composition";
import {
  mapMotifSteps,
  scaleMotifVelocities,
  withVoiceId,
} from "./helpers";

const GLASS_BPM = 72;
const GLASS_BEATS_PER_BAR = 3;
const GLASS_MASTER_BARS = 16;
const GLASS_PART_BARS = 4;
const GLASS_METER = {
  beatsPerBar: GLASS_BEATS_PER_BAR,
  beatUnit: 4,
} as const;

function glassPartStart(index: number): number {
  return index * GLASS_PART_BARS * GLASS_BEATS_PER_BAR;
}

function buildComposition(params: {
  id: string;
  title: string;
  key: Composition["key"];
  bpm: number;
  beatsPerBar: number;
  plan: PhrasePlan;
}): Composition {
  const phrase = compilePhrasePlan(params.plan);

  return {
    id: params.id,
    title: params.title,
    bpm: params.bpm,
    beatsPerBar: params.beatsPerBar,
    key: params.key,
    loop: true,
    sections: phrase.sections.length > 0 ? phrase.sections : undefined,
    phrase: {
      bars: params.plan.bars,
      notes: phrase.notes,
      chords: phrase.chords,
    },
    timing: phrase.timing,
  };
}

const glassSubject: Motif = {
  anchorDegree: 1,
  steps: [
    { beat: 0, length: 0.9, offset: 0, velocity: 0.58, pan: 0.08, toneIntent: "chord" },
    { beat: 1, length: 0.45, offset: 2, velocity: 0.62, pan: 0.08, toneIntent: "chord" },
    { beat: 1.5, length: 0.4, offset: 1, velocity: 0.52, pan: 0.06, toneIntent: "passing" },
    { beat: 2, length: 0.95, offset: 0, velocity: 0.58, pan: 0.04, toneIntent: "chord" },
  ],
};

const glassResponse: Motif = {
  anchorDegree: 4,
  steps: [
    { beat: 0, length: 0.88, offset: 1, velocity: 0.56, pan: 0.08, toneIntent: "chord" },
    { beat: 1, length: 0.42, offset: 0, velocity: 0.56, pan: 0.06, toneIntent: "chord" },
    { beat: 1.5, length: 0.36, offset: -1, velocity: 0.48, pan: 0.04, toneIntent: "passing" },
    { beat: 2, length: 1.08, offset: -3, velocity: 0.58, pan: 0.02, toneIntent: "chord" },
  ],
};

const glassDominantFigure: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.7,
      offset: 2,
      chromaticOffset: 1,
      velocity: 0.58,
      pan: 0.08,
      toneIntent: "chord",
    },
    { beat: 1, length: 0.45, offset: 4, velocity: 0.58, pan: 0.08, toneIntent: "chord" },
    {
      beat: 1.5,
      length: 0.4,
      offset: 2,
      chromaticOffset: 1,
      velocity: 0.5,
      pan: 0.06,
      toneIntent: "chord",
    },
    { beat: 2, length: 1, offset: 0, velocity: 0.56, pan: 0.04, toneIntent: "chord" },
  ],
};

const glassLanternFigure: Motif = {
  anchorDegree: 6,
  steps: [
    { beat: 0, length: 0.8, offset: 2, velocity: 0.54, pan: 0.08, toneIntent: "chord" },
    { beat: 1, length: 0.45, offset: 1, velocity: 0.5, pan: 0.06, toneIntent: "color" },
    { beat: 1.5, length: 0.4, offset: 0, velocity: 0.5, pan: 0.04, toneIntent: "chord" },
    { beat: 2, length: 0.95, offset: -2, velocity: 0.54, pan: 0.02, toneIntent: "chord" },
  ],
};

const glassPredominantFigure: Motif = {
  anchorDegree: 4,
  steps: [
    { beat: 0, length: 0.8, offset: 4, velocity: 0.54, pan: 0.08, toneIntent: "chord" },
    { beat: 1, length: 0.45, offset: 2, velocity: 0.52, pan: 0.06, toneIntent: "chord" },
    { beat: 1.5, length: 0.4, offset: 1, velocity: 0.48, pan: 0.04, toneIntent: "passing" },
    { beat: 2, length: 0.95, offset: 0, velocity: 0.54, pan: 0.02, toneIntent: "chord" },
  ],
};

const glassFinalCadence: Motif = {
  anchorDegree: 1,
  steps: [
    { beat: 0, length: 0.82, offset: 0, velocity: 0.58, pan: 0.08, toneIntent: "chord" },
    { beat: 1, length: 0.38, offset: 2, velocity: 0.58, pan: 0.08, toneIntent: "chord" },
    { beat: 1.5, length: 0.32, offset: 1, velocity: 0.46, pan: 0.05, toneIntent: "passing" },
    { beat: 2, length: 1.2, offset: 0, velocity: 0.62, pan: 0.04, toneIntent: "chord" },
  ],
};

const glassReturnSubject = scaleMotifVelocities(
  mapMotifSteps(glassSubject, (step, index) => ({
    ...step,
    length: index === 0 ? 1.02 : index === 3 ? 1.04 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 1.04 : 1.02)
        : step.velocity,
  })),
  1.04,
);

const glassReturnResponse = scaleMotifVelocities(
  mapMotifSteps(glassResponse, (step, index) => ({
    ...step,
    length: index === 3 ? 1.1 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 1.02 : 1.06)
        : step.velocity,
  })),
  1.02,
);

const glassBloomFigure = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(glassLanternFigure, { scaleSteps: 1 }), (step, index) => ({
    ...step,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 1 ? 0.92 : 1.02)
        : step.velocity,
  })),
  0.96,
);

const glassBloomCadence = scaleMotifVelocities(
  mapMotifSteps(glassFinalCadence, (step, index) => ({
    ...step,
    length: index === 3 ? 1.05 : step.length,
  })),
  0.98,
);

const glassShadowSubject = scaleMotifVelocities(retrograde(glassSubject), 0.82);
const glassShadowResponse = scaleMotifVelocities(
  mapMotifSteps(retrograde(glassResponse), (step, index) => ({
    ...step,
    length: index === 0 ? step.length + 0.16 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.9 : 0.84)
        : step.velocity,
  })),
  0.82,
);
const glassShadowPredominant = scaleMotifVelocities(
  mapMotifSteps(retrograde(glassPredominantFigure), (step, index) => ({
    ...step,
    length: index === 0 ? step.length + 0.12 : step.length,
    pan: (step.pan ?? 0) - 0.04,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.92 : 0.86)
        : step.velocity,
  })),
  0.86,
);

const glassShadowSuspension: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.84,
      offset: 1,
      chromaticOffset: 1,
      velocity: 0.46,
      pan: 0.02,
      toneIntent: "chord",
    },
    {
      beat: 1.75,
      length: 1.18,
      offset: -1,
      velocity: 0.42,
      pan: -0.04,
      toneIntent: "scale",
    },
  ],
};

function buildGlassBaselineHarmony(): HarmonyPlanItem[] {
  return [
    { bar: 0, root: "A3", quality: "minor7", velocity: 0.19, spread: 0.01 },
    { bar: 1, root: "D4", quality: "minor7", velocity: 0.18, spread: 0.01 },
    { bar: 2, root: "E3", quality: "major", velocity: 0.19, spread: 0.01 },
    { bar: 3, root: "A3", quality: "minor7", velocity: 0.2, spread: 0.01 },
    { bar: 4, root: "F3", quality: "major7", velocity: 0.18, spread: 0.01 },
    { bar: 5, root: "D4", quality: "minor7", velocity: 0.18, spread: 0.01 },
    { bar: 6, root: "E3", quality: "major", velocity: 0.19, spread: 0.01 },
    { bar: 7, root: "A3", quality: "minor7", velocity: 0.2, spread: 0.01 },
  ];
}

function buildGlassBaselineBass(harmony: HarmonyPlanItem[]): PatternNoteDraft[] {
  return harmony.flatMap((item) =>
    arpeggiateChord({
      startBeat: item.bar * GLASS_BEATS_PER_BAR,
      beats: GLASS_BEATS_PER_BAR,
      order: [0, 2, 1],
      stepLength: 1,
      noteLength: 0.42,
      velocity: item.quality === "major" ? 0.4 : 0.42,
      octaveOffset: -1,
      toneIntent: "chord",
    }),
  );
}

function buildGlassGardenBaselinePlan(): PhrasePlan {
  const harmony = buildGlassBaselineHarmony();
  const counterpoint = [
    ...arpeggiateChord({
      startBeat: 4,
      beats: 1.9,
      order: [2, 1, 0],
      stepLength: 1,
      noteLength: 0.66,
      velocity: 0.21,
      toneIntent: "chord",
    }),
    ...arpeggiateChord({
      startBeat: 6.5,
      beats: 2.6,
      order: [0, 1, 2],
      stepLength: 1,
      noteLength: 0.72,
      velocity: 0.24,
      toneIntent: "chord",
    }),
    ...arpeggiateChord({
      startBeat: 12.5,
      beats: 2.6,
      order: [2, 1, 0],
      stepLength: 1,
      noteLength: 0.72,
      velocity: 0.22,
      toneIntent: "chord",
    }),
    ...arpeggiateChord({
      startBeat: 16,
      beats: 1.9,
      order: [2, 1, 0],
      stepLength: 1,
      noteLength: 0.66,
      velocity: 0.2,
      toneIntent: "chord",
    }),
    ...arpeggiateChord({
      startBeat: 19,
      beats: 1.9,
      order: [0, 1, 2],
      stepLength: 1,
      noteLength: 0.72,
      velocity: 0.21,
      toneIntent: "chord",
    }),
  ];
  const bells = sparseBellAccents({
    accents: [
      { beat: 0, pitch: "E6", length: 0.72, velocity: 0.11, pan: 0.12 },
      { beat: 9, pitch: "E6", length: 0.7, velocity: 0.11, pan: -0.1 },
      { beat: 22.25, pitch: "E6", length: 0.8, velocity: 0.12, pan: 0.12 },
    ],
  });

  return {
    bars: 8,
    beatsPerBar: GLASS_BEATS_PER_BAR,
    key: { root: "A", scale: "minor" },
    harmony,
    padLayers: [{ synth: "warmPad", velocityScale: 0.88 }],
    arrangement: {
      densityCurve: [
        { beat: 0, value: 0.72 },
        { beat: 9, value: 0.8 },
        { beat: 18, value: 0.84 },
        { beat: 24, value: 0.76 },
      ],
      registerCurve: [
        { beat: 0, value: -0.05 },
        { beat: 9, value: 0.08 },
        { beat: 18, value: 0.12 },
        { beat: 24, value: 0 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.48 },
        { beat: 9, value: 0.54 },
        { beat: 21, value: 0.58 },
        { beat: 24, value: 0.5 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.28 },
        { beat: 6, value: 0.72 },
        { beat: 8.5, value: 0.92 },
        { beat: 18, value: 0.76 },
        { beat: 23, value: 1 },
      ],
      ornamentBaseProbability: 0.18,
    },
    noteLayers: [
      {
        kind: "motif",
        id: "glass-subject-a",
        synth: "softLead",
        motif: glassSubject,
        beatOffset: 0,
        register: { min: "E5", max: "C6", anchor: "A5" },
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "glass-response",
        synth: "softLead",
        motif: glassResponse,
        beatOffset: 3,
        register: { min: "F5", max: "D6", anchor: "A5" },
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "glass-dominant-a",
        synth: "softLead",
        motif: glassDominantFigure,
        beatOffset: 6,
        register: { min: "E5", max: "B5", anchor: "G#5" },
        clampToHarmony: false,
      },
      {
        kind: "motif",
        id: "glass-cadence-a",
        synth: "softLead",
        motif: glassSubject,
        beatOffset: 9,
        register: { min: "E5", max: "C6", anchor: "A5" },
        velocityScale: 0.98,
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "glass-lantern",
        synth: "softLead",
        motif: glassLanternFigure,
        beatOffset: 12,
        register: { min: "E5", max: "C6", anchor: "A5" },
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "glass-predominant",
        synth: "softLead",
        motif: glassPredominantFigure,
        beatOffset: 15,
        register: { min: "D5", max: "A5", anchor: "A5" },
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "glass-dominant-b",
        synth: "softLead",
        motif: glassDominantFigure,
        beatOffset: 18,
        register: { min: "E5", max: "B5", anchor: "G#5" },
        velocityScale: 1.02,
        clampToHarmony: false,
      },
      {
        kind: "motif",
        id: "glass-cadence-b",
        synth: "softLead",
        motif: glassFinalCadence,
        beatOffset: 21,
        register: { min: "E5", max: "C6", anchor: "A5" },
        velocityScale: 1.04,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "glass-counterpoint",
        synth: "softLead",
        notes: counterpoint,
        register: { min: "A3", max: "E5", anchor: "A4" },
        velocityScale: 0.86,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "glass-bass",
        synth: "roundBass",
        notes: buildGlassBaselineBass(harmony),
        register: { min: "E2", max: "F3", anchor: "A2" },
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "glass-bells",
        synth: "glassBell",
        notes: bells,
        register: { min: "C6", max: "A6", anchor: "A6" },
        clampToHarmony: false,
      },
    ],
  };
}

const glassMasterStatement = mapMotifSteps(glassSubject, (step, index) => ({
  ...step,
  length: index === 3 ? 0.82 : step.length,
}));

const glassMasterAnswer = mapMotifSteps(glassResponse, (step, index) => ({
  ...step,
  length: index === 3 ? 0.88 : step.length,
}));

const glassMasterBloomCall = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(glassSubject, { scaleSteps: 1 }), (step, index) => ({
    ...step,
    length: index === 0 ? 0.98 : index === 3 ? 0.8 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 1 ? 0.92 : 1.02)
        : step.velocity,
  })),
  0.98,
);

const glassMasterBloomAnswer = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(glassResponse, { scaleSteps: 1 }), (step, index) => ({
    ...step,
    length: index === 3 ? 0.84 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.96 : 0.92)
        : step.velocity,
  })),
  0.96,
);

const glassMasterSpiral = scaleMotifVelocities(
  mapMotifSteps(displaceRhythm(glassLanternFigure, 0.15), (step, index) => ({
    ...step,
    length: index === 3 ? 0.7 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 1 ? 0.9 : 0.96)
        : step.velocity,
  })),
  0.94,
);

const glassMasterBloomCadence = scaleMotifVelocities(
  mapMotifSteps(glassFinalCadence, (step, index) => ({
    ...step,
    length: index === 3 ? 0.92 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 3 ? 1.04 : 0.98)
        : step.velocity,
  })),
  1,
);

const glassMasterMirrorSubject = scaleMotifVelocities(
  mapMotifSteps(retrograde(glassSubject), (step, index) => ({
    ...step,
    length: index === 0 ? step.length + 0.16 : index === 3 ? 0.68 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.82 : 0.76)
        : step.velocity,
  })),
  0.8,
);

const glassMasterMirrorAnswer = scaleMotifVelocities(
  mapMotifSteps(retrograde(glassResponse), (step, index) => ({
    ...step,
    length: index === 0 ? step.length + 0.18 : index === 3 ? 0.72 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.84 : 0.78)
        : step.velocity,
  })),
  0.8,
);

const glassMasterVigil: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0.5,
      length: 0.92,
      offset: 1,
      chromaticOffset: 1,
      velocity: 0.46,
      pan: 0.02,
      toneIntent: "chord",
    },
    {
      beat: 1.75,
      length: 0.88,
      offset: 0,
      velocity: 0.4,
      pan: -0.02,
      toneIntent: "scale",
    },
  ],
};

const glassMasterReturnSubject = scaleMotifVelocities(
  mapMotifSteps(glassSubject, (step, index) => ({
    ...step,
    length: index === 0 ? 1.02 : index === 3 ? 0.96 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 1.08 : 1.04)
        : step.velocity,
  })),
  1.06,
);

const glassMasterReturnVow = scaleMotifVelocities(
  mapMotifSteps(glassDominantFigure, (step, index) => ({
    ...step,
    beat: step.beat + (index === 0 ? 0.1 : 0),
    length: index === 3 ? 0.86 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 1 ? 1.06 : 1.02)
        : step.velocity,
  })),
  1.04,
);

const glassMasterCrown: Motif = {
  anchorDegree: 1,
  steps: [
    { beat: 0, length: 0.56, offset: 2, velocity: 0.62, pan: 0.06, toneIntent: "chord" },
    { beat: 0.85, length: 0.34, offset: 1, velocity: 0.5, pan: 0.04, toneIntent: "passing" },
    { beat: 1.5, length: 0.42, offset: 0, velocity: 0.58, pan: 0.04, toneIntent: "chord" },
    { beat: 2, length: 1, offset: 0, velocity: 0.68, pan: 0.02, toneIntent: "chord" },
  ],
};

function buildGlassMasterHarmony(): HarmonyPlanItem[] {
  return [
    { bar: 0, root: "A3", quality: "minorAdd9", velocity: 0.16, spread: 0.01, tag: "statement" },
    { bar: 1, root: "D4", quality: "minor7", velocity: 0.17, spread: 0.01, tag: "statement" },
    { bar: 2, root: "C4", quality: "major", velocity: 0.17, inversion: 1, spread: 0.01, tag: "statement" },
    { bar: 3, root: "E3", quality: "major", velocity: 0.2, spread: 0.01, tag: "statement" },
    { bar: 4, root: "F3", quality: "major7", velocity: 0.18, spread: 0.01, tag: "flowering" },
    { bar: 5, root: "C4", quality: "major", velocity: 0.17, inversion: 1, spread: 0.01, tag: "flowering" },
    { bar: 6, root: "D4", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "flowering" },
    { bar: 7, root: "E3", quality: "major", velocity: 0.2, spread: 0.01, tag: "flowering" },
    { bar: 8, root: "C4", quality: "major7", velocity: 0.14, inversion: 1, spread: 0.01, tag: "shadow" },
    { bar: 9, root: "G3", quality: "sus2", velocity: 0.14, inversion: 1, spread: 0.01, tag: "shadow" },
    { bar: 10, root: "D4", quality: "minor7", velocity: 0.15, spread: 0.01, tag: "shadow" },
    { bar: 11, root: "E3", quality: "major", velocity: 0.17, spread: 0.01, tag: "shadow" },
    { bar: 12, root: "F3", quality: "major7", velocity: 0.17, spread: 0.01, tag: "threshold" },
    { bar: 13, root: "A3", quality: "minor7", velocity: 0.2, spread: 0.01, tag: "return" },
    { bar: 14, root: "E3", quality: "major", velocity: 0.22, spread: 0.01, tag: "return" },
    { bar: 15, root: "A3", quality: "minor7", velocity: 0.24, spread: 0.01, tag: "cadence" },
  ];
}

function buildGlassMasterBass(harmony: HarmonyPlanItem[]): PatternNoteDraft[] {
  return harmony.flatMap((item) => {
    const startBeat = item.bar * GLASS_BEATS_PER_BAR;

    if (item.tag === "shadow") {
      return arpeggiateChord({
        startBeat,
        beats: GLASS_BEATS_PER_BAR,
        order: [0, 2],
        stepLength: 1.5,
        noteLength: 0.6,
        velocity: item.quality === "major" ? 0.26 : 0.28,
        octaveOffset: -1,
        toneIntent: "chord",
      });
    }

    if (item.tag === "threshold") {
      return [
        {
          beat: startBeat,
          length: 1.35,
          pitch: "F2",
          velocity: 0.34,
          toneIntent: "chord",
        },
        {
          beat: startBeat + 1.5,
          length: 1.15,
          pitch: "C3",
          velocity: 0.24,
          toneIntent: "chord",
        },
      ];
    }

    if (item.tag === "cadence") {
      return [
        {
          beat: startBeat,
          length: 0.68,
          pitch: "A2",
          velocity: 0.44,
          toneIntent: "chord",
        },
        {
          beat: startBeat + 1,
          length: 0.46,
          pitch: "E3",
          velocity: 0.28,
          toneIntent: "chord",
        },
        {
          beat: startBeat + 2,
          length: 0.92,
          pitch: "A2",
          velocity: 0.4,
          toneIntent: "chord",
        },
      ];
    }

    if (item.tag === "return") {
      return arpeggiateChord({
        startBeat,
        beats: GLASS_BEATS_PER_BAR,
        order: [0, 1, 2],
        stepLength: 1,
        noteLength: 0.48,
        velocity: item.quality === "major" ? 0.44 : 0.42,
        octaveOffset: -1,
        toneIntent: "chord",
      });
    }

    return arpeggiateChord({
      startBeat,
      beats: GLASS_BEATS_PER_BAR,
      order: [0, 2, 1],
      stepLength: 1,
      noteLength: 0.42,
      velocity: item.quality === "major" ? 0.38 : 0.4,
      octaveOffset: -1,
      toneIntent: "chord",
    });
  });
}

function buildGlassMasterCounterpoint(): PatternNoteDraft[] {
  const counterCell = [
    withPosition(
      {
        pitch: "A4",
        velocity: 0.16,
        pan: -0.06,
        toneIntent: "chord" as const,
      },
      {
        at: positionAtBarBeat(1, 1, 1, 2),
        duration: span(0, 1),
      },
    ),
    withPosition(
      {
        pitch: "G4",
        velocity: 0.15,
        pan: 0.06,
        toneIntent: "scale" as const,
      },
      {
        at: positionAtBarBeat(2, 2, 1, 4),
        duration: span(0, 0, 3, 4),
      },
    ),
  ];

  return [
    ...repeatAcrossBars(counterCell, {
      startBar: 5,
      repetitions: 2,
      everyBars: 8,
      meter: GLASS_METER,
      label: "Counterline figure repeats across the bloom and return.",
    }),
    { beat: glassPartStart(1) + 7, length: 1.08, pitch: "B4", velocity: 0.16, pan: -0.04, toneIntent: "color" },
    withPosition(
      {
        pitch: "F4",
        velocity: 0.14,
        pan: -0.08,
        toneIntent: "chord" as const,
      },
      {
        at: positionAtBarBeat(13, 1),
        duration: span(0, 1),
      },
    ),
  ];
}

function buildGlassUndertow(): PatternNoteDraft[] {
  return [
    { beat: glassPartStart(2), length: 6, pitch: "C4", velocity: 0.05, pan: -0.08, toneIntent: "chord" },
    { beat: glassPartStart(2) + 6, length: 6, pitch: "E3", velocity: 0.05, pan: 0.08, toneIntent: "chord" },
  ];
}

function buildGlassMasterPlan(): PhrasePlan {
  const harmony = buildGlassMasterHarmony();
  const bells = sparseBellAccents({
    accents: [
      { at: positionAtBarBeat(1, 1), pitch: "E6", duration: span(0, 0, 3, 4), velocity: 0.11, pan: 0.12 },
      { at: positionAtBarBeat(5, 2, 1, 2), pitch: "C6", duration: span(0, 0, 3, 4), velocity: 0.09, pan: -0.08 },
      { beat: glassPartStart(2) + 10.5, pitch: "G5", length: 0.66, velocity: 0.07, pan: 0.06 },
      {
        at: pickupBefore(
          { kind: "sectionStart", startBar: 13, bars: 3, sectionId: "glass-return", label: "the return" },
          GLASS_METER,
        ),
        pitch: "E6",
        duration: span(0, 0, 3, 4),
        velocity: 0.1,
        pan: 0.1,
      },
      {
        at: cadenceBeat(
          { kind: "phraseEnd", bars: GLASS_MASTER_BARS, label: "the final cadence" },
          GLASS_METER,
        ),
        pitch: "A6",
        duration: span(0, 1),
        velocity: 0.13,
        pan: 0.14,
      },
    ],
  });
  const leadLayers = withVoiceId("lead", [
    {
      kind: "motif" as const,
      id: "glass-i-call",
      synth: "softLead" as const,
      motif: glassMasterStatement,
      positionOffset: positionAtBarBeat(1, 1),
      register: { min: "E5", max: "C6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-i-answer",
      synth: "softLead" as const,
      motif: glassMasterAnswer,
      positionOffset: positionAtBarBeat(2, 1),
      register: { min: "F5", max: "D6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-i-vigil",
      synth: "softLead" as const,
      motif: glassDominantFigure,
      positionOffset: positionAtBarBeat(3, 1),
      register: { min: "E5", max: "B5", anchor: "G#5" },
      clampToHarmony: false,
    },
    {
      kind: "motif" as const,
      id: "glass-i-close",
      synth: "softLead" as const,
      motif: glassMasterBloomCadence,
      positionOffset: positionAtBarBeat(4, 1),
      register: { min: "E5", max: "C6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-ii-bloom-call",
      synth: "softLead" as const,
      motif: glassMasterBloomCall,
      beatOffset: glassPartStart(1),
      register: { min: "F5", max: "D6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-ii-bloom-answer",
      synth: "softLead" as const,
      motif: glassMasterBloomAnswer,
      beatOffset: glassPartStart(1) + 3,
      register: { min: "E5", max: "D6", anchor: "C6" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-ii-spiral",
      synth: "softLead" as const,
      motif: glassMasterSpiral,
      beatOffset: glassPartStart(1) + 6,
      register: { min: "F5", max: "D6", anchor: "B5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-ii-bloom-close",
      synth: "softLead" as const,
      motif: glassMasterBloomCadence,
      beatOffset: glassPartStart(1) + 9,
      register: { min: "E5", max: "D6", anchor: "A5" },
      velocityScale: 1.02,
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-iii-mirror-call",
      synth: "softLead" as const,
      motif: glassMasterMirrorSubject,
      beatOffset: glassPartStart(2),
      register: { min: "C5", max: "A5", anchor: "E5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-iii-mirror-answer",
      synth: "softLead" as const,
      motif: glassMasterMirrorAnswer,
      beatOffset: glassPartStart(2) + 3,
      register: { min: "B4", max: "G5", anchor: "D5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-iii-vigil",
      synth: "softLead" as const,
      motif: glassMasterVigil,
      beatOffset: glassPartStart(2) + 6,
      register: { min: "C5", max: "A5", anchor: "E5" },
      clampToHarmony: false,
    },
    {
      kind: "motif" as const,
      id: "glass-iv-return-call",
      synth: "softLead" as const,
      motif: glassMasterReturnSubject,
      beatOffset: glassPartStart(3) + 3,
      register: { min: "G5", max: "D6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-iv-return-vow",
      synth: "softLead" as const,
      motif: glassMasterReturnVow,
      beatOffset: glassPartStart(3) + 6,
      register: { min: "F5", max: "C6", anchor: "B5" },
      clampToHarmony: false,
    },
    {
      kind: "motif" as const,
      id: "glass-iv-crown",
      synth: "softLead" as const,
      motif: glassMasterCrown,
      beatOffset: glassPartStart(3) + 9,
      register: { min: "E5", max: "C6", anchor: "A5" },
      clampToHarmony: true,
    },
  ]);

  return {
    bars: GLASS_MASTER_BARS,
    beatsPerBar: GLASS_BEATS_PER_BAR,
    meter: GLASS_METER,
    key: { root: "A", scale: "minor" },
    harmony,
    sections: [
      {
        id: "glass-threshold",
        role: "statement",
        startBar: 0,
        bars: 4,
        bias: {
          density: -0.06,
          register: -0.02,
          brightness: -0.03,
          cadence: 0.98,
        },
        description: "The room states its subject with ceremonial restraint.",
      },
      {
        id: "glass-bloom",
        role: "variation",
        startBar: 4,
        bars: 4,
        bias: {
          density: 0,
          register: 0.08,
          brightness: 0.08,
          cadence: 1.04,
        },
        description: "The same material opens upward and briefly gleams.",
      },
      {
        id: "glass-hollow",
        role: "shadow",
        startBar: 8,
        bars: 4,
        bias: {
          density: -0.18,
          register: -0.16,
          brightness: -0.16,
          cadence: 0.78,
        },
        description: "The motif appears only as a reflection inside the glass.",
      },
      {
        id: "glass-return",
        role: "return",
        startBar: 12,
        bars: 3,
        bias: {
          density: -0.02,
          register: 0.12,
          brightness: 0.1,
          cadence: 1.18,
        },
        description: "The return is withheld, then reclaimed at full height.",
      },
      {
        id: "glass-seal",
        role: "cadence",
        startBar: 15,
        bars: 1,
        bias: {
          density: -0.1,
          register: 0.06,
          brightness: 0.08,
          cadence: 1.34,
        },
        description: "The door finally closes on A.",
      },
    ],
    padLayers: [{ synth: "warmPad", voiceId: "pad", velocityScale: 0.82 }],
    arrangement: {
      densityCurve: [
        { at: positionAtBarBeat(1, 1), beat: 0, value: 0.52 },
        { at: positionAtBarBeat(5, 1), beat: glassPartStart(1), value: 0.62 },
        { at: positionAtBarBeat(9, 1), beat: glassPartStart(2), value: 0.18 },
        { at: positionAtBarBeat(13, 1), beat: glassPartStart(3), value: 0.7 },
        { beat: GLASS_MASTER_BARS * GLASS_BEATS_PER_BAR, value: 0.54 },
      ],
      registerCurve: [
        { beat: 0, value: -0.04 },
        { beat: glassPartStart(1), value: 0.08 },
        { beat: glassPartStart(2), value: -0.18 },
        { beat: glassPartStart(3), value: 0.2 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.42 },
        { beat: glassPartStart(1), value: 0.56 },
        { beat: glassPartStart(2), value: 0.24 },
        { beat: glassPartStart(3), value: 0.66 },
        { beat: GLASS_MASTER_BARS * GLASS_BEATS_PER_BAR, value: 0.46 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.2 },
        { beat: glassPartStart(0) + 8.5, value: 0.7 },
        { beat: glassPartStart(1) + 8.5, value: 0.82 },
        { beat: glassPartStart(2) + 8.5, value: 0.4 },
        { beat: glassPartStart(3) + 5.5, value: 0.88 },
        {
          at: cadenceBeat(
            { kind: "phraseEnd", bars: GLASS_MASTER_BARS, label: "the final cadence" },
            GLASS_METER,
          ),
          beat: glassPartStart(3) + 8.5,
          value: 1.1,
        },
      ],
      ornamentBaseProbability: 0.12,
    },
    noteLayers: [
      ...leadLayers,
      {
        kind: "draft",
        id: "glass-master-counterpoint",
        synth: "softLead",
        voiceId: "counterline",
        notes: buildGlassMasterCounterpoint(),
        register: { min: "A3", max: "E5", anchor: "A4" },
        velocityScale: 0.82,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "glass-master-bass",
        synth: "roundBass",
        voiceId: "bass",
        notes: buildGlassMasterBass(harmony),
        register: { min: "E2", max: "F3", anchor: "A2" },
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "glass-undertow",
        synth: "breathingDrone",
        voiceId: "drone",
        notes: buildGlassUndertow(),
        register: { min: "C3", max: "E4", anchor: "C4" },
        velocityScale: 0.88,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "glass-master-bells",
        synth: "glassBell",
        voiceId: "bells",
        notes: bells,
        register: { min: "G5", max: "A6", anchor: "E6" },
        clampToHarmony: false,
      },
    ],
  };
}

export const glassGardenBaseline: Composition = buildComposition({
  id: "glass-garden-baseline",
  title: "Glass Garden (Baseline)",
  key: { root: "A", scale: "minor" },
  bpm: GLASS_BPM,
  beatsPerBar: GLASS_BEATS_PER_BAR,
  plan: buildGlassGardenBaselinePlan(),
});

export const glassGarden: Composition = buildComposition({
  id: "glass-garden",
  title: "Glass Garden",
  key: { root: "A", scale: "minor" },
  bpm: GLASS_BPM,
  beatsPerBar: GLASS_BEATS_PER_BAR,
  plan: buildGlassMasterPlan(),
});

```

## /Users/william/Projects/TSinger/src/audio/presets/paperLanterns.ts

```ts
import { compilePhrasePlan } from "../authoring/compile";
import { makeAnswerPhrase } from "../authoring/motifs";
import {
  pulseBass,
  sighingFigure,
  sparseBellAccents,
  turnFigure,
} from "../authoring/patterns";
import {
  cadenceBeat,
  pickupBefore,
  positionAtBarBeat,
  repeatAcrossBars,
  span,
  withPosition,
} from "../authoring/timing";
import type {
  HarmonyPlanItem,
  Motif,
  PatternNoteDraft,
  PhrasePlan,
} from "../authoring/types";
import type { Composition } from "../composition";
import {
  mapMotifSteps,
  placeDraftNotes,
  scaleMotifVelocities,
  withVoiceId,
} from "./helpers";

const LANTERN_BPM = 88;
const LANTERN_BEATS_PER_BAR = 4;
const LANTERN_MASTER_BARS = 16;
const LANTERN_PART_BARS = 4;
const LANTERN_METER = {
  beatsPerBar: LANTERN_BEATS_PER_BAR,
  beatUnit: 4,
} as const;

function lanternPartStart(index: number): number {
  return index * LANTERN_PART_BARS * LANTERN_BEATS_PER_BAR;
}

function buildComposition(params: {
  id: string;
  title: string;
  key: Composition["key"];
  bpm: number;
  beatsPerBar: number;
  plan: PhrasePlan;
}): Composition {
  const phrase = compilePhrasePlan(params.plan);

  return {
    id: params.id,
    title: params.title,
    bpm: params.bpm,
    beatsPerBar: params.beatsPerBar,
    key: params.key,
    loop: true,
    sections: phrase.sections.length > 0 ? phrase.sections : undefined,
    phrase: {
      bars: params.plan.bars,
      notes: phrase.notes,
      chords: phrase.chords,
    },
    timing: phrase.timing,
  };
}

const lanternCall: Motif = {
  anchorDegree: 4,
  steps: [
    { beat: 0, length: 0.52, offset: 0, velocity: 0.66, pan: -0.08, toneIntent: "chord" },
    { beat: 0.75, length: 0.34, offset: 0, velocity: 0.58, pan: 0.02, toneIntent: "chord" },
    { beat: 1.5, length: 0.62, offset: 2, velocity: 0.72, pan: 0.08, toneIntent: "chord" },
    { beat: 2.5, length: 0.36, offset: 1, velocity: 0.58, pan: 0.02, toneIntent: "scale" },
    { beat: 3.25, length: 0.82, offset: -1, velocity: 0.62, pan: 0.08, toneIntent: "chord" },
  ],
};

const lanternResponse: Motif = {
  anchorDegree: 3,
  steps: [
    { beat: 0, length: 0.46, offset: 0, velocity: 0.6, pan: -0.06, toneIntent: "chord" },
    { beat: 0.75, length: 0.34, offset: 1, velocity: 0.58, pan: 0.02, toneIntent: "scale" },
    { beat: 1.5, length: 0.46, offset: 0, velocity: 0.56, pan: 0.06, toneIntent: "chord" },
    { beat: 2.5, length: 0.4, offset: -1, velocity: 0.56, pan: 0.02, toneIntent: "scale" },
    { beat: 3.25, length: 0.96, offset: -2, velocity: 0.64, pan: 0.08, toneIntent: "chord" },
  ],
};

const lanternLift: Motif = {
  anchorDegree: 5,
  steps: [
    { beat: 0, length: 0.44, offset: 0, velocity: 0.62, pan: -0.08, toneIntent: "chord" },
    { beat: 0.75, length: 0.38, offset: 1, velocity: 0.64, pan: 0.04, toneIntent: "chord" },
    { beat: 1.5, length: 0.68, offset: 3, velocity: 0.66, pan: 0.08, toneIntent: "color" },
    { beat: 2.5, length: 0.34, offset: 2, velocity: 0.58, pan: 0.02, toneIntent: "scale" },
    { beat: 3.25, length: 0.82, offset: 1, velocity: 0.62, pan: 0.08, toneIntent: "chord" },
  ],
};

const lanternHalfCadence: Motif = {
  anchorDegree: 2,
  steps: [
    { beat: 0, length: 0.44, offset: 0, velocity: 0.64, pan: 0.08, toneIntent: "chord" },
    { beat: 0.75, length: 0.36, offset: -1, velocity: 0.6, pan: 0.02, toneIntent: "scale" },
    { beat: 1.75, length: 0.48, offset: 2, velocity: 0.58, pan: 0.04, toneIntent: "scale" },
    { beat: 2.5, length: 0.34, offset: 3, velocity: 0.62, pan: -0.02, toneIntent: "chord" },
    { beat: 3.25, length: 0.9, offset: 3, velocity: 0.72, pan: 0.06, toneIntent: "chord" },
  ],
};

const lanternFinalCadence: Motif = {
  anchorDegree: 2,
  steps: [
    { beat: 0, length: 0.44, offset: 0, velocity: 0.64, pan: 0.08, toneIntent: "scale" },
    { beat: 0.75, length: 0.34, offset: -1, velocity: 0.6, pan: 0.02, toneIntent: "chord" },
    { beat: 1.75, length: 0.42, offset: 2, velocity: 0.56, pan: 0.04, toneIntent: "scale" },
    { beat: 2.5, length: 0.34, offset: 0, velocity: 0.58, pan: -0.02, toneIntent: "chord" },
    { beat: 3.25, length: 1.3, offset: -1, velocity: 0.78, pan: 0.06, toneIntent: "chord" },
  ],
};

const lanternBloomCall = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(lanternCall, { scaleSteps: 1 }), (step, index) => ({
    ...step,
    length: index === 4 ? step.length + 0.12 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 2 ? 0.98 : index === 4 ? 1 : 0.94)
        : step.velocity,
  })),
  0.98,
);

const lanternBloomResponse = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(lanternResponse, { scaleSteps: 1 }), (step, index) => ({
    ...step,
    length: index === 4 ? step.length + 0.12 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 4 ? 0.98 : 0.94)
        : step.velocity,
  })),
  0.96,
);

const lanternBloomLift = scaleMotifVelocities(
  mapMotifSteps(lanternLift, (step, index) => ({
    ...step,
    length: index === 2 ? step.length + 0.08 : index === 4 ? 0.92 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 2 ? 0.9 : 0.94)
        : step.velocity,
  })),
  0.96,
);

const lanternDriftResponse: Motif = {
  anchorDegree: 3,
  steps: [
    { beat: 0.5, length: 0.46, offset: 0, velocity: 0.5, pan: -0.04, toneIntent: "chord" },
    { beat: 1.75, length: 0.36, offset: -1, velocity: 0.48, pan: 0.02, toneIntent: "scale" },
    { beat: 3.0, length: 0.94, offset: -2, velocity: 0.56, pan: 0.08, toneIntent: "chord" },
  ],
};

const lanternDriftCall: Motif = {
  anchorDegree: 4,
  steps: [
    { beat: 0.5, length: 0.42, offset: 0, velocity: 0.5, pan: -0.04, toneIntent: "chord" },
    { beat: 1.75, length: 0.42, offset: 1, velocity: 0.5, pan: 0.04, toneIntent: "scale" },
    { beat: 3.0, length: 0.88, offset: 0, velocity: 0.56, pan: 0.08, toneIntent: "chord" },
  ],
};

const lanternReturnCall = scaleMotifVelocities(
  mapMotifSteps(lanternCall, (step, index) => ({
    ...step,
    length: index === 4 ? 0.78 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 1.06 : 1.02)
        : step.velocity,
  })),
  1.02,
);

const lanternReturnLift = scaleMotifVelocities(
  mapMotifSteps(lanternLift, (step, index) => ({
    ...step,
    length: index === 2 ? step.length + 0.1 : index === 4 ? 0.76 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 2 ? 1 : 1.04)
        : step.velocity,
  })),
  1.04,
);

const lanternHomecoming = scaleMotifVelocities(
  mapMotifSteps(lanternFinalCadence, (step, index) => ({
    ...step,
    length: index === 4 ? 0.75 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 4 ? 1.08 : 1.02)
        : step.velocity,
  })),
  1.08,
);

function buildLanternBaselineHarmony(): HarmonyPlanItem[] {
  return [
    { bar: 0, root: "C4", quality: "major", velocity: 0.22, inversion: 1, spread: 0.01 },
    { bar: 1, root: "A3", quality: "minor7", velocity: 0.21, spread: 0.01 },
    { bar: 2, root: "F3", quality: "add9", velocity: 0.23, inversion: 1, spread: 0.01 },
    { bar: 3, root: "G3", quality: "sus4", velocity: 0.23, spread: 0.01 },
    { bar: 4, root: "C4", quality: "major", velocity: 0.22, spread: 0.01 },
    { bar: 5, root: "G3", quality: "sus4", velocity: 0.22, spread: 0.01 },
    { bar: 6, root: "F3", quality: "add9", velocity: 0.23, inversion: 1, spread: 0.01 },
    { bar: 7, root: "C4", quality: "major", velocity: 0.22, spread: 0.01 },
  ];
}

function buildLanternBaselinePlan(): PhrasePlan {
  const harmony = buildLanternBaselineHarmony();
  const ornaments = [
    ...turnFigure({
      startBeat: 8.75,
      centerDegree: 2,
      stepLength: 0.25,
      noteLength: 0.16,
      velocity: 0.14,
      pan: 0.2,
    }),
    ...sighingFigure({
      startBeat: 28.75,
      highDegree: 5,
      lowDegree: 4,
      stepLength: 0.5,
      noteLength: 0.18,
      velocity: 0.14,
      pan: -0.18,
    }).map((note) => ({
      ...note,
      ornament: true,
    })),
  ];
  const bells = sparseBellAccents({
    accents: [
      { beat: 0, pitch: "G5", length: 0.62, velocity: 0.08, pan: 0.14 },
      { beat: 12, pitch: "G5", length: 0.7, velocity: 0.09, pan: -0.12 },
      { beat: 16, pitch: "G5", length: 0.62, velocity: 0.08, pan: 0.12 },
      { beat: 31.75, pitch: "G5", length: 0.72, velocity: 0.1, pan: 0.14 },
    ],
  });

  return {
    bars: 8,
    beatsPerBar: LANTERN_BEATS_PER_BAR,
    key: { root: "C", scale: "majorPentatonic" },
    harmony,
    padLayers: [{ synth: "warmPad", velocityScale: 0.88 }],
    arrangement: {
      densityCurve: [
        { beat: 0, value: 0.72 },
        { beat: 16, value: 0.8 },
        { beat: 32, value: 0.76 },
      ],
      registerCurve: [
        { beat: 0, value: 0.02 },
        { beat: 16, value: 0.12 },
        { beat: 28, value: 0.06 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.54 },
        { beat: 16, value: 0.62 },
        { beat: 32, value: 0.56 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.28 },
        { beat: 12, value: 0.74 },
        { beat: 15.25, value: 0.9 },
        { beat: 28, value: 0.78 },
        { beat: 31.25, value: 1 },
      ],
      ornamentBaseProbability: 0.2,
    },
    noteLayers: [
      {
        kind: "motif",
        id: "lantern-call-a",
        synth: "softLead",
        motif: lanternCall,
        beatOffset: 0,
        register: { min: "E5", max: "D6", anchor: "G5" },
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "lantern-response-a",
        synth: "softLead",
        motif: lanternResponse,
        beatOffset: 4,
        register: { min: "D5", max: "C6", anchor: "E5" },
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "lantern-lift-a",
        synth: "softLead",
        motif: lanternLift,
        beatOffset: 8,
        register: { min: "G5", max: "D6", anchor: "A5" },
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "lantern-half-cadence",
        synth: "softLead",
        motif: lanternHalfCadence,
        beatOffset: 12,
        register: { min: "G5", max: "D6", anchor: "D6" },
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "lantern-call-b",
        synth: "softLead",
        motif: lanternCall,
        beatOffset: 16,
        register: { min: "E5", max: "D6", anchor: "G5" },
        velocityScale: 0.98,
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "lantern-response-b",
        synth: "softLead",
        motif: lanternResponse,
        beatOffset: 20,
        register: { min: "D5", max: "C6", anchor: "E5" },
        velocityScale: 0.98,
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "lantern-lift-b",
        synth: "softLead",
        motif: lanternLift,
        beatOffset: 24,
        register: { min: "G5", max: "D6", anchor: "A5" },
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "lantern-final-cadence",
        synth: "softLead",
        motif: lanternFinalCadence,
        beatOffset: 28,
        register: { min: "E5", max: "D6", anchor: "D6" },
        velocityScale: 1.02,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "lantern-plucks",
        synth: "pluckyDust",
        notes: ornaments,
        register: { min: "A5", max: "E6", anchor: "C6" },
        allowOrnaments: true,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "lantern-bells",
        synth: "glassBell",
        notes: bells,
        register: { min: "G5", max: "D6", anchor: "C6" },
        clampToHarmony: false,
      },
      {
        kind: "draft",
        id: "lantern-bass",
        synth: "roundBass",
        notes: pulseBass({
          harmony,
          beatsPerBar: LANTERN_BEATS_PER_BAR,
          pattern: [
            { beatOffset: 0, intervalSemitones: 0, velocity: 0.44, length: 0.3 },
            { beatOffset: 2, intervalSemitones: 7, velocity: 0.32, length: 0.28 },
          ],
        }),
        register: { min: "C2", max: "D3", anchor: "C3" },
        clampToHarmony: true,
      },
    ],
  };
}

function buildLanternMasterHarmony(): HarmonyPlanItem[] {
  return [
    { bar: 0, root: "C4", quality: "major", velocity: 0.21, inversion: 1, spread: 0.01, tag: "statement" },
    { bar: 1, root: "A3", quality: "minor7", velocity: 0.21, spread: 0.01, tag: "statement" },
    { bar: 2, root: "F3", quality: "add9", velocity: 0.22, inversion: 1, spread: 0.01, tag: "statement" },
    { bar: 3, root: "G3", quality: "sus4", velocity: 0.22, spread: 0.01, tag: "statement" },
    { bar: 4, root: "C4", quality: "major", velocity: 0.2, inversion: 1, spread: 0.01, tag: "bloom" },
    { bar: 5, root: "E3", quality: "minor7", velocity: 0.2, inversion: 0, spread: 0.01, tag: "bloom" },
    { bar: 6, root: "F3", quality: "add9", velocity: 0.22, inversion: 1, spread: 0.01, tag: "bloom" },
    { bar: 7, root: "G3", quality: "sus4", velocity: 0.22, spread: 0.01, tag: "bloom" },
    { bar: 8, root: "A3", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "drift" },
    { bar: 9, root: "F3", quality: "add9", velocity: 0.18, inversion: 1, spread: 0.01, tag: "drift" },
    { bar: 10, root: "C4", quality: "major", velocity: 0.17, inversion: 1, spread: 0.01, tag: "drift" },
    { bar: 11, root: "G3", quality: "sus4", velocity: 0.18, spread: 0.01, tag: "drift" },
    { bar: 12, root: "F3", quality: "add9", velocity: 0.18, inversion: 1, spread: 0.01, tag: "threshold" },
    { bar: 13, root: "C4", quality: "major", velocity: 0.22, inversion: 1, spread: 0.01, tag: "return" },
    { bar: 14, root: "G3", quality: "sus4", velocity: 0.23, spread: 0.01, tag: "return" },
    { bar: 15, root: "C4", quality: "major", velocity: 0.25, inversion: 1, spread: 0.01, tag: "cadence" },
  ];
}

function buildLanternMasterBass(harmony: HarmonyPlanItem[]): PatternNoteDraft[] {
  const bodyBass = pulseBass({
    harmony: harmony.filter((item) => item.tag === "statement" || item.tag === "bloom"),
    beatsPerBar: LANTERN_BEATS_PER_BAR,
    pattern: [
      { beatOffset: 0, intervalSemitones: 0, velocity: 0.42, length: 0.32 },
      { beatOffset: 2, intervalSemitones: 7, velocity: 0.28, length: 0.26 },
    ],
  });
  const driftBass = pulseBass({
    harmony: harmony.filter((item) => item.tag === "drift"),
    beatsPerBar: LANTERN_BEATS_PER_BAR,
    pattern: [
      { beatOffset: 0, intervalSemitones: 0, velocity: 0.3, length: 0.34 },
      { beatOffset: 3, intervalSemitones: 7, velocity: 0.16, length: 0.22 },
    ],
  });
  const thresholdBass = pulseBass({
    harmony: harmony.filter((item) => item.tag === "threshold"),
    beatsPerBar: LANTERN_BEATS_PER_BAR,
    pattern: [{ beatOffset: 0, intervalSemitones: 0, velocity: 0.28, length: 0.44 }],
  });
  const returnBass = pulseBass({
    harmony: harmony.filter((item) => item.tag === "return" || item.tag === "cadence"),
    beatsPerBar: LANTERN_BEATS_PER_BAR,
    pattern: [
      { beatOffset: 0, intervalSemitones: 0, velocity: 0.44, length: 0.34 },
      { beatOffset: 2.5, intervalSemitones: 7, velocity: 0.24, length: 0.22 },
    ],
  });

  return [
    ...bodyBass,
    ...driftBass,
    ...thresholdBass,
    ...returnBass,
    {
      beat: lanternPartStart(3) + 14.75,
      length: 0.44,
      pitch: "C3",
      velocity: 0.26,
      toneIntent: "chord",
    },
  ];
}

function buildLanternMasterOrnaments(): PatternNoteDraft[] {
  return [
    ...turnFigure({
      start: pickupBefore(
        { kind: "sectionStart", startBar: 5, bars: 4, sectionId: "lantern-bloom", label: "the bloom" },
        LANTERN_METER,
        { subdivisions: 1, subdivisionUnit: 4 },
      ),
      meter: LANTERN_METER,
      centerDegree: 2,
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
      velocity: 0.12,
      pan: 0.18,
    }).map((note) => ({
      ...note,
      velocity: note.velocity !== undefined ? note.velocity * 0.96 : note.velocity,
    })),
    ...sighingFigure({
      start: pickupBefore(
        { kind: "sectionStart", startBar: 13, bars: 3, sectionId: "lantern-homecoming", label: "the homecoming" },
        LANTERN_METER,
      ),
      meter: LANTERN_METER,
      highDegree: 5,
      lowDegree: 4,
      stepSpan: { subdivisions: 1, subdivisionUnit: 2 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 3 },
      velocity: 0.12,
      pan: -0.16,
    }).map((note) => ({
      ...note,
      ornament: true,
      velocity: note.velocity !== undefined ? note.velocity * 0.92 : note.velocity,
    })),
  ];
}

function buildLanternCounterline(): PatternNoteDraft[] {
  const counterCell = [
    withPosition(
      {
        pitch: "E4",
        velocity: 0.16,
        pan: -0.08,
        toneIntent: "chord" as const,
      },
      {
        at: positionAtBarBeat(1, 2, 2, 4),
        duration: span(0, 1),
      },
    ),
    withPosition(
      {
        pitch: "G4",
        velocity: 0.15,
        pan: 0.04,
        toneIntent: "scale" as const,
      },
      {
        at: positionAtBarBeat(2, 2, 2, 4),
        duration: span(0, 0, 3, 4),
      },
    ),
  ];

  return [
    ...repeatAcrossBars(counterCell, {
      startBar: 5,
      repetitions: 2,
      everyBars: 8,
      meter: LANTERN_METER,
      label: "Counterline cell returns in bloom and homecoming.",
    }),
    {
      beat: lanternPartStart(1) + 9.5,
      length: 0.94,
      pitch: "A4",
      velocity: 0.16,
      pan: -0.04,
      toneIntent: "color",
    },
    {
      beat: lanternPartStart(1) + 13.5,
      length: 0.88,
      pitch: "G4",
      velocity: 0.16,
      pan: 0.02,
      toneIntent: "chord",
    },
    {
      beat: lanternPartStart(3) + 9.75,
      length: 1.02,
      pitch: "A4",
      velocity: 0.18,
      pan: -0.02,
      toneIntent: "chord",
    },
    {
      beat: lanternPartStart(3) + 14.5,
      length: 1.04,
      pitch: "F4",
      velocity: 0.15,
      pan: -0.06,
      toneIntent: "chord",
    },
  ];
}

function buildLanternMasterPlan(): PhrasePlan {
  const harmony = buildLanternMasterHarmony();
  const bells = sparseBellAccents({
    accents: [
      { at: positionAtBarBeat(1, 1), pitch: "G5", duration: span(0, 0, 5, 8), velocity: 0.08, pan: 0.14 },
      {
        at: pickupBefore(
          { kind: "sectionStart", startBar: 5, bars: 4, sectionId: "lantern-bloom", label: "the bloom" },
          LANTERN_METER,
        ),
        pitch: "A5",
        duration: span(0, 0, 5, 8),
        velocity: 0.07,
        pan: -0.1,
      },
      { beat: lanternPartStart(2) + 8.25, pitch: "A5", length: 0.56, velocity: 0.06, pan: 0.1 },
      { at: positionAtBarBeat(14, 1), pitch: "G5", duration: span(0, 0, 5, 8), velocity: 0.09, pan: 0.12 },
      {
        at: cadenceBeat(
          { kind: "phraseEnd", bars: LANTERN_MASTER_BARS, label: "the final landing" },
          LANTERN_METER,
        ),
        pitch: "C6",
        duration: span(0, 0, 3, 4),
        velocity: 0.1,
        pan: 0.14,
      },
    ],
  });
  const leadLayers = withVoiceId("lead", [
    {
      kind: "motif" as const,
      id: "lantern-i-call",
      synth: "softLead" as const,
      motif: lanternCall,
      positionOffset: positionAtBarBeat(1, 1),
      register: { min: "E5", max: "D6", anchor: "G5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-i-response",
      synth: "softLead" as const,
      motif: lanternResponse,
      positionOffset: positionAtBarBeat(2, 1),
      register: { min: "D5", max: "C6", anchor: "E5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-i-lift",
      synth: "softLead" as const,
      motif: lanternLift,
      positionOffset: positionAtBarBeat(3, 1),
      register: { min: "G5", max: "D6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-i-cadence",
      synth: "softLead" as const,
      motif: lanternHalfCadence,
      positionOffset: positionAtBarBeat(4, 1),
      register: { min: "G5", max: "D6", anchor: "D6" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-ii-call",
      synth: "softLead" as const,
      motif: lanternBloomCall,
      beatOffset: lanternPartStart(1),
      register: { min: "G5", max: "D6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-ii-response",
      synth: "softLead" as const,
      motif: lanternBloomResponse,
      beatOffset: lanternPartStart(1) + 4,
      register: { min: "E5", max: "D6", anchor: "G5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-ii-lift",
      synth: "softLead" as const,
      motif: lanternBloomLift,
      beatOffset: lanternPartStart(1) + 8,
      register: { min: "G5", max: "D6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-ii-cadence",
      synth: "softLead" as const,
      motif: scaleMotifVelocities(lanternHalfCadence, 0.98),
      beatOffset: lanternPartStart(1) + 12,
      register: { min: "G5", max: "D6", anchor: "C6" },
      velocityScale: 1.02,
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-iii-drift-response",
      synth: "softLead" as const,
      motif: lanternDriftResponse,
      beatOffset: lanternPartStart(2),
      register: { min: "C5", max: "A5", anchor: "E5" },
      velocityScale: 0.88,
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-iii-drift-call",
      synth: "softLead" as const,
      motif: lanternDriftCall,
      beatOffset: lanternPartStart(2) + 8,
      register: { min: "C5", max: "G5", anchor: "D5" },
      velocityScale: 0.84,
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-iv-call",
      synth: "softLead" as const,
      motif: lanternReturnCall,
      beatOffset: lanternPartStart(3) + 4,
      register: { min: "E5", max: "D6", anchor: "G5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-iv-lift",
      synth: "softLead" as const,
      motif: lanternReturnLift,
      beatOffset: lanternPartStart(3) + 8,
      register: { min: "G5", max: "D6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-iv-homecoming",
      synth: "softLead" as const,
      motif: lanternHomecoming,
      beatOffset: lanternPartStart(3) + 12,
      register: { min: "E5", max: "D6", anchor: "C6" },
      velocityScale: 1.04,
      clampToHarmony: true,
    },
  ]);

  return {
    bars: LANTERN_MASTER_BARS,
    beatsPerBar: LANTERN_BEATS_PER_BAR,
    meter: LANTERN_METER,
    key: { root: "C", scale: "majorPentatonic" },
    harmony,
    sections: [
      {
        id: "lantern-statement",
        role: "statement",
        startBar: 0,
        bars: 4,
        bias: {
          density: -0.06,
          register: 0,
          brightness: -0.03,
          cadence: 0.96,
        },
        description: "The lantern song in its plainest shape.",
      },
      {
        id: "lantern-bloom",
        role: "variation",
        startBar: 4,
        bars: 4,
        bias: {
          density: 0,
          register: 0.08,
          brightness: 0.07,
          cadence: 1.04,
        },
        description: "The tune opens outward and starts to glow.",
      },
      {
        id: "lantern-drift",
        role: "shadow",
        startBar: 8,
        bars: 4,
        bias: {
          density: -0.22,
          register: -0.12,
          brightness: -0.12,
          cadence: 0.72,
        },
        description: "The procession is heard from the river rather than seen.",
      },
      {
        id: "lantern-homecoming",
        role: "return",
        startBar: 12,
        bars: 3,
        bias: {
          density: -0.04,
          register: 0.08,
          brightness: 0.06,
          cadence: 1.18,
        },
        description: "The lanterns come back into view only after a full breath.",
      },
      {
        id: "lantern-landing",
        role: "cadence",
        startBar: 15,
        bars: 1,
        bias: {
          density: -0.08,
          register: 0.04,
          brightness: 0.04,
          cadence: 1.36,
        },
        description: "Final lantern landing at the doorway.",
      },
    ],
    padLayers: [{ synth: "warmPad", voiceId: "pad", velocityScale: 0.86 }],
    arrangement: {
      densityCurve: [
        { at: positionAtBarBeat(1, 1), beat: 0, value: 0.56 },
        { at: positionAtBarBeat(5, 1), beat: lanternPartStart(1), value: 0.68 },
        { at: positionAtBarBeat(9, 1), beat: lanternPartStart(2), value: 0.24 },
        { at: positionAtBarBeat(13, 1), beat: lanternPartStart(3), value: 0.68 },
        { beat: LANTERN_MASTER_BARS * LANTERN_BEATS_PER_BAR, value: 0.58 },
      ],
      registerCurve: [
        { beat: 0, value: 0 },
        { beat: lanternPartStart(1), value: 0.1 },
        { beat: lanternPartStart(2), value: -0.16 },
        { beat: lanternPartStart(3), value: 0.12 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.48 },
        { beat: lanternPartStart(1), value: 0.6 },
        { beat: lanternPartStart(2), value: 0.28 },
        { beat: lanternPartStart(3), value: 0.6 },
        { beat: LANTERN_MASTER_BARS * LANTERN_BEATS_PER_BAR, value: 0.52 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.2 },
        { beat: 15.25, value: 0.82 },
        { beat: lanternPartStart(1) + 15.25, value: 0.88 },
        { beat: lanternPartStart(2) + 15.25, value: 0.46 },
        { beat: lanternPartStart(3) + 7.5, value: 0.84 },
        {
          at: cadenceBeat(
            { kind: "phraseEnd", bars: LANTERN_MASTER_BARS, label: "the final landing" },
            LANTERN_METER,
          ),
          beat: lanternPartStart(3) + 15.25,
          value: 1.12,
        },
      ],
      ornamentBaseProbability: 0.12,
    },
    noteLayers: [
      ...leadLayers,
      {
        kind: "draft",
        id: "lantern-master-plucks",
        synth: "pluckyDust",
        voiceId: "ornament",
        notes: buildLanternMasterOrnaments(),
        register: { min: "A5", max: "E6", anchor: "C6" },
        allowOrnaments: true,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "lantern-master-counterline",
        synth: "softLead",
        voiceId: "counterline",
        notes: buildLanternCounterline(),
        register: { min: "D4", max: "A4", anchor: "E4" },
        velocityScale: 0.88,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "lantern-master-bells",
        synth: "glassBell",
        voiceId: "bells",
        notes: bells,
        register: { min: "G5", max: "E6", anchor: "C6" },
        clampToHarmony: false,
      },
      {
        kind: "draft",
        id: "lantern-master-bass",
        synth: "roundBass",
        voiceId: "bass",
        notes: buildLanternMasterBass(harmony),
        register: { min: "C2", max: "E3", anchor: "C3" },
        clampToHarmony: true,
      },
    ],
  };
}

export const paperLanternsBaseline: Composition = buildComposition({
  id: "paper-lanterns-baseline",
  title: "Paper Lanterns (Baseline)",
  key: { root: "C", scale: "majorPentatonic" },
  bpm: LANTERN_BPM,
  beatsPerBar: LANTERN_BEATS_PER_BAR,
  plan: buildLanternBaselinePlan(),
});

export const paperLanterns: Composition = buildComposition({
  id: "paper-lanterns",
  title: "Paper Lanterns",
  key: { root: "C", scale: "majorPentatonic" },
  bpm: LANTERN_BPM,
  beatsPerBar: LANTERN_BEATS_PER_BAR,
  plan: buildLanternMasterPlan(),
});

```

## /Users/william/Projects/TSinger/src/audio/presets/quietArcade.ts

```ts
import { compilePhrasePlan } from "../authoring/compile";
import { pulseBass, sparseBellAccents } from "../authoring/patterns";
import type {
  HarmonyPlanItem,
  PatternNoteDraft,
  PhrasePlan,
} from "../authoring/types";
import type { Composition } from "../composition";
import { placeDraftNotes } from "./helpers";

const ARCADE_BPM = 92;
const ARCADE_BEATS_PER_BAR = 4;
const ARCADE_MASTER_BARS = 16;
const ARCADE_PART_BARS = 4;

function arcadePartStart(index: number): number {
  return index * ARCADE_PART_BARS * ARCADE_BEATS_PER_BAR;
}

function buildComposition(params: {
  id: string;
  title: string;
  key: Composition["key"];
  bpm: number;
  beatsPerBar: number;
  plan: PhrasePlan;
}): Composition {
  const phrase = compilePhrasePlan(params.plan);

  return {
    id: params.id,
    title: params.title,
    bpm: params.bpm,
    beatsPerBar: params.beatsPerBar,
    key: params.key,
    loop: true,
    sections: phrase.sections.length > 0 ? phrase.sections : undefined,
    phrase: {
      bars: params.plan.bars,
      notes: phrase.notes,
      chords: phrase.chords,
    },
    timing: phrase.timing,
  };
}

const arcadeTheme: PatternNoteDraft[] = [
  { beat: 0, length: 0.46, pitch: "F#5", velocity: 0.74, pan: 0.08, toneIntent: "chord" },
  { beat: 0.75, length: 0.22, pitch: "F#5", velocity: 0.58, pan: -0.04, toneIntent: "chord" },
  { beat: 1.5, length: 0.34, pitch: "A5", velocity: 0.78, pan: -0.08, toneIntent: "scale" },
  { beat: 2.25, length: 0.42, pitch: "B5", velocity: 0.82, pan: 0.12, toneIntent: "chord" },
  { beat: 3, length: 0.42, pitch: "A5", velocity: 0.66, pan: 0.02, toneIntent: "scale" },
];

const arcadeDrop: PatternNoteDraft[] = [
  { beat: 0, length: 0.36, pitch: "E5", velocity: 0.66, pan: -0.08, toneIntent: "scale" },
  { beat: 0.75, length: 0.3, pitch: "D5", velocity: 0.62, pan: 0.06, toneIntent: "chord" },
  { beat: 1.75, length: 0.38, pitch: "B4", velocity: 0.64, pan: 0.08, toneIntent: "scale" },
  { beat: 2.75, length: 0.86, pitch: "A4", velocity: 0.64, pan: -0.08, toneIntent: "scale" },
];

const arcadeClimb: PatternNoteDraft[] = [
  { beat: 0, length: 0.32, pitch: "D5", velocity: 0.72, pan: 0.06, toneIntent: "chord" },
  { beat: 0.75, length: 0.32, pitch: "F#5", velocity: 0.74, pan: -0.04, toneIntent: "chord" },
  { beat: 1.5, length: 0.38, pitch: "A5", velocity: 0.8, pan: 0.1, toneIntent: "scale" },
  { beat: 2.25, length: 0.52, pitch: "D6", velocity: 0.84, pan: 0.12, toneIntent: "chord" },
  { beat: 3, length: 0.32, pitch: "B5", velocity: 0.66, pan: 0.02, toneIntent: "chord" },
];

const arcadeCadence: PatternNoteDraft[] = [
  { beat: 0, length: 0.3, pitch: "E5", velocity: 0.64, pan: -0.06, toneIntent: "scale" },
  { beat: 0.75, length: 0.34, pitch: "A5", velocity: 0.74, pan: 0.06, toneIntent: "chord" },
  { beat: 1.5, length: 0.42, pitch: "F#5", velocity: 0.72, pan: -0.08, toneIntent: "chord" },
  { beat: 2.5, length: 0.3, pitch: "E5", velocity: 0.58, pan: 0.04, toneIntent: "scale" },
  { beat: 3.25, length: 0.98, pitch: "D5", velocity: 0.74, pan: 0.1, toneIntent: "chord" },
];

const arcadeSpark: PatternNoteDraft[] = [
  { beat: 0, length: 0.3, pitch: "F#5", velocity: 0.72, pan: 0.08, toneIntent: "chord" },
  { beat: 0.75, length: 0.34, pitch: "A5", velocity: 0.8, pan: -0.08, toneIntent: "scale" },
  { beat: 1.5, length: 0.34, pitch: "B5", velocity: 0.82, pan: 0.12, toneIntent: "chord" },
  { beat: 2.25, length: 0.44, pitch: "D6", velocity: 0.82, pan: 0.08, toneIntent: "chord" },
  { beat: 3, length: 0.28, pitch: "B5", velocity: 0.64, pan: 0.02, toneIntent: "scale" },
];

const arcadeShimmer: PatternNoteDraft[] = [
  { beat: 0.25, length: 0.28, pitch: "G5", velocity: 0.64, pan: 0.06, toneIntent: "color" },
  { beat: 1.0, length: 0.34, pitch: "A5", velocity: 0.7, pan: -0.02, toneIntent: "scale" },
  { beat: 2.0, length: 0.42, pitch: "B5", velocity: 0.74, pan: 0.08, toneIntent: "chord" },
  { beat: 3.0, length: 0.48, pitch: "A5", velocity: 0.62, pan: -0.04, toneIntent: "scale" },
];

const arcadeAfterimage: PatternNoteDraft[] = [
  { beat: 0.5, length: 0.36, pitch: "D5", velocity: 0.56, pan: 0.02, toneIntent: "chord" },
  { beat: 2.0, length: 0.3, pitch: "F#5", velocity: 0.54, pan: -0.06, toneIntent: "chord" },
  { beat: 3.0, length: 0.7, pitch: "A4", velocity: 0.56, pan: 0.04, toneIntent: "scale" },
];

const arcadeContinue: PatternNoteDraft[] = [
  { beat: 1.0, length: 0.34, pitch: "A4", velocity: 0.54, pan: -0.04, toneIntent: "scale" },
  { beat: 2.25, length: 0.34, pitch: "D5", velocity: 0.58, pan: 0.04, toneIntent: "chord" },
  { beat: 3.0, length: 0.78, pitch: "F#5", velocity: 0.62, pan: 0.08, toneIntent: "chord" },
];

const arcadeThreshold: PatternNoteDraft[] = [
  { beat: 1.5, length: 0.52, pitch: "A4", velocity: 0.52, pan: -0.04, toneIntent: "scale" },
  { beat: 3.0, length: 0.84, pitch: "D5", velocity: 0.6, pan: 0.08, toneIntent: "chord" },
];

const arcadeFinale: PatternNoteDraft[] = [
  { beat: 0, length: 0.3, pitch: "B5", velocity: 0.64, pan: -0.04, toneIntent: "scale" },
  { beat: 0.75, length: 0.34, pitch: "A5", velocity: 0.76, pan: 0.08, toneIntent: "scale" },
  { beat: 1.5, length: 0.42, pitch: "F#5", velocity: 0.76, pan: -0.08, toneIntent: "chord" },
  { beat: 2.5, length: 0.32, pitch: "E5", velocity: 0.62, pan: 0.02, toneIntent: "scale" },
  { beat: 3.25, length: 1.3, pitch: "D5", velocity: 0.82, pan: 0.1, toneIntent: "chord" },
];

const arcadePingBright: PatternNoteDraft[] = [
  { beat: 0.5, length: 0.18, pitch: "D6", velocity: 0.18, pan: -0.28, toneIntent: "chord", ornament: true },
  { beat: 1.0, length: 0.18, pitch: "A5", velocity: 0.16, pan: 0.28, toneIntent: "scale", ornament: true },
];

const arcadePingWarm: PatternNoteDraft[] = [
  { beat: 1.0, length: 0.18, pitch: "G5", velocity: 0.15, pan: 0.22, toneIntent: "color", ornament: true },
  { beat: 2.5, length: 0.18, pitch: "B5", velocity: 0.16, pan: -0.22, toneIntent: "chord", ornament: true },
];

const arcadeCounterFigureA: PatternNoteDraft[] = [
  { beat: 0.5, length: 0.72, pitch: "D4", velocity: 0.16, pan: -0.08, toneIntent: "chord" },
];

const arcadeCounterFigureB: PatternNoteDraft[] = [
  { beat: 0.75, length: 0.52, pitch: "G4", velocity: 0.14, pan: 0.08, toneIntent: "color" },
  { beat: 2.5, length: 0.58, pitch: "E4", velocity: 0.15, pan: -0.06, toneIntent: "scale" },
];

const arcadeCounterFigureC: PatternNoteDraft[] = [
  { beat: 1.0, length: 0.68, pitch: "F#4", velocity: 0.16, pan: -0.06, toneIntent: "chord" },
];

const arcadeCounterFigureD: PatternNoteDraft[] = [
  { beat: 1.5, length: 0.52, pitch: "E4", velocity: 0.15, pan: 0.04, toneIntent: "scale" },
  { beat: 3.0, length: 0.84, pitch: "D4", velocity: 0.17, pan: -0.02, toneIntent: "chord" },
];

const arcadeBaselineNotes: Composition["phrase"]["notes"] = [
  { beat: 0.0, length: 0.4, pitch: "F#5", synth: "softLead", velocity: 0.72, pan: 0.08 },
  { beat: 0.75, length: 0.35, pitch: "A5", synth: "softLead", velocity: 0.78, pan: -0.08 },
  { beat: 1.5, length: 0.5, pitch: "B5", synth: "softLead", velocity: 0.8, pan: 0.12 },
  { beat: 2.5, length: 0.35, pitch: "A5", synth: "softLead", velocity: 0.66, pan: 0.02 },

  { beat: 4.0, length: 0.35, pitch: "F#5", synth: "softLead", velocity: 0.7, pan: -0.08 },
  { beat: 4.75, length: 0.35, pitch: "D5", synth: "softLead", velocity: 0.68, pan: 0.08 },
  { beat: 5.5, length: 0.5, pitch: "B4", synth: "softLead", velocity: 0.7, pan: -0.12 },
  { beat: 6.5, length: 0.45, pitch: "A4", synth: "softLead", velocity: 0.62, pan: -0.02 },

  { beat: 8.0, length: 0.35, pitch: "D5", synth: "softLead", velocity: 0.72, pan: 0.06 },
  { beat: 8.75, length: 0.35, pitch: "G5", synth: "softLead", velocity: 0.76, pan: -0.06 },
  { beat: 9.5, length: 0.6, pitch: "A5", synth: "softLead", velocity: 0.8, pan: 0.1 },
  { beat: 10.5, length: 0.35, pitch: "B5", synth: "softLead", velocity: 0.66, pan: 0.02 },

  { beat: 12.0, length: 0.35, pitch: "E5", synth: "softLead", velocity: 0.68, pan: -0.06 },
  { beat: 12.75, length: 0.35, pitch: "A5", synth: "softLead", velocity: 0.76, pan: 0.06 },
  { beat: 13.5, length: 0.6, pitch: "F#5", synth: "softLead", velocity: 0.74, pan: -0.08 },
  { beat: 14.5, length: 0.35, pitch: "E5", synth: "softLead", velocity: 0.62, pan: 0.04 },
  { beat: 15.25, length: 0.55, pitch: "D5", synth: "softLead", velocity: 0.68, pan: 0.1 },

  { beat: 16.0, length: 0.35, pitch: "F#5", synth: "softLead", velocity: 0.72, pan: 0.08 },
  { beat: 16.75, length: 0.35, pitch: "A5", synth: "softLead", velocity: 0.78, pan: -0.08 },
  { beat: 17.5, length: 0.45, pitch: "B5", synth: "softLead", velocity: 0.8, pan: 0.12 },
  { beat: 18.5, length: 0.35, pitch: "D6", synth: "softLead", velocity: 0.68, pan: 0.04 },

  { beat: 20.0, length: 0.35, pitch: "E5", synth: "softLead", velocity: 0.68, pan: -0.06 },
  { beat: 20.75, length: 0.35, pitch: "G5", synth: "softLead", velocity: 0.72, pan: 0.06 },
  { beat: 21.5, length: 0.45, pitch: "B5", synth: "softLead", velocity: 0.76, pan: 0.1 },
  { beat: 22.5, length: 0.35, pitch: "A5", synth: "softLead", velocity: 0.62, pan: -0.04 },

  { beat: 24.0, length: 0.35, pitch: "D5", synth: "softLead", velocity: 0.7, pan: 0.06 },
  { beat: 24.75, length: 0.35, pitch: "G5", synth: "softLead", velocity: 0.76, pan: -0.06 },
  { beat: 25.5, length: 0.55, pitch: "A5", synth: "softLead", velocity: 0.8, pan: 0.1 },
  { beat: 26.5, length: 0.35, pitch: "B5", synth: "softLead", velocity: 0.66, pan: 0.04 },

  { beat: 28.0, length: 0.3, pitch: "C#6", synth: "softLead", velocity: 0.62, pan: -0.04 },
  { beat: 28.75, length: 0.35, pitch: "A5", synth: "softLead", velocity: 0.74, pan: 0.08 },
  { beat: 29.5, length: 0.5, pitch: "F#5", synth: "softLead", velocity: 0.76, pan: -0.08 },
  { beat: 30.5, length: 0.35, pitch: "E5", synth: "softLead", velocity: 0.62, pan: 0.02 },
  { beat: 31.25, length: 0.6, pitch: "D5", synth: "softLead", velocity: 0.72, pan: 0.1 },

  { beat: 0.5, length: 0.18, pitch: "D6", synth: "pluckyDust", velocity: 0.2, pan: -0.3 },
  { beat: 1.0, length: 0.18, pitch: "A5", synth: "pluckyDust", velocity: 0.18, pan: 0.3 },
  { beat: 2.5, length: 0.18, pitch: "F#5", synth: "pluckyDust", velocity: 0.18, pan: -0.22 },
  { beat: 4.5, length: 0.18, pitch: "B5", synth: "pluckyDust", velocity: 0.18, pan: 0.26 },
  { beat: 6.0, length: 0.18, pitch: "D6", synth: "pluckyDust", velocity: 0.18, pan: -0.26 },
  { beat: 8.5, length: 0.18, pitch: "G5", synth: "pluckyDust", velocity: 0.17, pan: 0.28 },
  { beat: 9.0, length: 0.18, pitch: "D6", synth: "pluckyDust", velocity: 0.18, pan: -0.28 },
  { beat: 12.5, length: 0.18, pitch: "A5", synth: "pluckyDust", velocity: 0.18, pan: 0.24 },
  { beat: 16.5, length: 0.18, pitch: "D6", synth: "pluckyDust", velocity: 0.2, pan: -0.26 },
  { beat: 17.0, length: 0.18, pitch: "A5", synth: "pluckyDust", velocity: 0.18, pan: 0.28 },
  { beat: 20.5, length: 0.18, pitch: "G5", synth: "pluckyDust", velocity: 0.17, pan: -0.22 },
  { beat: 21.0, length: 0.18, pitch: "B5", synth: "pluckyDust", velocity: 0.18, pan: 0.24 },
  { beat: 24.5, length: 0.18, pitch: "G5", synth: "pluckyDust", velocity: 0.17, pan: 0.22 },
  { beat: 25.0, length: 0.18, pitch: "D6", synth: "pluckyDust", velocity: 0.18, pan: -0.24 },
  { beat: 28.5, length: 0.18, pitch: "A5", synth: "pluckyDust", velocity: 0.18, pan: 0.2 },
  { beat: 29.0, length: 0.18, pitch: "F#5", synth: "pluckyDust", velocity: 0.18, pan: -0.2 },

  { beat: 0.0, length: 0.3, pitch: "D2", synth: "roundBass", velocity: 0.56, pan: 0 },
  { beat: 2.0, length: 0.24, pitch: "F#2", synth: "roundBass", velocity: 0.32, pan: 0 },
  { beat: 3.5, length: 0.22, pitch: "A2", synth: "roundBass", velocity: 0.38, pan: 0 },
  { beat: 4.0, length: 0.3, pitch: "B2", synth: "roundBass", velocity: 0.54, pan: 0 },
  { beat: 6.0, length: 0.24, pitch: "D2", synth: "roundBass", velocity: 0.3, pan: 0 },
  { beat: 7.5, length: 0.22, pitch: "F#2", synth: "roundBass", velocity: 0.36, pan: 0 },
  { beat: 8.0, length: 0.3, pitch: "G2", synth: "roundBass", velocity: 0.54, pan: 0 },
  { beat: 10.0, length: 0.24, pitch: "D2", synth: "roundBass", velocity: 0.3, pan: 0 },
  { beat: 11.5, length: 0.22, pitch: "D2", synth: "roundBass", velocity: 0.36, pan: 0 },
  { beat: 12.0, length: 0.3, pitch: "A2", synth: "roundBass", velocity: 0.56, pan: 0 },
  { beat: 14.0, length: 0.24, pitch: "E2", synth: "roundBass", velocity: 0.32, pan: 0 },
  { beat: 15.5, length: 0.22, pitch: "C#3", synth: "roundBass", velocity: 0.34, pan: 0 },
  { beat: 16.0, length: 0.3, pitch: "D2", synth: "roundBass", velocity: 0.56, pan: 0 },
  { beat: 18.0, length: 0.24, pitch: "F#2", synth: "roundBass", velocity: 0.32, pan: 0 },
  { beat: 19.5, length: 0.22, pitch: "A2", synth: "roundBass", velocity: 0.36, pan: 0 },
  { beat: 20.0, length: 0.3, pitch: "E2", synth: "roundBass", velocity: 0.5, pan: 0 },
  { beat: 22.0, length: 0.24, pitch: "G2", synth: "roundBass", velocity: 0.3, pan: 0 },
  { beat: 23.5, length: 0.22, pitch: "B2", synth: "roundBass", velocity: 0.34, pan: 0 },
  { beat: 24.0, length: 0.3, pitch: "G2", synth: "roundBass", velocity: 0.54, pan: 0 },
  { beat: 26.0, length: 0.24, pitch: "D2", synth: "roundBass", velocity: 0.3, pan: 0 },
  { beat: 27.5, length: 0.22, pitch: "D2", synth: "roundBass", velocity: 0.36, pan: 0 },
  { beat: 28.0, length: 0.3, pitch: "A2", synth: "roundBass", velocity: 0.56, pan: 0 },
  { beat: 30.0, length: 0.24, pitch: "E2", synth: "roundBass", velocity: 0.32, pan: 0 },
  { beat: 31.5, length: 0.22, pitch: "C#3", synth: "roundBass", velocity: 0.34, pan: 0 },

  { beat: 0.0, length: 8.0, pitch: "D3", synth: "breathingDrone", velocity: 0.08, pan: -0.04 },
  { beat: 8.0, length: 8.0, pitch: "G2", synth: "breathingDrone", velocity: 0.07, pan: 0.04 },
  { beat: 16.0, length: 8.0, pitch: "D3", synth: "breathingDrone", velocity: 0.08, pan: 0.04 },
  { beat: 24.0, length: 8.0, pitch: "G2", synth: "breathingDrone", velocity: 0.07, pan: -0.04 },

  { beat: 0.0, length: 0.9, pitch: "D6", synth: "glassBell", velocity: 0.15, pan: 0.2 },
  { beat: 8.0, length: 0.9, pitch: "G5", synth: "glassBell", velocity: 0.14, pan: -0.2 },
  { beat: 16.0, length: 0.8, pitch: "D6", synth: "glassBell", velocity: 0.16, pan: 0.18 },
  { beat: 24.0, length: 0.8, pitch: "G5", synth: "glassBell", velocity: 0.14, pan: -0.18 },
  { beat: 30.75, length: 0.9, pitch: "D6", synth: "glassBell", velocity: 0.15, pan: 0.16 },
];

const arcadeBaselineChords: Composition["phrase"]["chords"] = [
  { beat: 0, length: 4, root: "D4", quality: "major", synth: "warmPad", velocity: 0.19, inversion: 1, spread: 0.008 },
  { beat: 4, length: 4, root: "B3", quality: "minor7", synth: "warmPad", velocity: 0.18, inversion: 0, spread: 0.008 },
  { beat: 8, length: 4, root: "G3", quality: "major", synth: "warmPad", velocity: 0.18, inversion: 1, spread: 0.008 },
  { beat: 12, length: 4, root: "A3", quality: "sus2", synth: "warmPad", velocity: 0.19, inversion: 0, spread: 0.008 },
  { beat: 16, length: 4, root: "D4", quality: "major", synth: "warmPad", velocity: 0.18, inversion: 1, spread: 0.008 },
  { beat: 20, length: 4, root: "E4", quality: "minor7", synth: "warmPad", velocity: 0.17, inversion: 0, spread: 0.008 },
  { beat: 24, length: 4, root: "G3", quality: "major", synth: "warmPad", velocity: 0.18, inversion: 1, spread: 0.008 },
  { beat: 28, length: 4, root: "A3", quality: "sus2", synth: "warmPad", velocity: 0.19, inversion: 0, spread: 0.008 },
];

function buildQuietArcadeMasterHarmony(): HarmonyPlanItem[] {
  return [
    { bar: 0, root: "D4", quality: "major", velocity: 0.18, inversion: 1, spread: 0.008, tag: "statement" },
    { bar: 1, root: "B3", quality: "minor7", velocity: 0.17, inversion: 0, spread: 0.008, tag: "statement" },
    { bar: 2, root: "G3", quality: "major", velocity: 0.17, inversion: 1, spread: 0.008, tag: "statement" },
    { bar: 3, root: "A3", quality: "sus2", velocity: 0.18, inversion: 0, spread: 0.008, tag: "statement" },
    { bar: 4, root: "D4", quality: "major", velocity: 0.19, inversion: 1, spread: 0.008, tag: "run" },
    { bar: 5, root: "G3", quality: "major", velocity: 0.18, inversion: 1, spread: 0.008, tag: "run" },
    { bar: 6, root: "E4", quality: "minor7", velocity: 0.17, inversion: 0, spread: 0.008, tag: "run" },
    { bar: 7, root: "A3", quality: "sus2", velocity: 0.2, inversion: 0, spread: 0.008, tag: "run" },
    { bar: 8, root: "B3", quality: "minor7", velocity: 0.15, inversion: 0, spread: 0.008, tag: "continue" },
    { bar: 9, root: "G3", quality: "major", velocity: 0.15, inversion: 1, spread: 0.008, tag: "continue" },
    { bar: 10, root: "E4", quality: "minor7", velocity: 0.15, inversion: 0, spread: 0.008, tag: "continue" },
    { bar: 11, root: "A3", quality: "sus2", velocity: 0.16, inversion: 0, spread: 0.008, tag: "continue" },
    { bar: 12, root: "G3", quality: "major", velocity: 0.16, inversion: 1, spread: 0.008, tag: "threshold" },
    { bar: 13, root: "D4", quality: "major", velocity: 0.2, inversion: 1, spread: 0.008, tag: "return" },
    { bar: 14, root: "A3", quality: "sus2", velocity: 0.21, inversion: 0, spread: 0.008, tag: "return" },
    { bar: 15, root: "D4", quality: "major", velocity: 0.23, inversion: 1, spread: 0.008, tag: "cadence" },
  ];
}

function buildQuietArcadeLead(): PatternNoteDraft[] {
  return [
    ...placeDraftNotes(arcadeTheme, { beatOffset: arcadePartStart(0) }),
    ...placeDraftNotes(arcadeDrop, { beatOffset: arcadePartStart(0) + 4 }),
    ...placeDraftNotes(arcadeClimb, { beatOffset: arcadePartStart(0) + 8 }),
    ...placeDraftNotes(arcadeCadence, { beatOffset: arcadePartStart(0) + 12 }),
    ...placeDraftNotes(arcadeSpark, { beatOffset: arcadePartStart(1), velocityScale: 1.04 }),
    ...placeDraftNotes(arcadeShimmer, { beatOffset: arcadePartStart(1) + 4, velocityScale: 0.96 }),
    ...placeDraftNotes(arcadeClimb, { beatOffset: arcadePartStart(1) + 8, velocityScale: 1.08 }),
    ...placeDraftNotes(arcadeCadence, { beatOffset: arcadePartStart(1) + 12, velocityScale: 1.02 }),
    ...placeDraftNotes(arcadeAfterimage, { beatOffset: arcadePartStart(2), velocityScale: 0.88 }),
    ...placeDraftNotes(arcadeContinue, { beatOffset: arcadePartStart(2) + 4, velocityScale: 0.82 }),
    ...placeDraftNotes(arcadeAfterimage, { beatOffset: arcadePartStart(2) + 8, velocityScale: 0.78, panShift: -0.04 }),
    ...placeDraftNotes(arcadeThreshold, { beatOffset: arcadePartStart(2) + 12, velocityScale: 0.8 }),
    ...placeDraftNotes(arcadeThreshold, { beatOffset: arcadePartStart(3), velocityScale: 0.94 }),
    ...placeDraftNotes(arcadeTheme, { beatOffset: arcadePartStart(3) + 4, velocityScale: 1.08 }),
    ...placeDraftNotes(arcadeClimb, { beatOffset: arcadePartStart(3) + 8, velocityScale: 1.12 }),
    ...placeDraftNotes(arcadeFinale, { beatOffset: arcadePartStart(3) + 12, velocityScale: 1.12 }),
  ];
}

function buildQuietArcadeCounterline(): PatternNoteDraft[] {
  return [
    ...placeDraftNotes(arcadeCounterFigureA, { beatOffset: arcadePartStart(1), velocityScale: 0.96 }),
    ...placeDraftNotes(arcadeCounterFigureB, { beatOffset: arcadePartStart(1) + 4, velocityScale: 0.92 }),
    ...placeDraftNotes(arcadeCounterFigureC, { beatOffset: arcadePartStart(1) + 8, velocityScale: 0.98 }),
    ...placeDraftNotes(arcadeCounterFigureD, { beatOffset: arcadePartStart(1) + 12, velocityScale: 0.98 }),
    ...placeDraftNotes(arcadeCounterFigureB, { beatOffset: arcadePartStart(3), velocityScale: 0.9 }),
    ...placeDraftNotes(arcadeCounterFigureA, { beatOffset: arcadePartStart(3) + 4, velocityScale: 1 }),
    ...placeDraftNotes(arcadeCounterFigureC, { beatOffset: arcadePartStart(3) + 8, velocityScale: 1.02 }),
    ...placeDraftNotes(arcadeCounterFigureD, { beatOffset: arcadePartStart(3) + 12, velocityScale: 1.04 }),
  ];
}

function buildQuietArcadePlucks(): PatternNoteDraft[] {
  return [
    ...placeDraftNotes(arcadePingBright, { beatOffset: 0 }),
    ...placeDraftNotes(arcadePingWarm, { beatOffset: 16, velocityScale: 0.94 }),
    ...placeDraftNotes(arcadePingBright, { beatOffset: 24, velocityScale: 0.9 }),
    ...placeDraftNotes(arcadePingWarm, { beatOffset: 32, velocityScale: 0.76 }),
    ...placeDraftNotes(arcadePingBright, { beatOffset: 48, velocityScale: 0.82 }),
    ...placeDraftNotes(arcadePingBright, { beatOffset: 56, velocityScale: 0.94 }),
    ...placeDraftNotes(arcadePingWarm, { beatOffset: 60, velocityScale: 0.9 }),
  ];
}

function buildQuietArcadeBass(harmony: HarmonyPlanItem[]): PatternNoteDraft[] {
  const main = pulseBass({
    harmony: harmony.filter((item) => item.tag === "statement" || item.tag === "run"),
    beatsPerBar: ARCADE_BEATS_PER_BAR,
    pattern: [
      { beatOffset: 0, intervalSemitones: 0, velocity: 0.46, length: 0.3 },
      { beatOffset: 2.5, intervalSemitones: 7, velocity: 0.22, length: 0.2 },
    ],
  });
  const continueBass = pulseBass({
    harmony: harmony.filter((item) => item.tag === "continue"),
    beatsPerBar: ARCADE_BEATS_PER_BAR,
    pattern: [
      { beatOffset: 0, intervalSemitones: 0, velocity: 0.3, length: 0.32 },
      { beatOffset: 3, intervalSemitones: 7, velocity: 0.16, length: 0.2 },
    ],
  });
  const thresholdBass = pulseBass({
    harmony: harmony.filter((item) => item.tag === "threshold"),
    beatsPerBar: ARCADE_BEATS_PER_BAR,
    pattern: [{ beatOffset: 0, intervalSemitones: 0, velocity: 0.28, length: 0.46 }],
  });
  const returnBass = pulseBass({
    harmony: harmony.filter((item) => item.tag === "return" || item.tag === "cadence"),
    beatsPerBar: ARCADE_BEATS_PER_BAR,
    pattern: [
      { beatOffset: 0, intervalSemitones: 0, velocity: 0.5, length: 0.34 },
      { beatOffset: 2.5, intervalSemitones: 7, velocity: 0.22, length: 0.2 },
    ],
  });

  return [
    ...main,
    ...continueBass,
    ...thresholdBass,
    ...returnBass,
    {
      beat: arcadePartStart(3) + 14.75,
      length: 0.44,
      pitch: "D2",
      velocity: 0.28,
      toneIntent: "chord",
    },
  ];
}

function buildQuietArcadeDrone(): PatternNoteDraft[] {
  return [
    { beat: 0, length: 16, pitch: "D3", velocity: 0.07, pan: -0.04, toneIntent: "chord" },
    { beat: 16, length: 8, pitch: "G2", velocity: 0.06, pan: 0.04, toneIntent: "chord" },
    { beat: 24, length: 8, pitch: "E3", velocity: 0.06, pan: -0.04, toneIntent: "chord" },
    { beat: 32, length: 8, pitch: "B2", velocity: 0.05, pan: -0.04, toneIntent: "chord" },
    { beat: 40, length: 8, pitch: "A2", velocity: 0.05, pan: 0.04, toneIntent: "chord" },
    { beat: 48, length: 4, pitch: "G2", velocity: 0.05, pan: -0.02, toneIntent: "chord" },
    { beat: 52, length: 12, pitch: "D3", velocity: 0.07, pan: 0.04, toneIntent: "chord" },
  ];
}

function buildQuietArcadeMasterPlan(): PhrasePlan {
  const harmony = buildQuietArcadeMasterHarmony();
  const bells = sparseBellAccents({
    accents: [
      { beat: 0, pitch: "D6", length: 0.82, velocity: 0.14, pan: 0.18 },
      { beat: arcadePartStart(1) + 4.5, pitch: "B5", length: 0.68, velocity: 0.1, pan: -0.18 },
      { beat: arcadePartStart(2) + 8, pitch: "A5", length: 0.72, velocity: 0.09, pan: 0.14 },
      { beat: arcadePartStart(3) + 4, pitch: "D6", length: 0.82, velocity: 0.15, pan: 0.18 },
      { beat: arcadePartStart(3) + 15.25, pitch: "B5", length: 0.86, velocity: 0.13, pan: 0.16 },
    ],
  });

  return {
    bars: ARCADE_MASTER_BARS,
    beatsPerBar: ARCADE_BEATS_PER_BAR,
    key: { root: "D", scale: "majorPentatonic" },
    harmony,
    sections: [
      {
        id: "arcade-attract",
        role: "statement",
        startBar: 0,
        bars: 4,
        bias: {
          density: -0.08,
          register: 0,
          brightness: -0.02,
          cadence: 0.96,
        },
        description: "The cabinet lights up and states the hook cleanly.",
      },
      {
        id: "arcade-run",
        role: "variation",
        startBar: 4,
        bars: 4,
        bias: {
          density: 0,
          register: 0.1,
          brightness: 0.08,
          cadence: 1.04,
        },
        description: "The hook starts winning, not just repeating.",
      },
      {
        id: "arcade-continue",
        role: "shadow",
        startBar: 8,
        bars: 4,
        bias: {
          density: -0.22,
          register: -0.14,
          brightness: -0.16,
          cadence: 0.74,
        },
        description: "The room keeps humming after the player steps away.",
      },
      {
        id: "arcade-homecoming",
        role: "return",
        startBar: 12,
        bars: 3,
        bias: {
          density: -0.02,
          register: 0.12,
          brightness: 0.12,
          cadence: 1.16,
        },
        description: "The hook is withheld, then arrives like it always belonged here.",
      },
      {
        id: "arcade-clear",
        role: "cadence",
        startBar: 15,
        bars: 1,
        bias: {
          density: -0.08,
          register: 0.08,
          brightness: 0.1,
          cadence: 1.32,
        },
        description: "Final clear-screen landing on D.",
      },
    ],
    padLayers: [{ synth: "warmPad", voiceId: "pad", velocityScale: 0.84 }],
    arrangement: {
      densityCurve: [
        { beat: 0, value: 0.48 },
        { beat: arcadePartStart(1), value: 0.6 },
        { beat: arcadePartStart(2), value: 0.18 },
        { beat: arcadePartStart(3), value: 0.66 },
        { beat: ARCADE_MASTER_BARS * ARCADE_BEATS_PER_BAR, value: 0.54 },
      ],
      registerCurve: [
        { beat: 0, value: 0 },
        { beat: arcadePartStart(1), value: 0.1 },
        { beat: arcadePartStart(2), value: -0.18 },
        { beat: arcadePartStart(3), value: 0.16 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.48 },
        { beat: arcadePartStart(1), value: 0.62 },
        { beat: arcadePartStart(2), value: 0.26 },
        { beat: arcadePartStart(3), value: 0.68 },
        { beat: ARCADE_MASTER_BARS * ARCADE_BEATS_PER_BAR, value: 0.54 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.18 },
        { beat: arcadePartStart(0) + 15.25, value: 0.72 },
        { beat: arcadePartStart(1) + 15.25, value: 0.86 },
        { beat: arcadePartStart(2) + 15.25, value: 0.42 },
        { beat: arcadePartStart(3) + 7.5, value: 0.82 },
        { beat: arcadePartStart(3) + 15.25, value: 1.12 },
      ],
      ornamentBaseProbability: 0.12,
    },
    noteLayers: [
      {
        kind: "draft",
        id: "arcade-lead",
        synth: "softLead",
        voiceId: "lead",
        notes: buildQuietArcadeLead(),
        register: { min: "A4", max: "B5", anchor: "F#5" },
        clampToHarmony: false,
      },
      {
        kind: "draft",
        id: "arcade-counterline",
        synth: "softLead",
        voiceId: "counterline",
        notes: buildQuietArcadeCounterline(),
        register: { min: "D4", max: "A4", anchor: "F#4" },
        velocityScale: 0.9,
        clampToHarmony: false,
      },
      {
        kind: "draft",
        id: "arcade-plucks",
        synth: "pluckyDust",
        voiceId: "ornament",
        notes: buildQuietArcadePlucks(),
        register: { min: "G5", max: "D6", anchor: "B5" },
        allowOrnaments: true,
        clampToHarmony: false,
      },
      {
        kind: "draft",
        id: "arcade-bass",
        synth: "roundBass",
        voiceId: "bass",
        notes: buildQuietArcadeBass(harmony),
        register: { min: "D2", max: "E3", anchor: "D2" },
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "arcade-drone",
        synth: "breathingDrone",
        voiceId: "drone",
        notes: buildQuietArcadeDrone(),
        register: { min: "G2", max: "B3", anchor: "D3" },
        velocityScale: 0.94,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "arcade-bells",
        synth: "glassBell",
        voiceId: "bells",
        notes: bells,
        register: { min: "G5", max: "D6", anchor: "D6" },
        clampToHarmony: false,
      },
    ],
  };
}

export const quietArcadeBaseline: Composition = {
  id: "quiet-arcade-baseline",
  title: "Quiet Arcade (Baseline)",
  bpm: ARCADE_BPM,
  beatsPerBar: ARCADE_BEATS_PER_BAR,
  key: { root: "D", scale: "majorPentatonic" },
  loop: true,
  phrase: {
    bars: 8,
    notes: arcadeBaselineNotes,
    chords: arcadeBaselineChords,
  },
};

export const quietArcade: Composition = buildComposition({
  id: "quiet-arcade",
  title: "Quiet Arcade",
  key: { root: "D", scale: "majorPentatonic" },
  bpm: ARCADE_BPM,
  beatsPerBar: ARCADE_BEATS_PER_BAR,
  plan: buildQuietArcadeMasterPlan(),
});

```

## /Users/william/Projects/TSinger/src/audio/presets/lowTideMemory.ts

```ts
import { compilePhrasePlan } from "../authoring/compile";
import type {
  HarmonyPlanItem,
  PatternNoteDraft,
  PhrasePlan,
} from "../authoring/types";
import type { Composition } from "../composition";
import { placeDraftNotes } from "./helpers";

const LOW_TIDE_BPM = 64;
const LOW_TIDE_BEATS_PER_BAR = 4;
const LOW_TIDE_MASTER_BARS = 16;
const LOW_TIDE_PART_BARS = 4;

function lowTidePartStart(index: number): number {
  return index * LOW_TIDE_PART_BARS * LOW_TIDE_BEATS_PER_BAR;
}

function buildComposition(params: {
  id: string;
  title: string;
  key: Composition["key"];
  bpm: number;
  beatsPerBar: number;
  plan: PhrasePlan;
}): Composition {
  const phrase = compilePhrasePlan(params.plan);

  return {
    id: params.id,
    title: params.title,
    bpm: params.bpm,
    beatsPerBar: params.beatsPerBar,
    key: params.key,
    loop: true,
    sections: phrase.sections.length > 0 ? phrase.sections : undefined,
    phrase: {
      bars: params.plan.bars,
      notes: phrase.notes,
      chords: phrase.chords,
    },
    timing: phrase.timing,
  };
}

const tideMemoryE: PatternNoteDraft[] = [
  { beat: 0.5, length: 0.22, pitch: "B5", velocity: 0.13, pan: 0.12, toneIntent: "chord" },
  { beat: 1.5, length: 0.24, pitch: "E6", velocity: 0.15, pan: -0.06, toneIntent: "chord" },
  { beat: 2.5, length: 0.3, pitch: "G6", velocity: 0.14, pan: 0.08, toneIntent: "scale" },
];

const tideBellE: PatternNoteDraft[] = [
  { beat: 3.0, length: 1.05, pitch: "F#6", velocity: 0.1, pan: 0.16, toneIntent: "scale" },
];

const tideMemoryC: PatternNoteDraft[] = [
  { beat: 0.5, length: 0.22, pitch: "G5", velocity: 0.12, pan: -0.12, toneIntent: "chord" },
  { beat: 1.5, length: 0.24, pitch: "C6", velocity: 0.13, pan: 0.04, toneIntent: "chord" },
  { beat: 2.5, length: 0.28, pitch: "E6", velocity: 0.14, pan: -0.04, toneIntent: "scale" },
];

const tideBellC: PatternNoteDraft[] = [
  { beat: 2.75, length: 0.9, pitch: "B5", velocity: 0.09, pan: 0.12, toneIntent: "scale" },
];

const tideMemoryG: PatternNoteDraft[] = [
  { beat: 0.5, length: 0.22, pitch: "D6", velocity: 0.13, pan: 0.1, toneIntent: "chord" },
  { beat: 1.5, length: 0.24, pitch: "G6", velocity: 0.14, pan: -0.04, toneIntent: "chord" },
  { beat: 2.5, length: 0.3, pitch: "A6", velocity: 0.14, pan: 0.08, toneIntent: "scale" },
];

const tideBellG: PatternNoteDraft[] = [
  { beat: 2.75, length: 0.9, pitch: "A6", velocity: 0.1, pan: 0.16, toneIntent: "scale" },
];

const tideMemoryD: PatternNoteDraft[] = [
  { beat: 0.5, length: 0.22, pitch: "A5", velocity: 0.12, pan: -0.08, toneIntent: "chord" },
  { beat: 1.5, length: 0.24, pitch: "D6", velocity: 0.13, pan: 0.04, toneIntent: "chord" },
  { beat: 2.5, length: 0.3, pitch: "F#6", velocity: 0.13, pan: -0.04, toneIntent: "scale" },
];

const tideBellD: PatternNoteDraft[] = [
  { beat: 2.75, length: 0.9, pitch: "A6", velocity: 0.09, pan: 0.14, toneIntent: "scale" },
];

const tideSparseE: PatternNoteDraft[] = [
  { beat: 0.75, length: 0.24, pitch: "B5", velocity: 0.1, pan: 0.1, toneIntent: "chord" },
  { beat: 2.5, length: 0.28, pitch: "E6", velocity: 0.11, pan: -0.04, toneIntent: "chord" },
];

const tideSparseBellE: PatternNoteDraft[] = [
  { beat: 3.0, length: 1, pitch: "E6", velocity: 0.09, pan: 0.14, toneIntent: "chord" },
];

const tideSparseG: PatternNoteDraft[] = [
  { beat: 0.75, length: 0.24, pitch: "D6", velocity: 0.1, pan: 0.08, toneIntent: "chord" },
  { beat: 2.5, length: 0.28, pitch: "G6", velocity: 0.11, pan: -0.04, toneIntent: "chord" },
];

const tideSparseBellG: PatternNoteDraft[] = [
  { beat: 3.0, length: 0.95, pitch: "A6", velocity: 0.08, pan: 0.12, toneIntent: "scale" },
];

const tideReturnE: PatternNoteDraft[] = [
  { beat: 0.5, length: 0.22, pitch: "B5", velocity: 0.12, pan: 0.1, toneIntent: "chord" },
  { beat: 1.5, length: 0.32, pitch: "E6", velocity: 0.15, pan: -0.04, toneIntent: "chord" },
  { beat: 3.25, length: 1.35, pitch: "E6", velocity: 0.17, pan: 0.08, toneIntent: "chord" },
];

const tideCurrentE: PatternNoteDraft[] = [
  { beat: 0.75, length: 0.2, pitch: "B5", velocity: 0.11, pan: 0.1, toneIntent: "chord" },
  { beat: 1.75, length: 0.24, pitch: "E6", velocity: 0.13, pan: -0.04, toneIntent: "chord" },
  { beat: 2.75, length: 0.34, pitch: "G6", velocity: 0.12, pan: 0.06, toneIntent: "scale" },
];

const tideCurrentG: PatternNoteDraft[] = [
  { beat: 0.75, length: 0.2, pitch: "D6", velocity: 0.11, pan: 0.08, toneIntent: "chord" },
  { beat: 1.75, length: 0.24, pitch: "G6", velocity: 0.13, pan: -0.02, toneIntent: "chord" },
  { beat: 2.75, length: 0.34, pitch: "A6", velocity: 0.12, pan: 0.06, toneIntent: "scale" },
];

const tideGatherC: PatternNoteDraft[] = [
  { beat: 0.75, length: 0.22, pitch: "G5", velocity: 0.11, pan: -0.08, toneIntent: "chord" },
  { beat: 2.0, length: 0.3, pitch: "C6", velocity: 0.13, pan: 0.02, toneIntent: "chord" },
  { beat: 3.0, length: 0.56, pitch: "E6", velocity: 0.14, pan: 0.06, toneIntent: "scale" },
];

const tideApproachD: PatternNoteDraft[] = [
  { beat: 0.75, length: 0.22, pitch: "A5", velocity: 0.11, pan: -0.06, toneIntent: "chord" },
  { beat: 2.0, length: 0.3, pitch: "D6", velocity: 0.13, pan: 0.02, toneIntent: "chord" },
  { beat: 3.0, length: 0.7, pitch: "F#6", velocity: 0.14, pan: 0.08, toneIntent: "scale" },
];

const lowTideBaselineNotes: Composition["phrase"]["notes"] = [
  { beat: 0.0, length: 8.0, pitch: "E3", synth: "breathingDrone", velocity: 0.18, pan: -0.08 },
  { beat: 0.0, length: 8.0, pitch: "B3", synth: "breathingDrone", velocity: 0.11, pan: 0.08 },
  { beat: 8.0, length: 8.0, pitch: "G3", synth: "breathingDrone", velocity: 0.15, pan: 0.06 },
  { beat: 8.0, length: 8.0, pitch: "D4", synth: "breathingDrone", velocity: 0.1, pan: -0.06 },
  { beat: 16.0, length: 8.0, pitch: "C3", synth: "breathingDrone", velocity: 0.14, pan: -0.07 },
  { beat: 16.0, length: 8.0, pitch: "G3", synth: "breathingDrone", velocity: 0.1, pan: 0.07 },
  { beat: 24.0, length: 8.0, pitch: "E3", synth: "breathingDrone", velocity: 0.18, pan: 0.08 },
  { beat: 24.0, length: 8.0, pitch: "B3", synth: "breathingDrone", velocity: 0.12, pan: -0.08 },

  { beat: 0.5, length: 0.24, pitch: "B5", synth: "pluckyDust", velocity: 0.13, pan: 0.12 },
  { beat: 1.25, length: 0.24, pitch: "E6", synth: "pluckyDust", velocity: 0.14, pan: -0.06 },
  { beat: 2.0, length: 0.24, pitch: "G6", synth: "pluckyDust", velocity: 0.14, pan: 0.08 },
  { beat: 2.75, length: 0.9, pitch: "F#6", synth: "glassBell", velocity: 0.1, pan: 0.16 },

  { beat: 4.5, length: 0.24, pitch: "G5", synth: "pluckyDust", velocity: 0.12, pan: -0.12 },
  { beat: 5.25, length: 0.24, pitch: "C6", synth: "pluckyDust", velocity: 0.13, pan: 0.04 },
  { beat: 6.0, length: 0.24, pitch: "E6", synth: "pluckyDust", velocity: 0.14, pan: -0.04 },
  { beat: 6.75, length: 0.9, pitch: "B5", synth: "glassBell", velocity: 0.09, pan: 0.12 },

  { beat: 8.5, length: 0.24, pitch: "D6", synth: "pluckyDust", velocity: 0.13, pan: 0.1 },
  { beat: 9.25, length: 0.24, pitch: "G6", synth: "pluckyDust", velocity: 0.14, pan: -0.04 },
  { beat: 10.0, length: 0.24, pitch: "B6", synth: "pluckyDust", velocity: 0.15, pan: 0.08 },
  { beat: 10.75, length: 0.9, pitch: "A6", synth: "glassBell", velocity: 0.1, pan: 0.16 },

  { beat: 12.5, length: 0.24, pitch: "A5", synth: "pluckyDust", velocity: 0.12, pan: -0.08 },
  { beat: 13.25, length: 0.24, pitch: "D6", synth: "pluckyDust", velocity: 0.13, pan: 0.04 },
  { beat: 14.0, length: 0.24, pitch: "E6", synth: "pluckyDust", velocity: 0.14, pan: -0.04 },
  { beat: 14.75, length: 0.9, pitch: "A6", synth: "glassBell", velocity: 0.09, pan: 0.14 },

  { beat: 16.5, length: 0.24, pitch: "G5", synth: "pluckyDust", velocity: 0.12, pan: -0.12 },
  { beat: 17.25, length: 0.24, pitch: "C6", synth: "pluckyDust", velocity: 0.13, pan: 0.04 },
  { beat: 18.0, length: 0.24, pitch: "E6", synth: "pluckyDust", velocity: 0.14, pan: -0.02 },
  { beat: 18.75, length: 0.9, pitch: "B5", synth: "glassBell", velocity: 0.09, pan: 0.12 },

  { beat: 20.5, length: 0.24, pitch: "D6", synth: "pluckyDust", velocity: 0.13, pan: 0.08 },
  { beat: 21.25, length: 0.24, pitch: "G6", synth: "pluckyDust", velocity: 0.14, pan: -0.04 },
  { beat: 22.0, length: 0.24, pitch: "B6", synth: "pluckyDust", velocity: 0.15, pan: 0.08 },
  { beat: 22.75, length: 0.9, pitch: "A6", synth: "glassBell", velocity: 0.09, pan: 0.14 },

  { beat: 24.5, length: 0.24, pitch: "A5", synth: "pluckyDust", velocity: 0.12, pan: -0.08 },
  { beat: 25.25, length: 0.24, pitch: "D6", synth: "pluckyDust", velocity: 0.13, pan: 0.04 },
  { beat: 26.0, length: 0.24, pitch: "E6", synth: "pluckyDust", velocity: 0.14, pan: -0.02 },
  { beat: 26.75, length: 0.9, pitch: "A6", synth: "glassBell", velocity: 0.09, pan: 0.14 },

  { beat: 28.5, length: 0.24, pitch: "B5", synth: "pluckyDust", velocity: 0.13, pan: 0.1 },
  { beat: 29.25, length: 0.24, pitch: "E6", synth: "pluckyDust", velocity: 0.14, pan: -0.04 },
  { beat: 30.0, length: 0.24, pitch: "G6", synth: "pluckyDust", velocity: 0.14, pan: 0.06 },
  { beat: 30.75, length: 1.2, pitch: "E6", synth: "glassBell", velocity: 0.11, pan: 0.16 },

  { beat: 0.0, length: 0.35, pitch: "E2", synth: "roundBass", velocity: 0.3, pan: 0 },
  { beat: 8.0, length: 0.35, pitch: "G2", synth: "roundBass", velocity: 0.24, pan: 0 },
  { beat: 16.0, length: 0.35, pitch: "C3", synth: "roundBass", velocity: 0.26, pan: 0 },
  { beat: 24.0, length: 0.35, pitch: "D2", synth: "roundBass", velocity: 0.24, pan: 0 },
  { beat: 28.0, length: 0.35, pitch: "E2", synth: "roundBass", velocity: 0.3, pan: 0 },
];

const lowTideBaselineChords: Composition["phrase"]["chords"] = [
  { beat: 0, length: 4, root: "E3", quality: "minorAdd9", synth: "warmPad", velocity: 0.23, inversion: 0, spread: 0.012 },
  { beat: 4, length: 4, root: "C3", quality: "major7", synth: "warmPad", velocity: 0.21, inversion: 1, spread: 0.012 },
  { beat: 8, length: 4, root: "G3", quality: "major", synth: "warmPad", velocity: 0.21, inversion: 0, spread: 0.012 },
  { beat: 12, length: 4, root: "D3", quality: "sus2", synth: "warmPad", velocity: 0.23, inversion: 1, spread: 0.012 },
  { beat: 16, length: 4, root: "C3", quality: "major7", synth: "warmPad", velocity: 0.21, inversion: 0, spread: 0.012 },
  { beat: 20, length: 4, root: "G3", quality: "major", synth: "warmPad", velocity: 0.2, inversion: 1, spread: 0.012 },
  { beat: 24, length: 4, root: "D3", quality: "sus2", synth: "warmPad", velocity: 0.22, inversion: 0, spread: 0.012 },
  { beat: 28, length: 4, root: "E3", quality: "minorAdd9", synth: "warmPad", velocity: 0.24, inversion: 0, spread: 0.012 },
];

function buildLowTideMasterHarmony(): HarmonyPlanItem[] {
  return [
    { bar: 0, root: "E3", quality: "minorAdd9", velocity: 0.2, spread: 0.012, tag: "shore" },
    { bar: 1, root: "C3", quality: "major7", velocity: 0.18, inversion: 1, spread: 0.012, tag: "shore" },
    { bar: 2, root: "G3", quality: "major", velocity: 0.18, spread: 0.012, tag: "shore" },
    { bar: 3, root: "D3", quality: "sus2", velocity: 0.2, inversion: 1, spread: 0.012, tag: "shore" },
    { bar: 4, root: "E3", quality: "minorAdd9", velocity: 0.2, spread: 0.012, tag: "current" },
    { bar: 5, root: "G3", quality: "major", velocity: 0.18, spread: 0.012, tag: "current" },
    { bar: 6, root: "C3", quality: "major7", velocity: 0.18, inversion: 1, spread: 0.012, tag: "current" },
    { bar: 7, root: "B3", quality: "minor7", velocity: 0.18, inversion: 0, spread: 0.012, tag: "current" },
    { bar: 8, root: "C3", quality: "major7", lengthBars: 2, velocity: 0.16, inversion: 0, spread: 0.012, tag: "night" },
    { bar: 10, root: "D3", quality: "sus2", lengthBars: 2, velocity: 0.17, inversion: 1, spread: 0.012, tag: "night" },
    { bar: 12, root: "C3", quality: "major7", velocity: 0.17, inversion: 0, spread: 0.012, tag: "return" },
    { bar: 13, root: "G3", quality: "major", velocity: 0.17, spread: 0.012, tag: "return" },
    { bar: 14, root: "D3", quality: "sus2", velocity: 0.19, inversion: 1, spread: 0.012, tag: "return" },
    { bar: 15, root: "E3", quality: "minorAdd9", velocity: 0.25, spread: 0.012, tag: "cadence" },
  ];
}

function buildLowTideMemoryPlucks(): PatternNoteDraft[] {
  return [
    ...placeDraftNotes(tideMemoryE, { beatOffset: lowTidePartStart(0) }),
    ...placeDraftNotes(tideMemoryC, { beatOffset: lowTidePartStart(0) + 4 }),
    ...placeDraftNotes(tideMemoryG, { beatOffset: lowTidePartStart(0) + 8 }),
    ...placeDraftNotes(tideMemoryD, { beatOffset: lowTidePartStart(0) + 12 }),
    ...placeDraftNotes(tideCurrentE, { beatOffset: lowTidePartStart(1), velocityScale: 0.9 }),
    ...placeDraftNotes(tideCurrentG, { beatOffset: lowTidePartStart(1) + 4, velocityScale: 0.88 }),
    ...placeDraftNotes(tideMemoryC, { beatOffset: lowTidePartStart(1) + 8, velocityScale: 0.84 }),
    ...placeDraftNotes(tideMemoryD, { beatOffset: lowTidePartStart(1) + 12, velocityScale: 0.86 }),
    ...placeDraftNotes(tideSparseE, { beatOffset: lowTidePartStart(2), velocityScale: 0.72 }),
    ...placeDraftNotes(tideSparseG, { beatOffset: lowTidePartStart(2) + 8, velocityScale: 0.72 }),
    ...placeDraftNotes(tideGatherC, { beatOffset: lowTidePartStart(3), velocityScale: 0.86 }),
    ...placeDraftNotes(tideMemoryG, { beatOffset: lowTidePartStart(3) + 4, velocityScale: 0.92 }),
    ...placeDraftNotes(tideApproachD, { beatOffset: lowTidePartStart(3) + 8, velocityScale: 0.96 }),
    ...placeDraftNotes(tideReturnE, { beatOffset: lowTidePartStart(3) + 12, velocityScale: 1.08 }),
  ];
}

function buildLowTideBells(): PatternNoteDraft[] {
  return [
    ...placeDraftNotes(tideBellE, { beatOffset: lowTidePartStart(0) }),
    ...placeDraftNotes(tideBellC, { beatOffset: lowTidePartStart(0) + 4 }),
    ...placeDraftNotes(tideBellG, { beatOffset: lowTidePartStart(0) + 8 }),
    ...placeDraftNotes(tideBellD, { beatOffset: lowTidePartStart(0) + 12 }),
    ...placeDraftNotes(tideBellE, { beatOffset: lowTidePartStart(1), velocityScale: 0.8 }),
    ...placeDraftNotes(tideBellG, { beatOffset: lowTidePartStart(1) + 4, velocityScale: 0.78 }),
    ...placeDraftNotes(tideBellC, { beatOffset: lowTidePartStart(1) + 8, velocityScale: 0.76 }),
    ...placeDraftNotes(tideBellD, { beatOffset: lowTidePartStart(1) + 12, velocityScale: 0.78 }),
    ...placeDraftNotes(tideSparseBellE, { beatOffset: lowTidePartStart(2), velocityScale: 0.7 }),
    ...placeDraftNotes(tideSparseBellG, { beatOffset: lowTidePartStart(2) + 8, velocityScale: 0.68 }),
    ...placeDraftNotes(tideBellC, { beatOffset: lowTidePartStart(3), velocityScale: 0.84 }),
    ...placeDraftNotes(tideBellG, { beatOffset: lowTidePartStart(3) + 8, velocityScale: 0.88 }),
    {
      beat: lowTidePartStart(3) + 15,
      length: 1.8,
      pitch: "E6",
      velocity: 0.14,
      pan: 0.16,
      toneIntent: "chord",
    },
  ];
}

function buildLowTideDrone(): PatternNoteDraft[] {
  return [
    { beat: 0, length: 16, pitch: "E3", velocity: 0.15, pan: -0.08, toneIntent: "chord" },
    { beat: 0, length: 16, pitch: "B3", velocity: 0.09, pan: 0.08, toneIntent: "chord" },
    { beat: 16, length: 8, pitch: "G3", velocity: 0.12, pan: 0.06, toneIntent: "chord" },
    { beat: 16, length: 8, pitch: "D4", velocity: 0.08, pan: -0.06, toneIntent: "chord" },
    { beat: 24, length: 8, pitch: "C3", velocity: 0.11, pan: -0.06, toneIntent: "chord" },
    { beat: 24, length: 8, pitch: "G3", velocity: 0.08, pan: 0.06, toneIntent: "chord" },
    { beat: 32, length: 8, pitch: "C3", velocity: 0.09, pan: -0.07, toneIntent: "chord" },
    { beat: 32, length: 8, pitch: "G3", velocity: 0.06, pan: 0.07, toneIntent: "chord" },
    { beat: 40, length: 8, pitch: "D3", velocity: 0.1, pan: 0.06, toneIntent: "chord" },
    { beat: 40, length: 8, pitch: "A3", velocity: 0.06, pan: -0.06, toneIntent: "chord" },
    { beat: 48, length: 8, pitch: "G3", velocity: 0.11, pan: 0.06, toneIntent: "chord" },
    { beat: 48, length: 8, pitch: "D4", velocity: 0.07, pan: -0.06, toneIntent: "chord" },
    { beat: 56, length: 8, pitch: "E3", velocity: 0.15, pan: 0.08, toneIntent: "chord" },
    { beat: 56, length: 8, pitch: "B3", velocity: 0.09, pan: -0.08, toneIntent: "chord" },
  ];
}

function buildLowTideBass(): PatternNoteDraft[] {
  return [
    { beat: 0, length: 0.36, pitch: "E2", velocity: 0.3, toneIntent: "chord" },
    { beat: 8, length: 0.34, pitch: "G2", velocity: 0.24, toneIntent: "chord" },
    { beat: 16, length: 0.36, pitch: "E2", velocity: 0.28, toneIntent: "chord" },
    { beat: 24, length: 0.34, pitch: "C3", velocity: 0.24, toneIntent: "chord" },
    { beat: 32, length: 0.34, pitch: "C3", velocity: 0.2, toneIntent: "chord" },
    { beat: 40, length: 0.34, pitch: "D2", velocity: 0.2, toneIntent: "chord" },
    { beat: 48, length: 0.34, pitch: "G2", velocity: 0.22, toneIntent: "chord" },
    { beat: 56, length: 0.36, pitch: "D2", velocity: 0.24, toneIntent: "chord" },
    { beat: 60, length: 0.62, pitch: "E2", velocity: 0.34, toneIntent: "chord" },
    { beat: 63, length: 0.86, pitch: "E2", velocity: 0.22, toneIntent: "chord" },
  ];
}

function buildLowTideMasterPlan(): PhrasePlan {
  const harmony = buildLowTideMasterHarmony();
  return {
    bars: LOW_TIDE_MASTER_BARS,
    beatsPerBar: LOW_TIDE_BEATS_PER_BAR,
    key: { root: "E", scale: "minor" },
    harmony,
    sections: [
      {
        id: "low-tide-shore",
        role: "statement",
        startBar: 0,
        bars: 4,
        bias: {
          density: -0.06,
          register: 0,
          brightness: -0.02,
          cadence: 0.86,
        },
        description: "The shoreline memory appears in its clearest outline.",
      },
      {
        id: "low-tide-current",
        role: "variation",
        startBar: 4,
        bars: 4,
        bias: {
          density: -0.02,
          register: 0.04,
          brightness: 0.04,
          cadence: 0.9,
        },
        description: "The tide starts pulling the same memory sideways.",
      },
      {
        id: "low-tide-night",
        role: "shadow",
        startBar: 8,
        bars: 4,
        bias: {
          density: -0.28,
          register: -0.12,
          brightness: -0.14,
          cadence: 0.62,
        },
        description: "The shoreline vanishes and only two lights remain.",
      },
      {
        id: "low-tide-return",
        role: "return",
        startBar: 12,
        bars: 3,
        bias: {
          density: -0.04,
          register: 0.06,
          brightness: 0.04,
          cadence: 1.06,
        },
        description: "The pieces gather themselves back into one tide line.",
      },
      {
        id: "low-tide-ebb",
        role: "cadence",
        startBar: 15,
        bars: 1,
        bias: {
          density: -0.1,
          register: 0.06,
          brightness: 0.06,
          cadence: 1.36,
        },
        description: "The final tide line resolves under the moon.",
      },
    ],
    padLayers: [{ synth: "warmPad", voiceId: "pad", velocityScale: 0.84 }],
    arrangement: {
      densityCurve: [
        { beat: 0, value: 0.28 },
        { beat: lowTidePartStart(1), value: 0.34 },
        { beat: lowTidePartStart(2), value: 0.08 },
        { beat: lowTidePartStart(3), value: 0.38 },
        { beat: LOW_TIDE_MASTER_BARS * LOW_TIDE_BEATS_PER_BAR, value: 0.3 },
      ],
      registerCurve: [
        { beat: 0, value: 0 },
        { beat: lowTidePartStart(1), value: 0.06 },
        { beat: lowTidePartStart(2), value: -0.18 },
        { beat: lowTidePartStart(3), value: 0.08 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.3 },
        { beat: lowTidePartStart(1), value: 0.4 },
        { beat: lowTidePartStart(2), value: 0.14 },
        { beat: lowTidePartStart(3), value: 0.44 },
        { beat: LOW_TIDE_MASTER_BARS * LOW_TIDE_BEATS_PER_BAR, value: 0.32 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.1 },
        { beat: lowTidePartStart(0) + 15.25, value: 0.28 },
        { beat: lowTidePartStart(1) + 15.25, value: 0.38 },
        { beat: lowTidePartStart(2) + 15.25, value: 0.14 },
        { beat: lowTidePartStart(3) + 11.5, value: 0.54 },
        { beat: lowTidePartStart(3) + 15.25, value: 0.96 },
      ],
      ornamentBaseProbability: 0.1,
    },
    noteLayers: [
      {
        kind: "draft",
        id: "low-tide-drone",
        synth: "breathingDrone",
        voiceId: "drone",
        notes: buildLowTideDrone(),
        register: { min: "B2", max: "D4", anchor: "E3" },
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "low-tide-plucks",
        synth: "pluckyDust",
        voiceId: "lead",
        notes: buildLowTideMemoryPlucks(),
        register: { min: "G5", max: "A6", anchor: "E6" },
        clampToHarmony: false,
      },
      {
        kind: "draft",
        id: "low-tide-bells",
        synth: "glassBell",
        voiceId: "bells",
        notes: buildLowTideBells(),
        register: { min: "B5", max: "A6", anchor: "E6" },
        clampToHarmony: false,
      },
      {
        kind: "draft",
        id: "low-tide-bass",
        synth: "roundBass",
        voiceId: "bass",
        notes: buildLowTideBass(),
        register: { min: "E2", max: "C3", anchor: "E2" },
        clampToHarmony: false,
      },
    ],
  };
}

export const lowTideMemoryBaseline: Composition = {
  id: "low-tide-memory-baseline",
  title: "Low Tide Memory (Baseline)",
  bpm: LOW_TIDE_BPM,
  beatsPerBar: LOW_TIDE_BEATS_PER_BAR,
  key: { root: "E", scale: "minor" },
  loop: true,
  phrase: {
    bars: 8,
    notes: lowTideBaselineNotes,
    chords: lowTideBaselineChords,
  },
};

export const lowTideMemory: Composition = buildComposition({
  id: "low-tide-memory",
  title: "Low Tide Memory",
  key: { root: "E", scale: "minor" },
  bpm: LOW_TIDE_BPM,
  beatsPerBar: LOW_TIDE_BEATS_PER_BAR,
  plan: buildLowTideMasterPlan(),
});

```

## /Users/william/Projects/TSinger/src/audio/testing/types.ts

```ts
import type { ChordQuality, Composition, SynthName } from "../composition";
import type { SectionRole, VoiceId } from "../metadata";
import type { TimingMetadata } from "../authoring/timing";

export type WindowedSeries = number[];

export type PitchRange = {
  min: string | null;
  max: string | null;
};

export type SymbolicCollision = {
  beat: number;
  bar: number;
  pitches: string[];
  voices: string[];
  sectionId?: string;
  sectionRole?: SectionRole;
};

export type ExpandedEventKind = "note" | "chordTone";

export type ExpandedEventRole =
  | "lead"
  | "counterline"
  | "accent"
  | "bass"
  | "pad"
  | "drone"
  | "ornament"
  | "texture";

export type ExpandedScheduledEvent = {
  id: string;
  sourceKind: ExpandedEventKind;
  sourceIndex: number;
  synth: SynthName;
  voiceId: VoiceId;
  layerId?: string;
  role: ExpandedEventRole;
  pitch: string;
  midi: number;
  beat: number;
  endBeat: number;
  durationBeats: number;
  velocity: number;
  barIndex: number;
  sectionId?: string;
  sectionRole?: SectionRole;
  chordRoot?: string;
  chordQuality?: ChordQuality;
  toneIndex?: number;
};

export type EventCollection = {
  noteEvents: ExpandedScheduledEvent[];
  chordToneEvents: ExpandedScheduledEvent[];
  mergedEvents: ExpandedScheduledEvent[];
};

export type VoiceAnalysis = {
  voiceId: string;
  synths: SynthName[];
  noteCount: number;
  pitchRange: PitchRange;
  averageLeapSemitones: number;
  maxLeapSemitones: number;
  repeatedPitchRatio: number;
  registerCenterMidi: number | null;
};

export type RoughnessCause = {
  beat: number;
  bar: number;
  sectionId?: string;
  sectionRole?: SectionRole;
  pitchA: string;
  pitchB: string;
  midiA: number;
  midiB: number;
  layerIdA?: string;
  layerIdB?: string;
  voiceA?: string;
  voiceB?: string;
  synthA?: string;
  synthB?: string;
  intervalSemitones: number;
  overlapBeats: number;
  registerBand: "low" | "mid" | "high";
  score: number;
  reason: string;
  patch: string;
  severity: "info" | "warning" | "error";
};

export type SymbolicAnalysis = {
  noteCount: number;
  chordEventCount: number;
  uniquePitches: string[];
  pitchRange: PitchRange;
  averageLeapSemitones: number;
  maxLeapSemitones: number;
  averageLeadLeapSemitones?: number;
  voiceAnalyses: VoiceAnalysis[];
  highRegisterDissonanceWarnings: string[];
  simultaneousCollisions: SymbolicCollision[];
  roughnessCauses: RoughnessCause[];
  noteDensityByBar: number[];
  onsetCountByBar: number[];
  chordToneRatio: number;
  colorToneRatio: number;
  repeatedPitchRatio: number;
  registerCenterMidi: number | null;
  cadenceStrengthByBar: number[];
  duplicateEventWarnings: string[];
  timing: TimingMetadata;
};

export type AudioFeatureAnalysis = {
  sampleRate: number;
  durationSeconds: number;
  rmsByWindow: WindowedSeries;
  peakByWindow: WindowedSeries;
  zeroCrossingRateByWindow: WindowedSeries;
  spectralCentroidByWindow: WindowedSeries;
  spectralRolloffByWindow: WindowedSeries;
  onsetStrengthByWindow: WindowedSeries;
  noveltyByBar: number[];
  roughnessByWindow: WindowedSeries;
  dcOffset: number;
  clippingSampleCount: number;
};

export type ValidationWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export type SectionAnalysis = {
  id: string;
  role: SectionRole;
  startBar: number;
  bars: number;
  description?: string;
  averageDensity: number;
  averageOnsets: number;
  averageCadenceStrength: number;
  averageNovelty: number | null;
};

export type PresetAnalysis = {
  presetId: string;
  title: string;
  renderedAtIso: string;
  durationSeconds: number;
  bars: number;
  bpm: number;
  beatsPerBar: number;
  sections: SectionAnalysis[];
  symbolic: SymbolicAnalysis;
  audio: AudioFeatureAnalysis;
  validationWarnings: ValidationWarning[];
  suggestedMusicalEdits: string[];
};

export type ComparisonDelta = {
  metric: string;
  before: number | string | null;
  after: number | string | null;
  delta?: number | null;
  interpretation: string;
};

export type PresetComparison = {
  presetIdA: string;
  presetIdB: string;
  summary: string;
  deltas: ComparisonDelta[];
};

export type AnalyzeOptions = {
  outputDir: string;
  generateCharts?: boolean;
  renderRepeats?: number;
  sampleRate?: number;
  offlineTailSeconds?: number;
  windowSize?: number;
  hopSize?: number;
};

export type OfflineRenderResult = {
  sampleRate: number;
  durationSeconds: number;
  channelData: Float32Array[];
  phraseRepeats: number;
  musicalDurationSeconds: number;
  tailSeconds: number;
};

export type ChartArtifact = {
  filename: string;
  content: string;
};

export type AnalysisArtifacts = {
  analysis: PresetAnalysis;
  events: EventCollection;
  report: string;
  charts: ChartArtifact[];
  render: OfflineRenderResult;
  composition: Composition;
};

```

## /Users/william/Projects/TSinger/src/audio/testing/symbolicAnalysis.ts

```ts
import type { Composition } from "../composition";
import { isChordTone, isScaleTone } from "../authoring/harmony";
import { describeSwingProfile } from "../authoring/timing";
import { getPitchClass, midiToNote } from "../theory";
import { describeVoiceId, isLeadVoiceId } from "../voiceIdentity";
import { findActiveChordAtBeat, mergeAllScheduledEvents } from "./collectEvents";
import { buildRoughnessCauses, getActiveEventsAtBeat } from "./roughness";
import type {
  EventCollection,
  ExpandedScheduledEvent,
  SymbolicAnalysis,
  SymbolicCollision,
  VoiceAnalysis,
} from "./types";

const HARSH_INTERVALS = new Set([1, 2, 6, 10, 11]);
const HIGH_REGISTER_WARNING_MIDI = 76;
const HIGH_REGISTER_LOWER_FLOOR_MIDI = 64;
const COLLISION_TOLERANCE_BEATS = 0.05;
const COLLISION_CLUSTER_WINDOW_BEATS = 0.08;
const MAX_COLLISION_SPACING_SEMITONES = 16;
const MAX_HIGH_REGISTER_WARNING_SPACING_SEMITONES = 14;

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function normalizeInterval(semitones: number): number {
  const normalized = modulo(Math.abs(semitones), 12);
  return Math.min(normalized, 12 - normalized);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function isLeadLike(event: ExpandedScheduledEvent): boolean {
  return isLeadVoiceId(event.voiceId) || event.role === "lead";
}

function buildLeapSeries(
  events: ExpandedScheduledEvent[],
  maxGapBeats: number,
): number[] {
  if (events.length <= 1) {
    return [];
  }

  const leaps: number[] = [];

  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1]!;
    const current = events[index]!;
    if (current.beat - previous.endBeat > maxGapBeats) {
      continue;
    }
    leaps.push(Math.abs(current.midi - previous.midi));
  }

  return leaps;
}

function groupByLine(events: ExpandedScheduledEvent[]): ExpandedScheduledEvent[][] {
  const grouped = new Map<string, ExpandedScheduledEvent[]>();

  for (const event of events) {
    const voiceKey = event.voiceId || event.synth;
    const lineKey = event.layerId ?? event.synth;
    const key = `${voiceKey}|${lineKey}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(event);
  }

  return [...grouped.values()].map((group) =>
    [...group].sort((left, right) => {
      if (left.beat !== right.beat) {
        return left.beat - right.beat;
      }

      return left.midi - right.midi;
    }),
  );
}

function buildRepeatedPitchStats(
  events: ExpandedScheduledEvent[],
  maxGapBeats: number,
): { matches: number; comparisons: number } {
  let matches = 0;
  let comparisons = 0;

  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1]!;
    const current = events[index]!;
    if (current.beat - previous.endBeat > maxGapBeats) {
      continue;
    }

    comparisons += 1;
    if (current.pitch === previous.pitch) {
      matches += 1;
    }
  }

  return { matches, comparisons };
}

function buildVoiceAnalyses(
  lineGroups: ExpandedScheduledEvent[][],
  maxGapBeats: number,
): VoiceAnalysis[] {
  const grouped = new Map<
    string,
    {
      events: ExpandedScheduledEvent[];
      leaps: number[];
      repeatedMatches: number;
      repeatedComparisons: number;
      weightedMidiSum: number;
      weightSum: number;
    }
  >();

  for (const group of lineGroups) {
    if (group.length === 0) {
      continue;
    }

    const key = group[0]!.voiceId || group[0]!.synth;
    const leaps = buildLeapSeries(group, maxGapBeats);
    const repeated = buildRepeatedPitchStats(group, maxGapBeats);
    const weightedMidiSum = group.reduce(
      (sum, event) => sum + event.midi * event.durationBeats * event.velocity,
      0,
    );
    const weightSum = group.reduce(
      (sum, event) => sum + event.durationBeats * event.velocity,
      0,
    );
    const current = grouped.get(key) ?? {
      events: [],
      leaps: [],
      repeatedMatches: 0,
      repeatedComparisons: 0,
      weightedMidiSum: 0,
      weightSum: 0,
    };

    current.events.push(...group);
    current.leaps.push(...leaps);
    current.repeatedMatches += repeated.matches;
    current.repeatedComparisons += repeated.comparisons;
    current.weightedMidiSum += weightedMidiSum;
    current.weightSum += weightSum;
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((group) => ({
      voiceId: describeVoiceId(group.events[0]?.voiceId, group.events[0]?.synth),
      synths: [...new Set(group.events.map((event) => event.synth))].sort(),
      noteCount: group.events.length,
      pitchRange: {
        min:
          group.events.length > 0
            ? midiToNote(Math.min(...group.events.map((event) => event.midi)))
            : null,
        max:
          group.events.length > 0
            ? midiToNote(Math.max(...group.events.map((event) => event.midi)))
            : null,
      },
      averageLeapSemitones: Number(average(group.leaps).toFixed(4)),
      maxLeapSemitones: group.leaps.length > 0 ? Math.max(...group.leaps) : 0,
      repeatedPitchRatio:
        group.repeatedComparisons > 0
          ? Number((group.repeatedMatches / group.repeatedComparisons).toFixed(4))
          : 0,
      registerCenterMidi:
        group.weightSum > 0 ? Number((group.weightedMidiSum / group.weightSum).toFixed(3)) : null,
    }))
    .sort((left, right) => {
      if (left.voiceId === "lead") {
        return -1;
      }

      if (right.voiceId === "lead") {
        return 1;
      }

      return right.noteCount - left.noteCount;
    });
}

function buildDuplicateWarnings(events: ExpandedScheduledEvent[]): string[] {
  const warnings: string[] = [];
  const seen = new Map<string, ExpandedScheduledEvent>();

  for (const event of events) {
    const roundedBeat = event.beat.toFixed(2);
    const key = `${event.voiceId}|${event.layerId ?? event.synth}|${event.pitch}|${roundedBeat}|${event.sourceKind}`;
    const previous = seen.get(key);

    if (previous && Math.abs(previous.beat - event.beat) <= 0.01) {
      warnings.push(
        `Duplicate ${describeVoiceId(event.voiceId, event.synth)} event on ${event.pitch} near beat ${roundedBeat}.`,
      );
    } else {
      seen.set(key, event);
    }
  }

  return unique(warnings);
}

function buildDensityByBar(
  composition: Composition,
  events: ExpandedScheduledEvent[],
): number[] {
  return Array.from({ length: composition.phrase.bars }, (_, barIndex) => {
    const barStart = barIndex * composition.beatsPerBar;
    const barEnd = barStart + composition.beatsPerBar;

    const occupiedBeats = events.reduce((sum, event) => {
      const overlapStart = Math.max(event.beat, barStart);
      const overlapEnd = Math.min(event.endBeat, barEnd);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      return sum + overlap;
    }, 0);

    return Number((occupiedBeats / composition.beatsPerBar).toFixed(4));
  });
}

function buildOnsetsByBar(
  composition: Composition,
  events: ExpandedScheduledEvent[],
): number[] {
  return Array.from({ length: composition.phrase.bars }, (_, barIndex) => {
    const barStart = barIndex * composition.beatsPerBar;
    const barEnd = barStart + composition.beatsPerBar;

    return events.filter(
      (event) => event.beat >= barStart && event.beat < barEnd,
    ).length;
  });
}

function buildCollisions(
  events: ExpandedScheduledEvent[],
): {
  collisions: SymbolicCollision[];
  warnings: string[];
} {
  const candidateBeats = unique(events.map((event) => event.beat)).sort(
    (left, right) => left - right,
  );
  const collisions: SymbolicCollision[] = [];
  const warningMap = new Map<string, string>();

  function getExistingCollisionCluster(beat: number): SymbolicCollision | null {
    return (
      collisions.find(
        (collision) => Math.abs(collision.beat - beat) <= COLLISION_CLUSTER_WINDOW_BEATS,
      ) ?? null
    );
  }

  for (const beat of candidateBeats) {
    const active = getActiveEventsAtBeat(events, beat + COLLISION_TOLERANCE_BEATS * 0.5);
    if (active.length <= 1) {
      continue;
    }

    let collided = false;
    const collisionPitches = new Set<string>();
    const highRegisterPairs: Array<{ left: ExpandedScheduledEvent; right: ExpandedScheduledEvent }> = [];

    for (let index = 0; index < active.length; index += 1) {
      for (let inner = index + 1; inner < active.length; inner += 1) {
        const left = active[index]!;
        const right = active[inner]!;
        const interval = normalizeInterval(left.midi - right.midi);
        const spacing = Math.abs(left.midi - right.midi);

        if (!HARSH_INTERVALS.has(interval) || spacing > MAX_COLLISION_SPACING_SEMITONES) {
          continue;
        }

        collided = true;
        collisionPitches.add(left.pitch);
        collisionPitches.add(right.pitch);

        const upperMidi = Math.max(left.midi, right.midi);
        const lowerMidi = Math.min(left.midi, right.midi);

        if (
          spacing <= MAX_HIGH_REGISTER_WARNING_SPACING_SEMITONES &&
          upperMidi >= HIGH_REGISTER_WARNING_MIDI &&
          lowerMidi >= HIGH_REGISTER_LOWER_FLOOR_MIDI
        ) {
          highRegisterPairs.push({ left, right });
        }
      }
    }

    if (collided) {
      const existingCluster = getExistingCollisionCluster(beat);

      if (existingCluster) {
        existingCluster.pitches = unique([
          ...existingCluster.pitches,
          ...collisionPitches,
        ]).sort();
        existingCluster.voices = unique([
          ...existingCluster.voices,
          ...active.map((event) => describeVoiceId(event.voiceId, event.synth)),
        ]).sort();
      } else {
        collisions.push({
          beat: Number(beat.toFixed(4)),
          bar: (active[0]?.barIndex ?? 0) + 1,
          pitches: [...collisionPitches].sort(),
          voices: unique(active.map((event) => describeVoiceId(event.voiceId, event.synth))).sort(),
          sectionId: active.find((event) => event.sectionId)?.sectionId,
          sectionRole: active.find((event) => event.sectionRole)?.sectionRole,
        });
      }

      const clusterBeat = (getExistingCollisionCluster(beat) ?? { beat }).beat;
      const cluster = getExistingCollisionCluster(beat);
      const clusterBar = cluster ? cluster.bar : Math.floor(clusterBeat) + 1;

      for (const pair of highRegisterPairs) {
        const key = `${clusterBeat.toFixed(2)}|${pair.left.pitch}|${pair.right.pitch}|${pair.left.voiceId}|${pair.right.voiceId}`;
        warningMap.set(
          key,
          `High-register clash near bar ${clusterBar}, beat ${clusterBeat.toFixed(2)} between ${describeVoiceId(pair.left.voiceId, pair.left.synth)} ${pair.left.pitch} and ${describeVoiceId(pair.right.voiceId, pair.right.synth)} ${pair.right.pitch}.`,
        );
      }
    }
  }

  return {
    collisions: collisions.sort((left, right) => left.beat - right.beat),
    warnings: [...warningMap.values()],
  };
}

function buildCadenceStrengthByBar(
  composition: Composition,
  events: EventCollection,
): number[] {
  const keyPitchClass = getPitchClass(composition.key.root);

  return Array.from({ length: composition.phrase.bars }, (_, barIndex) => {
    const barStart = barIndex * composition.beatsPerBar;
    const barEnd = barStart + composition.beatsPerBar;
    const arrivalStart = barEnd - composition.beatsPerBar * 0.42;
    const leadInStart = barEnd - composition.beatsPerBar * 0.9;
    const endHarmony = findActiveChordAtBeat(composition, barEnd - 0.001);

    const arrivalEvents = events.mergedEvents.filter(
      (event) => event.beat >= arrivalStart && event.beat < barEnd + 0.001,
    );
    const leadInEvents = events.noteEvents.filter(
      (event) => event.beat >= leadInStart && event.beat < arrivalStart,
    );
    const arrivalOnsets = events.noteEvents.filter(
      (event) => event.beat >= arrivalStart && event.beat < barEnd + 0.001,
    ).length;

    const arrivalWeight = arrivalEvents.reduce((sum, event) => {
      const activeHarmony =
        event.chordRoot && event.chordQuality
          ? { root: event.chordRoot, quality: event.chordQuality }
          : findActiveChordAtBeat(composition, Math.min(event.endBeat, barEnd) - 0.001);
      const isCadentialChordTone = activeHarmony
        ? isChordTone(event.pitch, activeHarmony.root, activeHarmony.quality)
        : false;
      const overlapBeats =
        Math.min(event.endBeat, barEnd) - Math.max(event.beat, arrivalStart);
      const sourceWeight =
        event.sourceKind === "note"
          ? event.role === "lead"
            ? 1.14
            : event.role === "counterline"
            ? 1.02
            : event.role === "accent"
            ? 1.02
            : event.role === "ornament"
            ? 0.82
            : 0.88
          : 0.36;
      const pitchClass = getPitchClass(event.pitch);
      const rootBonus =
        activeHarmony && pitchClass === getPitchClass(activeHarmony.root) ? 1.24 : 1;
      const registerWeight =
        event.role === "bass" ? 1.08 : event.midi >= 76 && !isCadentialChordTone ? 0.86 : 1;
      const harmonyWeight = isCadentialChordTone
        ? 1.24
        : isScaleTone(event.pitch, composition.key.root, composition.key.scale)
        ? 0.92
        : 0.74;

      return (
        sum +
        Math.max(0, overlapBeats) *
          event.velocity *
          sourceWeight *
          rootBonus *
          registerWeight *
          harmonyWeight
      );
    }, 0);

    const leadInDensity = leadInEvents.length;
    const sparsityBonus = 1 + Math.max(0, leadInDensity - arrivalOnsets) * 0.08;
    const endHarmonyBonus = endHarmony
      ? getPitchClass(endHarmony.root) === keyPitchClass
        ? 1.2
        : getPitchClass(endHarmony.root) === (keyPitchClass + 7) % 12
        ? 1.06
        : 0.94
      : 1;
    const phraseEndBonus = barIndex === composition.phrase.bars - 1 ? 1.08 : 1;
    const cadence = arrivalWeight * sparsityBonus * endHarmonyBonus * phraseEndBonus;

    return Number(cadence.toFixed(4));
  });
}

export function analyzeSymbolically(
  composition: Composition,
  events: EventCollection = mergeAllScheduledEvents(composition),
): SymbolicAnalysis {
  const melodicEvents = events.noteEvents;
  const allEvents = events.mergedEvents;
  const maxGapBeats = composition.beatsPerBar * 1.25;
  const groupedByLine = groupByLine(melodicEvents);
  const leapSeries = groupedByLine.flatMap((group) => buildLeapSeries(group, maxGapBeats));
  const explicitLeadGroups = groupedByLine.filter((group) =>
    group.some((event) => isLeadVoiceId(event.voiceId)),
  );
  const leadGroups =
    explicitLeadGroups.length > 0
      ? explicitLeadGroups
      : groupedByLine.filter((group) => group.some((event) => isLeadLike(event)));
  const leadLeapSeries = leadGroups.flatMap((group) =>
    buildLeapSeries(
      group.filter((event) => isLeadVoiceId(event.voiceId) || isLeadLike(event)),
      maxGapBeats,
    ),
  );
  const voiceAnalyses = buildVoiceAnalyses(groupedByLine, maxGapBeats);
  const duplicateEventWarnings = buildDuplicateWarnings(allEvents);
  const { collisions, warnings } = buildCollisions(allEvents);

  let chordToneCount = 0;
  let colorToneCount = 0;

  for (const event of melodicEvents) {
    const activeHarmony = findActiveChordAtBeat(composition, event.beat);
    if (!activeHarmony) {
      continue;
    }

    if (isChordTone(event.pitch, activeHarmony.root, activeHarmony.quality)) {
      chordToneCount += 1;
    } else if (isScaleTone(event.pitch, composition.key.root, composition.key.scale)) {
      colorToneCount += 1;
    }
  }

  const repeatedPitchSummary = groupedByLine.reduce(
    (summary, group) => {
      const stats = buildRepeatedPitchStats(group, maxGapBeats);
      return {
        matches: summary.matches + stats.matches,
        comparisons: summary.comparisons + stats.comparisons,
      };
    },
    { matches: 0, comparisons: 0 },
  );
  const weightedMidiSum = melodicEvents.reduce(
    (sum, event) => sum + event.midi * event.durationBeats * event.velocity,
    0,
  );
  const weightSum = melodicEvents.reduce(
    (sum, event) => sum + event.durationBeats * event.velocity,
    0,
  );
  const uniquePitches = unique(allEvents.map((event) => event.pitch)).sort(
    (left, right) => allEvents.find((event) => event.pitch === left)!.midi -
      allEvents.find((event) => event.pitch === right)!.midi,
  );
  const cadenceStrengthByBar = buildCadenceStrengthByBar(composition, events);
  const roughnessCauses = buildRoughnessCauses({
    events: allEvents,
    beatsPerBar: composition.beatsPerBar,
    cadenceStrengthByBar,
  });

  return {
    noteCount: composition.phrase.notes.length,
    chordEventCount: composition.phrase.chords.length,
    uniquePitches,
    pitchRange: {
      min: allEvents.length > 0 ? midiToNote(Math.min(...allEvents.map((event) => event.midi))) : null,
      max: allEvents.length > 0 ? midiToNote(Math.max(...allEvents.map((event) => event.midi))) : null,
    },
    averageLeapSemitones: Number(average(leapSeries).toFixed(4)),
    maxLeapSemitones: leapSeries.length > 0 ? Math.max(...leapSeries) : 0,
    averageLeadLeapSemitones:
      leadLeapSeries.length > 0 ? Number(average(leadLeapSeries).toFixed(4)) : undefined,
    voiceAnalyses,
    highRegisterDissonanceWarnings: warnings,
    simultaneousCollisions: collisions,
    roughnessCauses,
    noteDensityByBar: buildDensityByBar(composition, melodicEvents),
    onsetCountByBar: buildOnsetsByBar(composition, melodicEvents),
    chordToneRatio:
      melodicEvents.length > 0 ? Number((chordToneCount / melodicEvents.length).toFixed(4)) : 0,
    colorToneRatio:
      melodicEvents.length > 0 ? Number((colorToneCount / melodicEvents.length).toFixed(4)) : 0,
    repeatedPitchRatio:
      repeatedPitchSummary.comparisons > 0
        ? Number((repeatedPitchSummary.matches / repeatedPitchSummary.comparisons).toFixed(4))
        : 0,
    registerCenterMidi:
      weightSum > 0 ? Number((weightedMidiSum / weightSum).toFixed(3)) : null,
    cadenceStrengthByBar,
    duplicateEventWarnings,
    timing:
      composition.timing ?? {
        meter: { beatsPerBar: composition.beatsPerBar, beatUnit: 4 },
        swing: { kind: "straight" },
        summary: `${composition.beatsPerBar}/4 meter, ${describeSwingProfile({ kind: "straight" })}.`,
        symbolicPlacementCount: 0,
        insights: [],
        issues: [],
      },
  };
}

```

## /Users/william/Projects/TSinger/src/audio/testing/validate.ts

```ts
import type { PresetAnalysis, ValidationWarning } from "./types";

function pushIf(
  warnings: ValidationWarning[],
  condition: boolean,
  warning: ValidationWarning,
): void {
  if (condition) {
    warnings.push(warning);
  }
}

function max(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function validatePresetAnalysis(analysis: PresetAnalysis): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const maxDensity = max(analysis.symbolic.noteDensityByBar);
  const maxOnsets = max(analysis.symbolic.onsetCountByBar);
  const maxPeak = max(analysis.audio.peakByWindow);
  const maxNovelty = max(analysis.audio.noveltyByBar);
  const avgNovelty = average(analysis.audio.noveltyByBar);
  const finalCadence =
    analysis.symbolic.cadenceStrengthByBar[
      analysis.symbolic.cadenceStrengthByBar.length - 1
    ] ?? 0;
  const earlierCadence = max(
    analysis.symbolic.cadenceStrengthByBar.slice(
      0,
      Math.max(0, analysis.symbolic.cadenceStrengthByBar.length - 1),
    ),
  );
  const timingWarnings = analysis.symbolic.timing.issues.filter(
    (issue) => issue.level === "warning" || issue.level === "error",
  );

  pushIf(warnings, maxDensity > 2.6, {
    code: "dense-bar",
    severity: "warning",
    message: "One or more bars sustain a high amount of simultaneous note material and may feel crowded.",
  });

  pushIf(warnings, maxOnsets > analysis.beatsPerBar * 2.2, {
    code: "busy-onsets",
    severity: "warning",
    message: "The phrase packs many note attacks into a bar, which may read as fussy in exposed oscillator textures.",
  });

  pushIf(warnings, analysis.symbolic.maxLeapSemitones >= 15, {
    code: "large-leap",
    severity: "warning",
    message: "The melodic profile includes a very large leap that may sound abrupt without stronger preparation.",
  });

  pushIf(warnings, (analysis.symbolic.averageLeadLeapSemitones ?? 0) > 6.5, {
    code: "lead-leap-average",
    severity: "info",
    message: "Lead motion trends wide on average, which may reduce smoothness or singability.",
  });

  pushIf(warnings, analysis.symbolic.repeatedPitchRatio > 0.4, {
    code: "repeated-pitch",
    severity: "info",
    message: "Adjacent melodic events repeat the same pitch frequently, which may flatten contour.",
  });

  pushIf(warnings, analysis.symbolic.highRegisterDissonanceWarnings.length > 0, {
    code: "high-register-dissonance",
    severity: "warning",
    message: "Simultaneous upper-register intervals look harsh enough to deserve manual listening checks.",
  });

  pushIf(warnings, analysis.symbolic.duplicateEventWarnings.length > 0, {
    code: "duplicate-events",
    severity: "warning",
    message: "Near-duplicate events were detected and may indicate accidental layering or compilation overlap.",
  });

  pushIf(warnings, analysis.audio.clippingSampleCount > 0 || maxPeak >= 0.995, {
    code: "clipping-risk",
    severity: "error",
    message: "The offline render clips or comes dangerously close to full scale.",
  });

  pushIf(warnings, Math.abs(analysis.audio.dcOffset) >= 0.01, {
    code: "dc-offset",
    severity: "warning",
    message: "The rendered signal shows noticeable DC offset.",
  });

  pushIf(
    warnings,
    analysis.audio.noveltyByBar.length > 1 && avgNovelty < 0.015 && maxNovelty < 0.03,
    {
      code: "flat-novelty",
      severity: "info",
      message: "Bar-to-bar feature change is very flat, so the loop may feel emotionally static over time.",
    },
  );

  pushIf(
    warnings,
    finalCadence < Math.max(0.4, earlierCadence * 0.85),
    {
      code: "weak-final-cadence",
      severity: "info",
      message: "The phrase-ending bar does not stand out strongly in the cadence metric.",
    },
  );

  pushIf(
    warnings,
    analysis.symbolic.simultaneousCollisions.length > Math.max(2, analysis.bars / 2),
    {
      code: "collision-count",
      severity: "warning",
      message: "There are several simultaneous collision points, which may translate into exposed roughness.",
    },
  );

  if (timingWarnings.length > 0) {
    warnings.push({
      code: "timing-alignment",
      severity: timingWarnings.some((issue) => issue.level === "error") ? "error" : "warning",
      message: timingWarnings[0]!.message,
    });
  }

  return warnings;
}

```

## /Users/william/Projects/TSinger/src/audio/testing/report.ts

```ts
import type {
  PresetAnalysis,
  PresetComparison,
  RoughnessCause,
  SectionAnalysis,
} from "./types";

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

function formatBarRange(startBar: number, bars: number): string {
  const humanStart = startBar + 1;
  const humanEnd = startBar + bars;

  return humanStart === humanEnd ? `bar ${humanStart}` : `bars ${humanStart}-${humanEnd}`;
}

function pickTopSection(
  sections: SectionAnalysis[],
  selector: (section: SectionAnalysis) => number,
): SectionAnalysis | null {
  if (sections.length === 0) {
    return null;
  }

  return [...sections].sort((left, right) => selector(right) - selector(left))[0] ?? null;
}

function buildOverviewLines(analysis: PresetAnalysis): string[] {
  const sections = analysis.sections ?? [];
  const strongestCadenceSection = pickTopSection(
    sections,
    (section) => section.averageCadenceStrength,
  );
  const densestSection = pickTopSection(sections, (section) => section.averageDensity);
  const mostNovelSection = pickTopSection(
    sections.filter((section) => section.averageNovelty !== null),
    (section) => section.averageNovelty ?? 0,
  );
  const finalCadence =
    analysis.symbolic.cadenceStrengthByBar[
      analysis.symbolic.cadenceStrengthByBar.length - 1
    ] ?? 0;

  const lines = [
    `- Pitch range: ${analysis.symbolic.pitchRange.min ?? "n/a"} to ${analysis.symbolic.pitchRange.max ?? "n/a"}`,
    `- Chord-tone ratio: ${(analysis.symbolic.chordToneRatio * 100).toFixed(1)}%; repeated-pitch ratio ${(analysis.symbolic.repeatedPitchRatio * 100).toFixed(1)}%`,
    `- Mean novelty by bar: ${average(analysis.audio.noveltyByBar).toFixed(4)}; final cadence strength ${finalCadence.toFixed(3)}`,
    `- Timing: ${analysis.symbolic.timing.summary} ${analysis.symbolic.timing.symbolicPlacementCount} symbolic placements compiled.`,
  ];

  if (strongestCadenceSection) {
    lines.push(
      `- Strongest cadence section: \`${strongestCadenceSection.id}\` (${strongestCadenceSection.role}, ${formatBarRange(strongestCadenceSection.startBar, strongestCadenceSection.bars)})`,
    );
  }

  if (densestSection) {
    lines.push(
      `- Densest section: \`${densestSection.id}\` (${densestSection.averageDensity.toFixed(3)} average density)`,
    );
  }

  if (mostNovelSection) {
    lines.push(
      `- Highest-novelty section: \`${mostNovelSection.id}\` (${(mostNovelSection.averageNovelty ?? 0).toFixed(3)})`,
    );
  }

  return lines;
}

function buildSectionSummaryLines(analysis: PresetAnalysis): string[] {
  const sections = analysis.sections ?? [];
  if (sections.length === 0) {
    return ["- No section plan metadata was attached to this preset."];
  }

  return sections.map((section) => {
    const noveltyText =
      section.averageNovelty !== null ? `, novelty ${section.averageNovelty.toFixed(3)}` : "";
    const description = section.description ? ` ${section.description}` : "";

    return `- \`${section.id}\` (${section.role}, ${formatBarRange(section.startBar, section.bars)}): density ${section.averageDensity.toFixed(3)}, cadence ${section.averageCadenceStrength.toFixed(3)}${noveltyText}.${description}`;
  });
}

function buildVoiceSummaryLines(analysis: PresetAnalysis): string[] {
  const voices = analysis.symbolic.voiceAnalyses ?? [];
  if (voices.length === 0) {
    return ["- No voice-aware note analysis was available."];
  }

  return voices.slice(0, 5).map((voice) => {
    const pitchRange = `${voice.pitchRange.min ?? "n/a"} to ${voice.pitchRange.max ?? "n/a"}`;
    return `- \`${voice.voiceId}\`: ${voice.noteCount} notes, range ${pitchRange}, avg leap ${voice.averageLeapSemitones.toFixed(2)} st, repeated ${(voice.repeatedPitchRatio * 100).toFixed(1)}%, synths ${voice.synths.join(", ")}.`;
  });
}

function buildWarningLines(analysis: PresetAnalysis): string[] {
  const lines = analysis.validationWarnings
    .filter((warning) => warning.severity === "warning" || warning.severity === "error")
    .slice(0, 4)
    .map((warning) => `- [${warning.severity}] ${warning.code}: ${warning.message}`);

  lines.push(
    ...analysis.symbolic.timing.issues
      .slice(0, 3)
      .map((issue) => `- [${issue.level}] timing: ${issue.message}`),
  );
  lines.push(
    ...analysis.symbolic.highRegisterDissonanceWarnings
      .slice(0, 2)
      .map((warning) => `- [warning] harshness: ${warning}`),
  );
  lines.push(
    ...analysis.symbolic.duplicateEventWarnings
      .slice(0, 2)
      .map((warning) => `- [info] duplicate-events: ${warning}`),
  );

  if (lines.length === 0) {
    return ["- No validation warnings exceeded the current thresholds."];
  }

  return [...new Set(lines)].slice(0, 6);
}

function buildTimingLines(analysis: PresetAnalysis): string[] {
  const timing = analysis.symbolic.timing;
  const lines = [
    `- ${timing.summary}`,
    `- Symbolic placements compiled: ${timing.symbolicPlacementCount}`,
  ];

  if (timing.insights.length > 0) {
    lines.push(...timing.insights.slice(0, 5).map((insight) => `- ${insight.message}`));
  } else {
    lines.push("- No explicit timing annotations were attached to this preset.");
  }

  return lines;
}

function buildRoughnessCauseLine(cause: RoughnessCause): string {
  const sectionText = cause.sectionRole ? `, ${cause.sectionRole}` : "";
  return `- Bar ${cause.bar}, beat ${cause.beat.toFixed(2)}${sectionText}: ${cause.reason} Patch: ${cause.patch} Score ${cause.score.toFixed(3)} (${cause.severity}).`;
}

function buildRoughnessCauseLines(analysis: PresetAnalysis): string[] {
  const significantCauses = analysis.symbolic.roughnessCauses.filter(
    (cause) => cause.severity !== "info",
  );
  const causes =
    significantCauses.length > 0
      ? significantCauses
      : analysis.symbolic.roughnessCauses.slice(0, 2);

  if (causes.length === 0) {
    return ["- No exact roughness causes exceeded the current reporting threshold."];
  }

  return causes.slice(0, 4).map(buildRoughnessCauseLine);
}

export function buildSuggestedMusicalEdits(analysis: PresetAnalysis): string[] {
  const suggestions: string[] = [];
  const avgNovelty = average(analysis.audio.noveltyByBar);
  const maxNovelty = max(analysis.audio.noveltyByBar);
  const finalCadence =
    analysis.symbolic.cadenceStrengthByBar[
      analysis.symbolic.cadenceStrengthByBar.length - 1
    ] ?? 0;
  const earlierCadence = max(
    analysis.symbolic.cadenceStrengthByBar.slice(
      0,
      Math.max(0, analysis.symbolic.cadenceStrengthByBar.length - 1),
    ),
  );
  const topRoughnessCause = analysis.symbolic.roughnessCauses.find(
    (cause) => cause.severity !== "info",
  );

  if (topRoughnessCause) {
    suggestions.push(
      `${topRoughnessCause.patch} Focus on bar ${topRoughnessCause.bar}, beat ${topRoughnessCause.beat.toFixed(2)} first.`,
    );
  } else if (analysis.symbolic.highRegisterDissonanceWarnings.length > 0) {
    suggestions.push(
      "Re-register or spread the upper voices at the warned collision beats so minor seconds, tritones, or major sevenths are not exposed so tightly.",
    );
  }

  if ((analysis.symbolic.averageLeadLeapSemitones ?? 0) > 6 || analysis.symbolic.maxLeapSemitones >= 14) {
    suggestions.push(
      "Reduce the largest exposed lead leaps by adding stepwise approach or exit tones around the arrival notes.",
    );
  }

  if (analysis.symbolic.repeatedPitchRatio > 0.35) {
    suggestions.push(
      "Introduce one or two contour changes in the most repetitive line so adjacent attacks do not keep landing on the same pitch.",
    );
  }

  if (analysis.symbolic.chordToneRatio < 0.5) {
    suggestions.push(
      "Anchor more phrase accents and bar openings on chord tones so the harmony feels clearer in the oscillator texture.",
    );
  }

  if (max(analysis.symbolic.noteDensityByBar) > 2.4 || max(analysis.symbolic.onsetCountByBar) > analysis.beatsPerBar * 2.1) {
    suggestions.push(
      "Thin the densest bar or two first, especially ornamental attacks that sit on top of already-held harmony.",
    );
  }

  if (avgNovelty < 0.02) {
    suggestions.push(
      "Add a modest second-half change in register, rhythm cell, or accompaniment density so the loop evolves without needing many more notes.",
    );
  } else if (maxNovelty > Math.max(0.18, avgNovelty * 2.4)) {
    suggestions.push(
      "Smooth the sharpest section change with a shared pickup, common tone, or gentler density handoff if the transition feels too abrupt.",
    );
  }

  if (finalCadence < Math.max(0.4, earlierCadence * 0.9)) {
    suggestions.push(
      "Strengthen the final bar by lengthening a root or chord-tone arrival and slightly thinning the immediately preceding attacks.",
    );
  }

  if (analysis.symbolic.timing.issues.length > 0) {
    suggestions.push(
      "Fix the timing-boundary warnings first so pickups, returns, and cadence landings stay metrically intentional.",
    );
  }

  if (analysis.audio.clippingSampleCount > 0) {
    suggestions.push(
      "Reduce overlapping peak moments or ease the loudest simultaneous entries so the rendered mix keeps clean headroom.",
    );
  }

  return [...new Set(suggestions)].slice(0, 5);
}

export function buildPresetReport(analysis: PresetAnalysis): string {
  const suggestedEdits =
    analysis.suggestedMusicalEdits.length > 0
      ? analysis.suggestedMusicalEdits
      : buildSuggestedMusicalEdits(analysis);

  return [
    `# Preset Analysis: ${analysis.title}`,
    "",
    `- Preset ID: \`${analysis.presetId}\``,
    `- Rendered At: ${analysis.renderedAtIso}`,
    `- Duration: ${analysis.durationSeconds.toFixed(3)} seconds`,
    `- Meter: ${analysis.beatsPerBar}/bar at ${analysis.bpm} BPM`,
    `- Phrase Bars: ${analysis.bars}`,
    "",
    "## Overview",
    "",
    ...buildOverviewLines(analysis),
    "",
    "## Sections",
    "",
    ...buildSectionSummaryLines(analysis),
    "",
    "## Voices",
    "",
    ...buildVoiceSummaryLines(analysis),
    "",
    "## Timing",
    "",
    ...buildTimingLines(analysis),
    "",
    "## Warnings",
    "",
    ...buildWarningLines(analysis),
    "",
    "## Roughness Causes",
    "",
    ...buildRoughnessCauseLines(analysis),
    "",
    "## Suggested Edits",
    "",
    ...(suggestedEdits.length > 0
      ? suggestedEdits.map((item) => `- ${item}`)
      : ["- No specific metric-driven edits were triggered."]),
    "",
  ].join("\n");
}

export function buildComparisonReport(comparison: PresetComparison): string {
  return [
    `# Comparison: ${comparison.presetIdA} vs ${comparison.presetIdB}`,
    "",
    comparison.summary,
    "",
    "## Deltas",
    "",
    ...comparison.deltas.map((delta) => {
      const rawDelta =
        typeof delta.delta === "number" && Number.isFinite(delta.delta)
          ? ` (delta ${delta.delta.toFixed(4)})`
          : "";

      return `- **${delta.metric}**: ${String(delta.before)} -> ${String(delta.after)}${rawDelta}. ${delta.interpretation}`;
    }),
    "",
  ].join("\n");
}

```

