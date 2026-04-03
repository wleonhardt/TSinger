import { compilePhrasePlan } from "../authoring/compile";
import {
  makeAnswerPhrase,
  retrograde,
  sequence,
} from "../authoring/motifs";
import {
  brokenTriad,
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
  PhraseLayerPlan,
  PhrasePlan,
} from "../authoring/types";
import type { Composition } from "../composition";
import {
  mapMotifSteps,
  scalePhraseDynamics,
  scaleMotifVelocities,
  withRealization,
  withRhythmRole,
  withVoiceId,
} from "./helpers";

const PINWHEEL_BPM = 102;
const PINWHEEL_BEATS_PER_BAR = 4;
const PINWHEEL_MASTER_BARS = 20;
const PINWHEEL_METER = {
  beatsPerBar: PINWHEEL_BEATS_PER_BAR,
  beatUnit: 4,
} as const;

function buildComposition(params: {
  id: string;
  title: string;
  key: Composition["key"];
  bpm: number;
  beatsPerBar: number;
  plan: PhrasePlan;
}): Composition {
  const compiled = compilePhrasePlan(params.plan);
  const phrase = scalePhraseDynamics(
    {
      bars: params.plan.bars,
      notes: compiled.notes,
      chords: compiled.chords,
    },
    {
      noteScale: 0.88,
      chordScale: 0.68,
    },
  );

  return {
    id: params.id,
    title: params.title,
    bpm: params.bpm,
    beatsPerBar: params.beatsPerBar,
    key: params.key,
    loop: true,
    sections: compiled.sections.length > 0 ? compiled.sections : undefined,
    phrase,
    timing: compiled.timing,
    rhythm: compiled.rhythm,
  };
}

const circuitHook: Motif = {
  anchorDegree: 1,
  steps: [
    {
      beat: 0,
      length: 0.42,
      offset: 0,
      velocity: 0.64,
      pan: -0.1,
      toneIntent: "chord",
    },
    {
      beat: 0.75,
      length: 0.26,
      offset: 2,
      velocity: 0.54,
      pan: -0.02,
      toneIntent: "scale",
    },
    {
      beat: 1.5,
      length: 0.34,
      offset: 4,
      velocity: 0.6,
      pan: 0.06,
      toneIntent: "chord",
    },
    {
      beat: 2.25,
      length: 0.28,
      offset: 2,
      velocity: 0.52,
      pan: 0.1,
      toneIntent: "passing",
    },
    {
      beat: 3,
      length: 0.82,
      offset: 6,
      velocity: 0.68,
      pan: 0.14,
      toneIntent: "color",
    },
  ],
};

const circuitAnswer = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(circuitHook, { scaleSteps: 3 }), (step, index) => ({
    ...step,
    beat: step.beat + (index === 0 ? 0.12 : 0),
    length: index === 4 ? 0.9 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 2 ? 0.98 : 0.92)
        : step.velocity,
  })),
  0.98,
);

const circuitSpiral = scaleMotifVelocities(
  mapMotifSteps(sequence(circuitHook, { scaleSteps: 1 }, 2), (step, index) => ({
    ...step,
    beat: step.beat + (index >= 5 ? 0.18 : 0),
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index >= 5 ? 0.9 : 1)
        : step.velocity,
  })),
  0.92,
);

const circuitDetour = scaleMotifVelocities(
  mapMotifSteps(retrograde(circuitHook), (step, index) => ({
    ...step,
    beat: step.beat + 0.2,
    length: step.length * (index === 0 ? 1.2 : 1.04),
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.76 : 0.84)
        : step.velocity,
  })),
  0.9,
);

