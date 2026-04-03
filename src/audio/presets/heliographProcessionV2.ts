import { compilePhrasePlan } from "../authoring/compile";
import {
  invertMotif,
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

// ---------------------------------------------------------------------------
// Heliograph Procession V2
//
// Same soul: D lydian, 6/8, 74 BPM, processional luminosity.
//
// What changed:
// - The motif leans into the lydian #4 (G#): offset 3 from D in lydian
//   lands on G#, placed at beat 3 as the turning point of the phrase.
// - Added an inner broken-triad layer that gives the procession actual
//   bodies — not just a lead voice walking alone.
// - Real countermelody: a sigh-figure line that runs through ascent,
//   vault, and homecoming sections (not 4 isolated notes).
// - Vault section uses a genuine climactic motif (processionZenith:
//   wider intervals, higher energy) instead of the call played twice.
// - Eclipse uses invertMotif (reflected around scale degree 4) for
//   genuine melodic inversion, not just retrograde.
// - More harmonic color: Gmaj7 and Bm added for lydian brightness.
// ---------------------------------------------------------------------------

const V2_BPM = 74;
const V2_BEATS_PER_BAR = 6;
const V2_MASTER_BARS = 20;
const V2_METER = {
  beatsPerBar: V2_BEATS_PER_BAR,
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

// ---------------------------------------------------------------------------
// Motifs — lydian #4 as turning point
// ---------------------------------------------------------------------------

/** Primary call: 4 notes in compound meter (6/8). The #4 (G# in D lydian)
 *  appears at beat 3 as the phrase's brightest moment before resolving. */
const lightCall: Motif = {
  anchorDegree: 1,
  steps: [
    {
      beat: 0,
      length: 0.82,
      offset: 0,
      velocity: 0.68,
      pan: -0.12,
      toneIntent: "chord",
    },
    {
      beat: 1.5,
      length: 0.58,
      offset: 2,
      velocity: 0.58,
      pan: -0.02,
      toneIntent: "scale",
    },
    {
      beat: 3,
      length: 0.76,
      offset: 3,
      velocity: 0.66,
      pan: 0.08,
      toneIntent: "color",
      // offset 3 from D in lydian = G# (the #4)
    },
    {
      beat: 4.5,
      length: 1.15,
      offset: 4,
      velocity: 0.76,
      pan: 0.12,
      toneIntent: "chord",
    },
  ],
};

/** Answer: shifted up a 2nd with a slightly delayed landing. */
const lightAnswer = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(lightCall, { scaleSteps: 2 }), (step, index) => ({
    ...step,
    length: index === 3 ? 1.25 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 2 ? 0.96 : 0.92)
        : step.velocity,
  })),
  0.97,
);

/** Stride: the call doubled for sections that need more material. */
const lightStride = scaleMotifVelocities(
  mapMotifSteps(sequence(lightCall, { scaleSteps: 1 }, 2), (step, index) => ({
    ...step,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index >= 4 ? 0.92 : 1)
        : step.velocity,
  })),
  0.94,
);

/** Zenith: the vault's climactic motif. Wider intervals, higher energy.
 *  Starts from degree 3, leaps to 5 (a 3rd), then to 7 (the major 7th
 *  of D lydian = C#), creating genuine climactic tension. */
const lightZenith: Motif = {
  anchorDegree: 3,
  steps: [
    {
      beat: 0,
      length: 0.72,
      offset: 0,
      velocity: 0.7,
      pan: -0.1,
      toneIntent: "chord",
    },
    {
      beat: 1.5,
      length: 0.62,
      offset: 2,
      velocity: 0.64,
      pan: -0.02,
      toneIntent: "scale",
    },
    {
      beat: 3,
      length: 0.78,
      offset: 4,
      velocity: 0.72,
      pan: 0.08,
      toneIntent: "color",
    },
    {
      beat: 4.5,
      length: 1.3,
      offset: 2,
      velocity: 0.78,
      pan: 0.14,
      toneIntent: "chord",
    },
  ],
};

/** Eclipse motif: the call inverted around scale degree 4, creating a
 *  descending mirror. The #4 is still present but approached from above. */
