import { compilePhrasePlan } from "../authoring/compile";
import { makeAnswerPhrase } from "../authoring/motifs";
import {
  pulseBass,
  sighingFigure,
  sparseBellAccents,
  turnFigure,
} from "../authoring/patterns";
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
    length: index === 4 ? 1.46 : step.length,
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
    ...placeDraftNotes(
      turnFigure({
        startBeat: 0,
        centerDegree: 2,
        stepLength: 0.25,
        noteLength: 0.16,
        velocity: 0.12,
        pan: 0.18,
      }),
      { beatOffset: lanternPartStart(1) - 3.25, velocityScale: 0.96 },
    ),
    ...placeDraftNotes(
      sighingFigure({
        startBeat: 0,
        highDegree: 5,
        lowDegree: 4,
        stepLength: 0.5,
        noteLength: 0.18,
        velocity: 0.12,
        pan: -0.16,
      }).map((note) => ({
        ...note,
        ornament: true,
      })),
      { beatOffset: lanternPartStart(2) + 10.75, velocityScale: 0.92 },
    ),
  ];
}

function buildLanternCounterline(): PatternNoteDraft[] {
  return [
    {
      beat: lanternPartStart(1) + 1.5,
      length: 0.92,
      pitch: "E4",
      velocity: 0.16,
      pan: -0.08,
      toneIntent: "chord",
    },
    {
      beat: lanternPartStart(1) + 5.5,
      length: 0.84,
      pitch: "G4",
      velocity: 0.15,
      pan: 0.04,
      toneIntent: "scale",
    },
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
      beat: lanternPartStart(3),
      length: 1.04,
      pitch: "F4",
      velocity: 0.15,
      pan: -0.06,
      toneIntent: "chord",
    },
    {
      beat: lanternPartStart(3) + 5.75,
      length: 0.98,
      pitch: "E4",
      velocity: 0.17,
      pan: -0.06,
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
  ];
}

function buildLanternMasterPlan(): PhrasePlan {
  const harmony = buildLanternMasterHarmony();
  const bells = sparseBellAccents({
    accents: [
      { beat: 0, pitch: "G5", length: 0.62, velocity: 0.08, pan: 0.14 },
      { beat: lanternPartStart(1) + 1, pitch: "A5", length: 0.58, velocity: 0.07, pan: -0.1 },
      { beat: lanternPartStart(2) + 8.25, pitch: "A5", length: 0.56, velocity: 0.06, pan: 0.1 },
      { beat: lanternPartStart(3) + 4, pitch: "G5", length: 0.62, velocity: 0.09, pan: 0.12 },
      { beat: lanternPartStart(3) + 15.75, pitch: "C6", length: 0.82, velocity: 0.1, pan: 0.14 },
    ],
  });
  const leadLayers = withVoiceId("lead", [
    {
      kind: "motif" as const,
      id: "lantern-i-call",
      synth: "softLead" as const,
      motif: lanternCall,
      beatOffset: lanternPartStart(0),
      register: { min: "E5", max: "D6", anchor: "G5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-i-response",
      synth: "softLead" as const,
      motif: lanternResponse,
      beatOffset: lanternPartStart(0) + 4,
      register: { min: "D5", max: "C6", anchor: "E5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-i-lift",
      synth: "softLead" as const,
      motif: lanternLift,
      beatOffset: lanternPartStart(0) + 8,
      register: { min: "G5", max: "D6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "lantern-i-cadence",
      synth: "softLead" as const,
      motif: lanternHalfCadence,
      beatOffset: lanternPartStart(0) + 12,
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
        { beat: 0, value: 0.56 },
        { beat: lanternPartStart(1), value: 0.68 },
        { beat: lanternPartStart(2), value: 0.24 },
        { beat: lanternPartStart(3), value: 0.68 },
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
        { beat: lanternPartStart(3) + 15.25, value: 1.12 },
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
