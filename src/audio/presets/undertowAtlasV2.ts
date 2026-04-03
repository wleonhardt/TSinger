import { compilePhrasePlan } from "../authoring/compile";
import {
  augmentRhythm,
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
// Undertow Atlas V2
//
// Same soul: E dorian, 5/4, 68 BPM, deep oceanic pull.
//
// What changed:
// - The motif exploits the 5/4 as 3+2 grouping: three notes in beats 0–2.5,
//   then a two-beat tail with a rest on beat 3 creating breath before the
//   landing on beat 3.75. This gives the melody asymmetric momentum.
// - Richer harmony: Bm7, Cmaj7, D/F# added alongside the original Em/Dmaj7
//   orbit. The black-current section uses Cmaj7→Bm7 for darker modal color.
// - Real countermelody: a sighingFigure + position-placed line that runs
//   through sounding-lines and open-water, not just two isolated notes.
// - Black-current uses augmentRhythm (motif at 1.5× speed) for genuine
//   transformation rather than just velocity reduction.
// - Inner ripples start earlier (bar 5) and cover more sections.
// - Seal motif has a wider interval (octave drop to degree -7).
// ---------------------------------------------------------------------------

const V2_BPM = 68;
const V2_BEATS_PER_BAR = 5;
const V2_MASTER_BARS = 20;
const V2_METER = {
  beatsPerBar: V2_BEATS_PER_BAR,
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

// ---------------------------------------------------------------------------
// Motifs — 3+2 asymmetric grouping
// ---------------------------------------------------------------------------

/** Primary call: three-note ascending cluster (beats 0–2), breath, then
 *  a long landing on beat 3.75 that hangs into the next bar. */
const tidePull: Motif = {
  anchorDegree: 1,
  steps: [
    {
      beat: 0,
      length: 0.9,
      offset: 0,
      velocity: 0.68,
      pan: -0.1,
      toneIntent: "chord",
    },
    {
      beat: 1.25,
      length: 0.72,
      offset: 2,
      velocity: 0.58,
      pan: -0.02,
      toneIntent: "scale",
    },
    {
      beat: 2.5,
      length: 0.48,
      offset: 4,
      velocity: 0.54,
      pan: 0.06,
      toneIntent: "color",
    },
    // Beat 3 is empty — the 5/4 breath
    {
      beat: 3.75,
      length: 1.15,
      offset: 3,
      velocity: 0.72,
      pan: 0.12,
      toneIntent: "chord",
    },
  ],
};

/** Answer phrase: shifted up a 4th, with a slight rhythmic push on the
 *  landing note (arrives at 3.5 instead of 3.75). */
const tideReturn = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(tidePull, { scaleSteps: 3 }), (step, index) => ({
    ...step,
    beat: index === 3 ? 3.5 : step.beat,
    length: index === 3 ? 1.35 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 1 ? 0.94 : 0.9)
        : step.velocity,
  })),
  0.96,
);

/** Doubled call for the sounding-lines — plays the call twice at +1 step,
 *  second iteration slightly quieter. */
const tideDouble = scaleMotifVelocities(
  mapMotifSteps(sequence(tidePull, { scaleSteps: 1 }, 2), (step, index) => ({
    ...step,
    beat: step.beat + (index >= 4 ? 0.15 : 0),
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index >= 4 ? 0.88 : 1)
        : step.velocity,
  })),
  0.88,
);

/** Retrograde shadow — reversed and shifted, with the first note elongated
 *  to create a "sinking" feeling. */
const tideShadow = scaleMotifVelocities(
  mapMotifSteps(retrograde(tidePull), (step, index) => ({
    ...step,
    beat: step.beat + 0.25,
    length: step.length * (index === 0 ? 1.3 : 1.06),
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.74 : 0.82)
        : step.velocity,
  })),
  0.86,
);

/** Black-current augmented motif: the call stretched to 1.5× rhythm,
 *  creating a slow-motion undertow. */
const tideAugmented = scaleMotifVelocities(
  augmentRhythm(tidePull, 1.5),
  0.78,
);

/** Descending landfall from scale degree 5 — wider intervals than original,
 *  dropping to -3 then leaping to -7 for a bass-register anchor. */
const tideLandfall: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.96,
      offset: 0,
      velocity: 0.6,
      pan: -0.08,
      toneIntent: "chord",
    },
    {
      beat: 1.5,
      length: 0.62,
      offset: -2,
      velocity: 0.56,
      pan: 0.02,
      toneIntent: "scale",
    },
    {
      beat: 3,
      length: 0.78,
      offset: -3,
      velocity: 0.64,
      pan: 0.08,
      toneIntent: "color",
    },
    {
      beat: 4.0,
      length: 1.1,
      offset: -5,
      velocity: 0.74,
      pan: 0.14,
      toneIntent: "chord",
    },
  ],
};

