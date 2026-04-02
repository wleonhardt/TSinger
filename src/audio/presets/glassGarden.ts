import { compilePhrasePlan } from "../authoring/compile";
import {
  displaceRhythm,
  makeAnswerPhrase,
  retrograde,
} from "../authoring/motifs";
import { arpeggiateChord, sparseBellAccents } from "../authoring/patterns";
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
  PhrasePlan,
} from "../authoring/types";
import type { Composition } from "../composition";
import {
  mapMotifSteps,
  scaleMotifVelocities,
  withVoiceId,
} from "./helpers";

const GLASS_BPM = 72;
const GLASS_BEATS_PER_BAR = 3;
const GLASS_MASTER_BARS = 16;
const GLASS_PART_BARS = 4;
const GLASS_METER = {
  beatsPerBar: GLASS_BEATS_PER_BAR,
  beatUnit: 4,
} as const;

function glassPartStart(index: number): number {
  return index * GLASS_PART_BARS * GLASS_BEATS_PER_BAR;
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

const glassSubject: Motif = {
  anchorDegree: 1,
  steps: [
    { beat: 0, length: 0.9, offset: 0, velocity: 0.58, pan: 0.08, toneIntent: "chord" },
    { beat: 1, length: 0.45, offset: 2, velocity: 0.62, pan: 0.08, toneIntent: "chord" },
    { beat: 1.5, length: 0.4, offset: 1, velocity: 0.52, pan: 0.06, toneIntent: "passing" },
    { beat: 2, length: 0.95, offset: 0, velocity: 0.58, pan: 0.04, toneIntent: "chord" },
  ],
};

const glassResponse: Motif = {
  anchorDegree: 4,
  steps: [
    { beat: 0, length: 0.88, offset: 1, velocity: 0.56, pan: 0.08, toneIntent: "chord" },
    { beat: 1, length: 0.42, offset: 0, velocity: 0.56, pan: 0.06, toneIntent: "chord" },
    { beat: 1.5, length: 0.36, offset: -1, velocity: 0.48, pan: 0.04, toneIntent: "passing" },
    { beat: 2, length: 1.08, offset: -3, velocity: 0.58, pan: 0.02, toneIntent: "chord" },
  ],
};

const glassDominantFigure: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.7,
      offset: 2,
      chromaticOffset: 1,
      velocity: 0.58,
      pan: 0.08,
      toneIntent: "chord",
    },
    { beat: 1, length: 0.45, offset: 4, velocity: 0.58, pan: 0.08, toneIntent: "chord" },
    {
      beat: 1.5,
      length: 0.4,
      offset: 2,
      chromaticOffset: 1,
      velocity: 0.5,
      pan: 0.06,
      toneIntent: "chord",
    },
    { beat: 2, length: 1, offset: 0, velocity: 0.56, pan: 0.04, toneIntent: "chord" },
  ],
};

const glassLanternFigure: Motif = {
  anchorDegree: 6,
  steps: [
    { beat: 0, length: 0.8, offset: 2, velocity: 0.54, pan: 0.08, toneIntent: "chord" },
    { beat: 1, length: 0.45, offset: 1, velocity: 0.5, pan: 0.06, toneIntent: "color" },
    { beat: 1.5, length: 0.4, offset: 0, velocity: 0.5, pan: 0.04, toneIntent: "chord" },
    { beat: 2, length: 0.95, offset: -2, velocity: 0.54, pan: 0.02, toneIntent: "chord" },
  ],
};

const glassPredominantFigure: Motif = {
  anchorDegree: 4,
  steps: [
    { beat: 0, length: 0.8, offset: 4, velocity: 0.54, pan: 0.08, toneIntent: "chord" },
    { beat: 1, length: 0.45, offset: 2, velocity: 0.52, pan: 0.06, toneIntent: "chord" },
    { beat: 1.5, length: 0.4, offset: 1, velocity: 0.48, pan: 0.04, toneIntent: "passing" },
    { beat: 2, length: 0.95, offset: 0, velocity: 0.54, pan: 0.02, toneIntent: "chord" },
  ],
};

