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

const UNDERTOW_BPM = 68;
const UNDERTOW_BEATS_PER_BAR = 5;
const UNDERTOW_MASTER_BARS = 20;
const UNDERTOW_METER = {
  beatsPerBar: UNDERTOW_BEATS_PER_BAR,
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

const atlasCall: Motif = {
  anchorDegree: 1,
  steps: [
    {
      beat: 0,
      length: 1.1,
      offset: 0,
      velocity: 0.66,
      pan: -0.12,
      toneIntent: "chord",
    },
    {
      beat: 1.5,
      length: 0.58,
      offset: 2,
      velocity: 0.56,
      pan: -0.04,
      toneIntent: "scale",
    },
    {
      beat: 3,
      length: 0.72,
      offset: 4,
      velocity: 0.62,
      pan: 0.06,
      toneIntent: "chord",
    },
    {
      beat: 4.2,
      length: 0.6,
      offset: 3,
      velocity: 0.54,
      pan: 0.12,
      toneIntent: "color",
    },
  ],
};

const atlasResponse = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(atlasCall, { scaleSteps: 4 }), (step, index) => ({
    ...step,
    beat: step.beat + (index === 0 ? 0.25 : 0),
    length: index === 3 ? 0.86 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 2 ? 0.98 : 0.92)
        : step.velocity,
  })),
  0.98,
);

const atlasWake = scaleMotifVelocities(
  mapMotifSteps(sequence(atlasCall, { scaleSteps: 1 }, 2), (step, index) => ({
    ...step,
    beat: step.beat + (index >= 4 ? 0.25 : 0),
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index >= 4 ? 0.92 : 1)
        : step.velocity,
  })),
  0.9,
);

const atlasShadow = scaleMotifVelocities(
  mapMotifSteps(retrograde(atlasCall), (step, index) => ({
    ...step,
    beat: step.beat + 0.15,
    length: step.length * (index === 0 ? 1.18 : 1.06),
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.78 : 0.84)
        : step.velocity,
  })),
  0.9,
);

const atlasLandfall: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.92,
      offset: 0,
      velocity: 0.58,
      pan: -0.08,
      toneIntent: "chord",
    },
    {
      beat: 1.5,
      length: 0.58,
      offset: -1,
      velocity: 0.54,
      pan: 0.02,
      toneIntent: "scale",
    },
    {
      beat: 3,
      length: 0.72,
      offset: -2,
      velocity: 0.62,
      pan: 0.08,
      toneIntent: "color",
    },
    {
      beat: 4.15,
      length: 0.95,
      offset: -4,
      velocity: 0.72,
      pan: 0.12,
      toneIntent: "chord",
    },
  ],
};

const atlasSeal: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.92,
      offset: 0,
      velocity: 0.56,
      pan: -0.06,
      toneIntent: "chord",
    },
    {
      beat: 1.5,
      length: 0.52,
      offset: -1,
      velocity: 0.52,
      pan: 0.02,
      toneIntent: "scale",
    },
    {
      beat: 3,
      length: 0.72,
      offset: -2,
      velocity: 0.64,
      pan: 0.08,
      toneIntent: "color",
    },
    {
      beat: 4,
      length: 1,
      offset: -4,
      velocity: 0.8,
      pan: 0.12,
      toneIntent: "chord",
    },
  ],
};