const circuitLatch: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.34,
      offset: 0,
      velocity: 0.58,
      pan: -0.08,
      toneIntent: "chord",
    },
    {
      beat: 0.75,
      length: 0.28,
      offset: 1,
      velocity: 0.52,
      pan: -0.02,
      toneIntent: "scale",
    },
    {
      beat: 1.5,
      length: 0.32,
      offset: -1,
      velocity: 0.56,
      pan: 0.04,
      toneIntent: "passing",
    },
    {
      beat: 2.25,
      length: 0.3,
      offset: -2,
      velocity: 0.54,
      pan: 0.08,
      toneIntent: "scale",
    },
    {
      beat: 3,
      length: 0.96,
      offset: -4,
      velocity: 0.72,
      pan: 0.14,
      toneIntent: "chord",
    },
  ],
};

const circuitSeal: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.34,
      offset: 0,
      velocity: 0.56,
      pan: -0.06,
      toneIntent: "chord",
    },
    {
      beat: 0.75,
      length: 0.26,
      offset: 1,
      velocity: 0.5,
      pan: -0.02,
      toneIntent: "scale",
    },
    {
      beat: 1.5,
      length: 0.36,
      offset: -1,
      velocity: 0.58,
      pan: 0.06,
      toneIntent: "passing",
    },
    {
      beat: 2.25,
      length: 0.34,
      offset: -2,
      velocity: 0.56,
      pan: 0.1,
      toneIntent: "scale",
    },
    {
      beat: 3,
      length: 1,
      offset: -4,
      velocity: 0.82,
      pan: 0.16,
      toneIntent: "chord",
    },
  ],
};

function buildHarmony(): HarmonyPlanItem[] {
  return [
    { bar: 0, root: "G4", quality: "add9", velocity: 0.19, spread: 0.01, tag: "pinwheel-spark" },
    { bar: 1, root: "E4", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "pinwheel-spark" },
    { bar: 2, root: "C4", quality: "add9", velocity: 0.19, spread: 0.01, tag: "pinwheel-spark" },
    { bar: 3, root: "D4", quality: "sus2", velocity: 0.2, spread: 0.01, tag: "pinwheel-spark" },
    { bar: 4, root: "G4", quality: "add9", velocity: 0.2, spread: 0.01, tag: "pinwheel-braid" },
    { bar: 5, root: "E4", quality: "minor7", velocity: 0.17, spread: 0.01, tag: "pinwheel-braid" },
    { bar: 6, root: "E4", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "pinwheel-braid" },
    { bar: 7, root: "D4", quality: "sus2", velocity: 0.19, spread: 0.01, tag: "pinwheel-braid" },
    { bar: 8, root: "C4", quality: "add9", velocity: 0.18, spread: 0.01, tag: "pinwheel-crosswind" },
    { bar: 9, root: "F4", quality: "major", velocity: 0.18, spread: 0.01, tag: "pinwheel-crosswind" },
    { bar: 10, root: "E4", quality: "minor7", velocity: 0.17, spread: 0.01, tag: "pinwheel-crosswind" },
    { bar: 11, root: "D4", quality: "sus2", velocity: 0.18, spread: 0.01, tag: "pinwheel-crosswind" },
    { bar: 12, root: "C4", quality: "add9", velocity: 0.17, spread: 0.01, tag: "pinwheel-sidelight" },
    { bar: 13, root: "E4", quality: "minor7", velocity: 0.17, spread: 0.01, tag: "pinwheel-sidelight" },
    { bar: 14, root: "F4", quality: "major", velocity: 0.18, spread: 0.01, tag: "pinwheel-sidelight" },
    { bar: 15, root: "D4", quality: "sus2", velocity: 0.18, spread: 0.01, tag: "pinwheel-sidelight" },
    { bar: 16, root: "G4", quality: "add9", velocity: 0.21, spread: 0.01, tag: "pinwheel-overclock" },
    { bar: 17, root: "E4", quality: "minor7", velocity: 0.19, spread: 0.01, tag: "pinwheel-overclock" },
    { bar: 18, root: "D4", quality: "sus2", velocity: 0.22, spread: 0.01, tag: "pinwheel-overclock" },
    { bar: 19, root: "G4", quality: "major", velocity: 0.25, spread: 0.01, tag: "pinwheel-latch" },
  ];
}

