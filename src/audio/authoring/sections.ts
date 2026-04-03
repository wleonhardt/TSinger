import type { CompiledSection } from "../metadata";
import type { PhrasePlan } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function compileSections(plan: PhrasePlan): CompiledSection[] {
  if (!plan.sections || plan.sections.length === 0) {
    return [];
  }

  return [...plan.sections]
    .map((section) => {
      const safeStartBar = clamp(Math.trunc(section.startBar), 0, Math.max(0, plan.bars - 1));
      const safeBars = clamp(Math.trunc(section.bars), 1, Math.max(1, plan.bars - safeStartBar));
      const endBar = Math.min(plan.bars, safeStartBar + safeBars);
      const rawBias = {
        density: section.bias?.density ?? section.densityBias,
        register: section.bias?.register ?? section.registerBias,
        brightness: section.bias?.brightness ?? section.brightnessBias,
        cadence: section.bias?.cadence ?? section.cadenceWeight,
      };
      const bias = Object.values(rawBias).some((value) => value !== undefined)
        ? rawBias
        : undefined;

      return {
        id: section.id,
        role: section.role,
        barRole: section.barRole,
        startBar: safeStartBar,
        bars: safeBars,
        bias,
        description: section.description,
        startBeat: safeStartBar * plan.beatsPerBar,
        endBeat: endBar * plan.beatsPerBar,
        endBar,
      };
    })
    .sort((left, right) => left.startBar - right.startBar);
}

export function findSectionAtBeat(
  sections: CompiledSection[] | undefined,
  beat: number,
): CompiledSection | null {
  if (!sections || sections.length === 0) {
    return null;
  }

  return sections.find((section) => beat >= section.startBeat && beat < section.endBeat) ?? null;
}