const glassFinalCadence: Motif = {
  anchorDegree: 1,
  steps: [
    { beat: 0, length: 0.82, offset: 0, velocity: 0.58, pan: 0.08, toneIntent: "chord" },
    { beat: 1, length: 0.38, offset: 2, velocity: 0.58, pan: 0.08, toneIntent: "chord" },
    { beat: 1.5, length: 0.32, offset: 1, velocity: 0.46, pan: 0.05, toneIntent: "passing" },
    { beat: 2, length: 1.2, offset: 0, velocity: 0.62, pan: 0.04, toneIntent: "chord" },
  ],
};

const glassReturnSubject = scaleMotifVelocities(
  mapMotifSteps(glassSubject, (step, index) => ({
    ...step,
    length: index === 0 ? 1.02 : index === 3 ? 1.04 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 1.04 : 1.02)
        : step.velocity,
  })),
  1.04,
);

const glassReturnResponse = scaleMotifVelocities(
  mapMotifSteps(glassResponse, (step, index) => ({
    ...step,
    length: index === 3 ? 1.1 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 1.02 : 1.06)
        : step.velocity,
  })),
  1.02,
);

const glassBloomFigure = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(glassLanternFigure, { scaleSteps: 1 }), (step, index) => ({
    ...step,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 1 ? 0.92 : 1.02)
        : step.velocity,
  })),
  0.96,
);

const glassBloomCadence = scaleMotifVelocities(
  mapMotifSteps(glassFinalCadence, (step, index) => ({
    ...step,
    length: index === 3 ? 1.05 : step.length,
  })),
  0.98,
);

const glassShadowSubject = scaleMotifVelocities(retrograde(glassSubject), 0.82);
const glassShadowResponse = scaleMotifVelocities(
  mapMotifSteps(retrograde(glassResponse), (step, index) => ({
    ...step,
    length: index === 0 ? step.length + 0.16 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.9 : 0.84)
        : step.velocity,
  })),
  0.82,
);
const glassShadowPredominant = scaleMotifVelocities(
  mapMotifSteps(retrograde(glassPredominantFigure), (step, index) => ({
    ...step,
    length: index === 0 ? step.length + 0.12 : step.length,
    pan: (step.pan ?? 0) - 0.04,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.92 : 0.86)
        : step.velocity,
  })),
  0.86,
);

const glassShadowSuspension: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.84,
      offset: 1,
      chromaticOffset: 1,
      velocity: 0.46,
      pan: 0.02,
      toneIntent: "chord",
    },
    {
      beat: 1.75,
      length: 1.18,
      offset: -1,
      velocity: 0.42,
      pan: -0.04,
      toneIntent: "scale",
    },
  ],
};

function buildGlassBaselineHarmony(): HarmonyPlanItem[] {
  return [
    { bar: 0, root: "A3", quality: "minor7", velocity: 0.19, spread: 0.01 },
    { bar: 1, root: "D4", quality: "minor7", velocity: 0.18, spread: 0.01 },
    { bar: 2, root: "E3", quality: "major", velocity: 0.19, spread: 0.01 },
    { bar: 3, root: "A3", quality: "minor7", velocity: 0.2, spread: 0.01 },
    { bar: 4, root: "F3", quality: "major7", velocity: 0.18, spread: 0.01 },
    { bar: 5, root: "D4", quality: "minor7", velocity: 0.18, spread: 0.01 },
    { bar: 6, root: "E3", quality: "major", velocity: 0.19, spread: 0.01 },
    { bar: 7, root: "A3", quality: "minor7", velocity: 0.2, spread: 0.01 },
  ];
}

function buildGlassBaselineBass(harmony: HarmonyPlanItem[]): PatternNoteDraft[] {
  return harmony.flatMap((item) =>
    arpeggiateChord({
      startBeat: item.bar * GLASS_BEATS_PER_BAR,
      beats: GLASS_BEATS_PER_BAR,
      order: [0, 2, 1],
      stepLength: 1,
      noteLength: 0.42,
      velocity: item.quality === "major" ? 0.4 : 0.42,
      octaveOffset: -1,
      toneIntent: "chord",
    }),
  );
}

