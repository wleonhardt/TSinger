import type { ChordQuality } from "./composition";

const NOTE_PATTERN = /^([A-Ga-g])([#b]?)(-?\d+)$/;

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const SHARP_NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  add9: [0, 4, 7, 14],
  minorAdd9: [0, 3, 7, 14],
};

type ParsedNote = {
  noteName: string;
  octave: number;
};

function parseNote(note: string): ParsedNote {
  const match = NOTE_PATTERN.exec(note.trim());
  if (!match) {
    throw new Error(`Invalid note: ${note}`);
  }

  const [, rawLetter, accidental, rawOctave] = match;
  const noteName = `${rawLetter.toUpperCase()}${accidental}`;
  const octave = Number.parseInt(rawOctave, 10);

  if (NOTE_TO_SEMITONE[noteName] === undefined || Number.isNaN(octave)) {
    throw new Error(`Invalid note: ${note}`);
  }

  return { noteName, octave };
}

export function noteNameToPitchClass(note: string): number {
  const trimmed = note.trim();
  const directMatch = /^([A-Ga-g])([#b]?)$/.exec(trimmed);

  if (directMatch) {
    const [, rawLetter, accidental] = directMatch;
    const noteName = `${rawLetter.toUpperCase()}${accidental}`;
    const semitone = NOTE_TO_SEMITONE[noteName];

    if (semitone === undefined) {
      throw new Error(`Invalid note name: ${note}`);
    }

    return semitone;
  }

  return noteToMidi(trimmed) % 12;
}

export function noteToMidi(note: string): number {
  const { noteName, octave } = parseNote(note);
  const semitone = NOTE_TO_SEMITONE[noteName];

  return (octave + 1) * 12 + semitone;
}

export function midiToNote(midi: number): string {
  const roundedMidi = Math.round(midi);
  const normalized = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;

  return `${SHARP_NOTES[normalized]}${octave}`;
}

export function getPitchClass(note: string | number): number {
  if (typeof note === "number") {
    return ((Math.round(note) % 12) + 12) % 12;
  }

  return noteNameToPitchClass(note);
}

export function noteToFrequency(note: string): number {
  const midi = noteToMidi(note);
  return 440 * 2 ** ((midi - 69) / 12);
}

export function transpose(note: string, semitones: number): string {
  return midiToNote(noteToMidi(note) + Math.round(semitones));
}

export function buildChordPitches(
  root: string,
  quality: ChordQuality,
  inversion = 0,
): string[] {
  const intervals = [...CHORD_INTERVALS[quality]];
  const turns = Math.max(
    0,
    Number.isFinite(inversion) ? Math.trunc(inversion) : 0,
  );

  for (let index = 0; index < turns; index += 1) {
    const rotated = intervals.shift();
    if (rotated === undefined) {
      break;
    }

    intervals.push(rotated + 12);
  }

  return intervals.map((interval) => transpose(root, interval));
}
