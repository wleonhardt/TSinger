import type { CompiledSection } from "../metadata";
import { findSectionAtBeat } from "./sections";
import type { ArrangementCurvePoint, ArrangementSpec } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function interpolateCurve(
  points: ArrangementCurvePoint[] | undefined,
  beat: number,
  defaultValue: number,
): number {
  if (!points || points.length === 0) {
    return defaultValue;
  }

  const sorted = [...points].sort((left, right) => left.beat - right.beat);

  if (beat <= sorted[0]!.beat) {
    return sorted[0]!.value;
  }

  const last = sorted[sorted.length - 1]!;
  if (beat >= last.beat) {
    return last.value;
  }

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index]!;
    const next = sorted[index + 1]!;
    if (beat >= current.beat && beat <= next.beat) {
      const range = next.beat - current.beat || 1;
      const progress = (beat - current.beat) / range;

      return current.value + (next.value - current.value) * progress;
    }
  }

  return defaultValue;
}

function deterministicValue(seed: string): number {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return (hash % 1000) / 1000;
}

function getSectionBias(
  section: CompiledSection | null,
  key: "density" | "register" | "brightness" | "cadence",
): number {
  if (!section?.bias) {
    return key === "cadence" ? 1 : 0;
  }

  const value = section.bias[key];
  return value ?? (key === "cadence" ? 1 : 0);
}

export function getDensityAtBeat(
  arrangement: ArrangementSpec | undefined,
  beat: number,
  sections?: CompiledSection[],
): number {
  const section = findSectionAtBeat(sections, beat);
  const sectionBias = getSectionBias(section, "density");
  return clamp(interpolateCurve(arrangement?.densityCurve, beat, 1) + sectionBias, 0, 1.5);
}

export function getRegisterBiasAtBeat(
  arrangement: ArrangementSpec | undefined,
  beat: number,
  sections?: CompiledSection[],
): number {
  const section = findSectionAtBeat(sections, beat);
  const sectionBias = getSectionBias(section, "register");
  return clamp(interpolateCurve(arrangement?.registerCurve, beat, 0) + sectionBias, -1, 1);
}

export function getBrightnessAtBeat(
  arrangement: ArrangementSpec | undefined,
  beat: number,
  sections?: CompiledSection[],
): number {
  const section = findSectionAtBeat(sections, beat);
  const sectionBias = getSectionBias(section, "brightness");
  return clamp(interpolateCurve(arrangement?.brightnessCurve, beat, 0.5) + sectionBias, 0, 1);
}

export function getCadentialWeightAtBeat(
  arrangement: ArrangementSpec | undefined,
  beat: number,
  sections?: CompiledSection[],
): number {
  const section = findSectionAtBeat(sections, beat);
  const sectionWeight = getSectionBias(section, "cadence");
  return clamp(interpolateCurve(arrangement?.cadenceCurve, beat, 0.4) * sectionWeight, 0, 1.4);
}

export function shouldOrnament(
  arrangement: ArrangementSpec | undefined,
  beat: number,
  salt: string,
  sections?: CompiledSection[],
): boolean {
  const density = getDensityAtBeat(arrangement, beat, sections);
  const cadence = getCadentialWeightAtBeat(arrangement, beat, sections);
  const baseProbability = arrangement?.ornamentBaseProbability ?? 0.38;
  const threshold = clamp(baseProbability * density * (0.75 + cadence * 0.35), 0, 1);

  return deterministicValue(`${salt}:${beat.toFixed(3)}`) <= threshold;
}