const lightEclipse = scaleMotifVelocities(
  mapMotifSteps(invertMotif(lightCall, 4), (step, index) => ({
    ...step,
    beat: step.beat + 0.4,
    length: index === 0 ? 1.3 : step.length * 1.06,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.84 : 0.78)
        : step.velocity,
  })),
  0.86,
);

/** Crown: descending from degree 5, the procession's final seal. */
const lightCrown: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.74,
      offset: 0,
      velocity: 0.64,
      pan: -0.08,
      toneIntent: "chord",
    },
    {
      beat: 1.5,
      length: 0.52,
      offset: -1,
      velocity: 0.58,
      pan: -0.02,
      toneIntent: "scale",
    },
    {
      beat: 3,
      length: 0.72,
      offset: -4,
      velocity: 0.68,
      pan: 0.08,
      toneIntent: "chord",
    },
    {
      beat: 4.5,
      length: 1.4,
      offset: -2,
      velocity: 0.76,
      pan: 0.12,
      toneIntent: "color",
    },
  ],
};

/** Final seal: sustained, with wide drop. */
const lightSeal: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 1.2,
      offset: 0,
      velocity: 0.6,
      pan: -0.06,
      toneIntent: "chord",
    },
    {
      beat: 1.5,
      length: 0.52,
      offset: -1,
      velocity: 0.56,
      pan: 0.02,
      toneIntent: "scale",
    },
    {
      beat: 3,
      length: 0.82,
      offset: -4,
      velocity: 0.7,
      pan: 0.08,
      toneIntent: "chord",
    },
    {
      beat: 4.5,
      length: 1.55,
      offset: -6,
      velocity: 0.84,
      pan: 0.14,
      toneIntent: "chord",
    },
  ],
};

// ---------------------------------------------------------------------------
// Harmony — more lydian brightness
// ---------------------------------------------------------------------------

function buildHarmony(): HarmonyPlanItem[] {
  return [
    // Threshold (bars 0–3): D → Bm7 → Em7 → A sus2
    { bar: 0, root: "D4", quality: "major", velocity: 0.19, inversion: 1, spread: 0.01, tag: "v2-threshold" },
    { bar: 1, root: "B3", quality: "minor7", velocity: 0.17, spread: 0.01, tag: "v2-threshold" },
    { bar: 2, root: "E4", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "v2-threshold" },
    { bar: 3, root: "A3", quality: "sus2", velocity: 0.19, spread: 0.01, tag: "v2-threshold" },

    // Ascent (bars 4–7): D → G maj7 → Em7 → Bm
    { bar: 4, root: "D4", quality: "major", velocity: 0.2, inversion: 1, spread: 0.01, tag: "v2-ascent" },
    { bar: 5, root: "G3", quality: "major7", velocity: 0.18, spread: 0.01, tag: "v2-ascent" },
    { bar: 6, root: "E4", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "v2-ascent" },
    { bar: 7, root: "B3", quality: "minor", velocity: 0.2, spread: 0.01, tag: "v2-ascent" },

    // Vault (bars 8–11): G maj7 → D → Em7 → A sus2
    { bar: 8, root: "G3", quality: "major7", velocity: 0.19, spread: 0.01, tag: "v2-vault" },
    { bar: 9, root: "D4", quality: "major", velocity: 0.2, inversion: 1, spread: 0.01, tag: "v2-vault" },
    { bar: 10, root: "E4", quality: "minor7", velocity: 0.19, spread: 0.01, tag: "v2-vault" },
    { bar: 11, root: "A3", quality: "sus2", velocity: 0.2, spread: 0.01, tag: "v2-vault" },

    // Eclipse (bars 12–15): Bm7 → G maj7 → Em7 → A sus2
    { bar: 12, root: "B3", quality: "minor7", velocity: 0.16, spread: 0.01, tag: "v2-eclipse" },
    { bar: 13, root: "G3", quality: "major7", velocity: 0.16, spread: 0.01, tag: "v2-eclipse" },
    { bar: 14, root: "E4", quality: "minor7", velocity: 0.17, spread: 0.01, tag: "v2-eclipse" },
    { bar: 15, root: "A3", quality: "sus2", velocity: 0.17, spread: 0.01, tag: "v2-eclipse" },

    // Homecoming (bars 16–18): D → Bm7 → A sus2
    { bar: 16, root: "D4", quality: "major", velocity: 0.2, inversion: 1, spread: 0.01, tag: "v2-homecoming" },
    { bar: 17, root: "B3", quality: "minor7", velocity: 0.19, spread: 0.01, tag: "v2-homecoming" },
    { bar: 18, root: "A3", quality: "sus2", velocity: 0.21, spread: 0.01, tag: "v2-homecoming" },

    // Crown (bar 19): D
    { bar: 19, root: "D4", quality: "major", velocity: 0.24, inversion: 1, spread: 0.01, tag: "v2-crown" },
  ];
}

