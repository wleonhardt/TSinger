import type { ComparisonDelta, PresetAnalysis, PresetComparison } from "./types";

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function finalCadence(analysis: PresetAnalysis): number {
  return analysis.symbolic.cadenceStrengthByBar[
    analysis.symbolic.cadenceStrengthByBar.length - 1
  ] ?? 0;
}

function deltaMetric(
  metric: string,
  before: number | string | null,
  after: number | string | null,
  interpretation: string,
): ComparisonDelta {
  const numericBefore = typeof before === "number" ? before : null;
  const numericAfter = typeof after === "number" ? after : null;

  return {
    metric,
    before,
    after,
    delta:
      numericBefore !== null && numericAfter !== null
        ? Number((numericAfter - numericBefore).toFixed(6))
        : null,
    interpretation,
  };
}

export function comparePresetAnalyses(
  before: PresetAnalysis,
  after: PresetAnalysis,
): PresetComparison {
  const avgRoughnessBefore = average(before.audio.roughnessByWindow);
  const avgRoughnessAfter = average(after.audio.roughnessByWindow);
  const avgNoveltyBefore = average(before.audio.noveltyByBar);
  const avgNoveltyAfter = average(after.audio.noveltyByBar);
  const beforeCadence = finalCadence(before);
  const afterCadence = finalCadence(after);
  const deltas: ComparisonDelta[] = [
    deltaMetric(
      "note density (avg per bar)",
      average(before.symbolic.noteDensityByBar),
      average(after.symbolic.noteDensityByBar),
      average(after.symbolic.noteDensityByBar) < average(before.symbolic.noteDensityByBar)
        ? "Version B is sparser on average and may feel less crowded."
        : "Version B is denser on average and may feel fuller or busier.",
    ),
    deltaMetric(
      "average leap",
      before.symbolic.averageLeapSemitones,
      after.symbolic.averageLeapSemitones,
      after.symbolic.averageLeapSemitones < before.symbolic.averageLeapSemitones
        ? "Version B likely has smoother melodic motion."
        : "Version B likely uses wider melodic motion.",
    ),
    deltaMetric(
      "lead leap average",
      before.symbolic.averageLeadLeapSemitones ?? null,
      after.symbolic.averageLeadLeapSemitones ?? null,
      (after.symbolic.averageLeadLeapSemitones ?? Infinity) <
        (before.symbolic.averageLeadLeapSemitones ?? Infinity)
        ? "Version B likely keeps the lead line more singable."
        : "Version B likely asks more from the lead line intervallically.",
    ),
    deltaMetric(
      "mean roughness",
      avgRoughnessBefore,
      avgRoughnessAfter,
      avgRoughnessAfter < avgRoughnessBefore
        ? "Version B may feel less harsh in exposed simultaneities."
        : "Version B may expose more roughness or upper-register tension.",
    ),
    deltaMetric(
      "bar novelty",
      avgNoveltyBefore,
      avgNoveltyAfter,
      avgNoveltyAfter > avgNoveltyBefore
        ? "Version B likely changes more from bar to bar."
        : "Version B is likely more repetitive bar to bar.",
    ),
    deltaMetric(
      "final cadence strength",
      beforeCadence,
      afterCadence,
      afterCadence > beforeCadence
        ? "Version B likely has a stronger phrase-end arrival."
        : "Version B likely lands less firmly at the phrase ending.",
    ),
    deltaMetric(
      "chord-tone ratio",
      before.symbolic.chordToneRatio,
      after.symbolic.chordToneRatio,
      after.symbolic.chordToneRatio > before.symbolic.chordToneRatio
        ? "Version B leans more on harmonic grounding."
        : "Version B leaves more room for color tones or ambiguity.",
    ),
    deltaMetric(
      "repeated-pitch ratio",
      before.symbolic.repeatedPitchRatio,
      after.symbolic.repeatedPitchRatio,
      after.symbolic.repeatedPitchRatio < before.symbolic.repeatedPitchRatio
        ? "Version B likely has more contour variety."
        : "Version B likely repeats adjacent pitches more often.",
    ),
    deltaMetric(
      "clipping samples",
      before.audio.clippingSampleCount,
      after.audio.clippingSampleCount,
      after.audio.clippingSampleCount === before.audio.clippingSampleCount
        ? "Both versions show the same clipping status."
        : after.audio.clippingSampleCount < before.audio.clippingSampleCount
        ? "Version B has cleaner headroom."
        : "Version B moves closer to clipping.",
    ),
  ];

  const summary = [
    avgRoughnessAfter < avgRoughnessBefore
      ? "Roughness metrics decreased."
      : "Roughness metrics increased or stayed flat.",
    afterCadence > beforeCadence
      ? "Phrase-end arrival strengthened."
      : "Phrase-end arrival weakened or stayed flat.",
    avgNoveltyAfter > avgNoveltyBefore
      ? "Bar-to-bar contrast increased."
      : "Bar-to-bar contrast decreased or stayed flat.",
  ].join(" ");

  return {
    presetIdA: before.presetId,
    presetIdB: after.presetId,
    summary,
    deltas,
  };
}