function buildGlassGardenBaselinePlan(): PhrasePlan {
  const harmony = buildGlassBaselineHarmony();
  const counterpoint = [
    ...arpeggiateChord({
      startBeat: 4,
      beats: 1.9,
      order: [2, 1, 0],
      stepLength: 1,
      noteLength: 0.66,
      velocity: 0.21,
      toneIntent: "chord",
    }),
    ...arpeggiateChord({
      startBeat: 6.5,
      beats: 2.6,
      order: [0, 1, 2],
      stepLength: 1,
      noteLength: 0.72,
      velocity: 0.24,
      toneIntent: "chord",
    }),
    ...arpeggiateChord({
      startBeat: 12.5,
      beats: 2.6,
      order: [2, 1, 0],
      stepLength: 1,
      noteLength: 0.72,
      velocity: 0.22,
      toneIntent: "chord",
    }),
    ...arpeggiateChord({
      startBeat: 16,
      beats: 1.9,
      order: [2, 1, 0],
      stepLength: 1,
      noteLength: 0.66,
      velocity: 0.2,
      toneIntent: "chord",
    }),
    ...arpeggiateChord({
      startBeat: 19,
      beats: 1.9,
      order: [0, 1, 2],
      stepLength: 1,
      noteLength: 0.72,
      velocity: 0.21,
      toneIntent: "chord",
    }),
  ];
  const bells = sparseBellAccents({
    accents: [
      { beat: 0, pitch: "E6", length: 0.72, velocity: 0.11, pan: 0.12 },
      { beat: 9, pitch: "E6", length: 0.7, velocity: 0.11, pan: -0.1 },
      { beat: 22.25, pitch: "E6", length: 0.8, velocity: 0.12, pan: 0.12 },
    ],
  });

  return {
    bars: 8,
    beatsPerBar: GLASS_BEATS_PER_BAR,
    key: { root: "A", scale: "minor" },
    harmony,
    padLayers: [{ synth: "warmPad", velocityScale: 0.88 }],
    arrangement: {
      densityCurve: [
        { beat: 0, value: 0.72 },
        { beat: 9, value: 0.8 },
        { beat: 18, value: 0.84 },
        { beat: 24, value: 0.76 },
      ],
      registerCurve: [
        { beat: 0, value: -0.05 },
        { beat: 9, value: 0.08 },
        { beat: 18, value: 0.12 },
        { beat: 24, value: 0 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.48 },
        { beat: 9, value: 0.54 },
        { beat: 21, value: 0.58 },
        { beat: 24, value: 0.5 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.28 },
        { beat: 6, value: 0.72 },
        { beat: 8.5, value: 0.92 },
        { beat: 18, value: 0.76 },
        { beat: 23, value: 1 },
      ],
      ornamentBaseProbability: 0.18,
    },
    noteLayers: [
      {
        kind: "motif",
        id: "glass-subject-a",
        synth: "softLead",
        motif: glassSubject,
        beatOffset: 0,
        register: { min: "E5", max: "C6", anchor: "A5" },
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "glass-response",
        synth: "softLead",
        motif: glassResponse,
        beatOffset: 3,
        register: { min: "F5", max: "D6", anchor: "A5" },
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "glass-dominant-a",
        synth: "softLead",
        motif: glassDominantFigure,
        beatOffset: 6,
        register: { min: "E5", max: "B5", anchor: "G#5" },
        clampToHarmony: false,
      },
      {
        kind: "motif",
        id: "glass-cadence-a",
        synth: "softLead",
        motif: glassSubject,
        beatOffset: 9,
        register: { min: "E5", max: "C6", anchor: "A5" },
        velocityScale: 0.98,
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "glass-lantern",
        synth: "softLead",
        motif: glassLanternFigure,
        beatOffset: 12,
        register: { min: "E5", max: "C6", anchor: "A5" },
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "glass-predominant",
        synth: "softLead",
        motif: glassPredominantFigure,
        beatOffset: 15,
        register: { min: "D5", max: "A5", anchor: "A5" },
        clampToHarmony: true,
      },
      {
        kind: "motif",
        id: "glass-dominant-b",
        synth: "softLead",
        motif: glassDominantFigure,
        beatOffset: 18,
        register: { min: "E5", max: "B5", anchor: "G#5" },
        velocityScale: 1.02,
        clampToHarmony: false,
      },
      {
        kind: "motif",
        id: "glass-cadence-b",
        synth: "softLead",
        motif: glassFinalCadence,
        beatOffset: 21,
        register: { min: "E5", max: "C6", anchor: "A5" },
        velocityScale: 1.04,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "glass-counterpoint",
        synth: "softLead",
        notes: counterpoint,
        register: { min: "A3", max: "E5", anchor: "A4" },
        velocityScale: 0.86,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "glass-bass",
        synth: "roundBass",
        notes: buildGlassBaselineBass(harmony),
        register: { min: "E2", max: "F3", anchor: "A2" },
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "glass-bells",
        synth: "glassBell",
        notes: bells,
        register: { min: "C6", max: "A6", anchor: "A6" },
        clampToHarmony: false,
      },
    ],
  };
}