function buildHarmony(): HarmonyPlanItem[] {
  return [
    { bar: 0, root: "E4", quality: "minor", velocity: 0.18, spread: 0.01, tag: "undertow-chart-room" },
    { bar: 1, root: "D4", quality: "major7", velocity: 0.17, spread: 0.01, tag: "undertow-chart-room" },
    { bar: 2, root: "G3", quality: "add9", velocity: 0.19, spread: 0.01, tag: "undertow-chart-room" },
    { bar: 3, root: "A3", quality: "sus2", velocity: 0.18, spread: 0.01, tag: "undertow-chart-room" },
    { bar: 4, root: "E4", quality: "minor", velocity: 0.19, spread: 0.01, tag: "undertow-sounding-lines" },
    { bar: 5, root: "B3", quality: "minor7", velocity: 0.17, spread: 0.01, tag: "undertow-sounding-lines" },
    { bar: 6, root: "D4", quality: "major7", velocity: 0.18, spread: 0.01, tag: "undertow-sounding-lines" },
    { bar: 7, root: "A3", quality: "sus2", velocity: 0.18, spread: 0.01, tag: "undertow-sounding-lines" },
    { bar: 8, root: "G3", quality: "add9", velocity: 0.17, spread: 0.01, tag: "undertow-black-current" },
    { bar: 9, root: "D4", quality: "major7", velocity: 0.16, spread: 0.01, tag: "undertow-black-current" },
    { bar: 10, root: "B3", quality: "minor7", velocity: 0.16, spread: 0.01, tag: "undertow-black-current" },
    { bar: 11, root: "A3", quality: "sus2", velocity: 0.17, spread: 0.01, tag: "undertow-black-current" },
    { bar: 12, root: "E4", quality: "minor", velocity: 0.18, spread: 0.01, tag: "undertow-open-water" },
    { bar: 13, root: "G3", quality: "add9", velocity: 0.18, spread: 0.01, tag: "undertow-open-water" },
    { bar: 14, root: "D4", quality: "major7", velocity: 0.17, spread: 0.01, tag: "undertow-open-water" },
    { bar: 15, root: "A3", quality: "sus2", velocity: 0.18, spread: 0.01, tag: "undertow-open-water" },
    { bar: 16, root: "E4", quality: "minor", velocity: 0.2, spread: 0.01, tag: "undertow-shoreline" },
    { bar: 17, root: "D4", quality: "major7", velocity: 0.18, spread: 0.01, tag: "undertow-shoreline" },
    { bar: 18, root: "A3", quality: "sus2", velocity: 0.21, spread: 0.01, tag: "undertow-shoreline" },
    { bar: 19, root: "E4", quality: "minor", velocity: 0.24, spread: 0.01, tag: "undertow-seal" },
  ];
}

function buildDrone(): PatternNoteDraft[] {
  return [
    { beat: 0, length: 20, pitch: "E3", velocity: 0.1, pan: -0.08, toneIntent: "chord" },
    { beat: 0, length: 20, pitch: "B3", velocity: 0.06, pan: 0.08, toneIntent: "chord" },
    { beat: 20, length: 20, pitch: "D3", velocity: 0.09, pan: -0.08, toneIntent: "chord" },
    { beat: 20, length: 20, pitch: "A3", velocity: 0.05, pan: 0.08, toneIntent: "chord" },
    { beat: 40, length: 20, pitch: "G2", velocity: 0.09, pan: -0.06, toneIntent: "chord" },
    { beat: 40, length: 20, pitch: "D3", velocity: 0.05, pan: 0.06, toneIntent: "chord" },
    { beat: 60, length: 20, pitch: "E3", velocity: 0.1, pan: -0.08, toneIntent: "chord" },
    { beat: 60, length: 20, pitch: "B3", velocity: 0.06, pan: 0.08, toneIntent: "chord" },
    { beat: 80, length: 18.8, pitch: "E3", velocity: 0.12, pan: -0.08, toneIntent: "chord" },
    { beat: 80, length: 18.8, pitch: "B3", velocity: 0.07, pan: 0.08, toneIntent: "chord" },
  ];
}

