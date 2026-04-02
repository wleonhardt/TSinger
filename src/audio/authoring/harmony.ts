import type { ChordQuality } from "../composition";
import {
  buildChordPitches,
  getPitchClass,
  midiToNote,
  noteNameToPitchClass,
  noteToMidi,
  transpose,
} from "../theory";
import type { RegisterRange } from "./types";

const DEFAULT_REGISTER: RegisterRange = {
  min: "C4",
  max: "C6",
  anchor: "A4",
};

const SCALE_INTERVALS: Record<string, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  majorPentatonic: [0, 2, 4, 7, 9],
  pentatonicMajor: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  pentatonicMinor: [0, 3, 5, 7, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};

type AllowedToneOptions = {
  register?: RegisterRange;
  includeChordTones?: boolean;
  includeScaleTones?: boolean;
  includeColorTones?: boolean;
};

type ColorToneOptions = {
  chordRoot: string;
  chordQuality: ChordQuality;
  keyRoot: string;
  scaleName: string;
  register?: RegisterRange;
  anchorPitch?: string;
  preferBright?: boolean;
};

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function uniqueSorted(items: string[]): string[] {
  return [...new Set(items)].sort((left, right) => noteToMidi(left) - noteToMidi(right));
}

function getRegisterOrDefault(register?: RegisterRange): RegisterRange {
  return register ?? DEFAULT_REGISTER;
}

function normalizeScaleName(scaleName: string): string {
  const normalized = scaleName.trim();
  if (SCALE_INTERVALS[normalized]) {
    return normalized;
  }

  return normalized.replace(/\s+/g, "");
}

function buildPitchClassCandidates(
  targetPitchClass: number,
  register: RegisterRange,
): string[] {
  const minMidi = noteToMidi(register.min);
  const maxMidi = noteToMidi(register.max);
  const candidates: string[] = [];

  for (let midi = minMidi; midi <= maxMidi; midi += 1) {
    if (modulo(midi, 12) === targetPitchClass) {
      candidates.push(midiToNote(midi));
    }
  }

  return candidates;
}

function chooseNearest(
  candidates: string[],
  anchorPitch: string,
): string | null {
  if (candidates.length === 0) {
    return null;
  }

  const anchorMidi = noteToMidi(anchorPitch);

  return candidates.reduce((best, candidate) => {
    if (!best) {
      return candidate;
    }

    const bestDistance = Math.abs(noteToMidi(best) - anchorMidi);
    const candidateDistance = Math.abs(noteToMidi(candidate) - anchorMidi);

    if (candidateDistance < bestDistance) {
      return candidate;
    }

    if (candidateDistance === bestDistance && noteToMidi(candidate) > noteToMidi(best)) {
      return candidate;
    }

    return best;
  }, null as string | null);
}

export function getScaleIntervals(scaleName: string): readonly number[] {
  const normalized = normalizeScaleName(scaleName);
  return SCALE_INTERVALS[normalized] ?? SCALE_INTERVALS.minor;
}

export function getScaleDegreePitchClass(
  root: string,
  scaleName: string,
  degree: number,
): number {
  const intervals = getScaleIntervals(scaleName);
  const rootPitchClass = noteNameToPitchClass(root);
  const normalizedDegree = degree - 1;
  const interval = intervals[modulo(normalizedDegree, intervals.length)] ?? 0;

  return modulo(rootPitchClass + interval, 12);
}

export function resolveScaleDegreeToPitch(
  root: string,
  scaleName: string,
  degree: number,
  register?: RegisterRange,
  anchorPitch?: string,
): string {
  const activeRegister = getRegisterOrDefault(register);
  const targetPitchClass = getScaleDegreePitchClass(root, scaleName, degree);
  const candidates = buildPitchClassCandidates(targetPitchClass, activeRegister);
  const anchor = anchorPitch ?? activeRegister.anchor ?? activeRegister.min;
  const chosen = chooseNearest(candidates, anchor);

  if (!chosen) {
    return activeRegister.anchor ?? activeRegister.min;
  }

  return chosen;
}

