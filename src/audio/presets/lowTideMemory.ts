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
    rhythm: phrase.rhythm,
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
