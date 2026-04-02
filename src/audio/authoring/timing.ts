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
