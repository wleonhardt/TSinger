import { compilePhrasePlan } from "../authoring/compile";
import {
  makeAnswerPhrase,
  retrograde,
  sequence,
  invertMotif,
} from "../authoring/motifs";
import {
  brokenTriad,
  pentatonicFlourish,
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
// Pinwheel Circuit V2
//
// Same soul: G mixolydian, 4/4, 102 BPM, swing16, bright kinetic playfulness.
//
// What changed:
// - The hook leans into the mixolydian b7: the 5-note figure now explicitly
//   uses the F natural (offset 6 from G = the b7) as the climax note.
// - Harmony introduces F major and Cmaj7 for genuine mixolydian color
//   instead of cycling the same 4 chords. The crosswind section uses a
//   bVII-IV-I (F→C→G) progression that's distinctly mixolydian.
// - The crosswind section gets a genuinely new counter-theme (invertMotif
//   of the hook reflected around scale degree 4) instead of the same
//   retrograde used twice.
// - Uses pentatonicFlourish in the overclock section for new texture.
// - Bass patterns have more syncopation and section-specific character.
// - The sidelight shadow thins to 2 lead placements (not 4) for real space.
// ---------------------------------------------------------------------------

const V2_BPM = 102;
const V2_BEATS_PER_BAR = 4;
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

// ---------------------------------------------------------------------------
// Motifs — mixolydian b7 hook
// ---------------------------------------------------------------------------

/** Primary hook: 5 notes with the F natural (b7) as the peak note at beat 3.
 *  The passing tone at beat 2.25 creates anticipation before the b7 lands. */
const sparkHook: Motif = {
  anchorDegree: 1,
  steps: [
    {
      beat: 0,
      length: 0.44,
      offset: 0,
      velocity: 0.66,
      pan: -0.1,
      toneIntent: "chord",
    },
    {
      beat: 0.75,
      length: 0.3,
      offset: 2,
      velocity: 0.56,
      pan: -0.02,
      toneIntent: "scale",
    },
    {
      beat: 1.5,
      length: 0.38,
      offset: 4,
      velocity: 0.62,
      pan: 0.06,
      toneIntent: "chord",
    },
    {
      beat: 2.25,
      length: 0.26,
      offset: 5,
      velocity: 0.54,
      pan: 0.1,
      toneIntent: "passing",
    },
    {
      beat: 3,
      length: 0.86,
      offset: 6,
      velocity: 0.72,
      pan: 0.14,
      toneIntent: "color",
      // offset 6 from G in mixolydian = F natural (the b7)
    },
  ],
};

/** Answer phrase: shifted up a 3rd with subtle rhythmic variation. */
const sparkAnswer = scaleMotifVelocities(
  mapMotifSteps(makeAnswerPhrase(sparkHook, { scaleSteps: 3 }), (step, index) => ({
    ...step,
    beat: step.beat + (index === 0 ? 0.1 : 0),
    length: index === 4 ? 0.94 : step.length,
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 2 ? 0.98 : 0.92)
        : step.velocity,
  })),
  0.96,
);

/** Doubled sequence for the braid section. */
const sparkBraid = scaleMotifVelocities(
  mapMotifSteps(sequence(sparkHook, { scaleSteps: 1 }, 2), (step, index) => ({
    ...step,
    beat: step.beat + (index >= 5 ? 0.15 : 0),
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index >= 5 ? 0.88 : 1)
        : step.velocity,
  })),
  0.9,
);

/** Inverted counter-theme for the crosswind — the hook reflected around
 *  scale degree 4, creating a descending mirror that moves in opposite
 *  melodic direction. */
const sparkMirror = scaleMotifVelocities(
  mapMotifSteps(invertMotif(sparkHook, 4), (step, index) => ({
    ...step,
    beat: step.beat + 0.12,
    length: step.length * (index === 0 ? 1.15 : 1.02),
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.82 : 0.86)
        : step.velocity,
  })),
  0.88,
);