function buildCounterline(): PatternNoteDraft[] {
  const soundingCell = [
    withPosition(
      {
        degree: 5,
        velocity: 0.16,
        pan: -0.12,
        toneIntent: "chord" as const,
      },
      {
        at: positionAtBarBeat(1, 4),
        duration: span(0, 1),
      },
    ),
    withPosition(
      {
        degree: 3,
        velocity: 0.15,
        pan: 0.04,
        toneIntent: "scale" as const,
      },
      {
        at: positionAtBarBeat(2, 2, 1, 2),
        duration: span(0, 1),
      },
    ),
  ];

  return [
    ...repeatAcrossBars(soundingCell, {
      startBar: 5,
      repetitions: 2,
      everyBars: 12,
      meter: UNDERTOW_METER,
      label: "Counterline beacon returns in the sounding lines and the shoreline return.",
    }),
    withPosition(
      {
        degree: 6,
        velocity: 0.14,
        pan: -0.04,
        toneIntent: "color" as const,
      },
      {
        at: positionAtBarBeat(11, 3),
        duration: span(0, 1),
      },
    ),
    withPosition(
      {
        degree: 4,
        velocity: 0.13,
        pan: 0.04,
        toneIntent: "scale" as const,
      },
      {
        at: positionAtBarBeat(14, 5),
        duration: span(0, 1),
      },
    ),
  ];
}

function buildInnerRipples(): PatternNoteDraft[] {
  const rippleCell = [
    ...brokenTriad({
      start: positionAtBarBeat(1, 2),
      meter: UNDERTOW_METER,
      beats: 4,
      order: [0, 1, 2, 1],
      stepSpan: span(0, 1),
      noteSpan: span(0, 0, 3, 4),
      velocity: 0.1,
      pan: -0.14,
      toneIntent: "chord",
    }),
    ...brokenTriad({
      start: positionAtBarBeat(2, 1, 1, 2),
      meter: UNDERTOW_METER,
      beats: 4,
      order: [1, 2, 1, 0],
      stepSpan: span(0, 1),
      noteSpan: span(0, 0, 3, 4),
      velocity: 0.1,
      pan: 0.14,
      toneIntent: "chord",
    }),
  ];

  return repeatAcrossBars(rippleCell, {
    startBar: 9,
    repetitions: 2,
    everyBars: 4,
    meter: UNDERTOW_METER,
    label: "Inner ripples surface in the black current and open-water sections.",
  });
}

function buildOrnaments(): PatternNoteDraft[] {
  return [
    ...sighingFigure({
      start: pickupBefore(
        {
          kind: "sectionStart",
          startBar: 5,
          bars: 4,
          sectionId: "undertow-sounding-lines",
          label: "the sounding lines",
        },
        UNDERTOW_METER,
      ),
      meter: UNDERTOW_METER,
      highDegree: 5,
      lowDegree: 4,
      stepSpan: span(0, 0, 1, 2),
      noteSpan: span(0, 0, 3, 4),
      velocity: 0.11,
      pan: 0.16,
    }).map((note) => ({
      ...note,
      ornament: true,
      velocity: note.velocity !== undefined ? note.velocity * 0.94 : note.velocity,
    })),
    ...turnFigure({
      start: pickupBefore(
        {
          kind: "sectionStart",
          startBar: 9,
          bars: 4,
          sectionId: "undertow-black-current",
          label: "the black current",
        },
        UNDERTOW_METER,
        { subdivisions: 1, subdivisionUnit: 4 },
      ),
      meter: UNDERTOW_METER,
      centerDegree: 5,
      stepSpan: span(0, 0, 1, 4),
      noteSpan: span(0, 0, 1, 2),
      velocity: 0.1,
      pan: -0.14,
    }).map((note) => ({
      ...note,
      ornament: true,
      velocity: note.velocity !== undefined ? note.velocity * 0.9 : note.velocity,
    })),
    ...sighingFigure({
      start: pickupBefore(
        {
          kind: "sectionStart",
          startBar: 17,
          bars: 3,
          sectionId: "undertow-shoreline",
          label: "the shoreline",
        },
        UNDERTOW_METER,
      ),
      meter: UNDERTOW_METER,
      highDegree: 4,
      lowDegree: 3,
      stepSpan: span(0, 0, 1, 2),
      noteSpan: span(0, 0, 3, 4),
      velocity: 0.12,
      pan: 0.14,
    }).map((note) => ({
      ...note,
      ornament: true,
      velocity: note.velocity !== undefined ? note.velocity * 0.92 : note.velocity,
    })),
  ];
}