// ---------------------------------------------------------------------------
// Supporting layers
// ---------------------------------------------------------------------------

function buildDrone(): PatternNoteDraft[] {
  return [
    { beat: 0, length: 24, pitch: "D3", velocity: 0.1, pan: -0.08, toneIntent: "chord" },
    { beat: 0, length: 24, pitch: "A3", velocity: 0.06, pan: 0.08, toneIntent: "chord" },
    { beat: 24, length: 24, pitch: "G2", velocity: 0.09, pan: -0.08, toneIntent: "chord" },
    { beat: 24, length: 24, pitch: "D3", velocity: 0.06, pan: 0.08, toneIntent: "chord" },
    { beat: 48, length: 24, pitch: "E3", velocity: 0.09, pan: -0.08, toneIntent: "chord" },
    { beat: 48, length: 24, pitch: "B3", velocity: 0.06, pan: 0.08, toneIntent: "chord" },
    { beat: 72, length: 24, pitch: "B2", velocity: 0.08, pan: -0.06, toneIntent: "chord" },
    { beat: 72, length: 24, pitch: "F#3", velocity: 0.05, pan: 0.06, toneIntent: "chord" },
    { beat: 96, length: 22.5, pitch: "D3", velocity: 0.12, pan: -0.08, toneIntent: "chord" },
    { beat: 96, length: 22.5, pitch: "A3", velocity: 0.07, pan: 0.08, toneIntent: "chord" },
  ];
}

/** Real countermelody: sigh figures running through ascent, vault, and
 *  homecoming — a second voice that comments on the procession. */
function buildCounterline(): PatternNoteDraft[] {
  const ascentCell = [
    ...sighingFigure({
      start: positionAtBarBeat(1, 2, 1, 2),
      meter: V2_METER,
      highDegree: 5,
      lowDegree: 4,
      stepSpan: span(0, 1),
      noteSpan: span(0, 0, 3, 4),
      velocity: 0.18,
      pan: -0.1,
    }),
    withPosition(
      {
        degree: 3,
        velocity: 0.16,
        pan: 0.06,
        toneIntent: "chord" as const,
      },
      {
        at: positionAtBarBeat(2, 5),
        duration: span(0, 1),
      },
    ),
  ];

  const vaultCell = [
    withPosition(
      {
        degree: 6,
        velocity: 0.17,
        pan: -0.08,
        toneIntent: "color" as const,
      },
      {
        at: positionAtBarBeat(1, 3),
        duration: span(0, 1),
      },
    ),
    ...sighingFigure({
      start: positionAtBarBeat(1, 5),
      meter: V2_METER,
      highDegree: 5,
      lowDegree: 3,
      stepSpan: span(0, 1),
      noteSpan: span(0, 0, 3, 4),
      velocity: 0.16,
      pan: 0.04,
    }),
  ];

  return [
    ...repeatAcrossBars(ascentCell, {
      startBar: 5,
      repetitions: 3,
      everyBars: 1,
      meter: V2_METER,
      label: "Counterline sigh through ascent.",
    }),
    ...repeatAcrossBars(vaultCell, {
      startBar: 9,
      repetitions: 3,
      everyBars: 1,
      meter: V2_METER,
      label: "Counterline comments through vault.",
    }),
    withPosition(
      {
        degree: 7,
        velocity: 0.14,
        pan: -0.04,
        toneIntent: "color" as const,
      },
      {
        at: positionAtBarBeat(15, 4),
        duration: span(0, 1),
      },
    ),
    ...repeatAcrossBars(ascentCell, {
      startBar: 17,
      repetitions: 2,
      everyBars: 1,
      meter: V2_METER,
      label: "Counterline returns in homecoming.",
    }),
  ];
}

