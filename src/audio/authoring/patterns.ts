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
