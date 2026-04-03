import {
  addSpan,
  spanToBeats,
  type MeterSpec,
  type Span,
} from "../authoring/timing";
import type { Phrase } from "../composition";
import type {
  Motif,
  MotifStep,
  PatternNoteDraft,
  RhythmRole,
  VoiceId,
} from "../authoring/types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mapMotifSteps(
  motif: Motif,
  mapper: (step: MotifStep, index: number) => MotifStep,
): Motif {
  return {
    anchorDegree: motif.anchorDegree,
    steps: motif.steps.map((step, index) => mapper({ ...step }, index)),
  };
}

export function scaleMotifVelocities(motif: Motif, scale: number): Motif {
  return mapMotifSteps(motif, (step) => ({
    ...step,
    velocity:
      step.velocity !== undefined
        ? clamp(step.velocity * scale, 0.04, 1)
        : step.velocity,
  }));
}

export function placeDraftNotes(
  notes: PatternNoteDraft[],
  options: {
    beatOffset?: number;
    spanOffset?: Span;
    meter?: MeterSpec;
    velocityScale?: number;
    panShift?: number;
    lengthScale?: number;
  } = {},
): PatternNoteDraft[] {
  const {
    beatOffset = 0,
    spanOffset,
    meter,
    velocityScale = 1,
    panShift = 0,
    lengthScale = 1,
  } = options;
  const symbolicBeatOffset =
    spanOffset && meter ? spanToBeats(spanOffset, meter) : 0;

  return notes.map((note) => ({
    ...note,
    beat: note.beat + beatOffset + symbolicBeatOffset,
    at: note.at && spanOffset && meter ? addSpan(note.at, spanOffset, meter) : note.at,
    length: note.length * lengthScale,
    velocity:
      note.velocity !== undefined
        ? clamp(note.velocity * velocityScale, 0.04, 1)
        : note.velocity,
    pan: note.pan !== undefined ? note.pan + panShift : note.pan,
  }));
}

export function withVoiceId<T>(
  voiceId: VoiceId,
  items: T[],
): Array<T & { voiceId: VoiceId }> {
  return items.map((item) => ({
    ...item,
    voiceId:
      item && typeof item === "object" && "voiceId" in (item as object)
        ? ((item as { voiceId?: VoiceId }).voiceId ?? voiceId)
        : voiceId,
  }));
}

export function withRhythmRole<T>(
  rhythmRole: RhythmRole,
  items: T[],
): Array<T & { rhythmRole: RhythmRole }> {
  return items.map((item) => ({
    ...item,
    rhythmRole:
      item && typeof item === "object" && "rhythmRole" in (item as object)
        ? ((item as { rhythmRole?: RhythmRole }).rhythmRole ?? rhythmRole)
        : rhythmRole,
  }));
}

export function withRealization<T>(items: T[]): Array<T & { realization: true }> {
  return items.map((item) => ({ ...item, realization: true as const }));
}

export function scalePhraseDynamics(
  phrase: Phrase,
  options: {
    noteScale?: number;
    chordScale?: number;
  } = {},
): Phrase {
  const { noteScale = 1, chordScale = 1 } = options;

  return {
    bars: phrase.bars,
    notes: phrase.notes.map((note) => ({
      ...note,
      velocity:
        note.velocity !== undefined
          ? clamp(note.velocity * noteScale, 0.04, 1)
          : note.velocity,
    })),
    chords: phrase.chords.map((chord) => ({
      ...chord,
      velocity:
        chord.velocity !== undefined
          ? clamp(chord.velocity * chordScale, 0.04, 1)
          : chord.velocity,
    })),
  };
}