/** Inner broken-triad layer: the procession's body. Gives texture to the
 *  ascent and vault sections. */
function buildInnerTriads(): PatternNoteDraft[] {
  const ascentTriad = [
    ...brokenTriad({
      start: positionAtBarBeat(1, 2),
      meter: V2_METER,
      beats: 4,
      order: [0, 1, 2, 1],
      stepSpan: span(0, 1),
      noteSpan: span(0, 0, 3, 4),
      velocity: 0.12,
      pan: -0.12,
      toneIntent: "chord",
    }),
  ];

  const vaultTriad = [
    ...brokenTriad({
      start: positionAtBarBeat(1, 1, 1, 2),
      meter: V2_METER,
      beats: 4,
      order: [0, 2, 1, 2],
      stepSpan: span(0, 1),
      noteSpan: span(0, 0, 3, 4),
      velocity: 0.13,
      pan: 0.12,
      toneIntent: "chord",
    }),
  ];

  return [
    ...repeatAcrossBars(ascentTriad, {
      startBar: 5,
      repetitions: 3,
      everyBars: 1,
      meter: V2_METER,
      label: "Inner triads through ascent.",
    }),
    ...repeatAcrossBars(vaultTriad, {
      startBar: 9,
      repetitions: 3,
      everyBars: 1,
      meter: V2_METER,
      label: "Inner triads with different voicing through vault.",
    }),
    ...repeatAcrossBars(ascentTriad, {
      startBar: 17,
      repetitions: 2,
      everyBars: 1,
      meter: V2_METER,
      label: "Inner triads return in homecoming.",
    }),
  ];
}