/** Retrograde detour — used once in the sidelight, not twice. */
const sparkDetour = scaleMotifVelocities(
  mapMotifSteps(retrograde(sparkHook), (step, index) => ({
    ...step,
    beat: step.beat + 0.18,
    length: step.length * (index === 0 ? 1.2 : 1.04),
    velocity:
      step.velocity !== undefined
        ? step.velocity * (index === 0 ? 0.74 : 0.82)
        : step.velocity,
  })),
  0.86,
);

/** Latch/cadence motif: descending from degree 5 with the b7 as a passing
 *  tone on the way down. */
const sparkLatch: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.36,
      offset: 0,
      velocity: 0.6,
      pan: -0.08,
      toneIntent: "chord",
    },
    {
      beat: 0.75,
      length: 0.3,
      offset: -1,
      velocity: 0.54,
      pan: -0.02,
      toneIntent: "scale",
    },
    {
      beat: 1.5,
      length: 0.34,
      offset: -2,
      velocity: 0.58,
      pan: 0.04,
      toneIntent: "passing",
    },
    {
      beat: 2.25,
      length: 0.32,
      offset: -3,
      velocity: 0.56,
      pan: 0.08,
      toneIntent: "scale",
    },
    {
      beat: 3,
      length: 1.0,
      offset: -4,
      velocity: 0.74,
      pan: 0.14,
      toneIntent: "chord",
    },
  ],
};

/** Seal: latch with wider final drop. */
const sparkSeal: Motif = {
  anchorDegree: 5,
  steps: [
    {
      beat: 0,
      length: 0.36,
      offset: 0,
      velocity: 0.58,
      pan: -0.06,
      toneIntent: "chord",
    },
    {
      beat: 0.75,
      length: 0.28,
      offset: -1,
      velocity: 0.52,
      pan: -0.02,
      toneIntent: "scale",
    },
    {
      beat: 1.5,
      length: 0.38,
      offset: -2,
      velocity: 0.6,
      pan: 0.06,
      toneIntent: "passing",
    },
    {
      beat: 2.25,
      length: 0.34,
      offset: -3,
      velocity: 0.58,
      pan: 0.1,
      toneIntent: "scale",
    },
    {
      beat: 3,
      length: 1.1,
      offset: -6,
      velocity: 0.84,
      pan: 0.16,
      toneIntent: "chord",
    },
  ],
};

// ---------------------------------------------------------------------------
// Harmony — genuine mixolydian progressions
// ---------------------------------------------------------------------------

function buildHarmony(): HarmonyPlanItem[] {
  return [
    // Spark (bars 0–3): G → Em7 → C → Dsus2
    { bar: 0, root: "G4", quality: "add9", velocity: 0.19, spread: 0.01, tag: "v2-spark" },
    { bar: 1, root: "E4", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "v2-spark" },
    { bar: 2, root: "C4", quality: "add9", velocity: 0.19, spread: 0.01, tag: "v2-spark" },
    { bar: 3, root: "D4", quality: "sus2", velocity: 0.2, spread: 0.01, tag: "v2-spark" },

    // Braid (bars 4–7): G → Em7 → F → C
    { bar: 4, root: "G4", quality: "add9", velocity: 0.2, spread: 0.01, tag: "v2-braid" },
    { bar: 5, root: "E4", quality: "minor7", velocity: 0.18, spread: 0.01, tag: "v2-braid" },
    { bar: 6, root: "F4", quality: "major", velocity: 0.19, spread: 0.01, tag: "v2-braid" },
    { bar: 7, root: "C4", quality: "major7", velocity: 0.19, spread: 0.01, tag: "v2-braid" },

    // Crosswind (bars 8–11): F → C → G → Dsus2 (bVII-IV-I motion)
    { bar: 8, root: "F4", quality: "major", velocity: 0.18, spread: 0.01, tag: "v2-crosswind" },
    { bar: 9, root: "C4", quality: "add9", velocity: 0.18, spread: 0.01, tag: "v2-crosswind" },
    { bar: 10, root: "G4", quality: "add9", velocity: 0.18, spread: 0.01, tag: "v2-crosswind" },
    { bar: 11, root: "D4", quality: "sus2", velocity: 0.18, spread: 0.01, tag: "v2-crosswind" },

    // Sidelight (bars 12–15): C → Em7 → F → Dsus2
    { bar: 12, root: "C4", quality: "major7", velocity: 0.16, spread: 0.01, tag: "v2-sidelight" },
    { bar: 13, root: "E4", quality: "minor7", velocity: 0.16, spread: 0.01, tag: "v2-sidelight" },
    { bar: 14, root: "F4", quality: "major", velocity: 0.17, spread: 0.01, tag: "v2-sidelight" },
    { bar: 15, root: "D4", quality: "sus2", velocity: 0.17, spread: 0.01, tag: "v2-sidelight" },

    // Overclock (bars 16–18): G → F → Dsus2
    { bar: 16, root: "G4", quality: "add9", velocity: 0.22, spread: 0.01, tag: "v2-overclock" },
    { bar: 17, root: "F4", quality: "major", velocity: 0.2, spread: 0.01, tag: "v2-overclock" },
    { bar: 18, root: "D4", quality: "sus2", velocity: 0.22, spread: 0.01, tag: "v2-overclock" },

    // Latch (bar 19): G
    { bar: 19, root: "G4", quality: "major", velocity: 0.25, spread: 0.01, tag: "v2-latch" },
  ];
}

