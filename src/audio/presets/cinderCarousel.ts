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

const CINDER_BPM = 76;
const CINDER_BEATS_PER_BAR = 3;
const CINDER_MASTER_BARS = 24;
const CINDER_METER = {
  beatsPerBar: CINDER_BEATS_PER_BAR,
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
      noteScale: 0.9,
      chordScale: 0.72,
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

const cinderCall: Motif = {
  anchorDegree: 1,
  steps: [
    {
      beat: 0,
      length: 0.5,
      offset: 4,
      velocity: 0.64,
      pan: -0.08,
      toneIntent: "chord",
    },
    {
      beat: 0.75,
      length: 0.35,
      offset: 6,
      velocity: 0.56,
      pan: 0.02,
      toneIntent: "color",
    },
    {
      beat: 1.5,
      length: 0.48,
      offset: 4,
      velocity: 0.58,
      pan: 0.08,
      toneIntent: "chord",
    },
    {
      beat: 2.15,
      length: 0.72,
      offset: 2,
      velocity: 0.68,
      pan: 0.12,
      toneIntent: "scale",
    },
  ],
};

const cinderReply = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(cinderCall, { scaleSteps: 2 }), (step, index) => ({
    ...step,
    beat: step.beat + (index === 0 ? 0.1 : 0),
    length: index === 3 ? 0.8 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 1 ? 0.9 : 0.94)
        : step.velocity,
  })),
  0.98,
);

const cinderSpin = scaleMotifVelocities(
  mapMotifSteps(sequence(cinderCall, { scaleSteps: -1 }, 2), (step, index) => ({
    ...step,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index >= 4 ? 0.9 : 1)
        : step.velocity,
  })),
  0.9,
);

const cinderShadow = scaleMotifVelocities(
  mapMotifSteps(retrograde(cinderCall), (step, index) => ({
    ...step,
    beat: step.beat + 0.1,
    length: step.length * (index === 0 ? 1.28 : 1.08),
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.76 : 0.84)
        : step.velocity,
  })),
  0.9,
);

const cinderCadence: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.48,
      offset: 0,
      velocity: 0.58,
      pan: -0.08,
      toneIntent: "chord",
    },
    {
      beat: 0.75,
      length: 0.34,
      offset: 1,
      velocity: 0.52,
      pan: 0,
      toneIntent: "color",
    },
    {
      beat: 1.5,
      length: 0.48,
      offset: -1,
      velocity: 0.58,
      pan: 0.08,
      toneIntent: "scale",
    },
    {
      beat: 2.15,
      length: 0.9,
      offset: -4,
      velocity: 0.72,
      pan: 0.12,
      toneIntent: "chord",
    },
  ],
};

const cinderSeal: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.46,
      offset: 0,
      velocity: 0.56,
      pan: -0.06,
      toneIntent: "chord",
    },
    {
      beat: 0.75,
      length: 0.32,
      offset: 1,
      velocity: 0.5,
      pan: 0.02,
      toneIntent: "color",
    },
    {
      beat: 1.5,
      length: 0.54,
      offset: -1,
      velocity: 0.6,
      pan: 0.08,
      toneIntent: "scale",
    },
    {
      beat: 2,
      length: 1,
      offset: -4,
      velocity: 0.8,
      pan: 0.14,
      toneIntent: "chord",
    },
  ],
};

