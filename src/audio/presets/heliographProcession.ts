import { compilePhrasePlan } from "../authoring/compile";
import {
  makeAnswerPhrase,
  retrograde,
  sequence,
} from "../authoring/motifs";
import {
  pulseBass,
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

const HELIOGRAPH_BPM = 74;
const HELIOGRAPH_BEATS_PER_BAR = 6;
const HELIOGRAPH_MASTER_BARS = 20;
const HELIOGRAPH_METER = {
  beatsPerBar: HELIOGRAPH_BEATS_PER_BAR,
  beatUnit: 8,
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
      noteScale: 0.92,
      chordScale: 0.76,
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

const processionCall: Motif = {
  anchorDegree: 1,
  steps: [
    { beat: 0, length: 0.8, offset: 0, velocity: 0.66, pan: -0.12, toneIntent: "chord" },
    { beat: 1.5, length: 0.55, offset: 2, velocity: 0.56, pan: -0.02, toneIntent: "scale" },
    { beat: 3, length: 0.72, offset: 3, velocity: 0.64, pan: 0.08, toneIntent: "color" },
    { beat: 4.5, length: 1.1, offset: 4, velocity: 0.74, pan: 0.12, toneIntent: "chord" },
  ],
};

const processionAnswer = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(processionCall, { scaleSteps: 2 }), (step, index) => ({
    ...step,
    length: index === 3 ? 1.2 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 2 ? 0.96 : 0.92)
        : step.velocity,
  })),
  0.98,
);

const processionStride = scaleMotifVelocities(
  mapMotifSteps(sequence(processionCall, { scaleSteps: 1 }, 2), (step, index) => ({
    ...step,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index >= 4 ? 0.94 : 1)
        : step.velocity,
  })),
  0.96,
);

const processionEclipse = scaleMotifVelocities(
  mapMotifSteps(retrograde(processionCall), (step, index) => ({
    ...step,
    beat: step.beat + 0.5,
    length: index === 0 ? 1.35 : step.length * 1.06,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.86 : 0.8)
        : step.velocity,
  })),
  0.9,
);

const processionCrown: Motif = {
  anchorDegree: 5,
  steps: [
    { beat: 0, length: 0.72, offset: 0, velocity: 0.62, pan: -0.08, toneIntent: "chord" },
    { beat: 1.5, length: 0.5, offset: -1, velocity: 0.56, pan: -0.02, toneIntent: "scale" },
    { beat: 3, length: 0.7, offset: -4, velocity: 0.66, pan: 0.08, toneIntent: "chord" },
    { beat: 4.5, length: 1.35, offset: -2, velocity: 0.74, pan: 0.12, toneIntent: "color" },
  ],
};

const processionSeal: Motif = {
  anchorDegree: 5,
  steps: [
    { beat: 0, length: 1.2, offset: 0, velocity: 0.58, pan: -0.06, toneIntent: "chord" },
    { beat: 1.5, length: 0.5, offset: -1, velocity: 0.54, pan: 0.02, toneIntent: "scale" },
    { beat: 3, length: 0.8, offset: -4, velocity: 0.68, pan: 0.08, toneIntent: "chord" },
    { beat: 4.5, length: 1.5, offset: -4, velocity: 0.82, pan: 0.14, toneIntent: "chord" },
  ],
};

function buildHarmony(): HarmonyPlanItem[] {
  return [
    { bar: 0, root: "D4", quality: "major", velocity: 0.19, inversion: 1, spread: 0.01, tag: "threshold" },
    { bar: 1, root: "B3", quality: "minor7", velocity: 0.17, spread: 0.01, tag: "threshold" },
    { bar: 2, root: "E4", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "threshold" },
    { bar: 3, root: "A3", quality: "sus2", velocity: 0.19, spread: 0.01, tag: "threshold" },
    { bar: 4, root: "D4", quality: "major", velocity: 0.2, inversion: 1, spread: 0.01, tag: "ascent" },
    { bar: 5, root: "E4", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "ascent" },
    { bar: 6, root: "B3", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "ascent" },
    { bar: 7, root: "A3", quality: "sus2", velocity: 0.2, spread: 0.01, tag: "ascent" },
    { bar: 8, root: "B3", quality: "minor7", velocity: 0.17, spread: 0.01, tag: "vault" },
    { bar: 9, root: "E4", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "vault" },
    { bar: 10, root: "D4", quality: "major", velocity: 0.18, inversion: 1, spread: 0.01, tag: "vault" },
    { bar: 11, root: "A3", quality: "sus2", velocity: 0.19, spread: 0.01, tag: "vault" },
    { bar: 12, root: "B3", quality: "minor7", velocity: 0.16, spread: 0.01, tag: "eclipse" },
    { bar: 13, root: "A3", quality: "sus2", velocity: 0.16, spread: 0.01, tag: "eclipse" },
    { bar: 14, root: "E4", quality: "minor7", velocity: 0.17, spread: 0.01, tag: "eclipse" },
    { bar: 15, root: "A3", quality: "sus2", velocity: 0.18, spread: 0.01, tag: "eclipse" },
    { bar: 16, root: "D4", quality: "major", velocity: 0.2, inversion: 1, spread: 0.01, tag: "homecoming" },
    { bar: 17, root: "B3", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "homecoming" },
    { bar: 18, root: "A3", quality: "sus2", velocity: 0.21, spread: 0.01, tag: "homecoming" },
    { bar: 19, root: "D4", quality: "major", velocity: 0.24, inversion: 1, spread: 0.01, tag: "crown" },
  ];
}