// ---------------------------------------------------------------------------
// Supporting layers
// ---------------------------------------------------------------------------

function buildDrone(): PatternNoteDraft[] {
  return [
    { beat: 0, length: 16, pitch: "G3", velocity: 0.1, pan: -0.08, toneIntent: "chord" },
    { beat: 0, length: 16, pitch: "D4", velocity: 0.05, pan: 0.08, toneIntent: "chord" },
    { beat: 16, length: 16, pitch: "F3", velocity: 0.09, pan: -0.08, toneIntent: "chord" },
    { beat: 16, length: 16, pitch: "C4", velocity: 0.04, pan: 0.08, toneIntent: "chord" },
    { beat: 32, length: 16, pitch: "C3", velocity: 0.08, pan: -0.06, toneIntent: "chord" },
    { beat: 32, length: 16, pitch: "G3", velocity: 0.04, pan: 0.06, toneIntent: "chord" },
    { beat: 48, length: 16, pitch: "F3", velocity: 0.08, pan: -0.06, toneIntent: "chord" },
    { beat: 48, length: 16, pitch: "C4", velocity: 0.04, pan: 0.06, toneIntent: "chord" },
    { beat: 64, length: 15, pitch: "G3", velocity: 0.11, pan: -0.08, toneIntent: "chord" },
    { beat: 64, length: 15, pitch: "D4", velocity: 0.05, pan: 0.08, toneIntent: "chord" },
  ];
}

/** Counterline with broken triads and sigh figures — more present. */
function buildCounterline(): PatternNoteDraft[] {
  const braidFigure = [
    ...brokenTriad({
      start: positionAtBarBeat(1, 2, 1, 4),
      meter: V2_METER,
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
      meter: V2_METER,
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
      repetitions: 3,
      everyBars: 1,
      meter: V2_METER,
      label: "Counterline braid through the braid section.",
    }),
    ...brokenTriad({
      start: positionAtBarBeat(9, 2),
      meter: V2_METER,
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
      meter: V2_METER,
      highDegree: 5,
      lowDegree: 4,
      stepSpan: { subdivisions: 2, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 2 },
      velocity: 0.13,
      pan: 0.08,
    }),
    ...repeatAcrossBars(braidFigure, {
      startBar: 17,
      repetitions: 2,
      everyBars: 1,
      meter: V2_METER,
      label: "Counterline returns in overclock.",
    }),
  ];
}