function buildDrone(): PatternNoteDraft[] {
  return [
    { beat: 0, length: 16, pitch: "G3", velocity: 0.1, pan: -0.08, toneIntent: "chord" },
    { beat: 0, length: 16, pitch: "D4", velocity: 0.05, pan: 0.08, toneIntent: "chord" },
    { beat: 16, length: 16, pitch: "F3", velocity: 0.08, pan: -0.08, toneIntent: "chord" },
    { beat: 16, length: 16, pitch: "C4", velocity: 0.04, pan: 0.08, toneIntent: "chord" },
    { beat: 32, length: 16, pitch: "C3", velocity: 0.08, pan: -0.06, toneIntent: "chord" },
    { beat: 32, length: 16, pitch: "G3", velocity: 0.04, pan: 0.06, toneIntent: "chord" },
    { beat: 48, length: 16, pitch: "E3", velocity: 0.08, pan: -0.06, toneIntent: "chord" },
    { beat: 48, length: 16, pitch: "B3", velocity: 0.04, pan: 0.06, toneIntent: "chord" },
    { beat: 64, length: 15, pitch: "G3", velocity: 0.11, pan: -0.08, toneIntent: "chord" },
    { beat: 64, length: 15, pitch: "D4", velocity: 0.05, pan: 0.08, toneIntent: "chord" },
  ];
}

function buildCounterline(): PatternNoteDraft[] {
  const braidFigure = [
    ...brokenTriad({
      start: positionAtBarBeat(1, 2, 1, 4),
      meter: PINWHEEL_METER,
      beats: 1.5,
      order: [0, 1, 2],
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
      velocity: 0.18,
      pan: -0.14,
      toneIntent: "chord",
    }),
    ...sighingFigure({
      start: positionAtBarBeat(1, 4),
      meter: PINWHEEL_METER,
      highDegree: 6,
      lowDegree: 5,
      stepSpan: { subdivisions: 2, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 2 },
      velocity: 0.16,
      pan: 0.12,
    }),
  ];

  return [
    ...repeatAcrossBars(braidFigure, {
      startBar: 5,
      repetitions: 2,
      everyBars: 12,
      meter: PINWHEEL_METER,
      label: "Counterline braid returns in the braid and overclock sections.",
    }),
    ...brokenTriad({
      start: positionAtBarBeat(9, 2),
      meter: PINWHEEL_METER,
      beats: 1.5,
      order: [0, 1, 2, 1],
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
      velocity: 0.14,
      pan: -0.06,
      toneIntent: "chord",
    }),
    ...sighingFigure({
      start: positionAtBarBeat(14, 3, 1, 4),
      meter: PINWHEEL_METER,
      highDegree: 5,
      lowDegree: 4,
      stepSpan: { subdivisions: 2, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 2 },
      velocity: 0.13,
      pan: 0.08,
    }),
  ];
}