function buildOrnaments(): PatternNoteDraft[] {
  return [
    ...turnFigure({
      start: pickupBefore(
        { kind: "sectionStart", startBar: 5, bars: 4, sectionId: "v2-ascent", label: "the ascent" },
        V2_METER,
      ),
      meter: V2_METER,
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
        { kind: "sectionStart", startBar: 9, bars: 4, sectionId: "v2-vault", label: "the vault" },
        V2_METER,
        { subdivisions: 1, subdivisionUnit: 4 },
      ),
      meter: V2_METER,
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
    ...turnFigure({
      start: pickupBefore(
        { kind: "sectionStart", startBar: 17, bars: 3, sectionId: "v2-homecoming", label: "the homecoming" },
        V2_METER,
        { subdivisions: 1, subdivisionUnit: 4 },
      ),
      meter: V2_METER,
      centerDegree: 5,
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
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
        pitch: "A5",
        duration: span(0, 1),
        velocity: 0.08,
        pan: 0.16,
      },
      {
        at: pickupBefore(
          { kind: "sectionStart", startBar: 9, bars: 4, sectionId: "v2-vault", label: "the vault" },
          V2_METER,
        ),
        pitch: "B5",
        duration: span(0, 1),
        velocity: 0.07,
        pan: -0.12,
      },
      {
        at: positionAtBarBeat(11, 4),
        pitch: "G#5",
        duration: span(0, 1),
        velocity: 0.07,
        pan: 0.08,
      },
      {
        at: positionAtBarBeat(15, 5),
        pitch: "F#5",
        duration: span(0, 1),
        velocity: 0.06,
        pan: -0.06,
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
          { kind: "phraseEnd", bars: V2_MASTER_BARS, label: "the coronation" },
          V2_METER,
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
      harmony: harmony.filter((item) => item.tag !== "v2-eclipse"),
      beatsPerBar: V2_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.42, length: 0.52 },
        { beatOffset: 3, intervalSemitones: 7, velocity: 0.2, length: 0.32 },
      ],
      octaveShift: -12,
    }),
    ...pulseBass({
      harmony: harmony.filter((item) => item.tag === "v2-eclipse"),
      beatsPerBar: V2_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.26, length: 0.48 },
      ],
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

// ---------------------------------------------------------------------------
// Lead layers
// ---------------------------------------------------------------------------

function buildLeadLayers(): PhraseLayerPlan[] {
  return withRealization(
    withRhythmRole(
      "flow",
      withVoiceId("lead", [
        // Threshold: call → answer → crown
        {
          kind: "motif" as const,
          id: "v2-threshold-call",
          synth: "softLead" as const,
          motif: lightCall,
          positionOffset: positionAtBarBeat(1, 1),
          register: { min: "D5", max: "B6", anchor: "F#5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "v2-threshold-answer",
          synth: "softLead" as const,
          motif: lightAnswer,
          positionOffset: positionAtBarBeat(2, 1),
          register: { min: "E5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "v2-threshold-crown",
          synth: "softLead" as const,
          motif: lightCrown,
          positionOffset: positionAtBarBeat(4, 1),
          register: { min: "D5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          rhythmRole: "cadence",
        },

        // Ascent: stride → answer
        {
          kind: "motif" as const,
          id: "v2-ascent-stride",
          synth: "softLead" as const,
          motif: lightStride,
          positionOffset: positionAtBarBeat(5, 1),
          register: { min: "E5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "v2-ascent-answer",
          synth: "softLead" as const,
          motif: lightAnswer,
          positionOffset: positionAtBarBeat(7, 1),
          register: { min: "E5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 0.96,
          rhythmRole: "response",
        },

        // Vault: zenith (the climactic motif) → stride → crown
        {
          kind: "motif" as const,
          id: "v2-vault-zenith",
          synth: "softLead" as const,
          motif: lightZenith,
          positionOffset: positionAtBarBeat(9, 1),
          register: { min: "F#5", max: "C#7", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 1.02,
        },
        {
          kind: "motif" as const,
          id: "v2-vault-stride",
          synth: "softLead" as const,
          motif: lightStride,
          positionOffset: positionAtBarBeat(10, 1),
          register: { min: "F#5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 0.96,
        },
        {
          kind: "motif" as const,
          id: "v2-vault-crown",
          synth: "softLead" as const,
          motif: lightCrown,
          positionOffset: positionAtBarBeat(12, 1),
          register: { min: "D5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 0.94,
          rhythmRole: "cadence",
        },

        // Eclipse: inverted motif × 2 (real inversion, not retrograde)
        {
          kind: "motif" as const,
          id: "v2-eclipse-invert-a",
          synth: "softLead" as const,
          motif: lightEclipse,
          positionOffset: positionAtBarBeat(13, 1),
          register: { min: "D5", max: "A6", anchor: "F#5" },
          clampToHarmony: true,
          velocityScale: 0.84,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "v2-eclipse-invert-b",
          synth: "softLead" as const,
          motif: lightEclipse,
          positionOffset: positionAtBarBeat(15, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.8,
          rhythmRole: "suspension",
        },

        // Homecoming: call → answer (the return)
        {
          kind: "motif" as const,
          id: "v2-homecoming-call",
          synth: "softLead" as const,
          motif: lightCall,
          positionOffset: positionAtBarBeat(17, 1),
          register: { min: "D5", max: "B6", anchor: "F#5" },
          clampToHarmony: true,
          velocityScale: 1.04,
        },
        {
          kind: "motif" as const,
          id: "v2-homecoming-answer",
          synth: "softLead" as const,
          motif: lightAnswer,
          positionOffset: positionAtBarBeat(18, 1),
          register: { min: "E5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 1.04,
          rhythmRole: "response",
        },

        // Crown: the seal
        {
          kind: "motif" as const,
          id: "v2-crown",
          synth: "softLead" as const,
          motif: lightSeal,
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

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

function buildHeliographV2Plan(): PhrasePlan {
  const harmony = buildHarmony();

  return {
    bars: V2_MASTER_BARS,
    beatsPerBar: V2_BEATS_PER_BAR,
    meter: V2_METER,
    key: { root: "D", scale: "lydian" },
    harmony,
    sections: [
      {
        id: "v2-threshold",
        role: "statement",
        barRole: "arrival",
        startBar: 0,
        bars: 4,
        bias: { density: -0.08, register: 0, brightness: -0.02, cadence: 0.92 },
        description: "The procession appears. The #4 shines at the phrase's turning point.",
      },
      {
        id: "v2-ascent",
        role: "variation",
        barRole: "continuation",
        startBar: 4,
        bars: 4,
        bias: { density: 0.04, register: 0.08, brightness: 0.08, cadence: 0.98 },
        description: "The inner triads and countermelody join. The procession has bodies now.",
      },
      {
        id: "v2-vault",
        role: "bridge",
        barRole: "transition",
        startBar: 8,
        bars: 4,
        bias: { density: 0.06, register: 0.16, brightness: 0.14, cadence: 0.92 },
        description: "The zenith motif opens the architecture. This is the climax.",
      },
      {
        id: "v2-eclipse",
        role: "shadow",
        barRole: "transition",
        startBar: 12,
        bars: 4,
        bias: { density: -0.26, register: -0.18, brightness: -0.2, cadence: 0.58 },
        description: "The same procession inverted — descending where it rose, shadow where it shone.",
      },
      {
        id: "v2-homecoming",
        role: "return",
        barRole: "arrival",
        startBar: 16,
        bars: 3,
        bias: { density: -0.02, register: 0.1, brightness: 0.1, cadence: 1.14 },
        description: "The ascent resolves into certainty. The triads and counterline return.",
      },
      {
        id: "v2-crown",
        role: "cadence",
        barRole: "cadence",
        startBar: 19,
        bars: 1,
        bias: { density: -0.08, register: 0.08, brightness: 0.06, cadence: 1.36 },
        description: "A single bar seals the loop with luminous authority and a wide descent.",
      },
    ],
    cadenceTiming: [
      {
        targetBar: V2_MASTER_BARS,
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
        { beat: 24, value: 0.5 },
        { beat: 48, value: 0.6 },
        { beat: 72, value: 0.18 },
        { beat: 96, value: 0.58 },
        { beat: 120, value: 0.42 },
      ],
      registerCurve: [
        { beat: 0, value: 0 },
        { beat: 24, value: 0.08 },
        { beat: 48, value: 0.18 },
        { beat: 72, value: -0.2 },
        { beat: 96, value: 0.14 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.42 },
        { beat: 24, value: 0.58 },
        { beat: 48, value: 0.68 },
        { beat: 72, value: 0.2 },
        { beat: 96, value: 0.68 },
        { beat: 120, value: 0.48 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.18 },
        { beat: 21, value: 0.46 },
        { beat: 45, value: 0.58 },
        { beat: 69, value: 0.2 },
        { beat: 102, value: 0.8 },
        { beat: 114, value: 0.96 },
      ],
      ornamentBaseProbability: 0.1,
    },
    noteLayers: [
      ...buildLeadLayers(),
      {
        kind: "draft",
        id: "v2-counterline",
        synth: "softLead",
        voiceId: "counterline",
        rhythmRole: "response",
        realization: true,
        notes: buildCounterline(),
        register: { min: "A4", max: "E5", anchor: "D5" },
        velocityScale: 0.88,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "v2-inner-triads",
        synth: "pluckyDust",
        voiceId: "inner",
        rhythmRole: "flow",
        realization: true,
        notes: buildInnerTriads(),
        register: { min: "D4", max: "A5", anchor: "F#4" },
        velocityScale: 0.72,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "v2-ornaments",
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
        id: "v2-bells",
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
        id: "v2-bass",
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
        id: "v2-drone",
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

export const heliographProcessionV2: Composition = buildComposition({
  id: "heliograph-procession-v2",
  title: "Heliograph Procession V2",
  key: { root: "D", scale: "lydian" },
  bpm: V2_BPM,
  beatsPerBar: V2_BEATS_PER_BAR,
  plan: buildHeliographV2Plan(),
});