function buildBells(): PatternNoteDraft[] {
  return sparseBellAccents({
    accents: [
      {
        at: positionAtBarBeat(1, 1),
        pitch: "B5",
        duration: span(0, 1),
        velocity: 0.08,
        pan: 0.16,
      },
      {
        at: pickupBefore(
          {
            kind: "sectionStart",
            startBar: 9,
            bars: 4,
            sectionId: "undertow-black-current",
            label: "the black current",
          },
          UNDERTOW_METER,
        ),
        pitch: "D6",
        duration: span(0, 1),
        velocity: 0.07,
        pan: -0.12,
      },
      {
        at: positionAtBarBeat(12, 5),
        pitch: "A5",
        duration: span(0, 1),
        velocity: 0.06,
        pan: 0.08,
      },
      {
        at: positionAtBarBeat(18, 4),
        pitch: "B5",
        duration: span(0, 1),
        velocity: 0.09,
        pan: 0.12,
      },
      {
        at: cadenceBeat(
          { kind: "phraseEnd", bars: UNDERTOW_MASTER_BARS, label: "the atlas closes" },
          UNDERTOW_METER,
        ),
        pitch: "E6",
        duration: span(0, 1),
        velocity: 0.1,
        pan: 0.16,
      },
    ],
  });
}

function buildBass(harmony: HarmonyPlanItem[]): PatternNoteDraft[] {
  return [
    ...pulseBass({
      harmony: harmony.filter((item) => item.tag !== "undertow-black-current"),
      beatsPerBar: UNDERTOW_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.44, length: 0.72 },
        { beatOffset: 3, intervalSemitones: 7, velocity: 0.22, length: 0.34 },
        { beatOffset: 4.25, intervalSemitones: 0, velocity: 0.18, length: 0.28 },
      ],
      octaveShift: -12,
    }),
    ...pulseBass({
      harmony: harmony.filter((item) => item.tag === "undertow-black-current"),
      beatsPerBar: UNDERTOW_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.28, length: 0.76 },
        { beatOffset: 4, intervalSemitones: 7, velocity: 0.16, length: 0.3 },
      ],
      octaveShift: -12,
    }),
    {
      beat: 99,
      length: 1,
      pitch: "E2",
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
          id: "undertow-chart-call",
          synth: "softLead" as const,
          motif: atlasCall,
          positionOffset: positionAtBarBeat(1, 1),
          register: { min: "E5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "undertow-chart-response",
          synth: "softLead" as const,
          motif: atlasResponse,
          positionOffset: positionAtBarBeat(2, 1),
          register: { min: "F#5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "undertow-chart-landfall",
          synth: "softLead" as const,
          motif: atlasLandfall,
          positionOffset: positionAtBarBeat(4, 1),
          register: { min: "E5", max: "A6", anchor: "B5" },
          clampToHarmony: true,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "undertow-lines-wake",
          synth: "softLead" as const,
          motif: atlasWake,
          positionOffset: positionAtBarBeat(5, 1),
          register: { min: "F#5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "undertow-lines-response",
          synth: "softLead" as const,
          motif: atlasResponse,
          positionOffset: positionAtBarBeat(7, 1),
          register: { min: "F#5", max: "B6", anchor: "B5" },
          clampToHarmony: true,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "undertow-lines-landfall",
          synth: "softLead" as const,
          motif: atlasLandfall,
          positionOffset: positionAtBarBeat(8, 1),
          register: { min: "E5", max: "A6", anchor: "B5" },
          clampToHarmony: true,
          velocityScale: 0.96,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "undertow-current-shadow-a",
          synth: "softLead" as const,
          motif: atlasShadow,
          positionOffset: positionAtBarBeat(9, 1),
          register: { min: "D5", max: "A6", anchor: "F#5" },
          clampToHarmony: true,
          velocityScale: 0.86,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "undertow-current-shadow-b",
          synth: "softLead" as const,
          motif: atlasShadow,
          positionOffset: positionAtBarBeat(10, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.82,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "undertow-current-wake",
          synth: "softLead" as const,
          motif: atlasWake,
          positionOffset: positionAtBarBeat(11, 1),
          register: { min: "E5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 0.84,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "undertow-open-water-wake",
          synth: "softLead" as const,
          motif: atlasWake,
          positionOffset: positionAtBarBeat(13, 1),
          register: { min: "F#5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 0.9,
        },
        {
          kind: "motif" as const,
          id: "undertow-open-water-response",
          synth: "softLead" as const,
          motif: atlasResponse,
          positionOffset: positionAtBarBeat(15, 1),
          register: { min: "E5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 0.92,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "undertow-open-water-landfall",
          synth: "softLead" as const,
          motif: atlasLandfall,
          positionOffset: positionAtBarBeat(16, 1),
          register: { min: "E5", max: "A6", anchor: "B5" },
          clampToHarmony: true,
          velocityScale: 0.94,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "undertow-shoreline-call",
          synth: "softLead" as const,
          motif: atlasCall,
          positionOffset: positionAtBarBeat(17, 1),
          register: { min: "E5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 1.02,
        },
        {
          kind: "motif" as const,
          id: "undertow-shoreline-response",
          synth: "softLead" as const,
          motif: atlasResponse,
          positionOffset: positionAtBarBeat(18, 1),
          register: { min: "F#5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 1.02,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "undertow-shoreline-landfall",
          synth: "softLead" as const,
          motif: atlasLandfall,
          positionOffset: positionAtBarBeat(19, 1),
          register: { min: "E5", max: "A6", anchor: "B5" },
          clampToHarmony: true,
          velocityScale: 1.04,
          rhythmRole: "cadence",
        },
        {
          kind: "motif" as const,
          id: "undertow-seal",
          synth: "softLead" as const,
          motif: atlasSeal,
          positionOffset: positionAtBarBeat(20, 1),
          register: { min: "E5", max: "A6", anchor: "B5" },
          clampToHarmony: true,
          velocityScale: 1.08,
          rhythmRole: "cadence",
        },
      ]),
    ),
  );
}

function buildUndertowPlan(): PhrasePlan {
  const harmony = buildHarmony();

  return {
    bars: UNDERTOW_MASTER_BARS,
    beatsPerBar: UNDERTOW_BEATS_PER_BAR,
    meter: UNDERTOW_METER,
    key: { root: "E", scale: "dorian" },
    harmony,
    sections: [
      {
        id: "undertow-chart-room",
        role: "statement",
        barRole: "arrival",
        startBar: 0,
        bars: 4,
        bias: { density: -0.08, register: -0.02, brightness: -0.06, cadence: 0.92 },
        description: "The horizon is mapped before the tide is trusted.",
      },
      {
        id: "undertow-sounding-lines",
        role: "answer",
        barRole: "continuation",
        startBar: 4,
        bars: 4,
        bias: { density: 0, register: 0.08, brightness: 0.04, cadence: 0.98 },
        description: "The same contour repeats with more confidence and more tide under it.",
      },
      {
        id: "undertow-black-current",
        role: "shadow",
        barRole: "transition",
        startBar: 8,
        bars: 4,
        bias: { density: -0.22, register: -0.16, brightness: -0.2, cadence: 0.62 },
        description: "The atlas stays open, but the water goes dark beneath it.",
      },
      {
        id: "undertow-open-water",
        role: "bridge",
        barRole: "continuation",
        startBar: 12,
        bars: 4,
        bias: { density: -0.04, register: 0.06, brightness: 0, cadence: 0.88 },
        description: "The line stretches farther out and starts to read as weather.",
      },
      {
        id: "undertow-shoreline",
        role: "return",
        barRole: "arrival",
        startBar: 16,
        bars: 3,
        bias: { density: 0.02, register: 0.08, brightness: 0.06, cadence: 1.14 },
        description: "The motif arrives back on land without losing the pull underneath it.",
      },
      {
        id: "undertow-seal",
        role: "cadence",
        barRole: "cadence",
        startBar: 19,
        bars: 1,
        bias: { density: -0.1, register: 0.04, brightness: 0, cadence: 1.3 },
        description: "A single horizon line closes the map and restarts the tide.",
      },
    ],
    cadenceTiming: [
      {
        targetBar: UNDERTOW_MASTER_BARS,
        targetBeat: 1,
        mustLandOnStrongBeat: true,
        minFinalDurationBeats: 1.2,
        thinBeforeArrival: true,
        allowPickup: false,
        maxOrnamentVelocityNearCadence: 0.11,
      },
    ],
    padLayers: [{ synth: "warmPad", voiceId: "pad", velocityScale: 0.78 }],
    arrangement: {
      densityCurve: [
        { beat: 0, value: 0.28 },
        { beat: 20, value: 0.38 },
        { beat: 40, value: 0.18 },
        { beat: 60, value: 0.42 },
        { beat: 80, value: 0.5 },
        { beat: 100, value: 0.34 },
      ],
      registerCurve: [
        { beat: 0, value: -0.02 },
        { beat: 20, value: 0.06 },
        { beat: 40, value: -0.18 },
        { beat: 60, value: 0.02 },
        { beat: 80, value: 0.08 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.34 },
        { beat: 20, value: 0.42 },
        { beat: 40, value: 0.18 },
        { beat: 60, value: 0.32 },
        { beat: 80, value: 0.48 },
        { beat: 100, value: 0.3 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.18 },
        { beat: 20, value: 0.34 },
        { beat: 40, value: 0.22 },
        { beat: 60, value: 0.42 },
        { beat: 80, value: 0.76 },
        { beat: 95, value: 0.96 },
      ],
      ornamentBaseProbability: 0.08,
    },
    noteLayers: [
      ...buildLeadLayers(),
      {
        kind: "draft",
        id: "undertow-counterline",
        synth: "softLead",
        voiceId: "counterline",
        rhythmRole: "response",
        realization: true,
        notes: buildCounterline(),
        register: { min: "B4", max: "E5", anchor: "D5" },
        velocityScale: 0.84,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "undertow-inner-ripples",
        synth: "softLead",
        voiceId: "inner",
        rhythmRole: "flow",
        realization: true,
        notes: buildInnerRipples(),
        register: { min: "E4", max: "B5", anchor: "G4" },
        velocityScale: 0.72,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "undertow-ornaments",
        synth: "pluckyDust",
        voiceId: "ornament",
        rhythmRole: "ornament",
        realization: true,
        notes: buildOrnaments(),
        register: { min: "A5", max: "D6", anchor: "B5" },
        allowOrnaments: true,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "undertow-bells",
        synth: "glassBell",
        voiceId: "bells",
        rhythmRole: "punctuation",
        realization: true,
        notes: buildBells(),
        register: { min: "A5", max: "E6", anchor: "B5" },
        clampToHarmony: false,
      },
      {
        kind: "draft",
        id: "undertow-bass",
        synth: "roundBass",
        voiceId: "bass",
        rhythmRole: "anchor",
        realization: true,
        notes: buildBass(harmony),
        register: { min: "E2", max: "B2", anchor: "E2" },
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "undertow-drone",
        synth: "breathingDrone",
        voiceId: "drone",
        rhythmRole: "suspension",
        realization: true,
        notes: buildDrone(),
        register: { min: "G2", max: "B3", anchor: "E3" },
        clampToHarmony: true,
      },
    ],
  };
}

export const undertowAtlas: Composition = buildComposition({
  id: "undertow-atlas",
  title: "Undertow Atlas",
  key: { root: "E", scale: "dorian" },
  bpm: UNDERTOW_BPM,
  beatsPerBar: UNDERTOW_BEATS_PER_BAR,
  plan: buildUndertowPlan(),
});