function buildRotorInner(): PatternNoteDraft[] {
  const sparkCell = [
    withPosition(
      {
        degree: 5,
        velocity: 0.18,
        pan: -0.16,
        toneIntent: "scale" as const,
      },
      {
        at: positionAtBarBeat(1, 1, 1, 4),
        duration: span(0, 0, 1, 4),
      },
    ),
    withPosition(
      {
        degree: 3,
        velocity: 0.16,
        pan: 0.12,
        toneIntent: "passing" as const,
      },
      {
        at: positionAtBarBeat(1, 2, 3, 4),
        duration: span(0, 0, 1, 4),
      },
    ),
    withPosition(
      {
        degree: 6,
        velocity: 0.14,
        pan: -0.08,
        toneIntent: "color" as const,
      },
      {
        at: positionAtBarBeat(1, 4, 1, 4),
        duration: span(0, 0, 1, 4),
      },
    ),
  ];

  const crosswindCell = [
    withPosition(
      {
        degree: 4,
        velocity: 0.15,
        pan: -0.12,
        toneIntent: "scale" as const,
      },
      {
        at: positionAtBarBeat(1, 1, 1, 4),
        duration: span(0, 0, 1, 4),
      },
    ),
    withPosition(
      {
        degree: 2,
        velocity: 0.14,
        pan: 0.08,
        toneIntent: "passing" as const,
      },
      {
        at: positionAtBarBeat(1, 2, 2, 4),
        duration: span(0, 0, 1, 4),
      },
    ),
    withPosition(
      {
        degree: 5,
        velocity: 0.15,
        pan: -0.04,
        toneIntent: "scale" as const,
      },
      {
        at: positionAtBarBeat(1, 3, 3, 4),
        duration: span(0, 0, 1, 4),
      },
    ),
  ];

  const sidelightCell = [
    withPosition(
      {
        degree: 3,
        velocity: 0.12,
        pan: -0.08,
        toneIntent: "passing" as const,
      },
      {
        at: positionAtBarBeat(1, 2, 1, 4),
        duration: span(0, 0, 1, 4),
      },
    ),
    withPosition(
      {
        degree: 6,
        velocity: 0.11,
        pan: 0.1,
        toneIntent: "color" as const,
      },
      {
        at: positionAtBarBeat(1, 4, 2, 4),
        duration: span(0, 0, 1, 4),
      },
    ),
  ];

  const overclockCell = [
    withPosition(
      {
        degree: 5,
        velocity: 0.19,
        pan: -0.14,
        toneIntent: "scale" as const,
      },
      {
        at: positionAtBarBeat(1, 1, 1, 4),
        duration: span(0, 0, 1, 4),
      },
    ),
    withPosition(
      {
        degree: 2,
        velocity: 0.16,
        pan: 0.08,
        toneIntent: "passing" as const,
      },
      {
        at: positionAtBarBeat(1, 2, 3, 4),
        duration: span(0, 0, 1, 4),
      },
    ),
    withPosition(
      {
        degree: 4,
        velocity: 0.16,
        pan: -0.04,
        toneIntent: "scale" as const,
      },
      {
        at: positionAtBarBeat(1, 3, 1, 4),
        duration: span(0, 0, 1, 4),
      },
    ),
    withPosition(
      {
        degree: 6,
        velocity: 0.17,
        pan: 0.12,
        toneIntent: "color" as const,
      },
      {
        at: positionAtBarBeat(1, 4, 1, 4),
        duration: span(0, 0, 1, 4),
      },
    ),
  ];

  return [
    ...repeatAcrossBars(sparkCell, {
      startBar: 1,
      repetitions: 8,
      meter: PINWHEEL_METER,
      label: "Rotor spark repeats through the first half of the circuit.",
    }),
    ...repeatAcrossBars(crosswindCell, {
      startBar: 9,
      repetitions: 4,
      meter: PINWHEEL_METER,
      label: "Crosswind rotor shifts the accents without losing the spin.",
    }),
    ...repeatAcrossBars(sidelightCell, {
      startBar: 13,
      repetitions: 4,
      meter: PINWHEEL_METER,
      label: "Sidelight strips the rotor down to a wink and a breath.",
    }),
    ...repeatAcrossBars(overclockCell, {
      startBar: 17,
      repetitions: 3,
      meter: PINWHEEL_METER,
      label: "Overclock packs the spin tighter before the latch.",
    }),
  ];
}

