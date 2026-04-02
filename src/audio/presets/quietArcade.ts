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