/** Rotor inner layer — changes character per section. */
function buildRotorInner(): PatternNoteDraft[] {
  const sparkCell = [
    withPosition(
      { degree: 5, velocity: 0.18, pan: -0.16, toneIntent: "scale" as const },
      { at: positionAtBarBeat(1, 1, 1, 4), duration: span(0, 0, 1, 4) },
    ),
    withPosition(
      { degree: 3, velocity: 0.16, pan: 0.12, toneIntent: "passing" as const },
      { at: positionAtBarBeat(1, 2, 3, 4), duration: span(0, 0, 1, 4) },
    ),
    withPosition(
      { degree: 6, velocity: 0.14, pan: -0.08, toneIntent: "color" as const },
      { at: positionAtBarBeat(1, 4, 1, 4), duration: span(0, 0, 1, 4) },
    ),
  ];

  const crosswindCell = [
    withPosition(
      { degree: 4, velocity: 0.15, pan: -0.12, toneIntent: "scale" as const },
      { at: positionAtBarBeat(1, 1, 1, 4), duration: span(0, 0, 1, 4) },
    ),
    withPosition(
      { degree: 6, velocity: 0.14, pan: 0.08, toneIntent: "color" as const },
      { at: positionAtBarBeat(1, 2, 2, 4), duration: span(0, 0, 1, 4) },
    ),
    withPosition(
      { degree: 2, velocity: 0.15, pan: -0.04, toneIntent: "scale" as const },
      { at: positionAtBarBeat(1, 3, 3, 4), duration: span(0, 0, 1, 4) },
    ),
  ];

  const sidelightCell = [
    withPosition(
      { degree: 3, velocity: 0.11, pan: -0.08, toneIntent: "passing" as const },
      { at: positionAtBarBeat(1, 2, 1, 4), duration: span(0, 0, 1, 4) },
    ),
    withPosition(
      { degree: 6, velocity: 0.1, pan: 0.1, toneIntent: "color" as const },
      { at: positionAtBarBeat(1, 4, 2, 4), duration: span(0, 0, 1, 4) },
    ),
  ];

  const overclockCell = [
    withPosition(
      { degree: 5, velocity: 0.2, pan: -0.14, toneIntent: "scale" as const },
      { at: positionAtBarBeat(1, 1, 1, 4), duration: span(0, 0, 1, 4) },
    ),
    withPosition(
      { degree: 2, velocity: 0.17, pan: 0.08, toneIntent: "passing" as const },
      { at: positionAtBarBeat(1, 2, 3, 4), duration: span(0, 0, 1, 4) },
    ),
    withPosition(
      { degree: 4, velocity: 0.17, pan: -0.04, toneIntent: "scale" as const },
      { at: positionAtBarBeat(1, 3, 1, 4), duration: span(0, 0, 1, 4) },
    ),
    withPosition(
      { degree: 6, velocity: 0.18, pan: 0.12, toneIntent: "color" as const },
      { at: positionAtBarBeat(1, 4, 1, 4), duration: span(0, 0, 1, 4) },
    ),
  ];

  return [
    ...repeatAcrossBars(sparkCell, {
      startBar: 1,
      repetitions: 7,
      meter: V2_METER,
      label: "Rotor spark through first half.",
    }),
    ...repeatAcrossBars(crosswindCell, {
      startBar: 9,
      repetitions: 3,
      meter: V2_METER,
      label: "Crosswind rotor shifts accents.",
    }),
    ...repeatAcrossBars(sidelightCell, {
      startBar: 13,
      repetitions: 3,
      meter: V2_METER,
      label: "Sidelight strips rotor down.",
    }),
    ...repeatAcrossBars(overclockCell, {
      startBar: 17,
      repetitions: 3,
      meter: V2_METER,
      label: "Overclock tightens the spin.",
    }),
  ];
}

/** Pentatonic flourish in the overclock — new texture. */
function buildOverclockFlourish(): PatternNoteDraft[] {
  return [
    ...pentatonicFlourish({
      start: positionAtBarBeat(17, 3, 1, 2),
      meter: V2_METER,
      degrees: [5, 6, 8, 6, 5],
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
      velocity: 0.14,
      pan: 0.08,
      ornament: true,
    }),
    ...pentatonicFlourish({
      start: positionAtBarBeat(18, 3, 1, 2),
      meter: V2_METER,
      degrees: [6, 8, 6, 5, 3],
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
      velocity: 0.15,
      pan: -0.06,
      ornament: true,
    }),
  ];
}

