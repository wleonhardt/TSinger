import type { Composition } from "../composition";
import type {
  AudioFeatureAnalysis,
  SectionAnalysis,
  SymbolicAnalysis,
} from "./types";

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildSectionAnalyses(params: {
  composition: Composition;
  symbolic: SymbolicAnalysis;
  audio: AudioFeatureAnalysis;
}): SectionAnalysis[] {
  const { composition, symbolic, audio } = params;
  const sections = composition.sections ?? [];

  return sections.map((section) => {
    const endBar = Math.min(composition.phrase.bars, section.startBar + section.bars);
    const densitySlice = symbolic.noteDensityByBar.slice(section.startBar, endBar);
    const onsetSlice = symbolic.onsetCountByBar.slice(section.startBar, endBar);
    const cadenceSlice = symbolic.cadenceStrengthByBar.slice(section.startBar, endBar);
    const noveltySlice = audio.noveltyByBar.slice(section.startBar, endBar);

    return {
      id: section.id,
      role: section.role,
      startBar: section.startBar,
      bars: section.bars,
      description: section.description,
      averageDensity: Number(average(densitySlice).toFixed(4)),
      averageOnsets: Number(average(onsetSlice).toFixed(4)),
      averageCadenceStrength: Number(average(cadenceSlice).toFixed(4)),
      averageNovelty:
        noveltySlice.length > 0 ? Number(average(noveltySlice).toFixed(4)) : null,
    };
  });
}
