import type { PresetAnalysis, ValidationWarning } from "./types";

function pushIf(
  warnings: ValidationWarning[],
  condition: boolean,
  warning: ValidationWarning,
): void {
  if (condition) {
    warnings.push(warning);
  }
}

function max(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function validatePresetAnalysis(analysis: PresetAnalysis): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const maxDensity = max(analysis.symbolic.noteDensityByBar);
  const maxOnsets = max(analysis.symbolic.onsetCountByBar);
  const maxPeak = max(analysis.audio.peakByWindow);
  const maxNovelty = max(analysis.audio.noveltyByBar);
  const avgNovelty = average(analysis.audio.noveltyByBar);
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
  const timingWarnings = analysis.symbolic.timing.issues.filter(
    (issue) => issue.level === "warning" || issue.level === "error",
  );
  const rhythm = analysis.symbolic.rhythm;
  const rhythmWarnings = rhythm.issues.filter((issue) => issue.level === "warning");

  pushIf(warnings, maxDensity > 2.6, {
    code: "dense-bar",
    severity: "warning",
    message: "One or more bars sustain a high amount of simultaneous note material and may feel crowded.",
  });

  pushIf(warnings, maxOnsets > analysis.beatsPerBar * 2.2, {
    code: "busy-onsets",
    severity: "warning",
    message: "The phrase packs many note attacks into a bar, which may read as fussy in exposed oscillator textures.",
  });

  pushIf(warnings, analysis.symbolic.maxLeapSemitones >= 15, {
    code: "large-leap",
    severity: "warning",
    message: "The melodic profile includes a very large leap that may sound abrupt without stronger preparation.",
  });

  pushIf(warnings, (analysis.symbolic.averageLeadLeapSemitones ?? 0) > 6.5, {
    code: "lead-leap-average",
    severity: "info",
    message: "Lead motion trends wide on average, which may reduce smoothness or singability.",
  });

  pushIf(warnings, analysis.symbolic.repeatedPitchRatio > 0.4, {
    code: "repeated-pitch",
    severity: "info",
    message: "Adjacent melodic events repeat the same pitch frequently, which may flatten contour.",
  });

  pushIf(warnings, analysis.symbolic.highRegisterDissonanceWarnings.length > 0, {
    code: "high-register-dissonance",
    severity: "warning",
    message: "Simultaneous upper-register intervals look harsh enough to deserve manual listening checks.",
  });

  pushIf(warnings, analysis.symbolic.duplicateEventWarnings.length > 0, {
    code: "duplicate-events",
    severity: "warning",
    message: "Near-duplicate events were detected and may indicate accidental layering or compilation overlap.",
  });

  pushIf(warnings, analysis.audio.clippingSampleCount > 0 || maxPeak >= 0.995, {
    code: "clipping-risk",
    severity: "error",
    message: "The offline render clips or comes dangerously close to full scale.",
  });

  pushIf(warnings, Math.abs(analysis.audio.dcOffset) >= 0.01, {
    code: "dc-offset",
    severity: "warning",
    message: "The rendered signal shows noticeable DC offset.",
  });

  pushIf(
    warnings,
    analysis.audio.noveltyByBar.length > 1 && avgNovelty < 0.015 && maxNovelty < 0.03,
    {
      code: "flat-novelty",
      severity: "info",
      message: "Bar-to-bar feature change is very flat, so the loop may feel emotionally static over time.",
    },
  );

  pushIf(
    warnings,
    finalCadence < Math.max(0.4, earlierCadence * 0.85),
    {
      code: "weak-final-cadence",
      severity: "info",
      message: "The phrase-ending bar does not stand out strongly in the cadence metric.",
    },
  );

  pushIf(
    warnings,
    analysis.symbolic.simultaneousCollisions.length > Math.max(2, analysis.bars / 2),
    {
      code: "collision-count",
      severity: "warning",
      message: "There are several simultaneous collision points, which may translate into exposed roughness.",
    },
  );

  if (timingWarnings.length > 0) {
    warnings.push({
      code: "timing-alignment",
      severity: timingWarnings.some((issue) => issue.level === "error") ? "error" : "warning",
      message: timingWarnings[0]!.message,
    });
  }

  pushIf(warnings, rhythm.metricalDriftWarningBars.length > 0, {
    code: "metrical-drift",
    severity: "warning",
    message: `Strong-beat articulation weakens across consecutive bars beginning around bar ${rhythm.metricalDriftWarningBars[0]! + 1}.`,
  });

  pushIf(warnings, rhythm.offbeatOnlyBarCount > Math.max(1, analysis.bars * 0.2), {
    code: "offbeat-only-stretch",
    severity: "warning",
    message: `${rhythm.offbeatOnlyBarCount} active bars avoid strong-beat attacks entirely, which can loosen pulse authority over the loop.`,
  });

  pushIf(
    warnings,
    rhythm.anchorDownbeatPresence > 0 && rhythm.anchorDownbeatPresence < 0.55,
    {
      code: "weak-anchor-recovery",
      severity: "warning",
      message: `The anchor voice only recovers beat 1 in ${(rhythm.anchorDownbeatPresence * 100).toFixed(0)}% of its active bars.`,
    },
  );

  pushIf(
    warnings,
    rhythm.cadenceContractSatisfied === false,
    {
      code: "cadence-contract",
      severity: "warning",
      message:
        rhythm.cadenceContractIssues[0]?.message ??
        "One or more cadence timing contracts were not satisfied.",
    },
  );

  if (rhythmWarnings.length > 0) {
    warnings.push({
      code: "rhythm-coherence",
      severity: "warning",
      message: rhythmWarnings[0]!.message,
    });
  }

  return warnings;
}
