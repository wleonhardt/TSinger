import type { NoteEvent } from "../composition";
import type { CompiledSection } from "../metadata";
import type { MeterSpec } from "./timing";

export type RhythmRole =
  | "anchor"
  | "flow"
  | "response"
  | "pickup"
  | "cadence"
  | "ornament"
  | "punctuation"
  | "suspension"
  | (string & {});

export type BarRole =
  | "arrival"
  | "departure"
  | "continuation"
  | "transition"
  | "cadence"
  | "pickup"
  | (string & {});

export type RhythmProfile = {
  strongBeatBias?: number;
  offbeatBias?: number;
  pickupBias?: number;
  maxOnsetsPerBar?: number;
  leaveSpaceBeforeCadence?: boolean;
  downbeatArticulation?: number;
};

export type CadenceTimingContract = {
  targetBar?: number;
  targetBeat?: number;
  mustLandOnStrongBeat?: boolean;
  minFinalDurationBeats?: number;
  thinBeforeArrival?: boolean;
  allowPickup?: boolean;
  maxOrnamentVelocityNearCadence?: number;
};

export type CadenceContractIssue = {
  code: string;
  message: string;
  targetBar: number;
  targetBeat: number;
};

export type RhythmCoherenceIssue = {
  code: string;
  level: "info" | "warning";
  message: string;
  bar?: number;
};

export type ResolvedCadenceWindow = {
  targetBar: number;
  targetBeat: number;
  cadenceStartBeat: number;
  cadenceEndBeat: number;
  targetAbsoluteBeat: number;
  preCadenceStartBeat: number | null;
  thinBeforeArrival: boolean;
  allowPickup: boolean;
  maxOrnamentVelocityNearCadence?: number;
};

export type RhythmCoherenceAnalysis = {
  summary: string;
  insights: string[];
  barRoleCoverage: number;
  rhythmRoleCoverage: number;
  anchorDownbeatPresence: number;
  strongBeatArticulationByBar: number[];
  offbeatOnlyBarCount: number;
  metricalDriftWarningBars: number[];
  cadenceContractCount: number;
  cadenceContractSatisfied: boolean | null;
  cadenceContractIssues: CadenceContractIssue[];
  arrivalStrongBeatAverage: number | null;
  continuationStrongBeatAverage: number | null;
  issues: RhythmCoherenceIssue[];
};

const DEFAULT_PROFILES: Readonly<Record<string, RhythmProfile>> = {
  arrival: {
    strongBeatBias: 0.82,
    offbeatBias: 0.22,
    downbeatArticulation: 0.92,
  },
  departure: {
    strongBeatBias: 0.58,
    offbeatBias: 0.42,
    downbeatArticulation: 0.62,
  },
  continuation: {
    strongBeatBias: 0.44,
    offbeatBias: 0.58,
    downbeatArticulation: 0.5,
  },
  transition: {
    strongBeatBias: 0.34,
    offbeatBias: 0.62,
    pickupBias: 0.52,
    downbeatArticulation: 0.4,
  },
  cadence: {
    strongBeatBias: 0.92,
    offbeatBias: 0.12,
    downbeatArticulation: 1,
    leaveSpaceBeforeCadence: true,
  },
  pickup: {
    strongBeatBias: 0.22,
    offbeatBias: 0.74,
    pickupBias: 0.88,
    downbeatArticulation: 0.3,
  },
};