const glassMasterStatement = mapMotifSteps(glassSubject, (step, index) => ({
  ...step,
  length: index === 3 ? 0.82 : step.length,
}));

const glassMasterAnswer = mapMotifSteps(glassResponse, (step, index) => ({
  ...step,
  length: index === 3 ? 0.88 : step.length,
}));

const glassMasterBloomCall = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(glassSubject, { scaleSteps: 1 }), (step, index) => ({
    ...step,
    length: index === 0 ? 0.98 : index === 3 ? 0.8 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 1 ? 0.92 : 1.02)
        : step.velocity,
  })),
  0.98,
);

const glassMasterBloomAnswer = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(glassResponse, { scaleSteps: 1 }), (step, index) => ({
    ...step,
    length: index === 3 ? 0.84 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.96 : 0.92)
        : step.velocity,
  })),
  0.96,
);

const glassMasterSpiral = scaleMotifVelocities(
  mapMotifSteps(displaceRhythm(glassLanternFigure, 0.15), (step, index) => ({
    ...step,
    length: index === 3 ? 0.7 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 1 ? 0.9 : 0.96)
        : step.velocity,
  })),
  0.94,
);

const glassMasterBloomCadence = scaleMotifVelocities(
  mapMotifSteps(glassFinalCadence, (step, index) => ({
    ...step,
    length: index === 3 ? 0.92 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 3 ? 1.04 : 0.98)
        : step.velocity,
  })),
  1,
);

const glassMasterMirrorSubject = scaleMotifVelocities(
  mapMotifSteps(retrograde(glassSubject), (step, index) => ({
    ...step,
    length: index === 0 ? step.length + 0.16 : index === 3 ? 0.68 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.82 : 0.76)
        : step.velocity,
  })),
  0.8,
);

const glassMasterMirrorAnswer = scaleMotifVelocities(
  mapMotifSteps(retrograde(glassResponse), (step, index) => ({
    ...step,
    length: index === 0 ? step.length + 0.18 : index === 3 ? 0.72 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.84 : 0.78)
        : step.velocity,
  })),
  0.8,
);

const glassMasterVigil: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0.5,
      length: 0.92,
      offset: 1,
      chromaticOffset: 1,
      velocity: 0.46,
      pan: 0.02,
      toneIntent: "chord",
    },
    {
      beat: 1.75,
      length: 0.88,
      offset: 0,
      velocity: 0.4,
      pan: -0.02,
      toneIntent: "scale",
    },
  ],
};

const glassMasterReturnSubject = scaleMotifVelocities(
  mapMotifSteps(glassSubject, (step, index) => ({
    ...step,
    length: index === 0 ? 1.02 : index === 3 ? 0.96 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 1.08 : 1.04)
        : step.velocity,
  })),
  1.06,
);

const glassMasterReturnVow = scaleMotifVelocities(
  mapMotifSteps(glassDominantFigure, (step, index) => ({
    ...step,
    beat: step.beat + (index === 0 ? 0.1 : 0),
    length: index === 3 ? 0.86 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 1 ? 1.06 : 1.02)
        : step.velocity,
  })),
  1.04,
);