function buildOrnaments(): PatternNoteDraft[] {
  return [
    ...turnFigure({
      start: pickupBefore(
        {
          kind: "sectionStart",
          startBar: 5,
          bars: 4,
          sectionId: "pinwheel-braid",
          label: "the braid",
        },
        PINWHEEL_METER,
      ),
      meter: PINWHEEL_METER,
      centerDegree: 5,
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
      velocity: 0.11,
      pan: 0.18,
    }),
    ...turnFigure({
      start: pickupBefore(
        {
          kind: "sectionStart",
          startBar: 9,
          bars: 4,
          sectionId: "pinwheel-crosswind",
          label: "the crosswind",
        },
        PINWHEEL_METER,
      ),
      meter: PINWHEEL_METER,
      centerDegree: 4,
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
      velocity: 0.1,
      pan: -0.14,
    }),
    ...turnFigure({
      start: pickupBefore(
        {
          kind: "sectionStart",
          startBar: 17,
          bars: 3,
          sectionId: "pinwheel-overclock",
          label: "the overclock",
        },
        PINWHEEL_METER,
      ),
      meter: PINWHEEL_METER,
      centerDegree: 6,
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
      velocity: 0.11,
      pan: 0.16,
    }),
    ...sighingFigure({
      start: positionAtBarBeat(14, 4),
      meter: PINWHEEL_METER,
      highDegree: 6,
      lowDegree: 5,
      stepSpan: { subdivisions: 2, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 2 },
      velocity: 0.09,
      pan: -0.08,
    }),
  ];
}

function buildBells(): PatternNoteDraft[] {
  return sparseBellAccents({
    accents: [
      {
        at: positionAtBarBeat(3, 4, 1, 2),
        pitch: "D6",
        duration: span(0, 1),
        velocity: 0.11,
        pan: -0.08,
      },
      {
        at: pickupBefore(
          {
            kind: "sectionStart",
            startBar: 9,
            bars: 4,
            sectionId: "pinwheel-crosswind",
            label: "the crosswind",
          },
          PINWHEEL_METER,
        ),
        pitch: "B5",
        duration: span(0, 0, 3, 4),
        velocity: 0.1,
        pan: 0.12,
      },
      {
        at: positionAtBarBeat(11, 4),
        pitch: "F6",
        duration: span(0, 1),
        velocity: 0.1,
        pan: -0.1,
      },
      {
        at: positionAtBarBeat(18, 4, 1, 2),
        pitch: "D6",
        duration: span(0, 1),
        velocity: 0.11,
        pan: 0.08,
      },
      {
        at: cadenceBeat(
          { kind: "phraseEnd", bars: PINWHEEL_MASTER_BARS, label: "the latch" },
          PINWHEEL_METER,
        ),
        pitch: "G6",
        duration: span(0, 1),
        velocity: 0.12,
        pan: 0.14,
      },
    ],
  });
}

function buildBass(harmony: HarmonyPlanItem[]): PatternNoteDraft[] {
  return [
    ...pulseBass({
      harmony: harmony.filter(
        (item) => item.tag === "pinwheel-spark" || item.tag === "pinwheel-braid",
      ),
      beatsPerBar: PINWHEEL_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.44, length: 0.62 },
        { beatOffset: 1.75, intervalSemitones: 7, velocity: 0.16, length: 0.18 },
        { beatOffset: 2.5, intervalSemitones: 12, velocity: 0.12, length: 0.2 },
        { beatOffset: 3.25, intervalSemitones: 7, velocity: 0.16, length: 0.18 },
      ],
      octaveShift: -12,
    }),
    ...pulseBass({
      harmony: harmony.filter((item) => item.tag === "pinwheel-crosswind"),
      beatsPerBar: PINWHEEL_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.34, length: 0.7 },
        { beatOffset: 2.75, intervalSemitones: 7, velocity: 0.16, length: 0.18 },
      ],
      octaveShift: -12,
    }),
    ...pulseBass({
      harmony: harmony.filter((item) => item.tag === "pinwheel-sidelight"),
      beatsPerBar: PINWHEEL_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.3, length: 0.76 },
        { beatOffset: 3, intervalSemitones: 7, velocity: 0.14, length: 0.16 },
      ],
      octaveShift: -12,
    }),
    ...pulseBass({
      harmony: harmony.filter(
        (item) => item.tag === "pinwheel-overclock" || item.tag === "pinwheel-latch",
      ),
      beatsPerBar: PINWHEEL_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.46, length: 0.66 },
        { beatOffset: 1.75, intervalSemitones: 7, velocity: 0.18, length: 0.18 },
        { beatOffset: 2.5, intervalSemitones: 12, velocity: 0.14, length: 0.18 },
        { beatOffset: 3.25, intervalSemitones: 7, velocity: 0.18, length: 0.18 },
      ],
      octaveShift: -12,
    }),
    {
      beat: 79,
      length: 1.25,
      pitch: "G2",
      velocity: 0.34,
      toneIntent: "chord",
    },
  ];
}