export function getScalePitches(
  root: string,
  scaleName: string,
  octaveRange: { minOctave: number; maxOctave: number } = {
    minOctave: 3,
    maxOctave: 6,
  },
): string[] {
  const rootPitchClass = noteNameToPitchClass(root);
  const intervals = getScaleIntervals(scaleName);
  const notes: string[] = [];
  const allowedPitchClasses = new Set(
    intervals.map((interval) => modulo(rootPitchClass + interval, 12)),
  );
  const minMidi = octaveRange.minOctave * 12;
  const maxMidi = (octaveRange.maxOctave + 1) * 12 + 11;

  for (let midi = minMidi; midi <= maxMidi; midi += 1) {
    if (allowedPitchClasses.has(modulo(midi, 12))) {
      notes.push(midiToNote(midi));
    }
  }

  return uniqueSorted(notes);
}

export function getChordTones(root: string, quality: ChordQuality): string[] {
  return buildChordPitches(root, quality);
}

export function isChordTone(
  note: string,
  chordRoot: string,
  chordQuality: ChordQuality,
): boolean {
  const pitchClass = getPitchClass(note);
  return getChordTones(chordRoot, chordQuality).some(
    (tone) => getPitchClass(tone) === pitchClass,
  );
}

export function isScaleTone(
  note: string,
  keyRoot: string,
  scaleName: string,
): boolean {
  const pitchClass = getPitchClass(note);
  return getScaleIntervals(scaleName).some(
    (interval) => modulo(noteNameToPitchClass(keyRoot) + interval, 12) === pitchClass,
  );
}

export function getAllowedTonesOverHarmony(
  chordRoot: string,
  chordQuality: ChordQuality,
  keyRoot: string,
  scaleName: string,
  options: AllowedToneOptions = {},
): string[] {
  const register = getRegisterOrDefault(options.register);
  const includeChordTones = options.includeChordTones ?? true;
  const includeScaleTones = options.includeScaleTones ?? true;
  const includeColorTones = options.includeColorTones ?? true;
  const scalePitches = getScalePitches(keyRoot, scaleName, {
    minOctave: Math.floor(noteToMidi(register.min) / 12) - 1,
    maxOctave: Math.floor(noteToMidi(register.max) / 12) - 1,
  }).filter(
    (pitch) => noteToMidi(pitch) >= noteToMidi(register.min) && noteToMidi(pitch) <= noteToMidi(register.max),
  );

  const chordTones = scalePitches.filter((pitch) => isChordTone(pitch, chordRoot, chordQuality));
  const colorTones = scalePitches.filter((pitch) => !isChordTone(pitch, chordRoot, chordQuality));
  const allowed: string[] = [];

  if (includeChordTones) {
    allowed.push(...chordTones);
  }

  if (includeScaleTones) {
    allowed.push(...scalePitches);
  }

  if (includeColorTones) {
    allowed.push(...colorTones);
  }

  return uniqueSorted(allowed);
}

export function pickColorTone({
  chordRoot,
  chordQuality,
  keyRoot,
  scaleName,
  register,
  anchorPitch,
  preferBright = false,
}: ColorToneOptions): string | null {
  const activeRegister = getRegisterOrDefault(register);
  const anchor = anchorPitch ?? activeRegister.anchor ?? activeRegister.min;
  const colorCandidates = getAllowedTonesOverHarmony(
    chordRoot,
    chordQuality,
    keyRoot,
    scaleName,
    {
      register: activeRegister,
      includeChordTones: false,
      includeScaleTones: false,
      includeColorTones: true,
    },
  );

  if (colorCandidates.length === 0) {
    return null;
  }

  const ordered = [...colorCandidates].sort((left, right) => {
    const leftDistance = Math.abs(noteToMidi(left) - noteToMidi(anchor));
    const rightDistance = Math.abs(noteToMidi(right) - noteToMidi(anchor));

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    if (preferBright) {
      return noteToMidi(right) - noteToMidi(left);
    }

    return noteToMidi(left) - noteToMidi(right);
  });

  return ordered[0] ?? null;
}

export function getTendencyTone(
  chordRoot: string,
  chordQuality: ChordQuality,
  keyRoot: string,
  scaleName: string,
): string | null {
  const colorTone = pickColorTone({
    chordRoot,
    chordQuality,
    keyRoot,
    scaleName,
    preferBright: true,
  });

  if (colorTone) {
    return colorTone;
  }

  if (chordQuality === "major" || chordQuality === "minor") {
    return transpose(chordRoot, 11);
  }

  return null;
}
