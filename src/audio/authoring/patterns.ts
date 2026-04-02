import type { ChordEvent, SynthName } from "../composition";
import { transpose } from "../theory";
import type { HarmonyPlanItem, PatternNoteDraft } from "./types";

type ChordPatternOptions = {
  startBeat: number;
  beats: number;
  order: number[];
  stepLength?: number;
  noteLength?: number;
  velocity?: number;
  pan?: number;
  octaveOffset?: number;
  toneIntent?: PatternNoteDraft["toneIntent"];
  ornament?: boolean;
};

type SighingFigureOptions = {
  startBeat: number;
  highDegree: number;
  lowDegree: number;
  stepLength?: number;
  noteLength?: number;
  velocity?: number;
  pan?: number;
};

type TurnFigureOptions = {
  startBeat: number;
  centerDegree: number;
  stepLength?: number;
  noteLength?: number;
  velocity?: number;
  pan?: number;
};

type PentatonicFlourishOptions = {
  startBeat: number;
  degrees: number[];
  stepLength?: number;
  noteLength?: number;
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
    beat: number;
    pitch?: string;
    degree?: number;
    length?: number;
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

export function arpeggiateChord({
  startBeat,
  beats,
  order,
  stepLength = 0.5,
  noteLength = stepLength * 0.9,
  velocity = 0.5,
  pan = 0,
  octaveOffset = 0,
  toneIntent = "chord",
  ornament = false,
}: ChordPatternOptions): PatternNoteDraft[] {
  return order
    .filter((_, index) => index * stepLength < beats)
    .map((chordDegree, index) => ({
      beat: startBeat + index * stepLength,
      length: noteLength,
      chordDegree,
      velocity,
      pan,
      octaveOffset,
      toneIntent,
      ornament,
    }));
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
  startBeat,
  highDegree,
  lowDegree,
  stepLength = 0.5,
  noteLength = stepLength * 0.9,
  velocity = 0.5,
  pan = 0,
}: SighingFigureOptions): PatternNoteDraft[] {
  return [
    {
      beat: startBeat,
      length: noteLength,
      degree: highDegree,
      velocity,
      pan,
      toneIntent: "scale",
    },
    {
      beat: startBeat + stepLength,
      length: noteLength,
      degree: lowDegree,
      velocity: velocity * 0.92,
      pan,
      toneIntent: "scale",
    },
  ];
}

export function turnFigure({
  startBeat,
  centerDegree,
  stepLength = 0.25,
  noteLength = stepLength * 0.9,
  velocity = 0.44,
  pan = 0,
}: TurnFigureOptions): PatternNoteDraft[] {
  return [
    { beat: startBeat, length: noteLength, degree: centerDegree + 1, velocity, pan, toneIntent: "scale", ornament: true },
    { beat: startBeat + stepLength, length: noteLength, degree: centerDegree, velocity: velocity * 0.96, pan, toneIntent: "scale", ornament: true },
    { beat: startBeat + stepLength * 2, length: noteLength, degree: centerDegree - 1, velocity: velocity * 0.92, pan, toneIntent: "scale", ornament: true },
    { beat: startBeat + stepLength * 3, length: noteLength, degree: centerDegree, velocity: velocity * 0.9, pan, toneIntent: "scale", ornament: true },
  ];
}

export function pentatonicFlourish({
  startBeat,
  degrees,
  stepLength = 0.5,
  noteLength = stepLength * 0.9,
  velocity = 0.54,
  pan = 0,
  ornament = false,
}: PentatonicFlourishOptions): PatternNoteDraft[] {
  return degrees.map((degree, index) => ({
    beat: startBeat + index * stepLength,
    length: noteLength,
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
    beat: accent.beat,
    length: accent.length ?? 0.9,
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