const glassMasterCrown: Motif = {
  anchorDegree: 1,
  steps: [
    { beat: 0, length: 0.56, offset: 2, velocity: 0.62, pan: 0.06, toneIntent: "chord" },
    { beat: 0.85, length: 0.34, offset: 1, velocity: 0.5, pan: 0.04, toneIntent: "passing" },
    { beat: 1.5, length: 0.42, offset: 0, velocity: 0.58, pan: 0.04, toneIntent: "chord" },
    { beat: 2, length: 1, offset: 0, velocity: 0.68, pan: 0.02, toneIntent: "chord" },
  ],
};

function buildGlassMasterHarmony(): HarmonyPlanItem[] {
  return [
    { bar: 0, root: "A3", quality: "minorAdd9", velocity: 0.16, spread: 0.01, tag: "statement" },
    { bar: 1, root: "D4", quality: "minor7", velocity: 0.17, spread: 0.01, tag: "statement" },
    { bar: 2, root: "C4", quality: "major", velocity: 0.17, inversion: 1, spread: 0.01, tag: "statement" },
    { bar: 3, root: "E3", quality: "major", velocity: 0.2, spread: 0.01, tag: "statement" },
    { bar: 4, root: "F3", quality: "major7", velocity: 0.18, spread: 0.01, tag: "flowering" },
    { bar: 5, root: "C4", quality: "major", velocity: 0.17, inversion: 1, spread: 0.01, tag: "flowering" },
    { bar: 6, root: "D4", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "flowering" },
    { bar: 7, root: "E3", quality: "major", velocity: 0.2, spread: 0.01, tag: "flowering" },
    { bar: 8, root: "C4", quality: "major7", velocity: 0.14, inversion: 1, spread: 0.01, tag: "shadow" },
    { bar: 9, root: "G3", quality: "sus2", velocity: 0.14, inversion: 1, spread: 0.01, tag: "shadow" },
    { bar: 10, root: "D4", quality: "minor7", velocity: 0.15, spread: 0.01, tag: "shadow" },
    { bar: 11, root: "E3", quality: "major", velocity: 0.17, spread: 0.01, tag: "shadow" },
    { bar: 12, root: "F3", quality: "major7", velocity: 0.17, spread: 0.01, tag: "threshold" },
    { bar: 13, root: "A3", quality: "minor7", velocity: 0.2, spread: 0.01, tag: "return" },
    { bar: 14, root: "E3", quality: "major", velocity: 0.22, spread: 0.01, tag: "return" },
    { bar: 15, root: "A3", quality: "minor7", velocity: 0.24, spread: 0.01, tag: "cadence" },
  ];
}

function buildGlassMasterBass(harmony: HarmonyPlanItem[]): PatternNoteDraft[] {
  return harmony.flatMap((item) => {
    const startBeat = item.bar * GLASS_BEATS_PER_BAR;

    if (item.tag === "shadow") {
      return arpeggiateChord({
        startBeat,
        beats: GLASS_BEATS_PER_BAR,
        order: [0, 2],
        stepLength: 1.5,
        noteLength: 0.6,
        velocity: item.quality === "major" ? 0.26 : 0.28,
        octaveOffset: -1,
        toneIntent: "chord",
      });
    }

    if (item.tag === "threshold") {
      return [
        {
          beat: startBeat,
          length: 1.35,
          pitch: "F2",
          velocity: 0.34,
          toneIntent: "chord",
        },
        {
          beat: startBeat + 1.5,
          length: 1.15,
          pitch: "C3",
          velocity: 0.24,
          toneIntent: "chord",
        },
      ];
    }

    if (item.tag === "cadence") {
      return [
        {
          beat: startBeat,
          length: 0.68,
          pitch: "A2",
          velocity: 0.44,
          toneIntent: "chord",
        },
        {
          beat: startBeat + 1,
          length: 0.46,
          pitch: "E3",
          velocity: 0.28,
          toneIntent: "chord",
        },
        {
          beat: startBeat + 2,
          length: 0.92,
          pitch: "A2",
          velocity: 0.4,
          toneIntent: "chord",
        },
      ];
    }

    if (item.tag === "return") {
      return arpeggiateChord({
        startBeat,
        beats: GLASS_BEATS_PER_BAR,
        order: [0, 1, 2],
        stepLength: 1,
        noteLength: 0.48,
        velocity: item.quality === "major" ? 0.44 : 0.42,
        octaveOffset: -1,
        toneIntent: "chord",
      });
    }

    return arpeggiateChord({
      startBeat,
      beats: GLASS_BEATS_PER_BAR,
      order: [0, 2, 1],
      stepLength: 1,
      noteLength: 0.42,
      velocity: item.quality === "major" ? 0.38 : 0.4,
      octaveOffset: -1,
      toneIntent: "chord",
    });
  });
}

