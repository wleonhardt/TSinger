import type {
  PresetAnalysis,
  PresetComparison,
  RoughnessCause,
  SectionAnalysis,
} from "./types";

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

function formatBarRange(startBar: number, bars: number): string {
  const humanStart = startBar + 1;
  const humanEnd = startBar + bars;

  return humanStart === humanEnd ? `bar ${humanStart}` : `bars ${humanStart}-${humanEnd}`;
}

function pickTopSection(
  sections: SectionAnalysis[],
  selector: (section: SectionAnalysis) => number,
): SectionAnalysis | null {
  if (sections.length === 0) {
    return null;
  }

  return [...sections].sort((left, right) => selector(right) - selector(left))[0] ?? null;
}

function buildOverviewLines(analysis: PresetAnalysis): string[] {
  const sections = analysis.sections ?? [];
  const strongestCadenceSection = pickTopSection(
    sections,
    (section) => section.averageCadenceStrength,
  );
  const densestSection = pickTopSection(sections, (section) => section.averageDensity);
  const mostNovelSection = pickTopSection(
    sections.filter((section) => section.averageNovelty !== null),
    (section) => section.averageNovelty ?? 0,
  );
  const finalCadence =
    analysis.symbolic.cadenceStrengthByBar[
      analysis.symbolic.cadenceStrengthByBar.length - 1
    ] ?? 0;

  const lines = [
    `- Pitch range: ${analysis.symbolic.pitchRange.min ?? "n/a"} to ${analysis.symbolic.pitchRange.max ?? "n/a"}`,
    `- Chord-tone ratio: ${(analysis.symbolic.chordToneRatio * 100).toFixed(1)}%; repeated-pitch ratio ${(analysis.symbolic.repeatedPitchRatio * 100).toFixed(1)}%`,
    `- Mean novelty by bar: ${average(analysis.audio.noveltyByBar).toFixed(4)}; final cadence strength ${finalCadence.toFixed(3)}`,
    `- Timing: ${analysis.symbolic.timing.summary} ${analysis.symbolic.timing.symbolicPlacementCount} symbolic placements compiled.`,
  ];

  if (strongestCadenceSection) {
    lines.push(
      `- Strongest cadence section: \`${strongestCadenceSection.id}\` (${strongestCadenceSection.role}, ${formatBarRange(strongestCadenceSection.startBar, strongestCadenceSection.bars)})`,
    );
  }

  if (densestSection) {
    lines.push(
      `- Densest section: \`${densestSection.id}\` (${densestSection.averageDensity.toFixed(3)} average density)`,
    );
  }

  if (mostNovelSection) {
    lines.push(
      `- Highest-novelty section: \`${mostNovelSection.id}\` (${(mostNovelSection.averageNovelty ?? 0).toFixed(3)})`,
    );
  }

  return lines;
}

function buildSectionSummaryLines(analysis: PresetAnalysis): string[] {
  const sections = analysis.sections ?? [];
  if (sections.length === 0) {
    return ["- No section plan metadata was attached to this preset."];
  }

  return sections.map((section) => {
    const noveltyText =
      section.averageNovelty !== null ? `, novelty ${section.averageNovelty.toFixed(3)}` : "";
    const description = section.description ? ` ${section.description}` : "";

    return `- \`${section.id}\` (${section.role}, ${formatBarRange(section.startBar, section.bars)}): density ${section.averageDensity.toFixed(3)}, cadence ${section.averageCadenceStrength.toFixed(3)}${noveltyText}.${description}`;
  });
}

function buildVoiceSummaryLines(analysis: PresetAnalysis): string[] {
  const voices = analysis.symbolic.voiceAnalyses ?? [];
  if (voices.length === 0) {
    return ["- No voice-aware note analysis was available."];
  }

  return voices.slice(0, 5).map((voice) => {
    const pitchRange = `${voice.pitchRange.min ?? "n/a"} to ${voice.pitchRange.max ?? "n/a"}`;
    return `- \`${voice.voiceId}\`: ${voice.noteCount} notes, range ${pitchRange}, avg leap ${voice.averageLeapSemitones.toFixed(2)} st, repeated ${(voice.repeatedPitchRatio * 100).toFixed(1)}%, synths ${voice.synths.join(", ")}.`;
  });
}