/** Final seal: sustained chord tone with wide drop to -7. */
const tideSeal: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 1.0,
      offset: 0,
      velocity: 0.58,
      pan: -0.06,
      toneIntent: "chord",
    },
    {
      beat: 1.5,
      length: 0.56,
      offset: -2,
      velocity: 0.54,
      pan: 0.02,
      toneIntent: "scale",
    },
    {
      beat: 3,
      length: 0.8,
      offset: -3,
      velocity: 0.66,
      pan: 0.08,
      toneIntent: "color",
    },
    {
      beat: 4,
      length: 1.0,
      offset: -7,
      velocity: 0.82,
      pan: 0.14,
      toneIntent: "chord",
    },
  ],
};

// ---------------------------------------------------------------------------
// Harmony — more modal color
// ---------------------------------------------------------------------------

function buildHarmony(): HarmonyPlanItem[] {
  return [
    // Chart room (bars 0–3): Em → Bm7 → Dmaj7 → Asus2
    { bar: 0, root: "E4", quality: "minor", velocity: 0.18, spread: 0.01, tag: "v2-chart-room" },
    { bar: 1, root: "B3", quality: "minor7", velocity: 0.17, spread: 0.01, tag: "v2-chart-room" },
    { bar: 2, root: "D4", quality: "major7", velocity: 0.19, spread: 0.01, tag: "v2-chart-room" },
    { bar: 3, root: "A3", quality: "sus2", velocity: 0.18, spread: 0.01, tag: "v2-chart-room" },

    // Sounding lines (bars 4–7): Em → Cmaj7 → Gadd9 → Bm7
    { bar: 4, root: "E4", quality: "minor", velocity: 0.19, spread: 0.01, tag: "v2-sounding-lines" },
    { bar: 5, root: "C4", quality: "major7", velocity: 0.18, spread: 0.01, tag: "v2-sounding-lines" },
    { bar: 6, root: "G3", quality: "add9", velocity: 0.18, spread: 0.01, tag: "v2-sounding-lines" },
    { bar: 7, root: "B3", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "v2-sounding-lines" },

    // Black current (bars 8–11): Cmaj7 → Bm7 → Asus2 → Dmaj7
    { bar: 8, root: "C4", quality: "major7", velocity: 0.16, spread: 0.01, tag: "v2-black-current" },
    { bar: 9, root: "B3", quality: "minor7", velocity: 0.15, spread: 0.01, tag: "v2-black-current" },
    { bar: 10, root: "A3", quality: "sus2", velocity: 0.15, spread: 0.01, tag: "v2-black-current" },
    { bar: 11, root: "D4", quality: "major7", velocity: 0.16, spread: 0.01, tag: "v2-black-current" },

    // Open water (bars 12–15): Em → Gadd9 → Cmaj7 → Bm7
    { bar: 12, root: "E4", quality: "minor", velocity: 0.18, spread: 0.01, tag: "v2-open-water" },
    { bar: 13, root: "G3", quality: "add9", velocity: 0.18, spread: 0.01, tag: "v2-open-water" },
    { bar: 14, root: "C4", quality: "major7", velocity: 0.17, spread: 0.01, tag: "v2-open-water" },
    { bar: 15, root: "B3", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "v2-open-water" },

    // Shoreline (bars 16–18): Em → Dmaj7 → Asus2
    { bar: 16, root: "E4", quality: "minor", velocity: 0.2, spread: 0.01, tag: "v2-shoreline" },
    { bar: 17, root: "D4", quality: "major7", velocity: 0.19, spread: 0.01, tag: "v2-shoreline" },
    { bar: 18, root: "A3", quality: "sus2", velocity: 0.21, spread: 0.01, tag: "v2-shoreline" },

    // Seal (bar 19): Em
    { bar: 19, root: "E4", quality: "minor", velocity: 0.24, spread: 0.01, tag: "v2-seal" },
  ];
}

// ---------------------------------------------------------------------------
// Supporting layers
// ---------------------------------------------------------------------------