function buildDrone(): PatternNoteDraft[] {
  return [
    { beat: 0, length: 24, pitch: "D3", velocity: 0.1, pan: -0.08, toneIntent: "chord" },
    { beat: 0, length: 24, pitch: "A3", velocity: 0.06, pan: 0.08, toneIntent: "chord" },
    { beat: 24, length: 24, pitch: "B2", velocity: 0.09, pan: -0.08, toneIntent: "chord" },
    { beat: 24, length: 24, pitch: "F#3", velocity: 0.06, pan: 0.08, toneIntent: "chord" },
    { beat: 48, length: 24, pitch: "E3", velocity: 0.09, pan: -0.08, toneIntent: "chord" },
    { beat: 48, length: 24, pitch: "B3", velocity: 0.06, pan: 0.08, toneIntent: "chord" },
    { beat: 72, length: 24, pitch: "A2", velocity: 0.08, pan: -0.06, toneIntent: "chord" },
    { beat: 72, length: 24, pitch: "E3", velocity: 0.05, pan: 0.06, toneIntent: "chord" },
    { beat: 96, length: 22.5, pitch: "D3", velocity: 0.12, pan: -0.08, toneIntent: "chord" },
    { beat: 96, length: 22.5, pitch: "A3", velocity: 0.07, pan: 0.08, toneIntent: "chord" },
  ];
}

