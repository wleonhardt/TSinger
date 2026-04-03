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
// Cinder Carousel V2
//
// Same soul: A harmonic minor, 3/4, 76 BPM, waltz-box nostalgia.
//
// What changed:
// - 20 bars (not 24). The piece earns its length.
// - Motif uses wider intervals: the augmented 2nd (F→G#) of harmonic minor
//   is placed prominently at beats 0.75→1.5. This gives the carousel its
//   distinctive "winding-up" color instead of generic minor.
// - Fewer lead placements (14 instead of 20) — each one is more distinctive.
// - The ashfall section uses augmentRhythm (1.5× stretch) so the carousel
//   genuinely slows down rather than just dimming.
// - Clockwork inner layer runs through more sections (mirror + return).
// - The seal motif has a final wide drop (degree -6) for a deeper landing.
// ---------------------------------------------------------------------------

const V2_BPM = 76;
const V2_BEATS_PER_BAR = 3;
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
// Motifs — wider intervals, harmonic minor color
// ---------------------------------------------------------------------------

/** Primary call: the F→G# augmented 2nd at beats 0.75→1.5 is the hook.
 *  The waltz rhythm places weight on beat 1, color on 2, landing on 3. */
const emberTurn: Motif = {
  anchorDegree: 1,
  steps: [
    {
      beat: 0,
      length: 0.52,
      offset: 0,
      velocity: 0.66,
      pan: -0.08,
      toneIntent: "chord",
    },
    {
      beat: 0.75,
      length: 0.44,
      offset: 5,
      velocity: 0.58,
      pan: 0.02,
      toneIntent: "scale",
      // scale degree 6 in harmonic minor = F, degree 7 = G#
      // offset 5 lands on the 6th degree
    },
    {
      beat: 1.5,
      length: 0.56,
      offset: 6,
      velocity: 0.62,
      pan: 0.08,
      toneIntent: "color",
      // offset 6 = the raised 7th (G#), creating the aug 2nd interval
    },
    {
      beat: 2.25,
      length: 0.65,
      offset: 4,
      velocity: 0.7,
      pan: 0.12,
      toneIntent: "chord",
    },
  ],
};

/** Answer phrase: shifted up a 2nd with a longer tail. */
const emberReply = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(emberTurn, { scaleSteps: 2 }), (step, index) => ({
    ...step,
    beat: step.beat + (index === 0 ? 0.08 : 0),
    length: index === 3 ? 0.82 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 1 ? 0.92 : 0.95)
        : step.velocity,
  })),
  0.97,
);

/** Doubled sequence for the mirror section. */
const emberSpin = scaleMotifVelocities(
  mapMotifSteps(sequence(emberTurn, { scaleSteps: -1 }, 2), (step, index) => ({
    ...step,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index >= 4 ? 0.88 : 1)
        : step.velocity,
  })),
  0.88,
);

/** Retrograde shadow for the ashfall. */
const emberShadow = scaleMotifVelocities(
  mapMotifSteps(retrograde(emberTurn), (step, index) => ({
    ...step,
    beat: step.beat + 0.12,
    length: step.length * (index === 0 ? 1.3 : 1.08),
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.74 : 0.82)
        : step.velocity,
  })),
  0.86,
);

/** Augmented rhythm for the ashfall — the carousel in slow motion. */
const emberSlowed = scaleMotifVelocities(
  augmentRhythm(emberTurn, 1.5),
  0.74,
);

/** Cadence motif: descending from degree 5, landing on chord tones. */
const emberCadence: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.48,
      offset: 0,
      velocity: 0.6,
      pan: -0.08,
      toneIntent: "chord",
    },
    {
      beat: 0.75,
      length: 0.38,
      offset: -1,
      velocity: 0.54,
      pan: 0,
      toneIntent: "scale",
    },
    {
      beat: 1.5,
      length: 0.52,
      offset: -3,
      velocity: 0.6,
      pan: 0.08,
      toneIntent: "chord",
    },
    {
      beat: 2.25,
      length: 0.72,
      offset: -4,
      velocity: 0.74,
      pan: 0.12,
      toneIntent: "chord",
    },
  ],
};