function buildDrone(): PatternNoteDraft[] {
  return [
    { beat: 0, length: 20, pitch: "E3", velocity: 0.1, pan: -0.08, toneIntent: "chord" },
    { beat: 0, length: 20, pitch: "B3", velocity: 0.06, pan: 0.08, toneIntent: "chord" },
    { beat: 20, length: 20, pitch: "C3", velocity: 0.09, pan: -0.08, toneIntent: "chord" },
    { beat: 20, length: 20, pitch: "G3", velocity: 0.05, pan: 0.08, toneIntent: "chord" },
    { beat: 40, length: 20, pitch: "A2", velocity: 0.08, pan: -0.06, toneIntent: "chord" },
    { beat: 40, length: 20, pitch: "E3", velocity: 0.05, pan: 0.06, toneIntent: "chord" },
    { beat: 60, length: 20, pitch: "E3", velocity: 0.1, pan: -0.08, toneIntent: "chord" },
    { beat: 60, length: 20, pitch: "B3", velocity: 0.06, pan: 0.08, toneIntent: "chord" },
    { beat: 80, length: 18.8, pitch: "E3", velocity: 0.12, pan: -0.08, toneIntent: "chord" },
    { beat: 80, length: 18.8, pitch: "B3", velocity: 0.07, pan: 0.08, toneIntent: "chord" },
  ];
}

/** Real countermelody — sigh figures and positioned notes that form a
 *  descending line through the sounding-lines and open-water sections. */
function buildCounterline(): PatternNoteDraft[] {
  const soundingCell = [
    ...sighingFigure({
      start: positionAtBarBeat(1, 3),
      meter: V2_METER,
      highDegree: 6,
      lowDegree: 5,
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
        at: positionAtBarBeat(2, 4),
        duration: span(0, 1),
      },
    ),
  ];

  const openWaterCell = [
    ...sighingFigure({
      start: positionAtBarBeat(1, 2),
      meter: V2_METER,
      highDegree: 5,
      lowDegree: 3,
      stepSpan: span(0, 1),
      noteSpan: span(0, 0, 3, 4),
      velocity: 0.17,
      pan: -0.08,
    }),
    withPosition(
      {
        degree: 4,
        velocity: 0.15,
        pan: 0.04,
        toneIntent: "scale" as const,
      },
      {
        at: positionAtBarBeat(2, 5),
        duration: span(0, 1),
      },
    ),
  ];

  return [
    ...repeatAcrossBars(soundingCell, {
      startBar: 5,
      repetitions: 3,
      everyBars: 1,
      meter: V2_METER,
      label: "Counterline sigh through sounding lines.",
    }),
    withPosition(
      {
        degree: 7,
        velocity: 0.15,
        pan: -0.04,
        toneIntent: "color" as const,
      },
      {
        at: positionAtBarBeat(11, 3),
        duration: span(0, 1),
      },
    ),
    ...repeatAcrossBars(openWaterCell, {
      startBar: 13,
      repetitions: 3,
      everyBars: 1,
      meter: V2_METER,
      label: "Counterline descends through open water.",
    }),
  ];
}

function buildInnerRipples(): PatternNoteDraft[] {
  const rippleCell = [
    ...brokenTriad({
      start: positionAtBarBeat(1, 2),
      meter: V2_METER,
      beats: 4,
      order: [0, 1, 2, 1],
      stepSpan: span(0, 1),
      noteSpan: span(0, 0, 3, 4),
      velocity: 0.11,
      pan: -0.14,
      toneIntent: "chord",
    }),
    ...brokenTriad({
      start: positionAtBarBeat(2, 1, 1, 2),
      meter: V2_METER,
      beats: 4,
      order: [1, 2, 1, 0],
      stepSpan: span(0, 1),
      noteSpan: span(0, 0, 3, 4),
      velocity: 0.1,
      pan: 0.14,
      toneIntent: "chord",
    }),
  ];

  return [
    ...repeatAcrossBars(rippleCell, {
      startBar: 5,
      repetitions: 3,
      everyBars: 2,
      meter: V2_METER,
      label: "Inner ripples run through sounding lines and black current.",
    }),
    ...repeatAcrossBars(rippleCell, {
      startBar: 13,
      repetitions: 2,
      everyBars: 2,
      meter: V2_METER,
      label: "Inner ripples return in open water.",
    }),
  ];
}

