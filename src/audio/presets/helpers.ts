import type { Motif, MotifStep, PatternNoteDraft, VoiceId } from "../authoring/types";

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
    velocityScale?: number;
    panShift?: number;
    lengthScale?: number;
  } = {},
): PatternNoteDraft[] {
  const {
    beatOffset = 0,
    velocityScale = 1,
    panShift = 0,
    lengthScale = 1,
  } = options;

  return notes.map((note) => ({
    ...note,
    beat: note.beat + beatOffset,
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