function buildHarmony(): HarmonyPlanItem[] {
  return [
    { bar: 0, root: "A3", quality: "minor", velocity: 0.2, spread: 0.01, tag: "cinder-platform" },
    { bar: 1, root: "E4", quality: "major", velocity: 0.18, spread: 0.01, tag: "cinder-platform" },
    { bar: 2, root: "F4", quality: "major", velocity: 0.18, spread: 0.01, tag: "cinder-platform" },
    { bar: 3, root: "E4", quality: "major", velocity: 0.19, spread: 0.01, tag: "cinder-platform" },
    { bar: 4, root: "A3", quality: "minor", velocity: 0.2, spread: 0.01, tag: "cinder-platform" },
    { bar: 5, root: "C4", quality: "major", velocity: 0.17, spread: 0.01, tag: "cinder-platform" },
    { bar: 6, root: "A3", quality: "minor", velocity: 0.19, spread: 0.01, tag: "cinder-mirror" },
    { bar: 7, root: "F4", quality: "major", velocity: 0.18, spread: 0.01, tag: "cinder-mirror" },
    { bar: 8, root: "D4", quality: "minor7", velocity: 0.17, spread: 0.01, tag: "cinder-mirror" },
    { bar: 9, root: "E4", quality: "sus4", velocity: 0.18, spread: 0.01, tag: "cinder-mirror" },
    { bar: 10, root: "E4", quality: "major", velocity: 0.2, spread: 0.01, tag: "cinder-mirror" },
    { bar: 11, root: "A3", quality: "minor", velocity: 0.2, spread: 0.01, tag: "cinder-mirror" },
    { bar: 12, root: "F4", quality: "major", velocity: 0.16, spread: 0.01, tag: "cinder-ashfall" },
    { bar: 13, root: "D4", quality: "minor7", velocity: 0.16, spread: 0.01, tag: "cinder-ashfall" },
    { bar: 14, root: "E4", quality: "major", velocity: 0.17, spread: 0.01, tag: "cinder-ashfall" },
    { bar: 15, root: "A3", quality: "minor", velocity: 0.17, spread: 0.01, tag: "cinder-ashfall" },
    { bar: 16, root: "F4", quality: "major", velocity: 0.16, spread: 0.01, tag: "cinder-ashfall" },
    { bar: 17, root: "E4", quality: "major", velocity: 0.18, spread: 0.01, tag: "cinder-ashfall" },
    { bar: 18, root: "A3", quality: "minor", velocity: 0.2, spread: 0.01, tag: "cinder-return" },
    { bar: 19, root: "C4", quality: "major", velocity: 0.18, spread: 0.01, tag: "cinder-return" },
    { bar: 20, root: "F4", quality: "major", velocity: 0.18, spread: 0.01, tag: "cinder-return" },
    { bar: 21, root: "E4", quality: "sus4", velocity: 0.18, spread: 0.01, tag: "cinder-return" },
    { bar: 22, root: "E4", quality: "major", velocity: 0.22, spread: 0.01, tag: "cinder-return" },
    { bar: 23, root: "A3", quality: "minor", velocity: 0.25, spread: 0.01, tag: "cinder-seal" },
  ];
}

function buildDrone(): PatternNoteDraft[] {
  return [
    { beat: 0, length: 18, pitch: "A3", velocity: 0.1, pan: -0.08, toneIntent: "chord" },
    { beat: 0, length: 18, pitch: "E4", velocity: 0.06, pan: 0.08, toneIntent: "chord" },
    { beat: 18, length: 18, pitch: "F3", velocity: 0.09, pan: -0.08, toneIntent: "chord" },
    { beat: 18, length: 18, pitch: "C4", velocity: 0.05, pan: 0.08, toneIntent: "chord" },
    { beat: 36, length: 18, pitch: "D3", velocity: 0.09, pan: -0.06, toneIntent: "chord" },
    { beat: 36, length: 18, pitch: "A3", velocity: 0.05, pan: 0.06, toneIntent: "chord" },
    { beat: 54, length: 15, pitch: "A3", velocity: 0.11, pan: -0.08, toneIntent: "chord" },
    { beat: 54, length: 15, pitch: "E4", velocity: 0.07, pan: 0.08, toneIntent: "chord" },
    { beat: 69, length: 2.65, pitch: "A3", velocity: 0.12, pan: -0.06, toneIntent: "chord" },
    { beat: 69, length: 2.65, pitch: "E4", velocity: 0.07, pan: 0.06, toneIntent: "chord" },
  ];
}