function buildCounterline(): PatternNoteDraft[] {
  const beaconCell = [
    withPosition(
      {
        degree: 3,
        velocity: 0.18,
        pan: -0.12,
        toneIntent: "scale" as const,
      },
      {
        at: positionAtBarBeat(1, 2, 1, 2),
        duration: span(0, 1),
      },
    ),
    withPosition(
      {
        degree: 5,
        velocity: 0.16,
        pan: 0.08,
        toneIntent: "chord" as const,
      },
      {
        at: positionAtBarBeat(2, 5),
        duration: span(0, 1),
      },
    ),
  ];

  return [
    ...repeatAcrossBars(beaconCell, {
      startBar: 5,
      repetitions: 2,
      everyBars: 12,
      meter: HELIOGRAPH_METER,
      label: "Beacon counterline returns in ascent and homecoming.",
    }),
    withPosition(
      {
        degree: 6,
        velocity: 0.15,
        pan: -0.04,
        toneIntent: "color" as const,
      },
      {
        at: positionAtBarBeat(10, 4, 1, 2),
        duration: span(0, 1),
      },
    ),
    withPosition(
      {
        degree: 3,
        velocity: 0.14,
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

function buildOrnaments(): PatternNoteDraft[] {
  return [
    ...turnFigure({
      start: pickupBefore(
        {
          kind: "sectionStart",
          startBar: 5,
          bars: 4,
          sectionId: "heliograph-ascent",
          label: "the ascent",
        },
        HELIOGRAPH_METER,
      ),
      meter: HELIOGRAPH_METER,
      centerDegree: 4,
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
      velocity: 0.11,
      pan: 0.18,
    }).map((note) => ({
      ...note,
      ornament: true,
      velocity: note.velocity !== undefined ? note.velocity * 0.94 : note.velocity,
    })),
    ...turnFigure({
      start: pickupBefore(
        {
          kind: "sectionStart",
          startBar: 17,
          bars: 3,
          sectionId: "heliograph-homecoming",
          label: "the homecoming",
        },
        HELIOGRAPH_METER,
        { subdivisions: 1, subdivisionUnit: 4 },
      ),
      meter: HELIOGRAPH_METER,
      centerDegree: 5,
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
      velocity: 0.12,
      pan: -0.14,
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
        pitch: "A5",
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
          sectionId: "heliograph-vault",
          label: "the vault",
          },
          HELIOGRAPH_METER,
        ),
        pitch: "B5",
        duration: span(0, 1),
        velocity: 0.07,
        pan: -0.12,
      },
      {
        beat: 78,
        pitch: "F#5",
        length: 1.2,
        velocity: 0.06,
        pan: 0.08,
      },
      {
        at: positionAtBarBeat(18, 4),
        pitch: "A5",
        duration: span(0, 1),
        velocity: 0.09,
        pan: 0.12,
      },
      {
        at: cadenceBeat(
          { kind: "phraseEnd", bars: HELIOGRAPH_MASTER_BARS, label: "the coronation" },
          HELIOGRAPH_METER,
        ),
        pitch: "D6",
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
      harmony: harmony.filter((item) => item.tag !== "eclipse"),
      beatsPerBar: HELIOGRAPH_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.42, length: 0.5 },
        { beatOffset: 3, intervalSemitones: 7, velocity: 0.2, length: 0.32 },
      ],
      octaveShift: -12,
    }),
    ...pulseBass({
      harmony: harmony.filter((item) => item.tag === "eclipse"),
      beatsPerBar: HELIOGRAPH_BEATS_PER_BAR,
      pattern: [{ beatOffset: 0, intervalSemitones: 0, velocity: 0.26, length: 0.46 }],
      octaveShift: -12,
    }),
    {
      beat: 117,
      length: 1,
      pitch: "D2",
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
          id: "heliograph-threshold-call",
          synth: "softLead" as const,
          motif: processionCall,
          positionOffset: positionAtBarBeat(1, 1),
          register: { min: "D5", max: "B6", anchor: "F#5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "heliograph-threshold-answer",
          synth: "softLead" as const,
          motif: processionAnswer,
          positionOffset: positionAtBarBeat(2, 1),
          register: { min: "E5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "heliograph-threshold-crown",
          synth: "softLead" as const,
          motif: processionCrown,
          positionOffset: positionAtBarBeat(4, 1),
          register: { min: "D5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "heliograph-ascent-stride",
          synth: "softLead" as const,
          motif: processionStride,
          positionOffset: positionAtBarBeat(5, 1),
          register: { min: "E5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "heliograph-ascent-answer",
          synth: "softLead" as const,
          motif: processionAnswer,
          positionOffset: positionAtBarBeat(7, 1),
          register: { min: "E5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "heliograph-vault-stride",
          synth: "softLead" as const,
          motif: processionStride,
          positionOffset: positionAtBarBeat(9, 1),
          register: { min: "F#5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 0.94,
        },
        {
          kind: "motif" as const,
          id: "heliograph-eclipse-shadow-a",
          synth: "softLead" as const,
          motif: processionEclipse,
          positionOffset: positionAtBarBeat(13, 1),
          register: { min: "D5", max: "A6", anchor: "F#5" },
          clampToHarmony: true,
          velocityScale: 0.88,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "heliograph-eclipse-shadow-b",
          synth: "softLead" as const,
          motif: processionEclipse,
          positionOffset: positionAtBarBeat(15, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.82,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "heliograph-homecoming-call",
          synth: "softLead" as const,
          motif: processionCall,
          positionOffset: positionAtBarBeat(17, 1),
          register: { min: "D5", max: "B6", anchor: "F#5" },
          clampToHarmony: true,
          velocityScale: 1.04,
        },
        {
          kind: "motif" as const,
          id: "heliograph-homecoming-answer",
          synth: "softLead" as const,
          motif: processionAnswer,
          positionOffset: positionAtBarBeat(18, 1),
          register: { min: "E5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 1.04,
        },
        {
          kind: "motif" as const,
          id: "heliograph-crown",
          synth: "softLead" as const,
          motif: processionSeal,
          positionOffset: positionAtBarBeat(20, 1),
          register: { min: "D5", max: "A6", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 1.08,
          rhythmRole: "cadence",
        },
      ]),
    ),
  );
}

function buildHeliographPlan(): PhrasePlan {
  const harmony = buildHarmony();

  return {
    bars: HELIOGRAPH_MASTER_BARS,
    beatsPerBar: HELIOGRAPH_BEATS_PER_BAR,
    meter: HELIOGRAPH_METER,
    key: { root: "D", scale: "lydian" },
    harmony,
    sections: [
      {
        id: "heliograph-threshold",
        role: "statement",
        barRole: "arrival",
        startBar: 0,
        bars: 4,
        bias: { density: -0.08, register: 0, brightness: -0.02, cadence: 0.92 },
        description: "The procession appears as a distant line of reflected light.",
      },
      {
        id: "heliograph-ascent",
        role: "variation",
        barRole: "continuation",
        startBar: 4,
        bars: 4,
        bias: { density: 0, register: 0.08, brightness: 0.08, cadence: 0.98 },
        description: "The light starts climbing and the pulse becomes ceremonial.",
      },
      {
        id: "heliograph-vault",
        role: "bridge",
        barRole: "transition",
        startBar: 8,
        bars: 4,
        bias: { density: 0.04, register: 0.14, brightness: 0.12, cadence: 0.9 },
        description: "The architecture opens overhead and the motif takes longer steps.",
      },
      {
        id: "heliograph-eclipse",
        role: "shadow",
        barRole: "transition",
        startBar: 12,
        bars: 4,
        bias: { density: -0.24, register: -0.16, brightness: -0.18, cadence: 0.6 },
        description: "The same procession is seen in silhouette, almost under cloud.",
      },
      {
        id: "heliograph-homecoming",
        role: "return",
        barRole: "arrival",
        startBar: 16,
        bars: 3,
        bias: { density: -0.02, register: 0.1, brightness: 0.1, cadence: 1.12 },
        description: "The ascent resolves into certainty rather than climax alone.",
      },
      {
        id: "heliograph-crown",
        role: "cadence",
        barRole: "cadence",
        startBar: 19,
        bars: 1,
        bias: { density: -0.08, register: 0.08, brightness: 0.06, cadence: 1.34 },
        description: "A single final bar seals the loop with luminous authority.",
      },
    ],
    cadenceTiming: [
      {
        targetBar: HELIOGRAPH_MASTER_BARS,
        targetBeat: 1,
        mustLandOnStrongBeat: true,
        minFinalDurationBeats: 1.2,
        thinBeforeArrival: true,
        allowPickup: false,
        maxOrnamentVelocityNearCadence: 0.11,
      },
    ],
    padLayers: [{ synth: "warmPad", voiceId: "pad", velocityScale: 0.82 }],
    arrangement: {
      densityCurve: [
        { beat: 0, value: 0.34 },
        { beat: 24, value: 0.48 },
        { beat: 48, value: 0.56 },
        { beat: 72, value: 0.2 },
        { beat: 96, value: 0.58 },
        { beat: 120, value: 0.42 },
      ],
      registerCurve: [
        { beat: 0, value: 0 },
        { beat: 24, value: 0.08 },
        { beat: 48, value: 0.14 },
        { beat: 72, value: -0.18 },
        { beat: 96, value: 0.12 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.42 },
        { beat: 24, value: 0.56 },
        { beat: 48, value: 0.64 },
        { beat: 72, value: 0.22 },
        { beat: 96, value: 0.66 },
        { beat: 120, value: 0.48 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.18 },
        { beat: 21, value: 0.44 },
        { beat: 45, value: 0.56 },
        { beat: 69, value: 0.22 },
        { beat: 102, value: 0.78 },
        { beat: 114, value: 0.96 },
      ],
      ornamentBaseProbability: 0.1,
    },
    noteLayers: [
      ...buildLeadLayers(),
      {
        kind: "draft",
        id: "heliograph-counterline",
        synth: "softLead",
        voiceId: "counterline",
        rhythmRole: "response",
        realization: true,
        notes: buildCounterline(),
        register: { min: "A4", max: "E5", anchor: "D5" },
        velocityScale: 0.86,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "heliograph-ornaments",
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
        id: "heliograph-bells",
        synth: "glassBell",
        voiceId: "bells",
        rhythmRole: "punctuation",
        realization: true,
        notes: buildBells(),
        register: { min: "F#5", max: "D6", anchor: "A5" },
        clampToHarmony: false,
      },
      {
        kind: "draft",
        id: "heliograph-bass",
        synth: "roundBass",
        voiceId: "bass",
        rhythmRole: "anchor",
        realization: true,
        notes: buildBass(harmony),
        register: { min: "D2", max: "B2", anchor: "D2" },
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "heliograph-drone",
        synth: "breathingDrone",
        voiceId: "drone",
        rhythmRole: "suspension",
        realization: true,
        notes: buildDrone(),
        register: { min: "A2", max: "B3", anchor: "D3" },
        clampToHarmony: true,
      },
    ],
  };
}

export const heliographProcession: Composition = buildComposition({
  id: "heliograph-procession",
  title: "Heliograph Procession",
  key: { root: "D", scale: "lydian" },
  bpm: HELIOGRAPH_BPM,
  beatsPerBar: HELIOGRAPH_BEATS_PER_BAR,
  plan: buildHeliographPlan(),
});