/** Seal: wide drop to -6 for deep landing. */
const emberSeal: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.48,
      offset: 0,
      velocity: 0.58,
      pan: -0.06,
      toneIntent: "chord",
    },
    {
      beat: 0.75,
      length: 0.36,
      offset: -1,
      velocity: 0.52,
      pan: 0.02,
      toneIntent: "scale",
    },
    {
      beat: 1.5,
      length: 0.56,
      offset: -3,
      velocity: 0.62,
      pan: 0.08,
      toneIntent: "chord",
    },
    {
      beat: 2.15,
      length: 1.0,
      offset: -6,
      velocity: 0.82,
      pan: 0.14,
      toneIntent: "chord",
    },
  ],
};

// ---------------------------------------------------------------------------
// Harmony — more harmonic minor character
// ---------------------------------------------------------------------------

function buildHarmony(): HarmonyPlanItem[] {
  return [
    // Platform (bars 0–4): Am → E → F → E → Am
    { bar: 0, root: "A3", quality: "minor", velocity: 0.2, spread: 0.01, tag: "v2-platform" },
    { bar: 1, root: "E4", quality: "major", velocity: 0.18, spread: 0.01, tag: "v2-platform" },
    { bar: 2, root: "F4", quality: "major", velocity: 0.18, spread: 0.01, tag: "v2-platform" },
    { bar: 3, root: "E4", quality: "major", velocity: 0.19, spread: 0.01, tag: "v2-platform" },
    { bar: 4, root: "A3", quality: "minor", velocity: 0.2, spread: 0.01, tag: "v2-platform" },

    // Mirror (bars 5–9): Dm7 → E → F → Am → Esus4
    { bar: 5, root: "D4", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "v2-mirror" },
    { bar: 6, root: "E4", quality: "major", velocity: 0.19, spread: 0.01, tag: "v2-mirror" },
    { bar: 7, root: "F4", quality: "major", velocity: 0.18, spread: 0.01, tag: "v2-mirror" },
    { bar: 8, root: "A3", quality: "minor", velocity: 0.19, spread: 0.01, tag: "v2-mirror" },
    { bar: 9, root: "E4", quality: "sus4", velocity: 0.18, spread: 0.01, tag: "v2-mirror" },

    // Ashfall (bars 10–14): F → Dm7 → Am → E → F
    { bar: 10, root: "F4", quality: "major", velocity: 0.16, spread: 0.01, tag: "v2-ashfall" },
    { bar: 11, root: "D4", quality: "minor7", velocity: 0.15, spread: 0.01, tag: "v2-ashfall" },
    { bar: 12, root: "A3", quality: "minor", velocity: 0.16, spread: 0.01, tag: "v2-ashfall" },
    { bar: 13, root: "E4", quality: "major", velocity: 0.16, spread: 0.01, tag: "v2-ashfall" },
    { bar: 14, root: "F4", quality: "major", velocity: 0.17, spread: 0.01, tag: "v2-ashfall" },

    // Return (bars 15–18): Am → C → E → Esus4
    { bar: 15, root: "A3", quality: "minor", velocity: 0.2, spread: 0.01, tag: "v2-return" },
    { bar: 16, root: "C4", quality: "major", velocity: 0.19, spread: 0.01, tag: "v2-return" },
    { bar: 17, root: "E4", quality: "major", velocity: 0.2, spread: 0.01, tag: "v2-return" },
    { bar: 18, root: "E4", quality: "sus4", velocity: 0.22, spread: 0.01, tag: "v2-return" },

    // Seal (bar 19): Am
    { bar: 19, root: "A3", quality: "minor", velocity: 0.25, spread: 0.01, tag: "v2-seal" },
  ];
}

// ---------------------------------------------------------------------------
// Supporting layers
// ---------------------------------------------------------------------------

