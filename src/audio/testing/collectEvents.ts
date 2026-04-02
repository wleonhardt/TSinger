import type { ChordEvent, Composition, SynthName } from "../composition";
import { buildChordPitches, noteToMidi } from "../theory";
import { resolveVoiceId } from "../voiceIdentity";
import type { EventCollection, ExpandedEventRole, ExpandedScheduledEvent } from "./types";

const DEFAULT_CHORD_SPREAD_SECONDS = 0.01;
const MIN_CHORD_SPREAD_SECONDS = 0.006;
const MAX_CHORD_SPREAD_SECONDS = 0.018;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundBeat(value: number): number {
  return Number(value.toFixed(4));
}

function secondsToBeats(seconds: number, bpm: number): number {
  return seconds / (60 / bpm);
}

export function getRoleForSynth(synth: SynthName): ExpandedEventRole {
  switch (synth) {
    case "softLead":
      return "lead";
    case "glassBell":
      return "accent";
    case "pluckyDust":
      return "ornament";
    case "roundBass":
      return "bass";
    case "warmPad":
      return "pad";
    case "breathingDrone":
      return "drone";
    default:
      return "texture";
  }
}

export function getRoleForVoice(
  voiceId: string | undefined,
  synth: SynthName,
): ExpandedEventRole {
  switch (voiceId) {
    case "lead":
      return "lead";
    case "counterline":
      return "counterline";
    case "bass":
      return "bass";
    case "pad":
      return "pad";
    case "drone":
      return "drone";
    case "bells":
      return "accent";
    case "ornament":
      return "ornament";
    default:
      return getRoleForSynth(synth);
  }
}

export function sortEventsByBeat<T extends { beat: number; midi: number }>(events: T[]): T[] {
  return [...events].sort((left, right) => {
    if (left.beat !== right.beat) {
      return left.beat - right.beat;
    }

    return left.midi - right.midi;
  });
}

export function collectExpandedNoteEvents(composition: Composition): ExpandedScheduledEvent[] {
  return sortEventsByBeat(
    composition.phrase.notes.map((note, index) => {
      const voiceId = resolveVoiceId(note.voiceId, note.synth);

      return {
        id: `note:${index}`,
        sourceKind: "note" as const,
        sourceIndex: index,
        synth: note.synth,
        voiceId,
        layerId: note.layerId,
        role: getRoleForVoice(voiceId, note.synth),
        pitch: note.pitch,
        midi: noteToMidi(note.pitch),
        beat: roundBeat(note.beat),
        endBeat: roundBeat(note.beat + Math.max(0, note.length)),
        durationBeats: Math.max(0, note.length),
        velocity: note.velocity ?? 0.72,
        barIndex: Math.max(0, Math.floor(note.beat / composition.beatsPerBar)),
        sectionId: note.sectionId,
        sectionRole: note.sectionRole,
      };
    }),
  );
}

function expandChordEvent(
  chord: ChordEvent,
  composition: Composition,
  chordIndex: number,
): ExpandedScheduledEvent[] {
  let pitches: string[] = [];

  try {
    pitches = buildChordPitches(chord.root, chord.quality, chord.inversion);
  } catch {
    return [];
  }

  const spreadSeconds = clamp(
    chord.spread ?? DEFAULT_CHORD_SPREAD_SECONDS,
    MIN_CHORD_SPREAD_SECONDS,
    MAX_CHORD_SPREAD_SECONDS,
  );
  const spreadBeats = secondsToBeats(spreadSeconds, composition.bpm);

  return pitches.map((pitch, toneIndex) => {
    const beat = chord.beat + spreadBeats * toneIndex;
    const durationBeats = Math.max(0, chord.length);
    const voiceId = resolveVoiceId(chord.voiceId, chord.synth, { isPad: true });

    return {
      id: `chord:${chordIndex}:${toneIndex}`,
      sourceKind: "chordTone" as const,
      sourceIndex: chordIndex,
      synth: chord.synth,
      voiceId,
      layerId: chord.layerId,
      role: getRoleForVoice(voiceId, chord.synth),
      pitch,
      midi: noteToMidi(pitch),
      beat: roundBeat(beat),
      endBeat: roundBeat(beat + durationBeats),
      durationBeats,
      velocity: (chord.velocity ?? 0.3) * 0.94,
      barIndex: Math.max(0, Math.floor(chord.beat / composition.beatsPerBar)),
      sectionId: chord.sectionId,
      sectionRole: chord.sectionRole,
      chordRoot: chord.root,
      chordQuality: chord.quality,
      toneIndex,
    };
  });
}

export function expandChordEvents(composition: Composition): ExpandedScheduledEvent[] {
  return sortEventsByBeat(
    composition.phrase.chords.flatMap((chord, index) =>
      expandChordEvent(chord, composition, index),
    ),
  );
}

export function mergeAllScheduledEvents(composition: Composition): EventCollection {
  const noteEvents = collectExpandedNoteEvents(composition);
  const chordToneEvents = expandChordEvents(composition);

  return {
    noteEvents,
    chordToneEvents,
    mergedEvents: sortEventsByBeat([...noteEvents, ...chordToneEvents]),
  };
}

export function groupEventsByBar(
  events: ExpandedScheduledEvent[],
  bars: number,
  beatsPerBar: number,
): ExpandedScheduledEvent[][] {
  const grouped = Array.from({ length: bars }, () => [] as ExpandedScheduledEvent[]);

  for (const event of events) {
    const barIndex = Math.min(
      bars - 1,
      Math.max(0, Math.floor(event.beat / beatsPerBar)),
    );
    grouped[barIndex]!.push(event);
  }

  return grouped;
}

export function findActiveChordAtBeat(
  composition: Composition,
  beat: number,
): ChordEvent | null {
  const active = composition.phrase.chords.find(
    (chord) => beat >= chord.beat && beat < chord.beat + chord.length,
  );

  if (active) {
    return active;
  }

  const previous = [...composition.phrase.chords]
    .filter((chord) => chord.beat <= beat)
    .sort((left, right) => right.beat - left.beat)[0];

  return previous ?? null;
}
