import { spanToBeats, type MeterSpec, type Span } from "./timing";
import type { Motif, MotifStep } from "./types";

type SequenceShift = number | { scaleSteps?: number; semitones?: number };

type AnswerPhraseOptions = {
  scaleSteps?: number;
  semitones?: number;
};

function cloneStep(step: MotifStep): MotifStep {
  return { ...step };
}

function getMotifLength(motif: Motif): number {
  return motif.steps.reduce(
    (length, step) => Math.max(length, step.beat + step.length),
    0,
  );
}

function getShift(shift: SequenceShift): { scaleSteps: number; semitones: number } {
  if (typeof shift === "number") {
    return { scaleSteps: shift, semitones: 0 };
  }

  return {
    scaleSteps: shift.scaleSteps ?? 0,
    semitones: shift.semitones ?? 0,
  };
}

export function sequence(
  motif: Motif,
  shift: SequenceShift,
  repetitions: number,
): Motif {
  const { scaleSteps, semitones } = getShift(shift);
  const motifLength = getMotifLength(motif);
  const repeatedSteps: MotifStep[] = [];

  for (let index = 0; index < repetitions; index += 1) {
    for (const step of motif.steps) {
      repeatedSteps.push({
        ...cloneStep(step),
        beat: step.beat + motifLength * index,
        offset: step.offset + scaleSteps * index,
        chromaticOffset: (step.chromaticOffset ?? 0) + semitones * index,
      });
    }
  }

  return {
    anchorDegree: motif.anchorDegree,
    steps: repeatedSteps,
  };
}

export function invertMotif(motif: Motif, axisPitch: number): Motif {
  return {
    anchorDegree: motif.anchorDegree,
    steps: motif.steps.map((step) => {
      const absoluteDegree = motif.anchorDegree + step.offset;
      const invertedDegree = axisPitch * 2 - absoluteDegree;

      return {
        ...cloneStep(step),
        offset: invertedDegree - motif.anchorDegree,
      };
    }),
  };
}

export function retrograde(motif: Motif): Motif {
  const motifLength = getMotifLength(motif);

  return {
    anchorDegree: motif.anchorDegree,
    steps: [...motif.steps]
      .reverse()
      .map((step) => ({
        ...cloneStep(step),
        beat: motifLength - (step.beat + step.length),
      })),
  };
}

export function augmentRhythm(motif: Motif, factor: number): Motif {
  return {
    anchorDegree: motif.anchorDegree,
    steps: motif.steps.map((step) => ({
      ...cloneStep(step),
      beat: step.beat * factor,
      length: step.length * factor,
    })),
  };
}

export function diminishRhythm(motif: Motif, factor: number): Motif {
  return augmentRhythm(motif, 1 / factor);
}

export function displaceRhythm(motif: Motif, beatOffset: number): Motif {
  return {
    anchorDegree: motif.anchorDegree,
    steps: motif.steps.map((step) => ({
      ...cloneStep(step),
      beat: step.beat + beatOffset,
    })),
  };
}

export function displaceRhythmBySpan(
  motif: Motif,
  displacement: Span,
  meter: MeterSpec,
): Motif {
  return displaceRhythm(motif, spanToBeats(displacement, meter));
}

export function makeAnswerPhrase(
  motif: Motif,
  options: AnswerPhraseOptions = {},
): Motif {
  const scaleSteps = options.scaleSteps ?? 3;
  const semitones = options.semitones ?? 0;

  return {
    anchorDegree: motif.anchorDegree + scaleSteps,
    steps: motif.steps.map((step) => ({
      ...cloneStep(step),
      chromaticOffset: (step.chromaticOffset ?? 0) + semitones,
    })),
  };
}

export function motifLength(motif: Motif): number {
  return getMotifLength(motif);
}
