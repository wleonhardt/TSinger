import { compilePhrasePlan } from "../authoring/compile";
import type {
  HarmonyPlanItem,
  PatternNoteDraft,
  PhrasePlan,
} from "../authoring/types";
import type { Composition } from "../composition";
import { scalePhraseDynamics } from "./helpers";

// ---------------------------------------------------------------------------
// Stillwater
//
// E dorian, 4/4, 76 BPM, 8 bars.
//
// A slow ambient loop built on four voices: a warm pad tracing the chord
// progression, a softLead melody that rises to the dorian C# then descends
// home, a round bass alternating roots and fifths, and a single breathing
// drone on E that sustains beneath everything.  Two glassBell accents
// add a tiny sparkle in the melodic gaps.
//
// Harmony: Em7 → Cmaj7 → Am(add9) → Bm
// The progression descends (E → C → A) then lifts (B) to resolve back
// to E on the loop boundary — a natural V → i pull.
// ---------------------------------------------------------------------------

const BPM = 76;
const BEATS_PER_BAR = 4;
const BARS = 8;

const harmony: HarmonyPlanItem[] = [
  { bar: 0, root: "E3", quality: "minor7", lengthBars: 2, velocity: 0.22 },
  { bar: 2, root: "C3", quality: "major7", lengthBars: 2, velocity: 0.25 },
  { bar: 4, root: "A3", quality: "minorAdd9", lengthBars: 2, velocity: 0.27 },
  { bar: 6, root: "B2", quality: "minor", lengthBars: 2, velocity: 0.24 },
];

// -- Melody (softLead) ------------------------------------------------------
// Contour: B4 → descend to G4 → rise through E5 → touch C#5 (dorian) →
// descend to F#4 → settle on B4.  Ends where it starts for seamless loop.

const melodyNotes: PatternNoteDraft[] = [
  // Bars 0–1 (Em7)
  { beat: 1, length: 2.5, degree: 5, velocity: 0.52, pan: -0.1, toneIntent: "chord" },
  { beat: 3.5, length: 1.2, degree: 4, velocity: 0.40, pan: 0.05, toneIntent: "scale" },
  { beat: 5.5, length: 2.0, degree: 3, velocity: 0.45, pan: -0.05, toneIntent: "chord" },

  // Bars 2–3 (Cmaj7) — rising to the peak
  { beat: 9, length: 2.0, degree: 5, velocity: 0.50, pan: 0.08, toneIntent: "chord" },
  { beat: 12, length: 2.5, degree: 1, velocity: 0.56, pan: -0.08, toneIntent: "chord" },

  // Bars 4–5 (Am add9) — the dorian moment
  { beat: 16.5, length: 2.5, degree: 6, velocity: 0.54, pan: 0.1, toneIntent: "color" },
  { beat: 19.5, length: 1.5, degree: 4, velocity: 0.40, pan: -0.05, toneIntent: "scale" },
  { beat: 21, length: 2.0, degree: 3, velocity: 0.42, pan: 0.0, toneIntent: "chord" },

  // Bars 6–7 (Bm) — descent and resolution
  { beat: 24.5, length: 1.5, degree: 2, velocity: 0.48, pan: -0.1, toneIntent: "chord" },
  { beat: 26.5, length: 1.0, degree: 4, velocity: 0.42, pan: 0.08, toneIntent: "scale" },
  { beat: 28, length: 3.0, degree: 5, velocity: 0.52, pan: 0.0, toneIntent: "chord" },
];

// -- Bass (roundBass) -------------------------------------------------------
// Root on the downbeat of each chord, fifth halfway through the second bar.

const bassNotes: PatternNoteDraft[] = [
  { beat: 0, length: 3.2, pitch: "E2", velocity: 0.44 },
  { beat: 4.5, length: 2.5, pitch: "B2", velocity: 0.30 },
  { beat: 8, length: 3.2, pitch: "C2", velocity: 0.42 },
  { beat: 12.5, length: 2.5, pitch: "G2", velocity: 0.28 },
  { beat: 16, length: 3.2, pitch: "A1", velocity: 0.42 },
  { beat: 20.5, length: 2.5, pitch: "E2", velocity: 0.30 },
  { beat: 24, length: 3.2, pitch: "B1", velocity: 0.44 },
  { beat: 29, length: 2.5, pitch: "F#2", velocity: 0.34 },
];

// -- Bell accents (glassBell) -----------------------------------------------
// Two notes placed in melodic gaps for a faint sparkle.

const bellNotes: PatternNoteDraft[] = [
  { beat: 14, length: 0.6, pitch: "B5", velocity: 0.18, pan: 0.15, toneIntent: "chord" },
  { beat: 22.5, length: 0.6, pitch: "E5", velocity: 0.16, pan: -0.12, toneIntent: "chord" },
];

// -- Phrase plan ------------------------------------------------------------

const plan: PhrasePlan = {
  bars: BARS,
  beatsPerBar: BEATS_PER_BAR,
  key: { root: "E", scale: "dorian" },
  harmony,

  sections: [
    { id: "settle", role: "statement", startBar: 0, bars: 4, description: "Opening — pad and melody establish the world" },
    { id: "color", role: "bridge", startBar: 4, bars: 2, description: "Dorian C# moment — emotional peak" },
    { id: "resolve", role: "cadence", startBar: 6, bars: 2, description: "Descent back to B, ready to loop" },
  ],

  padLayers: [
    { synth: "warmPad", voiceId: "pad", velocityScale: 0.8 },
  ],

  noteLayers: [
    {
      kind: "draft",
      id: "melody",
      synth: "softLead",
      voiceId: "lead",
      register: { min: "E4", max: "E6", anchor: "B4" },
      notes: melodyNotes,
    },
    {
      kind: "draft",
      id: "bass",
      synth: "roundBass",
      voiceId: "bass",
      register: { min: "A1", max: "E3", anchor: "E2" },
      notes: bassNotes,
    },
    {
      kind: "draft",
      id: "drone",
      synth: "breathingDrone",
      voiceId: "drone",
      register: { min: "E2", max: "E3", anchor: "E2" },
      notes: [
        { beat: 0, length: 32, pitch: "E2", velocity: 0.20 },
      ],
    },
    {
      kind: "draft",
      id: "bells",
      synth: "glassBell",
      voiceId: "bells",
      register: { min: "E5", max: "E7", anchor: "B5" },
      notes: bellNotes,
    },
  ],

  arrangement: {
    densityCurve: [
      { beat: 0, value: 0.5 },
      { beat: 12, value: 0.7 },
      { beat: 20, value: 0.6 },
      { beat: 28, value: 0.5 },
    ],
    brightnessCurve: [
      { beat: 0, value: 0.4 },
      { beat: 12, value: 0.6 },
      { beat: 20, value: 0.55 },
      { beat: 28, value: 0.4 },
    ],
  },
};

// -- Build ------------------------------------------------------------------

const compiled = compilePhrasePlan(plan);
const phrase = scalePhraseDynamics(
  { bars: BARS, notes: compiled.notes, chords: compiled.chords },
  { noteScale: 0.95, chordScale: 0.8 },
);

export const stillwater: Composition = {
  id: "stillwater",
  title: "Stillwater",
  bpm: BPM,
  beatsPerBar: BEATS_PER_BAR,
  key: { root: "E", scale: "dorian" },
  loop: true,
  sections: compiled.sections.length > 0 ? compiled.sections : undefined,
  phrase,
  timing: compiled.timing,
  rhythm: compiled.rhythm,
};