function buildGlassMasterCounterpoint(): PatternNoteDraft[] {
  const counterCell = [
    withPosition(
      {
        pitch: "A4",
        velocity: 0.16,
        pan: -0.06,
        toneIntent: "chord" as const,
      },
      {
        at: positionAtBarBeat(1, 1, 1, 2),
        duration: span(0, 1),
      },
    ),
    withPosition(
      {
        pitch: "G4",
        velocity: 0.15,
        pan: 0.06,
        toneIntent: "scale" as const,
      },
      {
        at: positionAtBarBeat(2, 2, 1, 4),
        duration: span(0, 0, 3, 4),
      },
    ),
  ];

  return [
    ...repeatAcrossBars(counterCell, {
      startBar: 5,
      repetitions: 2,
      everyBars: 8,
      meter: GLASS_METER,
      label: "Counterline figure repeats across the bloom and return.",
    }),
    { beat: glassPartStart(1) + 7, length: 1.08, pitch: "B4", velocity: 0.16, pan: -0.04, toneIntent: "color" },
    withPosition(
      {
        pitch: "F4",
        velocity: 0.14,
        pan: -0.08,
        toneIntent: "chord" as const,
      },
      {
        at: positionAtBarBeat(13, 1),
        duration: span(0, 1),
      },
    ),
  ];
}

function buildGlassUndertow(): PatternNoteDraft[] {
  return [
    { beat: glassPartStart(2), length: 6, pitch: "C4", velocity: 0.05, pan: -0.08, toneIntent: "chord" },
    { beat: glassPartStart(2) + 6, length: 6, pitch: "E3", velocity: 0.05, pan: 0.08, toneIntent: "chord" },
  ];
}