function buildCounterline(): PatternNoteDraft[] {
  const carouselCell = [
    ...sighingFigure({
      start: positionAtBarBeat(1, 2),
      meter: CINDER_METER,
      highDegree: 3,
      lowDegree: 2,
      stepSpan: span(0, 0, 1, 2),
      noteSpan: span(0, 1),
      velocity: 0.14,
      pan: -0.12,
    }),
    withPosition(
      {
        degree: 5,
        velocity: 0.14,
        pan: 0.06,
        toneIntent: "chord" as const,
      },
      {
        at: positionAtBarBeat(2, 3),
        duration: span(0, 0, 3, 4),
      },
    ),
  ];

  return [
    ...repeatAcrossBars(carouselCell, {
      startBar: 7,
      repetitions: 2,
      everyBars: 12,
      meter: CINDER_METER,
      label: "The carousel answer returns in the mirror and the late return.",
    }),
    withPosition(
      {
        degree: 6,
        velocity: 0.13,
        pan: -0.04,
        toneIntent: "color" as const,
      },
      {
        at: positionAtBarBeat(14, 2),
        duration: span(0, 1),
      },
    ),
    withPosition(
      {
        degree: 4,
        velocity: 0.13,
        pan: 0.02,
        toneIntent: "scale" as const,
      },
      {
        at: positionAtBarBeat(16, 3),
        duration: span(0, 0, 3, 4),
      },
    ),
  ];
}

function buildClockworkInner(): PatternNoteDraft[] {
  const mechanismCell = [
    ...brokenTriad({
      start: positionAtBarBeat(1, 1, 1, 2),
      meter: CINDER_METER,
      beats: 2.5,
      order: [0, 1, 2],
      stepSpan: span(0, 0, 3, 4),
      noteSpan: span(0, 0, 1, 2),
      velocity: 0.1,
      pan: -0.14,
      toneIntent: "chord",
    }),
    ...brokenTriad({
      start: positionAtBarBeat(2, 1, 1, 2),
      meter: CINDER_METER,
      beats: 2.5,
      order: [2, 1, 0],
      stepSpan: span(0, 0, 3, 4),
      noteSpan: span(0, 0, 1, 2),
      velocity: 0.1,
      pan: 0.14,
      toneIntent: "chord",
    }),
  ];

  return repeatAcrossBars(mechanismCell, {
    startBar: 13,
    repetitions: 2,
    everyBars: 8,
    meter: CINDER_METER,
    label: "Clockwork teeth turn underneath the ashfall and the final return.",
  });
}

function buildOrnaments(): PatternNoteDraft[] {
  return [
    ...turnFigure({
      start: pickupBefore(
        {
          kind: "sectionStart",
          startBar: 7,
          bars: 6,
          sectionId: "cinder-mirror",
          label: "the mirror section",
        },
        CINDER_METER,
      ),
      meter: CINDER_METER,
      centerDegree: 5,
      stepSpan: span(0, 0, 1, 4),
      noteSpan: span(0, 0, 1, 2),
      velocity: 0.1,
      pan: 0.16,
    }).map((note) => ({
      ...note,
      ornament: true,
      velocity: note.velocity !== undefined ? note.velocity * 0.92 : note.velocity,
    })),
    ...sighingFigure({
      start: pickupBefore(
        {
          kind: "sectionStart",
          startBar: 13,
          bars: 6,
          sectionId: "cinder-ashfall",
          label: "the ashfall",
        },
        CINDER_METER,
      ),
      meter: CINDER_METER,
      highDegree: 4,
      lowDegree: 3,
      stepSpan: span(0, 0, 1, 2),
      noteSpan: span(0, 0, 3, 4),
      velocity: 0.11,
      pan: -0.14,
    }).map((note) => ({
      ...note,
      ornament: true,
      velocity: note.velocity !== undefined ? note.velocity * 0.9 : note.velocity,
    })),
    ...turnFigure({
      start: pickupBefore(
        {
          kind: "sectionStart",
          startBar: 19,
          bars: 5,
          sectionId: "cinder-return",
          label: "the return",
        },
        CINDER_METER,
      ),
      meter: CINDER_METER,
      centerDegree: 6,
      stepSpan: span(0, 0, 1, 4),
      noteSpan: span(0, 0, 1, 2),
      velocity: 0.12,
      pan: 0.12,
    }).map((note) => ({
      ...note,
      ornament: true,
      velocity: note.velocity !== undefined ? note.velocity * 0.92 : note.velocity,
    })),
    ...sighingFigure({
      start: pickupBefore(
        {
          kind: "sectionStart",
          startBar: 24,
          bars: 1,
          sectionId: "cinder-seal",
          label: "the seal",
        },
        CINDER_METER,
      ),
      meter: CINDER_METER,
      highDegree: 3,
      lowDegree: 2,
      stepSpan: span(0, 0, 1, 2),
      noteSpan: span(0, 0, 3, 4),
      velocity: 0.11,
      pan: -0.1,
    }).map((note) => ({
      ...note,
      ornament: true,
      velocity: note.velocity !== undefined ? note.velocity * 0.9 : note.velocity,
    })),
  ];
}