function buildWarningLines(analysis: PresetAnalysis): string[] {
  const lines = analysis.validationWarnings
    .filter((warning) => warning.severity === "warning" || warning.severity === "error")
    .slice(0, 4)
    .map((warning) => `- [${warning.severity}] ${warning.code}: ${warning.message}`);

  lines.push(
    ...analysis.symbolic.timing.issues
      .slice(0, 3)
      .map((issue) => `- [${issue.level}] timing: ${issue.message}`),
  );
  lines.push(
    ...analysis.symbolic.highRegisterDissonanceWarnings
      .slice(0, 2)
      .map((warning) => `- [warning] harshness: ${warning}`),
  );
  lines.push(
    ...analysis.symbolic.duplicateEventWarnings
      .slice(0, 2)
      .map((warning) => `- [info] duplicate-events: ${warning}`),
  );

  if (lines.length === 0) {
    return ["- No validation warnings exceeded the current thresholds."];
  }

  return [...new Set(lines)].slice(0, 6);
}

function buildTimingLines(analysis: PresetAnalysis): string[] {
  const timing = analysis.symbolic.timing;
  const lines = [
    `- ${timing.summary}`,
    `- Symbolic placements compiled: ${timing.symbolicPlacementCount}`,
  ];

  if (timing.insights.length > 0) {
    lines.push(...timing.insights.slice(0, 5).map((insight) => `- ${insight.message}`));
  } else {
    lines.push("- No explicit timing annotations were attached to this preset.");
  }

  return lines;
}

function buildRoughnessCauseLine(cause: RoughnessCause): string {
  const sectionText = cause.sectionRole ? `, ${cause.sectionRole}` : "";
  return `- Bar ${cause.bar}, beat ${cause.beat.toFixed(2)}${sectionText}: ${cause.reason} Patch: ${cause.patch} Score ${cause.score.toFixed(3)} (${cause.severity}).`;
}

function buildRoughnessCauseLines(analysis: PresetAnalysis): string[] {
  const significantCauses = analysis.symbolic.roughnessCauses.filter(
    (cause) => cause.severity !== "info",
  );
  const causes =
    significantCauses.length > 0
      ? significantCauses
      : analysis.symbolic.roughnessCauses.slice(0, 2);

  if (causes.length === 0) {
    return ["- No exact roughness causes exceeded the current reporting threshold."];
  }

  return causes.slice(0, 4).map(buildRoughnessCauseLine);
}