function buildGlassMasterPlan(): PhrasePlan {
  const harmony = buildGlassMasterHarmony();
  const bells = sparseBellAccents({
    accents: [
      { at: positionAtBarBeat(1, 1), pitch: "E6", duration: span(0, 0, 3, 4), velocity: 0.11, pan: 0.12 },
      { at: positionAtBarBeat(5, 2, 1, 2), pitch: "C6", duration: span(0, 0, 3, 4), velocity: 0.09, pan: -0.08 },
      { beat: glassPartStart(2) + 10.5, pitch: "G5", length: 0.66, velocity: 0.07, pan: 0.06 },
      {
        at: pickupBefore(
          { kind: "sectionStart", startBar: 13, bars: 3, sectionId: "glass-return", label: "the return" },
          GLASS_METER,
        ),
        pitch: "E6",
        duration: span(0, 0, 3, 4),
        velocity: 0.1,
        pan: 0.1,
      },
      {
        at: cadenceBeat(
          { kind: "phraseEnd", bars: GLASS_MASTER_BARS, label: "the final cadence" },
          GLASS_METER,
        ),
        pitch: "A6",
        duration: span(0, 1),
        velocity: 0.13,
        pan: 0.14,
      },
    ],
  });
  const leadLayers = withVoiceId("lead", [
    {
      kind: "motif" as const,
      id: "glass-i-call",
      synth: "softLead" as const,
      motif: glassMasterStatement,
      positionOffset: positionAtBarBeat(1, 1),
      register: { min: "E5", max: "C6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-i-answer",
      synth: "softLead" as const,
      motif: glassMasterAnswer,
      positionOffset: positionAtBarBeat(2, 1),
      register: { min: "F5", max: "D6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-i-vigil",
      synth: "softLead" as const,
      motif: glassDominantFigure,
      positionOffset: positionAtBarBeat(3, 1),
      register: { min: "E5", max: "B5", anchor: "G#5" },
      clampToHarmony: false,
    },
    {
      kind: "motif" as const,
      id: "glass-i-close",
      synth: "softLead" as const,
      motif: glassMasterBloomCadence,
      positionOffset: positionAtBarBeat(4, 1),
      register: { min: "E5", max: "C6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-ii-bloom-call",
      synth: "softLead" as const,
      motif: glassMasterBloomCall,
      beatOffset: glassPartStart(1),
      register: { min: "F5", max: "D6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-ii-bloom-answer",
      synth: "softLead" as const,
      motif: glassMasterBloomAnswer,
      beatOffset: glassPartStart(1) + 3,
      register: { min: "E5", max: "D6", anchor: "C6" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-ii-spiral",
      synth: "softLead" as const,
      motif: glassMasterSpiral,
      beatOffset: glassPartStart(1) + 6,
      register: { min: "F5", max: "D6", anchor: "B5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-ii-bloom-close",
      synth: "softLead" as const,
      motif: glassMasterBloomCadence,
      beatOffset: glassPartStart(1) + 9,
      register: { min: "E5", max: "D6", anchor: "A5" },
      velocityScale: 1.02,
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-iii-mirror-call",
      synth: "softLead" as const,
      motif: glassMasterMirrorSubject,
      beatOffset: glassPartStart(2),
      register: { min: "C5", max: "A5", anchor: "E5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-iii-mirror-answer",
      synth: "softLead" as const,
      motif: glassMasterMirrorAnswer,
      beatOffset: glassPartStart(2) + 3,
      register: { min: "B4", max: "G5", anchor: "D5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-iii-vigil",
      synth: "softLead" as const,
      motif: glassMasterVigil,
      beatOffset: glassPartStart(2) + 6,
      register: { min: "C5", max: "A5", anchor: "E5" },
      clampToHarmony: false,
    },
    {
      kind: "motif" as const,
      id: "glass-iv-return-call",
      synth: "softLead" as const,
      motif: glassMasterReturnSubject,
      beatOffset: glassPartStart(3) + 3,
      register: { min: "G5", max: "D6", anchor: "A5" },
      clampToHarmony: true,
    },
    {
      kind: "motif" as const,
      id: "glass-iv-return-vow",
      synth: "softLead" as const,
      motif: glassMasterReturnVow,
      beatOffset: glassPartStart(3) + 6,
      register: { min: "F5", max: "C6", anchor: "B5" },
      clampToHarmony: false,
    },
    {
      kind: "motif" as const,
      id: "glass-iv-crown",
      synth: "softLead" as const,
      motif: glassMasterCrown,
      beatOffset: glassPartStart(3) + 9,
      register: { min: "E5", max: "C6", anchor: "A5" },
      clampToHarmony: true,
    },
  ]);

  return {
    bars: GLASS_MASTER_BARS,
    beatsPerBar: GLASS_BEATS_PER_BAR,
    meter: GLASS_METER,
    key: { root: "A", scale: "minor" },
    harmony,
    sections: [
      {
        id: "glass-threshold",
        role: "statement",
        startBar: 0,
        bars: 4,
        bias: {
          density: -0.06,
          register: -0.02,
          brightness: -0.03,
          cadence: 0.98,
        },
        description: "The room states its subject with ceremonial restraint.",
      },
      {
        id: "glass-bloom",
        role: "variation",
        startBar: 4,
        bars: 4,
        bias: {
          density: 0,
          register: 0.08,
          brightness: 0.08,
          cadence: 1.04,
        },
        description: "The same material opens upward and briefly gleams.",
      },
      {
        id: "glass-hollow",
        role: "shadow",
        startBar: 8,
        bars: 4,
        bias: {
          density: -0.18,
          register: -0.16,
          brightness: -0.16,
          cadence: 0.78,
        },
        description: "The motif appears only as a reflection inside the glass.",
      },
      {
        id: "glass-return",
        role: "return",
        startBar: 12,
        bars: 3,
        bias: {
          density: -0.02,
          register: 0.12,
          brightness: 0.1,
          cadence: 1.18,
        },
        description: "The return is withheld, then reclaimed at full height.",
      },
      {
        id: "glass-seal",
        role: "cadence",
        startBar: 15,
        bars: 1,
        bias: {
          density: -0.1,
          register: 0.06,
          brightness: 0.08,
          cadence: 1.34,
        },
        description: "The door finally closes on A.",
      },
    ],
    padLayers: [{ synth: "warmPad", voiceId: "pad", velocityScale: 0.82 }],
    arrangement: {
      densityCurve: [
        { at: positionAtBarBeat(1, 1), beat: 0, value: 0.52 },
        { at: positionAtBarBeat(5, 1), beat: glassPartStart(1), value: 0.62 },
        { at: positionAtBarBeat(9, 1), beat: glassPartStart(2), value: 0.18 },
        { at: positionAtBarBeat(13, 1), beat: glassPartStart(3), value: 0.7 },
        { beat: GLASS_MASTER_BARS * GLASS_BEATS_PER_BAR, value: 0.54 },
      ],
      registerCurve: [
        { beat: 0, value: -0.04 },
        { beat: glassPartStart(1), value: 0.08 },
        { beat: glassPartStart(2), value: -0.18 },
        { beat: glassPartStart(3), value: 0.2 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.42 },
        { beat: glassPartStart(1), value: 0.56 },
        { beat: glassPartStart(2), value: 0.24 },
        { beat: glassPartStart(3), value: 0.66 },
        { beat: GLASS_MASTER_BARS * GLASS_BEATS_PER_BAR, value: 0.46 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.2 },
        { beat: glassPartStart(0) + 8.5, value: 0.7 },
        { beat: glassPartStart(1) + 8.5, value: 0.82 },
        { beat: glassPartStart(2) + 8.5, value: 0.4 },
        { beat: glassPartStart(3) + 5.5, value: 0.88 },
        {
          at: cadenceBeat(
            { kind: "phraseEnd", bars: GLASS_MASTER_BARS, label: "the final cadence" },
            GLASS_METER,
          ),
          beat: glassPartStart(3) + 8.5,
          value: 1.1,
        },
      ],
      ornamentBaseProbability: 0.12,
    },
    noteLayers: [
      ...leadLayers,
      {
        kind: "draft",
        id: "glass-master-counterpoint",
        synth: "softLead",
        voiceId: "counterline",
        notes: buildGlassMasterCounterpoint(),
        register: { min: "A3", max: "E5", anchor: "A4" },
        velocityScale: 0.82,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "glass-master-bass",
        synth: "roundBass",
        voiceId: "bass",
        notes: buildGlassMasterBass(harmony),
        register: { min: "E2", max: "F3", anchor: "A2" },
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "glass-undertow",
        synth: "breathingDrone",
        voiceId: "drone",
        notes: buildGlassUndertow(),
        register: { min: "C3", max: "E4", anchor: "C4" },
        velocityScale: 0.88,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "glass-master-bells",
        synth: "glassBell",
        voiceId: "bells",
        notes: bells,
        register: { min: "G5", max: "A6", anchor: "E6" },
        clampToHarmony: false,
      },
    ],
  };
}

export const glassGardenBaseline: Composition = buildComposition({
  id: "glass-garden-baseline",
  title: "Glass Garden (Baseline)",
  key: { root: "A", scale: "minor" },
  bpm: GLASS_BPM,
  beatsPerBar: GLASS_BEATS_PER_BAR,
  plan: buildGlassGardenBaselinePlan(),
});

export const glassGarden: Composition = buildComposition({
  id: "glass-garden",
  title: "Glass Garden",
  key: { root: "A", scale: "minor" },
  bpm: GLASS_BPM,
  beatsPerBar: GLASS_BEATS_PER_BAR,
  plan: buildGlassMasterPlan(),
});