function buildLeadLayers(): PhraseLayerPlan[] {
  return withRealization(
    withRhythmRole(
      "flow",
      withVoiceId("lead", [
        {
          kind: "motif" as const,
          id: "pinwheel-spark-hook",
          synth: "softLead" as const,
          motif: circuitHook,
          positionOffset: positionAtBarBeat(1, 1),
          register: { min: "D5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "pinwheel-spark-answer",
          synth: "softLead" as const,
          motif: circuitAnswer,
          positionOffset: positionAtBarBeat(2, 1),
          register: { min: "E5", max: "C7", anchor: "A5" },
          clampToHarmony: true,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "pinwheel-spark-hook-ii",
          synth: "softLead" as const,
          motif: circuitHook,
          positionOffset: positionAtBarBeat(3, 1),
          register: { min: "D5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 0.96,
        },
        {
          kind: "motif" as const,
          id: "pinwheel-spark-latch",
          synth: "softLead" as const,
          motif: circuitLatch,
          positionOffset: positionAtBarBeat(4, 1),
          register: { min: "D5", max: "A6", anchor: "G5" },
          clampToHarmony: true,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "pinwheel-braid-spiral",
          synth: "softLead" as const,
          motif: circuitSpiral,
          positionOffset: positionAtBarBeat(5, 1),
          register: { min: "E5", max: "D7", anchor: "A5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "pinwheel-braid-answer",
          synth: "softLead" as const,
          motif: circuitAnswer,
          positionOffset: positionAtBarBeat(7, 1),
          register: { min: "E5", max: "C7", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 0.96,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "pinwheel-braid-latch",
          synth: "softLead" as const,
          motif: circuitLatch,
          positionOffset: positionAtBarBeat(8, 1),
          register: { min: "D5", max: "A6", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 0.98,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "pinwheel-crosswind-detour-a",
          synth: "softLead" as const,
          motif: circuitDetour,
          positionOffset: positionAtBarBeat(9, 1),
          register: { min: "C5", max: "A6", anchor: "F5" },
          clampToHarmony: true,
          velocityScale: 0.84,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "pinwheel-crosswind-detour-b",
          synth: "softLead" as const,
          motif: circuitDetour,
          positionOffset: positionAtBarBeat(10, 1),
          register: { min: "C5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.8,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "pinwheel-crosswind-spiral",
          synth: "softLead" as const,
          motif: circuitSpiral,
          positionOffset: positionAtBarBeat(11, 1),
          register: { min: "D5", max: "C7", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 0.84,
        },
        {
          kind: "motif" as const,
          id: "pinwheel-crosswind-latch",
          synth: "softLead" as const,
          motif: circuitLatch,
          positionOffset: positionAtBarBeat(12, 1),
          register: { min: "D5", max: "A6", anchor: "F5" },
          clampToHarmony: true,
          velocityScale: 0.82,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "pinwheel-sidelight-detour",
          synth: "softLead" as const,
          motif: circuitDetour,
          positionOffset: positionAtBarBeat(13, 1),
          register: { min: "C5", max: "G6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.76,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "pinwheel-sidelight-hook-ghost",
          synth: "softLead" as const,
          motif: circuitHook,
          positionOffset: positionAtBarBeat(14, 1),
          register: { min: "C5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.78,
        },
        {
          kind: "motif" as const,
          id: "pinwheel-sidelight-answer-hush",
          synth: "softLead" as const,
          motif: circuitAnswer,
          positionOffset: positionAtBarBeat(15, 1),
          register: { min: "D5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 0.76,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "pinwheel-sidelight-latch",
          synth: "softLead" as const,
          motif: circuitLatch,
          positionOffset: positionAtBarBeat(16, 1),
          register: { min: "D5", max: "A6", anchor: "F5" },
          clampToHarmony: true,
          velocityScale: 0.78,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "pinwheel-overclock-spiral",
          synth: "softLead" as const,
          motif: circuitSpiral,
          positionOffset: positionAtBarBeat(17, 1),
          register: { min: "E5", max: "D7", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 1.02,
        },
        {
          kind: "motif" as const,
          id: "pinwheel-overclock-answer",
          synth: "softLead" as const,
          motif: circuitAnswer,
          positionOffset: positionAtBarBeat(18, 1),
          register: { min: "E5", max: "C7", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 1.04,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "pinwheel-overclock-latch",
          synth: "softLead" as const,
          motif: circuitLatch,
          positionOffset: positionAtBarBeat(19, 1),
          register: { min: "D5", max: "A6", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 1.06,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "pinwheel-seal",
          synth: "softLead" as const,
          motif: circuitSeal,
          positionOffset: positionAtBarBeat(20, 1),
          register: { min: "D5", max: "A6", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 1.08,
          rhythmRole: "cadence",
        },
      ]),
    ),
  );
}

function buildPinwheelPlan(): PhrasePlan {
  const harmony = buildHarmony();

  return {
    bars: PINWHEEL_MASTER_BARS,
    beatsPerBar: PINWHEEL_BEATS_PER_BAR,
    meter: PINWHEEL_METER,
    swing: { kind: "swing16", amount: 0.6 },
    key: { root: "G", scale: "mixolydian" },
    harmony,
    sections: [
      {
        id: "pinwheel-spark",
        role: "statement",
        barRole: "arrival",
        startBar: 0,
        bars: 4,
        bias: { density: -0.02, register: 0, brightness: 0.04, cadence: 0.94 },
        description: "A bright little engine starts spinning before it has room to boast.",
      },
      {
        id: "pinwheel-braid",
        role: "answer",
        barRole: "continuation",
        startBar: 4,
        bars: 4,
        bias: { density: 0.08, register: 0.1, brightness: 0.08, cadence: 0.98 },
        description: "The hook learns how to travel in pairs and starts grinning at itself.",
      },
      {
        id: "pinwheel-crosswind",
        role: "bridge",
        barRole: "transition",
        startBar: 8,
        bars: 4,
        bias: { density: 0.02, register: 0.12, brightness: 0.02, cadence: 0.84 },
        description: "The circuit catches sidewind and the harmony starts leaning under the spin.",
      },
      {
        id: "pinwheel-sidelight",
        role: "shadow",
        barRole: "transition",
        startBar: 12,
        bars: 4,
        bias: { density: -0.2, register: -0.12, brightness: -0.16, cadence: 0.58 },
        description: "The machine is seen from the side: fewer sparks, more mechanism.",
      },
      {
        id: "pinwheel-overclock",
        role: "return",
        barRole: "arrival",
        startBar: 16,
        bars: 3,
        bias: { density: 0.12, register: 0.14, brightness: 0.12, cadence: 1.12 },
        description: "Everything locks back in, tighter and brighter, without losing its wit.",
      },
      {
        id: "pinwheel-latch",
        role: "cadence",
        barRole: "cadence",
        startBar: 19,
        bars: 1,
        bias: { density: -0.08, register: 0.06, brightness: 0.02, cadence: 1.34 },
        description: "A single latched bar snaps the loop shut and throws it open again.",
      },
    ],
    cadenceTiming: [
      {
        targetBar: PINWHEEL_MASTER_BARS,
        targetBeat: 1,
        mustLandOnStrongBeat: true,
        minFinalDurationBeats: 1.1,
        thinBeforeArrival: true,
        allowPickup: false,
        maxOrnamentVelocityNearCadence: 0.11,
      },
    ],
    padLayers: [{ synth: "warmPad", voiceId: "pad", velocityScale: 0.72 }],
    arrangement: {
      densityCurve: [
        { beat: 0, value: 0.44 },
        { beat: 16, value: 0.56 },
        { beat: 32, value: 0.48 },
        { beat: 48, value: 0.24 },
        { beat: 64, value: 0.62 },
        { beat: 80, value: 0.46 },
      ],
      registerCurve: [
        { beat: 0, value: 0 },
        { beat: 16, value: 0.08 },
        { beat: 32, value: 0.14 },
        { beat: 48, value: -0.14 },
        { beat: 64, value: 0.16 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.5 },
        { beat: 16, value: 0.62 },
        { beat: 32, value: 0.56 },
        { beat: 48, value: 0.26 },
        { beat: 64, value: 0.7 },
        { beat: 80, value: 0.48 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.24 },
        { beat: 16, value: 0.4 },
        { beat: 32, value: 0.52 },
        { beat: 48, value: 0.24 },
        { beat: 68, value: 0.78 },
        { beat: 76, value: 0.98 },
      ],
      ornamentBaseProbability: 0.09,
    },
    noteLayers: [
      ...buildLeadLayers(),
      {
        kind: "draft",
        id: "pinwheel-counterline",
        synth: "softLead",
        voiceId: "counterline",
        rhythmRole: "response",
        realization: true,
        notes: buildCounterline(),
        register: { min: "G4", max: "D6", anchor: "B4" },
        velocityScale: 0.82,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "pinwheel-rotor",
        synth: "pluckyDust",
        voiceId: "inner",
        rhythmRole: "flow",
        realization: true,
        notes: buildRotorInner(),
        register: { min: "G4", max: "E6", anchor: "B4" },
        velocityScale: 0.74,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "pinwheel-ornaments",
        synth: "pluckyDust",
        voiceId: "ornament",
        rhythmRole: "ornament",
        realization: true,
        notes: buildOrnaments(),
        register: { min: "D5", max: "B6", anchor: "G5" },
        allowOrnaments: true,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "pinwheel-bells",
        synth: "glassBell",
        voiceId: "bells",
        rhythmRole: "punctuation",
        realization: true,
        notes: buildBells(),
        register: { min: "G5", max: "G6", anchor: "D6" },
        clampToHarmony: false,
      },
      {
        kind: "draft",
        id: "pinwheel-bass",
        synth: "roundBass",
        voiceId: "bass",
        rhythmRole: "anchor",
        realization: true,
        notes: buildBass(harmony),
        register: { min: "G2", max: "D3", anchor: "G2" },
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "pinwheel-drone",
        synth: "breathingDrone",
        voiceId: "drone",
        rhythmRole: "suspension",
        realization: true,
        notes: buildDrone(),
        register: { min: "C3", max: "D4", anchor: "G3" },
        clampToHarmony: true,
      },
    ],
  };
}

export const pinwheelCircuit: Composition = buildComposition({
  id: "pinwheel-circuit",
  title: "Pinwheel Circuit",
  key: { root: "G", scale: "mixolydian" },
  bpm: PINWHEEL_BPM,
  beatsPerBar: PINWHEEL_BEATS_PER_BAR,
  plan: buildPinwheelPlan(),
});