function buildOrnaments(): PatternNoteDraft[] {
  return [
    ...sighingFigure({
      start: pickupBefore(
        {
          kind: "sectionStart",
          startBar: 5,
          bars: 4,
          sectionId: "v2-sounding-lines",
          label: "the sounding lines",
        },
        V2_METER,
      ),
      meter: V2_METER,
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
          sectionId: "v2-black-current",
          label: "the black current",
        },
        V2_METER,
        { subdivisions: 1, subdivisionUnit: 4 },
      ),
      meter: V2_METER,
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
          sectionId: "v2-shoreline",
          label: "the shoreline",
        },
        V2_METER,
      ),
      meter: V2_METER,
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
            sectionId: "v2-black-current",
            label: "the black current",
          },
          V2_METER,
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
        at: positionAtBarBeat(15, 3),
        pitch: "C6",
        duration: span(0, 1),
        velocity: 0.07,
        pan: -0.06,
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
          { kind: "phraseEnd", bars: V2_MASTER_BARS, label: "the atlas closes" },
          V2_METER,
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
      harmony: harmony.filter((item) => item.tag !== "v2-black-current"),
      beatsPerBar: V2_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.44, length: 0.72 },
        { beatOffset: 3, intervalSemitones: 7, velocity: 0.22, length: 0.34 },
        { beatOffset: 4.25, intervalSemitones: 0, velocity: 0.18, length: 0.28 },
      ],
      octaveShift: -12,
    }),
    ...pulseBass({
      harmony: harmony.filter((item) => item.tag === "v2-black-current"),
      beatsPerBar: V2_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.28, length: 0.82 },
        { beatOffset: 4, intervalSemitones: 7, velocity: 0.14, length: 0.3 },
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

// ---------------------------------------------------------------------------
// Lead layers
// ---------------------------------------------------------------------------

function buildLeadLayers(): PhraseLayerPlan[] {
  return withRealization(
    withRhythmRole(
      "flow",
      withVoiceId("lead", [
        // Chart room: call → return → landfall
        {
          kind: "motif" as const,
          id: "v2-chart-call",
          synth: "softLead" as const,
          motif: tidePull,
          positionOffset: positionAtBarBeat(1, 1),
          register: { min: "E5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "v2-chart-return",
          synth: "softLead" as const,
          motif: tideReturn,
          positionOffset: positionAtBarBeat(2, 1),
          register: { min: "F#5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "v2-chart-landfall",
          synth: "softLead" as const,
          motif: tideLandfall,
          positionOffset: positionAtBarBeat(4, 1),
          register: { min: "E5", max: "A6", anchor: "B5" },
          clampToHarmony: true,
          rhythmRole: "cadence",
        },

        // Sounding lines: double → return → landfall
        {
          kind: "motif" as const,
          id: "v2-lines-double",
          synth: "softLead" as const,
          motif: tideDouble,
          positionOffset: positionAtBarBeat(5, 1),
          register: { min: "F#5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "v2-lines-return",
          synth: "softLead" as const,
          motif: tideReturn,
          positionOffset: positionAtBarBeat(7, 1),
          register: { min: "F#5", max: "B6", anchor: "B5" },
          clampToHarmony: true,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "v2-lines-landfall",
          synth: "softLead" as const,
          motif: tideLandfall,
          positionOffset: positionAtBarBeat(8, 1),
          register: { min: "E5", max: "A6", anchor: "B5" },
          clampToHarmony: true,
          velocityScale: 0.96,
          rhythmRole: "cadence",
        },

        // Black current: augmented motif × 2, then shadow
        {
          kind: "motif" as const,
          id: "v2-current-augmented-a",
          synth: "softLead" as const,
          motif: tideAugmented,
          positionOffset: positionAtBarBeat(9, 1),
          register: { min: "D5", max: "A6", anchor: "F#5" },
          clampToHarmony: true,
          velocityScale: 0.82,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "v2-current-shadow",
          synth: "softLead" as const,
          motif: tideShadow,
          positionOffset: positionAtBarBeat(11, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.78,
          rhythmRole: "suspension",
        },

        // Open water: call → double (condensed) → landfall
        {
          kind: "motif" as const,
          id: "v2-open-call",
          synth: "softLead" as const,
          motif: tidePull,
          positionOffset: positionAtBarBeat(13, 1),
          register: { min: "F#5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 0.92,
        },
        {
          kind: "motif" as const,
          id: "v2-open-return",
          synth: "softLead" as const,
          motif: tideReturn,
          positionOffset: positionAtBarBeat(14, 1),
          register: { min: "E5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 0.94,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "v2-open-landfall",
          synth: "softLead" as const,
          motif: tideLandfall,
          positionOffset: positionAtBarBeat(16, 1),
          register: { min: "E5", max: "A6", anchor: "B5" },
          clampToHarmony: true,
          velocityScale: 0.96,
          rhythmRole: "cadence",
        },

        // Shoreline: call → return (final statement)
        {
          kind: "motif" as const,
          id: "v2-shore-call",
          synth: "softLead" as const,
          motif: tidePull,
          positionOffset: positionAtBarBeat(17, 1),
          register: { min: "E5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 1.02,
        },
        {
          kind: "motif" as const,
          id: "v2-shore-return",
          synth: "softLead" as const,
          motif: tideReturn,
          positionOffset: positionAtBarBeat(18, 1),
          register: { min: "F#5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 1.04,
          rhythmRole: "response",
        },

        // Seal
        {
          kind: "motif" as const,
          id: "v2-seal",
          synth: "softLead" as const,
          motif: tideSeal,
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

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

function buildUndertowV2Plan(): PhrasePlan {
  const harmony = buildHarmony();

  return {
    bars: V2_MASTER_BARS,
    beatsPerBar: V2_BEATS_PER_BAR,
    meter: V2_METER,
    key: { root: "E", scale: "dorian" },
    harmony,
    sections: [
      {
        id: "v2-chart-room",
        role: "statement",
        barRole: "arrival",
        startBar: 0,
        bars: 4,
        bias: { density: -0.08, register: -0.02, brightness: -0.06, cadence: 0.92 },
        description: "The 3+2 pull introduces itself: three notes reaching, one note landing.",
      },
      {
        id: "v2-sounding-lines",
        role: "answer",
        barRole: "continuation",
        startBar: 4,
        bars: 4,
        bias: { density: 0.04, register: 0.08, brightness: 0.04, cadence: 0.98 },
        description: "The countermelody enters and the ripples begin. The ocean has a second voice.",
      },
      {
        id: "v2-black-current",
        role: "shadow",
        barRole: "transition",
        startBar: 8,
        bars: 4,
        bias: { density: -0.24, register: -0.16, brightness: -0.2, cadence: 0.6 },
        description: "The motif stretches to 1.5× — the same tide in slow motion, seen from below.",
      },
      {
        id: "v2-open-water",
        role: "bridge",
        barRole: "continuation",
        startBar: 12,
        bars: 4,
        bias: { density: 0, register: 0.06, brightness: 0, cadence: 0.88 },
        description: "The call returns at normal speed and the counterline descends through it.",
      },
      {
        id: "v2-shoreline",
        role: "return",
        barRole: "arrival",
        startBar: 16,
        bars: 3,
        bias: { density: 0.02, register: 0.08, brightness: 0.06, cadence: 1.14 },
        description: "The motif arrives home without losing the pull underneath.",
      },
      {
        id: "v2-seal",
        role: "cadence",
        barRole: "cadence",
        startBar: 19,
        bars: 1,
        bias: { density: -0.1, register: 0.04, brightness: 0, cadence: 1.3 },
        description: "A single horizon line drops an octave and restarts the tide.",
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
    padLayers: [{ synth: "warmPad", voiceId: "pad", velocityScale: 0.78 }],
    arrangement: {
      densityCurve: [
        { beat: 0, value: 0.28 },
        { beat: 20, value: 0.42 },
        { beat: 40, value: 0.16 },
        { beat: 60, value: 0.44 },
        { beat: 80, value: 0.5 },
        { beat: 100, value: 0.34 },
      ],
      registerCurve: [
        { beat: 0, value: -0.02 },
        { beat: 20, value: 0.08 },
        { beat: 40, value: -0.2 },
        { beat: 60, value: 0.04 },
        { beat: 80, value: 0.1 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.32 },
        { beat: 20, value: 0.44 },
        { beat: 40, value: 0.16 },
        { beat: 60, value: 0.34 },
        { beat: 80, value: 0.48 },
        { beat: 100, value: 0.28 },
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
        id: "v2-counterline",
        synth: "softLead",
        voiceId: "counterline",
        rhythmRole: "response",
        realization: true,
        notes: buildCounterline(),
        register: { min: "B4", max: "E5", anchor: "D5" },
        velocityScale: 0.86,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "v2-inner-ripples",
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
        register: { min: "A5", max: "E6", anchor: "B5" },
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
        register: { min: "E2", max: "B2", anchor: "E2" },
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
        register: { min: "G2", max: "B3", anchor: "E3" },
        clampToHarmony: true,
      },
    ],
  };
}

export const undertowAtlasV2: Composition = buildComposition({
  id: "undertow-atlas-v2",
  title: "Undertow Atlas V2",
  key: { root: "E", scale: "dorian" },
  bpm: V2_BPM,
  beatsPerBar: V2_BEATS_PER_BAR,
  plan: buildUndertowV2Plan(),
});