export function buildSuggestedMusicalEdits(analysis: PresetAnalysis): string[] {
  const suggestions: string[] = [];
  const avgNovelty = average(analysis.audio.noveltyByBar);
  const maxNovelty = max(analysis.audio.noveltyByBar);
  const finalCadence =
    analysis.symbolic.cadenceStrengthByBar[
      analysis.symbolic.cadenceStrengthByBar.length - 1
    ] ?? 0;
  const earlierCadence = max(
    analysis.symbolic.cadenceStrengthByBar.slice(
      0,
      Math.max(0, analysis.symbolic.cadenceStrengthByBar.length - 1),
    ),
  );
  const topRoughnessCause = analysis.symbolic.roughnessCauses.find(
    (cause) => cause.severity !== "info",
  );

  if (topRoughnessCause) {
    suggestions.push(
      `${topRoughnessCause.patch} Focus on bar ${topRoughnessCause.bar}, beat ${topRoughnessCause.beat.toFixed(2)} first.`,
    );
  } else if (analysis.symbolic.highRegisterDissonanceWarnings.length > 0) {
    suggestions.push(
      "Re-register or spread the upper voices at the warned collision beats so minor seconds, tritones, or major sevenths are not exposed so tightly.",
    );
  }

  if ((analysis.symbolic.averageLeadLeapSemitones ?? 0) > 6 || analysis.symbolic.maxLeapSemitones >= 14) {
    suggestions.push(
      "Reduce the largest exposed lead leaps by adding stepwise approach or exit tones around the arrival notes.",
    );
  }

  if (analysis.symbolic.repeatedPitchRatio > 0.35) {
    suggestions.push(
      "Introduce one or two contour changes in the most repetitive line so adjacent attacks do not keep landing on the same pitch.",
    );
  }

  if (analysis.symbolic.chordToneRatio < 0.5) {
    suggestions.push(
      "Anchor more phrase accents and bar openings on chord tones so the harmony feels clearer in the oscillator texture.",
    );
  }

  if (max(analysis.symbolic.noteDensityByBar) > 2.4 || max(analysis.symbolic.onsetCountByBar) > analysis.beatsPerBar * 2.1) {
    suggestions.push(
      "Thin the densest bar or two first, especially ornamental attacks that sit on top of already-held harmony.",
    );
  }

  if (avgNovelty < 0.02) {
    suggestions.push(
      "Add a modest second-half change in register, rhythm cell, or accompaniment density so the loop evolves without needing many more notes.",
    );
  } else if (maxNovelty > Math.max(0.18, avgNovelty * 2.4)) {
    suggestions.push(
      "Smooth the sharpest section change with a shared pickup, common tone, or gentler density handoff if the transition feels too abrupt.",
    );
  }

  if (finalCadence < Math.max(0.4, earlierCadence * 0.9)) {
    suggestions.push(
      "Strengthen the final bar by lengthening a root or chord-tone arrival and slightly thinning the immediately preceding attacks.",
    );
  }

  if (analysis.symbolic.timing.issues.length > 0) {
    suggestions.push(
      "Fix the timing-boundary warnings first so pickups, returns, and cadence landings stay metrically intentional.",
    );
  }

  if (analysis.audio.clippingSampleCount > 0) {
    suggestions.push(
      "Reduce overlapping peak moments or ease the loudest simultaneous entries so the rendered mix keeps clean headroom.",
    );
  }

  return [...new Set(suggestions)].slice(0, 5);
}

export function buildPresetReport(analysis: PresetAnalysis): string {
  const suggestedEdits =
    analysis.suggestedMusicalEdits.length > 0
      ? analysis.suggestedMusicalEdits
      : buildSuggestedMusicalEdits(analysis);

  return [
    `# Preset Analysis: ${analysis.title}`,
    "",
    `- Preset ID: \`${analysis.presetId}\``,
    `- Rendered At: ${analysis.renderedAtIso}`,
    `- Duration: ${analysis.durationSeconds.toFixed(3)} seconds`,
    `- Meter: ${analysis.beatsPerBar}/bar at ${analysis.bpm} BPM`,
    `- Phrase Bars: ${analysis.bars}`,
    "",
    "## Overview",
    "",
    ...buildOverviewLines(analysis),
    "",
    "## Sections",
    "",
    ...buildSectionSummaryLines(analysis),
    "",
    "## Voices",
    "",
    ...buildVoiceSummaryLines(analysis),
    "",
    "## Timing",
    "",
    ...buildTimingLines(analysis),
    "",
    "## Warnings",
    "",
    ...buildWarningLines(analysis),
    "",
    "## Roughness Causes",
    "",
    ...buildRoughnessCauseLines(analysis),
    "",
    "## Suggested Edits",
    "",
    ...(suggestedEdits.length > 0
      ? suggestedEdits.map((item) => `- ${item}`)
      : ["- No specific metric-driven edits were triggered."]),
    "",
  ].join("\n");
}

export function buildComparisonReport(comparison: PresetComparison): string {
  return [
    `# Comparison: ${comparison.presetIdA} vs ${comparison.presetIdB}`,
    "",
    comparison.summary,
    "",
    "## Deltas",
    "",
    ...comparison.deltas.map((delta) => {
      const rawDelta =
        typeof delta.delta === "number" && Number.isFinite(delta.delta)
          ? ` (delta ${delta.delta.toFixed(4)})`
          : "";

      return `- **${delta.metric}**: ${String(delta.before)} -> ${String(delta.after)}${rawDelta}. ${delta.interpretation}`;
    }),
    "",
  ].join("\n");
}