function buildBells(): PatternNoteDraft[] {
  return sparseBellAccents({
    accents: [
      {
        at: positionAtBarBeat(1, 1),
        pitch: "E6",
        duration: span(0, 0, 3, 4),
        velocity: 0.08,
        pan: 0.14,
      },
      {
        at: pickupBefore(
          {
            kind: "sectionStart",
            startBar: 7,
            bars: 6,
            sectionId: "cinder-mirror",
            label: "the mirror",
          },
          CINDER_METER,
        ),
        pitch: "A5",
        duration: span(0, 0, 3, 4),
        velocity: 0.07,
        pan: -0.12,
      },
      {
        at: positionAtBarBeat(14, 1),
        pitch: "C6",
        duration: span(0, 0, 3, 4),
        velocity: 0.06,
        pan: 0.1,
      },
      {
        at: pickupBefore(
          {
            kind: "sectionStart",
            startBar: 19,
            bars: 5,
            sectionId: "cinder-return",
            label: "the return",
          },
          CINDER_METER,
        ),
        pitch: "E6",
        duration: span(0, 0, 3, 4),
        velocity: 0.09,
        pan: 0.12,
      },
      {
        at: cadenceBeat(
          { kind: "phraseEnd", bars: CINDER_MASTER_BARS, label: "the ember vow" },
          CINDER_METER,
        ),
        pitch: "A5",
        duration: span(0, 1),
        velocity: 0.1,
        pan: 0.14,
      },
    ],
  });
}