function buildDrone(): PatternNoteDraft[] {
  return [
    { beat: 0, length: 15, pitch: "A3", velocity: 0.1, pan: -0.08, toneIntent: "chord" },
    { beat: 0, length: 15, pitch: "E4", velocity: 0.06, pan: 0.08, toneIntent: "chord" },
    { beat: 15, length: 15, pitch: "D3", velocity: 0.09, pan: -0.08, toneIntent: "chord" },
    { beat: 15, length: 15, pitch: "A3", velocity: 0.05, pan: 0.08, toneIntent: "chord" },
    { beat: 30, length: 15, pitch: "F3", velocity: 0.08, pan: -0.06, toneIntent: "chord" },
    { beat: 30, length: 15, pitch: "C4", velocity: 0.05, pan: 0.06, toneIntent: "chord" },
    { beat: 45, length: 13, pitch: "A3", velocity: 0.11, pan: -0.08, toneIntent: "chord" },
    { beat: 45, length: 13, pitch: "E4", velocity: 0.07, pan: 0.08, toneIntent: "chord" },
    { beat: 58, length: 2, pitch: "A3", velocity: 0.12, pan: -0.06, toneIntent: "chord" },
    { beat: 58, length: 2, pitch: "E4", velocity: 0.07, pan: 0.06, toneIntent: "chord" },
  ];
}

/** Counterline with sigh figures — appears in mirror and return. */
function buildCounterline(): PatternNoteDraft[] {
  const mirrorCell = [
    ...sighingFigure({
      start: positionAtBarBeat(1, 2),
      meter: V2_METER,
      highDegree: 3,
      lowDegree: 2,
      stepSpan: span(0, 0, 1, 2),
      noteSpan: span(0, 1),
      velocity: 0.16,
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
    ...repeatAcrossBars(mirrorCell, {
      startBar: 6,
      repetitions: 3,
      everyBars: 1,
      meter: V2_METER,
      label: "Counterline sigh through mirror section.",
    }),
    withPosition(
      {
        degree: 6,
        velocity: 0.13,
        pan: -0.04,
        toneIntent: "color" as const,
      },
      {
        at: positionAtBarBeat(13, 2),
        duration: span(0, 1),
      },
    ),
    ...repeatAcrossBars(mirrorCell, {
      startBar: 16,
      repetitions: 2,
      everyBars: 1,
      meter: V2_METER,
      label: "Counterline returns in the return section.",
    }),
  ];
}

/** Clockwork broken triads — runs through mirror, ashfall, and return. */
function buildClockworkInner(): PatternNoteDraft[] {
  const mechanismCell = [
    ...brokenTriad({
      start: positionAtBarBeat(1, 1, 1, 2),
      meter: V2_METER,
      beats: 2.5,
      order: [0, 1, 2],
      stepSpan: span(0, 0, 3, 4),
      noteSpan: span(0, 0, 1, 2),
      velocity: 0.11,
      pan: -0.14,
      toneIntent: "chord",
    }),
    ...brokenTriad({
      start: positionAtBarBeat(2, 1, 1, 2),
      meter: V2_METER,
      beats: 2.5,
      order: [2, 1, 0],
      stepSpan: span(0, 0, 3, 4),
      noteSpan: span(0, 0, 1, 2),
      velocity: 0.1,
      pan: 0.14,
      toneIntent: "chord",
    }),
  ];

  return [
    ...repeatAcrossBars(mechanismCell, {
      startBar: 6,
      repetitions: 4,
      everyBars: 2,
      meter: V2_METER,
      label: "Clockwork teeth turn through mirror and ashfall.",
    }),
    ...repeatAcrossBars(mechanismCell, {
      startBar: 16,
      repetitions: 2,
      everyBars: 2,
      meter: V2_METER,
      label: "Clockwork returns in the final return.",
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
          bars: 5,
          sectionId: "v2-mirror",
          label: "the mirror",
        },
        V2_METER,
      ),
      meter: V2_METER,
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
          startBar: 10,
          bars: 5,
          sectionId: "v2-ashfall",
          label: "the ashfall",
        },
        V2_METER,
      ),
      meter: V2_METER,
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
          startBar: 15,
          bars: 4,
          sectionId: "v2-return",
          label: "the return",
        },
        V2_METER,
      ),
      meter: V2_METER,
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
            startBar: 5,
            bars: 5,
            sectionId: "v2-mirror",
            label: "the mirror",
          },
          V2_METER,
        ),
        pitch: "A5",
        duration: span(0, 0, 3, 4),
        velocity: 0.07,
        pan: -0.12,
      },
      {
        at: positionAtBarBeat(12, 1),
        pitch: "C6",
        duration: span(0, 0, 3, 4),
        velocity: 0.06,
        pan: 0.1,
      },
      {
        at: positionAtBarBeat(17, 2),
        pitch: "E6",
        duration: span(0, 0, 3, 4),
        velocity: 0.09,
        pan: 0.12,
      },
      {
        at: cadenceBeat(
          { kind: "phraseEnd", bars: V2_MASTER_BARS, label: "the ember vow" },
          V2_METER,
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
      harmony: harmony.filter((item) => item.tag !== "v2-ashfall"),
      beatsPerBar: V2_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.44, length: 0.78 },
        { beatOffset: 1, intervalSemitones: 7, velocity: 0.14, length: 0.22 },
        { beatOffset: 2, intervalSemitones: 12, velocity: 0.12, length: 0.22 },
      ],
      octaveShift: -12,
    }),
    ...pulseBass({
      harmony: harmony.filter((item) => item.tag === "v2-ashfall"),
      beatsPerBar: V2_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.28, length: 0.82 },
        { beatOffset: 2, intervalSemitones: 7, velocity: 0.14, length: 0.24 },
      ],
      octaveShift: -12,
    }),
    {
      beat: 59,
      length: 1,
      pitch: "A2",
      velocity: 0.32,
      toneIntent: "chord",
    },
  ];
}