function buildOrnaments(): PatternNoteDraft[] {
  return [
    ...turnFigure({
      start: pickupBefore(
        { kind: "sectionStart", startBar: 5, bars: 4, sectionId: "v2-braid", label: "the braid" },
        V2_METER,
      ),
      meter: V2_METER,
      centerDegree: 5,
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
      velocity: 0.11,
      pan: 0.18,
    }),
    ...turnFigure({
      start: pickupBefore(
        { kind: "sectionStart", startBar: 9, bars: 4, sectionId: "v2-crosswind", label: "the crosswind" },
        V2_METER,
      ),
      meter: V2_METER,
      centerDegree: 4,
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
      velocity: 0.1,
      pan: -0.14,
    }),
    ...turnFigure({
      start: pickupBefore(
        { kind: "sectionStart", startBar: 17, bars: 3, sectionId: "v2-overclock", label: "the overclock" },
        V2_METER,
      ),
      meter: V2_METER,
      centerDegree: 6,
      stepSpan: { subdivisions: 1, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 4 },
      velocity: 0.12,
      pan: 0.16,
    }),
    ...sighingFigure({
      start: positionAtBarBeat(14, 4),
      meter: V2_METER,
      highDegree: 6,
      lowDegree: 5,
      stepSpan: { subdivisions: 2, subdivisionUnit: 4 },
      noteSpan: { subdivisions: 1, subdivisionUnit: 2 },
      velocity: 0.09,
      pan: -0.08,
    }),
    ...buildOverclockFlourish(),
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
          { kind: "sectionStart", startBar: 9, bars: 4, sectionId: "v2-crosswind", label: "the crosswind" },
          V2_METER,
        ),
        pitch: "F6",
        duration: span(0, 0, 3, 4),
        velocity: 0.1,
        pan: 0.12,
      },
      {
        at: positionAtBarBeat(11, 4),
        pitch: "B5",
        duration: span(0, 1),
        velocity: 0.09,
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
          { kind: "phraseEnd", bars: V2_MASTER_BARS, label: "the latch" },
          V2_METER,
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
        (item) => item.tag === "v2-spark" || item.tag === "v2-braid",
      ),
      beatsPerBar: V2_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.44, length: 0.62 },
        { beatOffset: 1.75, intervalSemitones: 7, velocity: 0.18, length: 0.18 },
        { beatOffset: 2.5, intervalSemitones: 12, velocity: 0.14, length: 0.2 },
        { beatOffset: 3.25, intervalSemitones: 7, velocity: 0.16, length: 0.18 },
      ],
      octaveShift: -12,
    }),
    ...pulseBass({
      harmony: harmony.filter((item) => item.tag === "v2-crosswind"),
      beatsPerBar: V2_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.36, length: 0.72 },
        { beatOffset: 1.5, intervalSemitones: 5, velocity: 0.16, length: 0.18 },
        { beatOffset: 2.75, intervalSemitones: 7, velocity: 0.18, length: 0.2 },
      ],
      octaveShift: -12,
    }),
    ...pulseBass({
      harmony: harmony.filter((item) => item.tag === "v2-sidelight"),
      beatsPerBar: V2_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.28, length: 0.78 },
        { beatOffset: 3, intervalSemitones: 7, velocity: 0.12, length: 0.16 },
      ],
      octaveShift: -12,
    }),
    ...pulseBass({
      harmony: harmony.filter(
        (item) => item.tag === "v2-overclock" || item.tag === "v2-latch",
      ),
      beatsPerBar: V2_BEATS_PER_BAR,
      pattern: [
        { beatOffset: 0, intervalSemitones: 0, velocity: 0.48, length: 0.64 },
        { beatOffset: 1.5, intervalSemitones: 5, velocity: 0.18, length: 0.18 },
        { beatOffset: 2.5, intervalSemitones: 12, velocity: 0.16, length: 0.18 },
        { beatOffset: 3.25, intervalSemitones: 7, velocity: 0.2, length: 0.2 },
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

// ---------------------------------------------------------------------------
// Lead layers — sidelight thins to 2 placements
// ---------------------------------------------------------------------------

function buildLeadLayers(): PhraseLayerPlan[] {
  return withRealization(
    withRhythmRole(
      "flow",
      withVoiceId("lead", [
        // Spark: hook → answer → latch
        {
          kind: "motif" as const,
          id: "v2-spark-hook",
          synth: "softLead" as const,
          motif: sparkHook,
          positionOffset: positionAtBarBeat(1, 1),
          register: { min: "D5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "v2-spark-answer",
          synth: "softLead" as const,
          motif: sparkAnswer,
          positionOffset: positionAtBarBeat(2, 1),
          register: { min: "E5", max: "C7", anchor: "A5" },
          clampToHarmony: true,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "v2-spark-latch",
          synth: "softLead" as const,
          motif: sparkLatch,
          positionOffset: positionAtBarBeat(4, 1),
          register: { min: "D5", max: "A6", anchor: "G5" },
          clampToHarmony: true,
          rhythmRole: "cadence",
        },

        // Braid: braid → answer → latch
        {
          kind: "motif" as const,
          id: "v2-braid-spiral",
          synth: "softLead" as const,
          motif: sparkBraid,
          positionOffset: positionAtBarBeat(5, 1),
          register: { min: "E5", max: "D7", anchor: "A5" },
          clampToHarmony: true,
        },
        {
          kind: "motif" as const,
          id: "v2-braid-answer",
          synth: "softLead" as const,
          motif: sparkAnswer,
          positionOffset: positionAtBarBeat(7, 1),
          register: { min: "E5", max: "C7", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 0.96,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "v2-braid-latch",
          synth: "softLead" as const,
          motif: sparkLatch,
          positionOffset: positionAtBarBeat(8, 1),
          register: { min: "D5", max: "A6", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 0.98,
          rhythmRole: "cadence",
        },

        // Crosswind: mirror × 2 → braid → latch (new counter-theme)
        {
          kind: "motif" as const,
          id: "v2-crosswind-mirror-a",
          synth: "softLead" as const,
          motif: sparkMirror,
          positionOffset: positionAtBarBeat(9, 1),
          register: { min: "C5", max: "A6", anchor: "F5" },
          clampToHarmony: true,
          velocityScale: 0.86,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "v2-crosswind-mirror-b",
          synth: "softLead" as const,
          motif: sparkMirror,
          positionOffset: positionAtBarBeat(10, 1),
          register: { min: "C5", max: "A6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.82,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "v2-crosswind-braid",
          synth: "softLead" as const,
          motif: sparkBraid,
          positionOffset: positionAtBarBeat(11, 1),
          register: { min: "D5", max: "C7", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 0.86,
        },

        // Sidelight: only 2 placements — detour + answer-hush
        {
          kind: "motif" as const,
          id: "v2-sidelight-detour",
          synth: "softLead" as const,
          motif: sparkDetour,
          positionOffset: positionAtBarBeat(13, 1),
          register: { min: "C5", max: "G6", anchor: "E5" },
          clampToHarmony: true,
          velocityScale: 0.74,
          rhythmRole: "suspension",
        },
        {
          kind: "motif" as const,
          id: "v2-sidelight-answer-hush",
          synth: "softLead" as const,
          motif: sparkAnswer,
          positionOffset: positionAtBarBeat(15, 1),
          register: { min: "D5", max: "B6", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 0.74,
          rhythmRole: "response",
        },

        // Overclock: braid → answer → latch
        {
          kind: "motif" as const,
          id: "v2-overclock-braid",
          synth: "softLead" as const,
          motif: sparkBraid,
          positionOffset: positionAtBarBeat(17, 1),
          register: { min: "E5", max: "D7", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 1.04,
        },
        {
          kind: "motif" as const,
          id: "v2-overclock-answer",
          synth: "softLead" as const,
          motif: sparkAnswer,
          positionOffset: positionAtBarBeat(18, 1),
          register: { min: "E5", max: "C7", anchor: "A5" },
          clampToHarmony: true,
          velocityScale: 1.06,
          rhythmRole: "response",
        },
        {
          kind: "motif" as const,
          id: "v2-overclock-latch",
          synth: "softLead" as const,
          motif: sparkLatch,
          positionOffset: positionAtBarBeat(19, 1),
          register: { min: "D5", max: "A6", anchor: "G5" },
          clampToHarmony: true,
          velocityScale: 1.06,
          rhythmRole: "cadence",
        },

        // Seal
        {
          kind: "motif" as const,
          id: "v2-seal",
          synth: "softLead" as const,
          motif: sparkSeal,
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

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

function buildPinwheelV2Plan(): PhrasePlan {
  const harmony = buildHarmony();

  return {
    bars: V2_MASTER_BARS,
    beatsPerBar: V2_BEATS_PER_BAR,
    meter: V2_METER,
    swing: { kind: "swing16", amount: 0.6 },
    key: { root: "G", scale: "mixolydian" },
    harmony,
    sections: [
      {
        id: "v2-spark",
        role: "statement",
        barRole: "arrival",
        startBar: 0,
        bars: 4,
        bias: { density: -0.02, register: 0, brightness: 0.04, cadence: 0.94 },
        description: "The b7 hook spins up: five notes with the F natural as its peak.",
      },
      {
        id: "v2-braid",
        role: "answer",
        barRole: "continuation",
        startBar: 4,
        bars: 4,
        bias: { density: 0.08, register: 0.1, brightness: 0.08, cadence: 0.98 },
        description: "The hook doubles and the F major harmony makes the mixolydian explicit.",
      },
      {
        id: "v2-crosswind",
        role: "bridge",
        barRole: "transition",
        startBar: 8,
        bars: 4,
        bias: { density: 0.02, register: 0.12, brightness: 0.02, cadence: 0.84 },
        description: "The inverted counter-theme arrives over bVII-IV-I. A new angle on the same spin.",
      },
      {
        id: "v2-sidelight",
        role: "shadow",
        barRole: "transition",
        startBar: 12,
        bars: 4,
        bias: { density: -0.22, register: -0.14, brightness: -0.18, cadence: 0.56 },
        description: "Two motifs and silence. The machine is seen from the side.",
      },
      {
        id: "v2-overclock",
        role: "return",
        barRole: "arrival",
        startBar: 16,
        bars: 3,
        bias: { density: 0.14, register: 0.14, brightness: 0.14, cadence: 1.14 },
        description: "Everything locks back tighter with pentatonic flourishes and the b7 blazing.",
      },
      {
        id: "v2-latch",
        role: "cadence",
        barRole: "cadence",
        startBar: 19,
        bars: 1,
        bias: { density: -0.08, register: 0.06, brightness: 0.02, cadence: 1.34 },
        description: "A single latched bar snaps shut and throws itself open again.",
      },
    ],
    cadenceTiming: [
      {
        targetBar: V2_MASTER_BARS,
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
        { beat: 16, value: 0.58 },
        { beat: 32, value: 0.5 },
        { beat: 48, value: 0.22 },
        { beat: 64, value: 0.66 },
        { beat: 80, value: 0.46 },
      ],
      registerCurve: [
        { beat: 0, value: 0 },
        { beat: 16, value: 0.08 },
        { beat: 32, value: 0.14 },
        { beat: 48, value: -0.16 },
        { beat: 64, value: 0.18 },
      ],
      brightnessCurve: [
        { beat: 0, value: 0.5 },
        { beat: 16, value: 0.64 },
        { beat: 32, value: 0.58 },
        { beat: 48, value: 0.24 },
        { beat: 64, value: 0.72 },
        { beat: 80, value: 0.48 },
      ],
      cadenceCurve: [
        { beat: 0, value: 0.24 },
        { beat: 16, value: 0.42 },
        { beat: 32, value: 0.54 },
        { beat: 48, value: 0.22 },
        { beat: 68, value: 0.8 },
        { beat: 76, value: 0.98 },
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
        register: { min: "G4", max: "D6", anchor: "B4" },
        velocityScale: 0.84,
        clampToHarmony: true,
      },
      {
        kind: "draft",
        id: "v2-rotor",
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
        id: "v2-ornaments",
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
        id: "v2-bells",
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
        id: "v2-bass",
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
        id: "v2-drone",
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

export const pinwheelCircuitV2: Composition = buildComposition({
  id: "pinwheel-circuit-v2",
  title: "Pinwheel Circuit V2",
  key: { root: "G", scale: "mixolydian" },
  bpm: V2_BPM,
  beatsPerBar: V2_BEATS_PER_BAR,
  plan: buildPinwheelV2Plan(),
});