function buildBass(harmony: HarmonyPlanItem[]): PatternNoteDraft[] {
  return [
    ...pulseBass({
      harmony: harmony.filter((item) => item.tag !== "cinder-ashfall"),
      beatsPerBar: CINDER_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.44, length: 0.78 },
        { beatOffset: 1, intervalSemitones: 7, velocity: 0.14, length: 0.22 },
        { beatOffset: 2, intervalSemitones: 12, velocity: 0.12, length: 0.22 },
      ],
      octaveShift: -12,
    }),
    ...pulseBass({
      harmony: harmony.filter((item) => item.tag === "cinder-ashfall"),
      beatsPerBar: CINDER_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.28, length: 0.82 },
        { beatOffset: 2, intervalSemitones: 7, velocity: 0.16, length: 0.24 },
      ],
      octaveShift: -12,
    }),
    {
      beat: 71,
      length: 1,
      pitch: "A2",
      velocity: 0.32,
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
          id: "cinder-platform-call",
          synth: "softLead" as const,
          motif: cinderCall,
          positionOffset: positionAtBarBeat(1, 1),
          register: { min: "E5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "cinder-platform-reply",
          synth: "softLead" as const,
          motif: cinderReply,
          positionOffset: positionAtBarBeat(2, 1),
          register: { min: "E5", max: "A6", anchor: "G#5" },
          clampToHarmony: true,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "cinder-platform-call-ii",
          synth: "softLead" as const,
          motif: cinderCall,
          positionOffset: positionAtBarBeat(3, 1),
          register: { min: "E5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.96,
        },
        {
          kind: "motif" as const,
          id: "cinder-platform-cadence",
          synth: "softLead" as const,
          motif: cinderCadence,
          positionOffset: positionAtBarBeat(4, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "cinder-platform-spin",
          synth: "softLead" as const,
          motif: cinderSpin,
          positionOffset: positionAtBarBeat(5, 1),
          register: { min: "E5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "cinder-mirror-reply",
          synth: "softLead" as const,
          motif: cinderReply,
          positionOffset: positionAtBarBeat(7, 1),
          register: { min: "E5", max: "A6", anchor: "G#5" },
          clampToHarmony: true,
          velocityScale: 0.98,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "cinder-mirror-call",
          synth: "softLead" as const,
          motif: cinderCall,
          positionOffset: positionAtBarBeat(8, 1),
          register: { min: "E5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.98,
        },
        {
          kind: "motif" as const,
          id: "cinder-mirror-spin",
          synth: "softLead" as const,
          motif: cinderSpin,
          positionOffset: positionAtBarBeat(9, 1),
          register: { min: "F5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 0.92,
        },
        {
          kind: "motif" as const,
          id: "cinder-mirror-cadence",
          synth: "softLead" as const,
          motif: cinderCadence,
          positionOffset: positionAtBarBeat(11, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.96,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "cinder-mirror-reply-hush",
          synth: "softLead" as const,
          motif: cinderReply,
          positionOffset: positionAtBarBeat(12, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.84,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "cinder-ashfall-shadow-a",
          synth: "softLead" as const,
          motif: cinderShadow,
          positionOffset: positionAtBarBeat(13, 1),
          register: { min: "C5", max: "G6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.82,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "cinder-ashfall-shadow-b",
          synth: "softLead" as const,
          motif: cinderShadow,
          positionOffset: positionAtBarBeat(14, 1),
          register: { min: "C5", max: "G6", anchor: "D5" },
          clampToHarmony: true,
          velocityScale: 0.78,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "cinder-ashfall-call",
          synth: "softLead" as const,
          motif: cinderCall,
          positionOffset: positionAtBarBeat(15, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.76,
        },
        {
          kind: "motif" as const,
          id: "cinder-ashfall-cadence",
          synth: "softLead" as const,
          motif: cinderCadence,
          positionOffset: positionAtBarBeat(16, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.8,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "cinder-ashfall-reply",
          synth: "softLead" as const,
          motif: cinderReply,
          positionOffset: positionAtBarBeat(17, 1),
          register: { min: "D5", max: "A6", anchor: "G#5" },
          clampToHarmony: true,
          velocityScale: 0.8,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "cinder-ashfall-pivot",
          synth: "softLead" as const,
          motif: cinderCadence,
          positionOffset: positionAtBarBeat(18, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.82,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "cinder-return-call",
          synth: "softLead" as const,
          motif: cinderCall,
          positionOffset: positionAtBarBeat(19, 1),
          register: { min: "E5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 1.02,
        },
        {
          kind: "motif" as const,
          id: "cinder-return-reply",
          synth: "softLead" as const,
          motif: cinderReply,
          positionOffset: positionAtBarBeat(20, 1),
          register: { min: "E5", max: "A6", anchor: "G#5" },
          clampToHarmony: true,
          velocityScale: 1.02,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "cinder-return-spin",
          synth: "softLead" as const,
          motif: cinderSpin,
          positionOffset: positionAtBarBeat(21, 1),
          register: { min: "F5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 0.98,
        },
        {
          kind: "motif" as const,
          id: "cinder-return-cadence",
          synth: "softLead" as const,
          motif: cinderCadence,
          positionOffset: positionAtBarBeat(23, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 1.04,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "cinder-seal",
          synth: "softLead" as const,
          motif: cinderSeal,
          positionOffset: positionAtBarBeat(24, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 1.08,
          rhythmRole: "cadence",
        },
      ]),
    ),
  );
}

function buildCinderPlan(): PhrasePlan {
  const harmony = buildHarmony();

  return {
    bars: CINDER_MASTER_BARS,
    beatsPerBar: CINDER_BEATS_PER_BAR,
    meter: CINDER_METER,
    key: { root: "A", scale: "harmonicMinor" },
    harmony,
    sections: [
      {
        id: "cinder-platform",
        role: "statement",
        barRole: "arrival",
        startBar: 0,
        bars: 6,
        bias: { density: -0.06, register: -0.04, brightness: -0.06, cadence: 0.92 },
        description: "The carousel introduces itself like a memory with gears still turning.",
      },
      {
        id: "cinder-mirror",
        role: "variation",
        barRole: "continuation",
        startBar: 6,
        bars: 6,
        bias: { density: 0.02, register: 0.06, brightness: 0.02, cadence: 0.98 },
        description: "The same turn begins to glow, but the machinery stays audible.",
      },
      {
        id: "cinder-ashfall",
        role: "shadow",
        barRole: "transition",
        startBar: 12,
        bars: 6,
        bias: { density: -0.22, register: -0.16, brightness: -0.24, cadence: 0.6 },
        description: "The ride continues as ash, silhouette, and afterimage.",
      },
      {
        id: "cinder-return",
        role: "return",
        barRole: "arrival",
        startBar: 18,
        bars: 5,
        bias: { density: -0.02, register: 0.08, brightness: 0.04, cadence: 1.14 },
        description: "The carousel comes back into view with more tenderness than before.",
      },
      {
        id: "cinder-seal",
        role: "cadence",
        barRole: "cadence",
        startBar: 23,
        bars: 1,
        bias: { density: -0.12, register: 0.04, brightness: -0.04, cadence: 1.34 },
        description: "One last turn seals the loop with a quiet ember instead of a blaze.",
      },
    ],
    cadenceTiming: [
      {
        targetBar: CINDER_MASTER_BARS,
        targetBeat: 1,
        mustLandOnStrongBeat: true,
        minFinalDurationBeats: 1,
        thinBeforeArrival: true,
        allowPickup: false,
        maxOrnamentVelocityNearCadence: 0.11,
      },
    ],
    padLayers: [{ synth: "warmPad", voiceId: "pad", velocityScale: 0.76 }],
    arrangement: {
      densityCurve: [
        { beat: 0, value: 0.34 },
        { beat: 18, value: 0.46 },
        { beat: 36, value: 0.2 },
        { beat: 54, value: 0.5 },
        { beat: 72, value: 0.36 },
      ],
      registerCurve: [
        { beat: 0, value: -0.02 },
        { beat: 18, value: 0.08 },
        { beat: 36, value: -0.18 },
        { beat: 54, value: 0.1 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.28 },
        { beat: 18, value: 0.36 },
        { beat: 36, value: 0.14 },
        { beat: 54, value: 0.4 },
        { beat: 72, value: 0.24 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.18 },
        { beat: 12, value: 0.34 },
        { beat: 30, value: 0.5 },
        { beat: 48, value: 0.26 },
        { beat: 63, value: 0.78 },
        { beat: 69, value: 0.98 },
      ],
      ornamentBaseProbability: 0.08,
    },
    noteLayers: [
      ...buildLeadLayers(),
      {
        kind: "draft",
        id: "cinder-counterline",
        synth: "softLead",
        voiceId: "counterline",
        rhythmRole: "response",
        realization: true,
        notes: buildCounterline(),
        register: { min: "A4", max: "E5", anchor: "C5" },
        velocityScale: 0.82,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "cinder-clockwork",
        synth: "pluckyDust",
        voiceId: "inner",
        rhythmRole: "flow",
        realization: true,
        notes: buildClockworkInner(),
        register: { min: "A4", max: "E6", anchor: "C5" },
        velocityScale: 0.74,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "cinder-ornaments",
        synth: "pluckyDust",
        voiceId: "ornament",
        rhythmRole: "ornament",
        realization: true,
        notes: buildOrnaments(),
        register: { min: "E5", max: "A6", anchor: "E6" },
        allowOrnaments: true,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "cinder-bells",
        synth: "glassBell",
        voiceId: "bells",
        rhythmRole: "punctuation",
        realization: true,
        notes: buildBells(),
        register: { min: "A5", max: "E6", anchor: "C6" },
        clampToHarmony: false,
      },
      {
        kind: "draft",
        id: "cinder-bass",
        synth: "roundBass",
        voiceId: "bass",
        rhythmRole: "anchor",
        realization: true,
        notes: buildBass(harmony),
        register: { min: "A2", max: "E3", anchor: "A2" },
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "cinder-drone",
        synth: "breathingDrone",
        voiceId: "drone",
        rhythmRole: "suspension",
        realization: true,
        notes: buildDrone(),
        register: { min: "D3", max: "E4", anchor: "A3" },
        clampToHarmony: true,
      },
    ],
  };
}

export const cinderCarousel: Composition = buildComposition({
  id: "cinder-carousel",
  title: "Cinder Carousel",
  key: { root: "A", scale: "harmonicMinor" },
  bpm: CINDER_BPM,
  beatsPerBar: CINDER_BEATS_PER_BAR,
  plan: buildCinderPlan(),
});