const SECTION_ROLE_TO_BAR_ROLE: Readonly<Record<string, BarRole>> = {
  statement: "arrival",
  answer: "continuation",
  shadow: "continuation",
  bridge: "transition",
  return: "arrival",
  cadence: "cadence",
  variation: "continuation",
  transition: "transition",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function average(values: number[]): number {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

export function getDefaultRhythmProfile(barRole: BarRole): RhythmProfile {
  return DEFAULT_PROFILES[barRole] ?? DEFAULT_PROFILES.continuation!;
}

export function resolveBarRole(section: CompiledSection | null): BarRole | undefined {
  if (!section) {
    return undefined;
  }

  return section.barRole ?? SECTION_ROLE_TO_BAR_ROLE[section.role] ?? undefined;
}

export function getBeatInBar(beat: number, meter: MeterSpec): number {
  return modulo(beat, meter.beatsPerBar);
}

export function isDownbeat(beat: number, meter: MeterSpec): boolean {
  return getBeatInBar(beat, meter) < 0.05;
}

export function isStrongBeat(beat: number, meter: MeterSpec): boolean {
  const beatInBar = getBeatInBar(beat, meter);
  if (beatInBar < 0.05) {
    return true;
  }

  if (meter.beatsPerBar === 4 && Math.abs(beatInBar - 2) < 0.05) {
    return true;
  }

  if (meter.beatsPerBar === 3 && Math.abs(beatInBar - 1) < 0.05) {
    return true;
  }

  if (meter.beatsPerBar >= 6 && Math.abs(beatInBar - meter.beatsPerBar / 2) < 0.05) {
    return true;
  }

  return false;
}

function isLastBeatOfBar(beat: number, meter: MeterSpec): boolean {
  return Math.abs(getBeatInBar(beat, meter) - (meter.beatsPerBar - 1)) < 0.05;
}

export function getBarIndex(beat: number, meter: MeterSpec): number {
  return Math.floor(beat / meter.beatsPerBar);
}

export function getBarRoleAtBeat(
  beat: number,
  meter: MeterSpec,
  sections: CompiledSection[],
): BarRole | undefined {
  const barIndex = getBarIndex(beat, meter);
  const section =
    sections.find((candidate) => barIndex >= candidate.startBar && barIndex < candidate.endBar) ??
    null;
  return resolveBarRole(section);
}

export function inferRhythmRole(
  voiceId: string | undefined,
  synth: string | undefined,
  fallback: RhythmRole | undefined,
): RhythmRole | undefined {
  if (fallback) {
    return fallback;
  }

  switch (voiceId) {
    case "bass":
    case "drone":
    case "pad":
      return "anchor";
    case "lead":
      return "flow";
    case "counterline":
    case "inner":
      return "response";
    case "bells":
      return "punctuation";
    case "ornament":
      return "ornament";
    default:
      break;
  }

  switch (synth) {
    case "roundBass":
    case "warmPad":
    case "breathingDrone":
      return "anchor";
    case "softLead":
      return "flow";
    case "glassBell":
      return "punctuation";
    case "pluckyDust":
      return "ornament";
    default:
      return undefined;
  }
}

export function computeRhythmVelocityFactor(
  beat: number,
  meter: MeterSpec,
  rhythmRole: RhythmRole | undefined,
  barRole: BarRole | undefined,
): number {
  if (!rhythmRole && !barRole) {
    return 1;
  }

  const onDownbeat = isDownbeat(beat, meter);
  const onStrongBeat = isStrongBeat(beat, meter);
  let factor = 1;

  if (rhythmRole === "anchor") {
    factor *= onDownbeat ? 1.08 : onStrongBeat ? 1.03 : 0.95;
  }

  if (rhythmRole === "flow") {
    if ((barRole === "arrival" || barRole === "cadence") && onStrongBeat) {
      factor *= onDownbeat ? 1.05 : 1.02;
    }
  }

  if (rhythmRole === "response") {
    if (!onStrongBeat) {
      factor *= 1.03;
    }
    if (onDownbeat) {
      factor *= 0.98;
    }
  }

  if (rhythmRole === "pickup") {
    factor *= isLastBeatOfBar(beat, meter) ? 1.04 : 0.97;
  }

  if (rhythmRole === "cadence") {
    factor *= barRole === "cadence" && onStrongBeat ? 1.08 : 1.01;
  }

  if (rhythmRole === "ornament" || rhythmRole === "punctuation") {
    if (barRole === "cadence") {
      factor *= 0.82;
    } else if (barRole === "arrival") {
      factor *= 0.9;
    }
  }

  if (rhythmRole === "suspension" && barRole === "arrival" && onDownbeat) {
    factor *= 0.92;
  }

  if (barRole && onDownbeat) {
    const articulation = getDefaultRhythmProfile(barRole).downbeatArticulation ?? 0.5;
    factor *= 0.96 + articulation * 0.12;
  }

  return factor;
}

export function rhythmOrnamentDensityFactor(
  barRole: BarRole | undefined,
  rhythmRole: RhythmRole | undefined,
): number {
  if (barRole === "cadence") {
    if (rhythmRole === "ornament") {
      return 0.2;
    }
    if (rhythmRole === "punctuation") {
      return 0.45;
    }
  }

  if (barRole === "arrival" && rhythmRole === "ornament") {
    return 0.68;
  }

  if (barRole === "pickup" && rhythmRole === "pickup") {
    return 1.05;
  }

  return 1;
}

export function resolveCadenceWindows(
  contracts: CadenceTimingContract[] | undefined,
  meter: MeterSpec,
  totalBars: number,
): ResolvedCadenceWindow[] {
  return (contracts ?? []).map((contract) => {
    const targetBar = clamp(contract.targetBar ?? totalBars, 1, Math.max(1, totalBars));
    const targetBeat = clamp(
      contract.targetBeat ?? 1,
      1,
      Math.max(1, meter.beatsPerBar),
    );
    const cadenceStartBeat = (targetBar - 1) * meter.beatsPerBar;
    const cadenceEndBeat = cadenceStartBeat + meter.beatsPerBar;

    return {
      targetBar,
      targetBeat,
      cadenceStartBeat,
      cadenceEndBeat,
      targetAbsoluteBeat: cadenceStartBeat + (targetBeat - 1),
      preCadenceStartBeat:
        targetBar > 1 ? cadenceStartBeat - meter.beatsPerBar : null,
      thinBeforeArrival: contract.thinBeforeArrival ?? false,
      allowPickup: contract.allowPickup ?? true,
      maxOrnamentVelocityNearCadence: contract.maxOrnamentVelocityNearCadence,
    };
  });
}

export function getCadenceWindowAtBeat(
  beat: number,
  windows: ResolvedCadenceWindow[],
): ResolvedCadenceWindow | null {
  return (
    windows.find(
      (window) =>
        beat >= (window.preCadenceStartBeat ?? window.cadenceStartBeat) - 0.01 &&
        beat < window.cadenceEndBeat + 0.01,
    ) ?? null
  );
}

export function validateCadenceContract(
  contract: CadenceTimingContract,
  notes: NoteEvent[],
  meter: MeterSpec,
  totalBars: number,
): CadenceContractIssue[] {
  const window = resolveCadenceWindows([contract], meter, totalBars)[0]!;
  const issues: CadenceContractIssue[] = [];
  const cadenceNotes = notes.filter(
    (note) => note.beat >= window.cadenceStartBeat - 0.01 && note.beat < window.cadenceEndBeat + 0.01,
  );

  if (cadenceNotes.length === 0) {
    issues.push({
      code: "cadence-empty",
      message: `Cadence bar ${window.targetBar} has no note events.`,
      targetBar: window.targetBar,
      targetBeat: window.targetBeat,
    });
    return issues;
  }

  if (contract.mustLandOnStrongBeat) {
    const hasStrongBeatLanding = cadenceNotes.some((note) => isStrongBeat(note.beat, meter));
    if (!hasStrongBeatLanding) {
      issues.push({
        code: "cadence-no-strong-beat",
        message: `Cadence bar ${window.targetBar} never lands on a strong beat.`,
        targetBar: window.targetBar,
        targetBeat: window.targetBeat,
      });
    }
  }

  const landingNotes = cadenceNotes.filter(
    (note) => Math.abs(note.beat - window.targetAbsoluteBeat) < 0.1,
  );
  if (landingNotes.length === 0) {
    issues.push({
      code: "cadence-target-missed",
      message: `No note lands at bar ${window.targetBar}, beat ${window.targetBeat}.`,
      targetBar: window.targetBar,
      targetBeat: window.targetBeat,
    });
  }

  if (contract.minFinalDurationBeats !== undefined) {
    const latestLanding = [...landingNotes].sort((left, right) => right.beat - left.beat)[0];
    if (
      latestLanding &&
      latestLanding.length < contract.minFinalDurationBeats - 0.01
    ) {
      issues.push({
        code: "cadence-short-final",
        message: `Cadence landing lasts ${latestLanding.length.toFixed(2)} beats but needs at least ${contract.minFinalDurationBeats}.`,
        targetBar: window.targetBar,
        targetBeat: window.targetBeat,
      });
    }
  }

  if (contract.thinBeforeArrival && window.preCadenceStartBeat !== null) {
    const preCadenceNotes = notes.filter(
      (note) =>
        note.beat >= window.preCadenceStartBeat! - 0.01 &&
        note.beat < window.cadenceStartBeat - 0.01,
    );
    const averagePerBar = notes.length / Math.max(1, totalBars);
    if (preCadenceNotes.length > averagePerBar * 1.35) {
      issues.push({
        code: "cadence-dense-precadence",
        message: `Bar ${window.targetBar - 1} remains denser than average before the cadence.`,
        targetBar: window.targetBar,
        targetBeat: window.targetBeat,
      });
    }
  }

  if (!window.allowPickup) {
    const pickupNotes = cadenceNotes.filter((note) => note.beat < window.targetAbsoluteBeat - 0.01);
    if (pickupNotes.length > 0) {
      issues.push({
        code: "cadence-unwanted-pickup",
        message: `Cadence target at bar ${window.targetBar}, beat ${window.targetBeat} is preceded by ${pickupNotes.length} in-bar pickup note(s).`,
        targetBar: window.targetBar,
        targetBeat: window.targetBeat,
      });
    }
  }

  if (window.maxOrnamentVelocityNearCadence !== undefined) {
    const loudOrnaments = cadenceNotes.filter(
      (note) =>
        (note.rhythmRole === "ornament" || note.rhythmRole === "punctuation") &&
        (note.velocity ?? 0) > window.maxOrnamentVelocityNearCadence!,
    );
    if (loudOrnaments.length > 0) {
      issues.push({
        code: "cadence-loud-ornament",
        message: `${loudOrnaments.length} ornament note(s) exceed the cadence velocity cap of ${window.maxOrnamentVelocityNearCadence}.`,
        targetBar: window.targetBar,
        targetBeat: window.targetBeat,
      });
    }
  }

  return issues;
}

export function analyzeRhythmCoherence(
  notes: NoteEvent[],
  meter: MeterSpec,
  totalBars: number,
  sections: CompiledSection[],
  cadenceContracts: CadenceTimingContract[] | undefined,
): RhythmCoherenceAnalysis {
  const issues: RhythmCoherenceIssue[] = [];
  const insights: string[] = [];
  const bars = Array.from({ length: totalBars }, (_, index) =>
    notes.filter((note) => getBarIndex(note.beat, meter) === index),
  );
  const barRoles = Array.from({ length: totalBars }, (_, index) => {
    const section =
      sections.find((candidate) => index >= candidate.startBar && index < candidate.endBar) ?? null;
    return resolveBarRole(section);
  });

  const barsWithRole = barRoles.filter((role) => role !== undefined).length;
  const barRoleCoverage = ratio(barsWithRole, Math.max(1, totalBars));
  const notesWithRole = notes.filter((note) => note.rhythmRole !== undefined).length;
  const rhythmRoleCoverage = ratio(notesWithRole, Math.max(1, notes.length));

  const strongBeatArticulationByBar = bars.map((barNotes) =>
    barNotes.length > 0
      ? ratio(
          barNotes.filter((note) => isStrongBeat(note.beat, meter)).length,
          barNotes.length,
        )
      : 0,
  );

  const offbeatOnlyBarCount = bars.filter(
    (barNotes) =>
      barNotes.length > 0 && !barNotes.some((note) => isStrongBeat(note.beat, meter)),
  ).length;

  const anchorNotes = notes.filter((note) => note.rhythmRole === "anchor");
  const anchorBars = new Set(anchorNotes.map((note) => getBarIndex(note.beat, meter)));
  const anchorBarsWithDownbeat = new Set(
    anchorNotes
      .filter((note) => isDownbeat(note.beat, meter))
      .map((note) => getBarIndex(note.beat, meter)),
  );
  const anchorDownbeatPresence = ratio(anchorBarsWithDownbeat.size, anchorBars.size);

  const metricalDriftWarningBars: number[] = [];
  let weakStreak = 0;
  for (let barIndex = 0; barIndex < strongBeatArticulationByBar.length; barIndex += 1) {
    const articulation = strongBeatArticulationByBar[barIndex]!;
    if (bars[barIndex]!.length > 0 && articulation < 0.15) {
      weakStreak += 1;
      if (weakStreak >= 3) {
        metricalDriftWarningBars.push(barIndex);
      }
    } else {
      weakStreak = 0;
    }
  }

  const arrivalBars = strongBeatArticulationByBar.filter((_, index) => {
    const role = barRoles[index];
    return role === "arrival" || role === "cadence";
  });
  const continuationBars = strongBeatArticulationByBar.filter((_, index) => {
    const role = barRoles[index];
    return role === "continuation" || role === "transition" || role === "departure";
  });
  const arrivalStrongBeatAverage = arrivalBars.length > 0 ? average(arrivalBars) : null;
  const continuationStrongBeatAverage =
    continuationBars.length > 0 ? average(continuationBars) : null;

  if (barRoleCoverage > 0.5) {
    insights.push(
      `Rhythmic bar roles cover ${barsWithRole} of ${totalBars} bars.`,
    );
  }

  if (anchorNotes.length > 0) {
    insights.push(
      `Anchor voice articulates the downbeat in ${(anchorDownbeatPresence * 100).toFixed(0)}% of its active bars.`,
    );
  }

  if (offbeatOnlyBarCount === 0 && notes.length > 0) {
    insights.push("Every active bar retains at least one strong-beat articulation.");
  }

  if (
    arrivalStrongBeatAverage !== null &&
    continuationStrongBeatAverage !== null &&
    arrivalStrongBeatAverage > continuationStrongBeatAverage + 0.08
  ) {
    insights.push(
      `Arrival and cadence bars carry stronger beat weight (${arrivalStrongBeatAverage.toFixed(2)}) than continuation bars (${continuationStrongBeatAverage.toFixed(2)}).`,
    );
  }

  if (offbeatOnlyBarCount > Math.max(2, totalBars * 0.3)) {
    issues.push({
      code: "excessive-offbeat-bars",
      level: "warning",
      message: `${offbeatOnlyBarCount} of ${totalBars} bars avoid strong-beat articulation, risking metric dissolution.`,
    });
  }

  if (metricalDriftWarningBars.length > 0) {
    issues.push({
      code: "metrical-drift",
      level: "warning",
      message: `Three or more consecutive weak-grid bars begin at bar ${metricalDriftWarningBars[0]! + 1}.`,
      bar: metricalDriftWarningBars[0],
    });
  }

  if (anchorNotes.length > 0 && anchorDownbeatPresence < 0.5) {
    issues.push({
      code: "anchor-abandons-downbeat",
      level: "warning",
      message: `Anchor voice only hits beat 1 in ${(anchorDownbeatPresence * 100).toFixed(0)}% of its active bars.`,
    });
  }

  if (
    arrivalStrongBeatAverage !== null &&
    continuationStrongBeatAverage !== null &&
    arrivalStrongBeatAverage < continuationStrongBeatAverage + 0.03
  ) {
    issues.push({
      code: "bar-role-flattening",
      level: "warning",
      message:
        "Arrival and cadence bars are not rhythmically weightier than continuation bars, so phrase roles may blur.",
    });
  }

  for (const section of sections) {
    const resolvedRole = resolveBarRole(section);
    if (resolvedRole !== "cadence" && resolvedRole !== "arrival") {
      continue;
    }

    const sectionNotes = notes.filter(
      (note) => note.beat >= section.startBeat - 0.01 && note.beat < section.endBeat + 0.01,
    );
    if (sectionNotes.length === 0) {
      continue;
    }

    const strongBeatRatio = ratio(
      sectionNotes.filter((note) => isStrongBeat(note.beat, meter)).length,
      sectionNotes.length,
    );
    if (resolvedRole === "cadence" && strongBeatRatio < 0.3) {
      issues.push({
        code: "cadence-section-weak",
        level: "warning",
        message: `Section "${section.id}" is marked as cadence but only ${(strongBeatRatio * 100).toFixed(0)}% of its notes land on strong beats.`,
        bar: section.startBar,
      });
    }
  }

  const cadenceContractIssues = (cadenceContracts ?? []).flatMap((contract) =>
    validateCadenceContract(contract, notes, meter, totalBars),
  );
  const cadenceContractSatisfied =
    cadenceContracts && cadenceContracts.length > 0
      ? cadenceContractIssues.length === 0
      : null;

  if (cadenceContractSatisfied === true) {
    const targets = resolveCadenceWindows(cadenceContracts, meter, totalBars)
      .map((window) => `bar ${window.targetBar}, beat ${window.targetBeat}`)
      .join("; ");
    insights.push(`Cadence contract satisfied at ${targets}.`);
  }

  for (const cadenceIssue of cadenceContractIssues) {
    issues.push({
      code: cadenceIssue.code,
      level: "warning",
      message: cadenceIssue.message,
      bar: cadenceIssue.targetBar - 1,
    });
  }

  const summaryParts = [
    `${(rhythmRoleCoverage * 100).toFixed(0)}% of note events carry rhythm roles`,
    `${(anchorDownbeatPresence * 100).toFixed(0)}% anchor downbeat presence`,
    `${offbeatOnlyBarCount} offbeat-only bars`,
  ];
  if (cadenceContractSatisfied !== null) {
    summaryParts.push(
      cadenceContractSatisfied ? "cadence contract satisfied" : "cadence contract needs attention",
    );
  }

  return {
    summary: summaryParts.join(", "),
    insights,
    barRoleCoverage,
    rhythmRoleCoverage,
    anchorDownbeatPresence,
    strongBeatArticulationByBar,
    offbeatOnlyBarCount,
    metricalDriftWarningBars,
    cadenceContractCount: cadenceContracts?.length ?? 0,
    cadenceContractSatisfied,
    cadenceContractIssues,
    arrivalStrongBeatAverage,
    continuationStrongBeatAverage,
    issues,
  };
}