// ---------------------------------------------------------------------------
// Lead layers — 14 placements (down from 20)
// ---------------------------------------------------------------------------

function buildLeadLayers(): PhraseLayerPlan[] {
  return withRealization(
    withRhythmRole(
      "flow",
      withVoiceId("lead", [
        // Platform: call → reply → cadence
        {
          kind: "motif" as const,
          id: "v2-platform-call",
          synth: "softLead" as const,
          motif: emberTurn,
          positionOffset: positionAtBarBeat(1, 1),
          register: { min: "E5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "v2-platform-reply",
          synth: "softLead" as const,
          motif: emberReply,
          positionOffset: positionAtBarBeat(2, 1),
          register: { min: "E5", max: "A6", anchor: "G#5" },
          clampToHarmony: true,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "v2-platform-cadence",
          synth: "softLead" as const,
          motif: emberCadence,
          positionOffset: positionAtBarBeat(4, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          rhythmRole: "cadence",
        },

        // Mirror: spin → reply → cadence
        {
          kind: "motif" as const,
          id: "v2-mirror-spin",
          synth: "softLead" as const,
          motif: emberSpin,
          positionOffset: positionAtBarBeat(6, 1),
          register: { min: "E5", max: "B6", anchor: "A5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "v2-mirror-reply",
          synth: "softLead" as const,
          motif: emberReply,
          positionOffset: positionAtBarBeat(8, 1),
          register: { min: "E5", max: "A6", anchor: "G#5" },
          clampToHarmony: true,
          velocityScale: 0.96,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "v2-mirror-cadence",
          synth: "softLead" as const,
          motif: emberCadence,
          positionOffset: positionAtBarBeat(9, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.94,
          rhythmRole: "cadence",
        },

        // Ashfall: slowed → shadow
        {
          kind: "motif" as const,
          id: "v2-ashfall-slowed",
          synth: "softLead" as const,
          motif: emberSlowed,
          positionOffset: positionAtBarBeat(10, 1),
          register: { min: "C5", max: "G6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.78,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "v2-ashfall-shadow",
          synth: "softLead" as const,
          motif: emberShadow,
          positionOffset: positionAtBarBeat(12, 1),
          register: { min: "C5", max: "G6", anchor: "D5" },
          clampToHarmony: true,
          velocityScale: 0.74,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "v2-ashfall-cadence",
          synth: "softLead" as const,
          motif: emberCadence,
          positionOffset: positionAtBarBeat(14, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.76,
          rhythmRole: "cadence",
        },

        // Return: call → reply → cadence
        {
          kind: "motif" as const,
          id: "v2-return-call",
          synth: "softLead" as const,
          motif: emberTurn,
          positionOffset: positionAtBarBeat(15, 1),
          register: { min: "E5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 1.02,
        },
        {
          kind: "motif" as const,
          id: "v2-return-reply",
          synth: "softLead" as const,
          motif: emberReply,
          positionOffset: positionAtBarBeat(16, 1),
          register: { min: "E5", max: "A6", anchor: "G#5" },
          clampToHarmony: true,
          velocityScale: 1.02,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "v2-return-cadence",
          synth: "softLead" as const,
          motif: emberCadence,
          positionOffset: positionAtBarBeat(18, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 1.04,
          rhythmRole: "cadence",
        },

        // Seal
        {
          kind: "motif" as const,
          id: "v2-seal",
          synth: "softLead" as const,
          motif: emberSeal,
          positionOffset: positionAtBarBeat(20, 1),
          register: { min: "D5", max: "A6", anchor: "E5" },
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

function buildCinderV2Plan(): PhrasePlan {
  const harmony = buildHarmony();

  return {
    bars: V2_MASTER_BARS,
    beatsPerBar: V2_BEATS_PER_BAR,
    meter: V2_METER,
    key: { root: "A", scale: "harmonicMinor" },
    harmony,
    sections: [
      {
        id: "v2-platform",
        role: "statement",
        barRole: "arrival",
        startBar: 0,
        bars: 5,
        bias: { density: -0.06, register: -0.04, brightness: -0.06, cadence: 0.92 },
        description: "The carousel introduces the F→G# winding: a memory that winds itself.",
      },
      {
        id: "v2-mirror",
        role: "variation",
        barRole: "continuation",
        startBar: 5,
        bars: 5,
        bias: { density: 0.04, register: 0.06, brightness: 0.02, cadence: 0.98 },
        description: "The same turn glows brighter. The clockwork becomes audible.",
      },
      {
        id: "v2-ashfall",
        role: "shadow",
        barRole: "transition",
        startBar: 10,
        bars: 5,
        bias: { density: -0.22, register: -0.16, brightness: -0.24, cadence: 0.6 },
        description: "The carousel slows to 1.5× — the same music seen as ash and afterimage.",
      },
      {
        id: "v2-return",
        role: "return",
        barRole: "arrival",
        startBar: 15,
        bars: 4,
        bias: { density: 0, register: 0.08, brightness: 0.04, cadence: 1.14 },
        description: "The waltz comes back warm. The clockwork is tenderness now.",
      },
      {
        id: "v2-seal",
        role: "cadence",
        barRole: "cadence",
        startBar: 19,
        bars: 1,
        bias: { density: -0.12, register: 0.04, brightness: -0.04, cadence: 1.34 },
        description: "One last turn drops an octave and seals the loop as ember, not blaze.",
      },
    ],
    cadenceTiming: [
      {
        targetBar: V2_MASTER_BARS,
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
        { beat: 15, value: 0.48 },
        { beat: 30, value: 0.2 },
        { beat: 45, value: 0.52 },
        { beat: 60, value: 0.36 },
      ],
      registerCurve: [
        { beat: 0, value: -0.02 },
        { beat: 15, value: 0.08 },
        { beat: 30, value: -0.18 },
        { beat: 45, value: 0.1 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.28 },
        { beat: 15, value: 0.38 },
        { beat: 30, value: 0.12 },
        { beat: 45, value: 0.42 },
        { beat: 60, value: 0.24 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.18 },
        { beat: 12, value: 0.36 },
        { beat: 27, value: 0.22 },
        { beat: 48, value: 0.78 },
        { beat: 57, value: 0.98 },
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
        register: { min: "A4", max: "E5", anchor: "C5" },
        velocityScale: 0.84,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "v2-clockwork",
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
        id: "v2-ornaments",
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
        id: "v2-bells",
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
        id: "v2-bass",
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
        id: "v2-drone",
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

export const cinderCarouselV2: Composition = buildComposition({
  id: "cinder-carousel-v2",
  title: "Cinder Carousel V2",
  key: { root: "A", scale: "harmonicMinor" },
  bpm: V2_BPM,
  beatsPerBar: V2_BEATS_PER_BAR,
  plan: buildCinderV2Plan(),
});
