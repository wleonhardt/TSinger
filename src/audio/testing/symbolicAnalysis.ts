import type { Composition } from "../composition";
import { analyzeRhythmCoherence } from "../authoring/rhythm";
import { isChordTone, isScaleTone } from "../authoring/harmony";
import { describeSwingProfile } from "../authoring/timing";
import { getPitchClass, midiToNote } from "../theory";
import { describeVoiceId, isLeadVoiceId } from "../voiceIdentity";
import { findActiveChordAtBeat, mergeAllScheduledEvents } from "./collectEvents";
import { buildRoughnessCauses, getActiveEventsAtBeat } from "./roughness";
import type {
  EventCollection,
  ExpandedScheduledEvent,
  SymbolicAnalysis,
  SymbolicCollision,
  VoiceAnalysis,
} from "./types";

const HARSH_INTERVALS = new Set([1, 2, 6, 10, 11]);
const HIGH_REGISTER_WARNING_MIDI = 76;
const HIGH_REGISTER_LOWER_FLOOR_MIDI = 64;
const COLLISION_TOLERANCE_BEATS = 0.05;
const COLLISION_CLUSTER_WINDOW_BEATS = 0.08;
const MAX_COLLISION_SPACING_SEMITONES = 16;
const MAX_HIGH_REGISTER_WARNING_SPACING_SEMITONES = 14;

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function normalizeInterval(semitones: number): number {
  const normalized = modulo(Math.abs(semitones), 12);
  return Math.min(normalized, 12 - normalized);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function isLeadLike(event: ExpandedScheduledEvent): boolean {
  return isLeadVoiceId(event.voiceId) || event.role === "lead";
}

function buildLeapSeries(
  events: ExpandedScheduledEvent[],
  maxGapBeats: number,
): number[] {
  if (events.length <= 1) {
    return [];
  }

  const leaps: number[] = [];

  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1]!;
    const current = events[index]!;
    if (current.beat - previous.endBeat > maxGapBeats) {
      continue;
    }
    leaps.push(Math.abs(current.midi - previous.midi));
  }

  return leaps;
}

function groupByLine(events: ExpandedScheduledEvent[]): ExpandedScheduledEvent[][] {
  const grouped = new Map<string, ExpandedScheduledEvent[]>();

  for (const event of events) {
    const voiceKey = event.voiceId || event.synth;
    const lineKey = event.layerId ?? event.synth;
    const key = `${voiceKey}|${lineKey}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(event);
  }

  return [...grouped.values()].map((group) =>
    [...group].sort((left, right) => {
      if (left.beat !== right.beat) {
        return left.beat - right.beat;
      }

      return left.midi - right.midi;
    }),
  );
}

function buildRepeatedPitchStats(
  events: ExpandedScheduledEvent[],
  maxGapBeats: number,
): { matches: number; comparisons: number } {
  let matches = 0;
  let comparisons = 0;

  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1]!;
    const current = events[index]!;
    if (current.beat - previous.endBeat > maxGapBeats) {
      continue;
    }

    comparisons += 1;
    if (current.pitch === previous.pitch) {
      matches += 1;
    }
  }

  return { matches, comparisons };
}

function buildVoiceAnalyses(
  lineGroups: ExpandedScheduledEvent[][],
  maxGapBeats: number,
): VoiceAnalysis[] {
  const grouped = new Map<
    string,
    {
      events: ExpandedScheduledEvent[];
      leaps: number[];
      repeatedMatches: number;
      repeatedComparisons: number;
      weightedMidiSum: number;
      weightSum: number;
    }
  >();

  for (const group of lineGroups) {
    if (group.length === 0) {
      continue;
    }

    const key = group[0]!.voiceId || group[0]!.synth;
    const leaps = buildLeapSeries(group, maxGapBeats);
    const repeated = buildRepeatedPitchStats(group, maxGapBeats);
    const weightedMidiSum = group.reduce(
      (sum, event) => sum + event.midi * event.durationBeats * event.velocity,
      0,
    );
    const weightSum = group.reduce(
      (sum, event) => sum + event.durationBeats * event.velocity,
      0,
    );
    const current = grouped.get(key) ?? {
      events: [],
      leaps: [],
      repeatedMatches: 0,
      repeatedComparisons: 0,
      weightedMidiSum: 0,
      weightSum: 0,
    };

    current.events.push(...group);
    current.leaps.push(...leaps);
    current.repeatedMatches += repeated.matches;
    current.repeatedComparisons += repeated.comparisons;
    current.weightedMidiSum += weightedMidiSum;
    current.weightSum += weightSum;
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((group) => ({
      voiceId: describeVoiceId(group.events[0]?.voiceId, group.events[0]?.synth),
      synths: [...new Set(group.events.map((event) => event.synth))].sort(),
      noteCount: group.events.length,
      pitchRange: {
        min:
          group.events.length > 0
            ? midiToNote(Math.min(...group.events.map((event) => event.midi)))
            : null,
        max:
          group.events.length > 0
            ? midiToNote(Math.max(...group.events.map((event) => event.midi)))
            : null,
      },
      averageLeapSemitones: Number(average(group.leaps).toFixed(4)),
      maxLeapSemitones: group.leaps.length > 0 ? Math.max(...group.leaps) : 0,
      repeatedPitchRatio:
        group.repeatedComparisons > 0
          ? Number((group.repeatedMatches / group.repeatedComparisons).toFixed(4))
          : 0,
      registerCenterMidi:
        group.weightSum > 0 ? Number((group.weightedMidiSum / group.weightSum).toFixed(3)) : null,
    }))
    .sort((left, right) => {
      if (left.voiceId === "lead") {
        return -1;
      }

      if (right.voiceId === "lead") {
        return 1;
      }

      return right.noteCount - left.noteCount;
    });
}

function buildDuplicateWarnings(events: ExpandedScheduledEvent[]): string[] {
  const warnings: string[] = [];
  const seen = new Map<string, ExpandedScheduledEvent>();

  for (const event of events) {
    const roundedBeat = event.beat.toFixed(2);
    const key = `${event.voiceId}|${event.layerId ?? event.synth}|${event.pitch}|${roundedBeat}|${event.sourceKind}`;
    const previous = seen.get(key);

    if (previous && Math.abs(previous.beat - event.beat) <= 0.01) {
      warnings.push(
        `Duplicate ${describeVoiceId(event.voiceId, event.synth)} event on ${event.pitch} near beat ${roundedBeat}.`,
      );
    } else {
      seen.set(key, event);
    }
  }

  return unique(warnings);
}

function buildDensityByBar(
  composition: Composition,
  events: ExpandedScheduledEvent[],
): number[] {
  return Array.from({ length: composition.phrase.bars }, (_, barIndex) => {
    const barStart = barIndex * composition.beatsPerBar;
    const barEnd = barStart + composition.beatsPerBar;

    const occupiedBeats = events.reduce((sum, event) => {
      const overlapStart = Math.max(event.beat, barStart);
      const overlapEnd = Math.min(event.endBeat, barEnd);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      return sum + overlap;
    }, 0);

    return Number((occupiedBeats / composition.beatsPerBar).toFixed(4));
  });
}

function buildOnsetsByBar(
  composition: Composition,
  events: ExpandedScheduledEvent[],
): number[] {
  return Array.from({ length: composition.phrase.bars }, (_, barIndex) => {
    const barStart = barIndex * composition.beatsPerBar;
    const barEnd = barStart + composition.beatsPerBar;

    return events.filter(
      (event) => event.beat >= barStart && event.beat < barEnd,
    ).length;
  });
}

function buildCollisions(
  events: ExpandedScheduledEvent[],
): {
  collisions: SymbolicCollision[];
  warnings: string[];
} {
  const candidateBeats = unique(events.map((event) => event.beat)).sort(
    (left, right) => left - right,
  );
  const collisions: SymbolicCollision[] = [];
  const warningMap = new Map<string, string>();

  function getExistingCollisionCluster(beat: number): SymbolicCollision | null {
    return (
      collisions.find(
        (collision) => Math.abs(collision.beat - beat) <= COLLISION_CLUSTER_WINDOW_BEATS,
      ) ?? null
    );
  }

  for (const beat of candidateBeats) {
    const active = getActiveEventsAtBeat(events, beat + COLLISION_TOLERANCE_BEATS * 0.5);
    if (active.length <= 1) {
      continue;
    }

    let collided = false;
    const collisionPitches = new Set<string>();
    const highRegisterPairs: Array<{ left: ExpandedScheduledEvent; right: ExpandedScheduledEvent }> = [];

    for (let index = 0; index < active.length; index += 1) {
      for (let inner = index + 1; inner < active.length; inner += 1) {
        const left = active[index]!;
        const right = active[inner]!;
        const interval = normalizeInterval(left.midi - right.midi);
        const spacing = Math.abs(left.midi - right.midi);

        if (!HARSH_INTERVALS.has(interval) || spacing > MAX_COLLISION_SPACING_SEMITONES) {
          continue;
        }

        collided = true;
        collisionPitches.add(left.pitch);
        collisionPitches.add(right.pitch);

        const upperMidi = Math.max(left.midi, right.midi);
        const lowerMidi = Math.min(left.midi, right.midi);

        if (
          spacing <= MAX_HIGH_REGISTER_WARNING_SPACING_SEMITONES &&
          upperMidi >= HIGH_REGISTER_WARNING_MIDI &&
          lowerMidi >= HIGH_REGISTER_LOWER_FLOOR_MIDI
        ) {
          highRegisterPairs.push({ left, right });
        }
      }
    }

    if (collided) {
      const existingCluster = getExistingCollisionCluster(beat);

      if (existingCluster) {
        existingCluster.pitches = unique([
          ...existingCluster.pitches,
          ...collisionPitches,
        ]).sort();
        existingCluster.voices = unique([
          ...existingCluster.voices,
          ...active.map((event) => describeVoiceId(event.voiceId, event.synth)),
        ]).sort();
      } else {
        collisions.push({
          beat: Number(beat.toFixed(4)),
          bar: (active[0]?.barIndex ?? 0) + 1,
          pitches: [...collisionPitches].sort(),
          voices: unique(active.map((event) => describeVoiceId(event.voiceId, event.synth))).sort(),
          sectionId: active.find((event) => event.sectionId)?.sectionId,
          sectionRole: active.find((event) => event.sectionRole)?.sectionRole,
        });
      }

      const clusterBeat = (getExistingCollisionCluster(beat) ?? { beat }).beat;
      const cluster = getExistingCollisionCluster(beat);
      const clusterBar = cluster ? cluster.bar : Math.floor(clusterBeat) + 1;

      for (const pair of highRegisterPairs) {
        const key = `${clusterBeat.toFixed(2)}|${pair.left.pitch}|${pair.right.pitch}|${pair.left.voiceId}|${pair.right.voiceId}`;
        warningMap.set(
          key,
          `High-register clash near bar ${clusterBar}, beat ${clusterBeat.toFixed(2)} between ${describeVoiceId(pair.left.voiceId, pair.left.synth)} ${pair.left.pitch} and ${describeVoiceId(pair.right.voiceId, pair.right.synth)} ${pair.right.pitch}.`,
        );
      }
    }
  }

  return {
    collisions: collisions.sort((left, right) => left.beat - right.beat),
    warnings: [...warningMap.values()],
  };
}

function buildCadenceStrengthByBar(
  composition: Composition,
  events: EventCollection,
): number[] {
  const keyPitchClass = getPitchClass(composition.key.root);

  return Array.from({ length: composition.phrase.bars }, (_, barIndex) => {
    const barStart = barIndex * composition.beatsPerBar;
    const barEnd = barStart + composition.beatsPerBar;
    const arrivalStart = barEnd - composition.beatsPerBar * 0.42;
    const leadInStart = barEnd - composition.beatsPerBar * 0.9;
    const endHarmony = findActiveChordAtBeat(composition, barEnd - 0.001);

    const arrivalEvents = events.mergedEvents.filter(
      (event) => event.beat >= arrivalStart && event.beat < barEnd + 0.001,
    );
    const leadInEvents = events.noteEvents.filter(
      (event) => event.beat >= leadInStart && event.beat < arrivalStart,
    );
    const arrivalOnsets = events.noteEvents.filter(
      (event) => event.beat >= arrivalStart && event.beat < barEnd + 0.001,
    ).length;

    const arrivalWeight = arrivalEvents.reduce((sum, event) => {
      const activeHarmony =
        event.chordRoot && event.chordQuality
          ? { root: event.chordRoot, quality: event.chordQuality }
          : findActiveChordAtBeat(composition, Math.min(event.endBeat, barEnd) - 0.001);
      const isCadentialChordTone = activeHarmony
        ? isChordTone(event.pitch, activeHarmony.root, activeHarmony.quality)
        : false;
      const overlapBeats =
        Math.min(event.endBeat, barEnd) - Math.max(event.beat, arrivalStart);
      const sourceWeight =
        event.sourceKind === "note"
          ? event.role === "lead"
            ? 1.14
            : event.role === "counterline"
            ? 1.02
            : event.role === "accent"
            ? 1.02
            : event.role === "ornament"
            ? 0.82
            : 0.88
          : 0.36;
      const pitchClass = getPitchClass(event.pitch);
      const rootBonus =
        activeHarmony && pitchClass === getPitchClass(activeHarmony.root) ? 1.24 : 1;
      const registerWeight =
        event.role === "bass" ? 1.08 : event.midi >= 76 && !isCadentialChordTone ? 0.86 : 1;
      const harmonyWeight = isCadentialChordTone
        ? 1.24
        : isScaleTone(event.pitch, composition.key.root, composition.key.scale)
        ? 0.92
        : 0.74;

      return (
        sum +
        Math.max(0, overlapBeats) *
          event.velocity *
          sourceWeight *
          rootBonus *
          registerWeight *
          harmonyWeight
      );
    }, 0);

    const leadInDensity = leadInEvents.length;
    const sparsityBonus = 1 + Math.max(0, leadInDensity - arrivalOnsets) * 0.08;
    const endHarmonyBonus = endHarmony
      ? getPitchClass(endHarmony.root) === keyPitchClass
        ? 1.2
        : getPitchClass(endHarmony.root) === (keyPitchClass + 7) % 12
        ? 1.06
        : 0.94
      : 1;
    const phraseEndBonus = barIndex === composition.phrase.bars - 1 ? 1.08 : 1;
    const cadence = arrivalWeight * sparsityBonus * endHarmonyBonus * phraseEndBonus;

    return Number(cadence.toFixed(4));
  });
}

export function analyzeSymbolically(
  composition: Composition,
  events: EventCollection = mergeAllScheduledEvents(composition),
): SymbolicAnalysis {
  const melodicEvents = events.noteEvents;
  const allEvents = events.mergedEvents;
  const maxGapBeats = composition.beatsPerBar * 1.25;
  const groupedByLine = groupByLine(melodicEvents);
  const leapSeries = groupedByLine.flatMap((group) => buildLeapSeries(group, maxGapBeats));
  const explicitLeadGroups = groupedByLine.filter((group) =>
    group.some((event) => isLeadVoiceId(event.voiceId)),
  );
  const leadGroups =
    explicitLeadGroups.length > 0
      ? explicitLeadGroups
      : groupedByLine.filter((group) => group.some((event) => isLeadLike(event)));
  const leadLeapSeries = leadGroups.flatMap((group) =>
    buildLeapSeries(
      group.filter((event) => isLeadVoiceId(event.voiceId) || isLeadLike(event)),
      maxGapBeats,
    ),
  );
  const voiceAnalyses = buildVoiceAnalyses(groupedByLine, maxGapBeats);
  const duplicateEventWarnings = buildDuplicateWarnings(allEvents);
  const { collisions, warnings } = buildCollisions(allEvents);

  let chordToneCount = 0;
  let colorToneCount = 0;

  for (const event of melodicEvents) {
    const activeHarmony = findActiveChordAtBeat(composition, event.beat);
    if (!activeHarmony) {
      continue;
    }

    if (isChordTone(event.pitch, activeHarmony.root, activeHarmony.quality)) {
      chordToneCount += 1;
    } else if (isScaleTone(event.pitch, composition.key.root, composition.key.scale)) {
      colorToneCount += 1;
    }
  }

  const repeatedPitchSummary = groupedByLine.reduce(
    (summary, group) => {
      const stats = buildRepeatedPitchStats(group, maxGapBeats);
      return {
        matches: summary.matches + stats.matches,
        comparisons: summary.comparisons + stats.comparisons,
      };
    },
    { matches: 0, comparisons: 0 },
  );
  const weightedMidiSum = melodicEvents.reduce(
    (sum, event) => sum + event.midi * event.durationBeats * event.velocity,
    0,
  );
  const weightSum = melodicEvents.reduce(
    (sum, event) => sum + event.durationBeats * event.velocity,
    0,
  );
  const uniquePitches = unique(allEvents.map((event) => event.pitch)).sort(
    (left, right) => allEvents.find((event) => event.pitch === left)!.midi -
      allEvents.find((event) => event.pitch === right)!.midi,
  );
  const cadenceStrengthByBar = buildCadenceStrengthByBar(composition, events);
  const roughnessCauses = buildRoughnessCauses({
    events: allEvents,
    beatsPerBar: composition.beatsPerBar,
    cadenceStrengthByBar,
  });
  const timing =
    composition.timing ?? {
      meter: { beatsPerBar: composition.beatsPerBar, beatUnit: 4 },
      swing: { kind: "straight" },
      summary: `${composition.beatsPerBar}/4 meter, ${describeSwingProfile({ kind: "straight" })}.`,
      symbolicPlacementCount: 0,
      insights: [],
      issues: [],
    };
  const rhythm =
    composition.rhythm ??
    analyzeRhythmCoherence(
      composition.phrase.notes,
      timing.meter,
      composition.phrase.bars,
      composition.sections ?? [],
      undefined,
    );

  return {
    noteCount: composition.phrase.notes.length,
    chordEventCount: composition.phrase.chords.length,
    uniquePitches,
    pitchRange: {
      min: allEvents.length > 0 ? midiToNote(Math.min(...allEvents.map((event) => event.midi))) : null,
      max: allEvents.length > 0 ? midiToNote(Math.max(...allEvents.map((event) => event.midi))) : null,
    },
    averageLeapSemitones: Number(average(leapSeries).toFixed(4)),
    maxLeapSemitones: leapSeries.length > 0 ? Math.max(...leapSeries) : 0,
    averageLeadLeapSemitones:
      leadLeapSeries.length > 0 ? Number(average(leadLeapSeries).toFixed(4)) : undefined,
    voiceAnalyses,
    highRegisterDissonanceWarnings: warnings,
    simultaneousCollisions: collisions,
    roughnessCauses,
    noteDensityByBar: buildDensityByBar(composition, melodicEvents),
    onsetCountByBar: buildOnsetsByBar(composition, melodicEvents),
    chordToneRatio:
      melodicEvents.length > 0 ? Number((chordToneCount / melodicEvents.length).toFixed(4)) : 0,
    colorToneRatio:
      melodicEvents.length > 0 ? Number((colorToneCount / melodicEvents.length).toFixed(4)) : 0,
    repeatedPitchRatio:
      repeatedPitchSummary.comparisons > 0
        ? Number((repeatedPitchSummary.matches / repeatedPitchSummary.comparisons).toFixed(4))
        : 0,
    registerCenterMidi:
      weightSum > 0 ? Number((weightedMidiSum / weightSum).toFixed(3)) : null,
    cadenceStrengthByBar,
    duplicateEventWarnings,
    timing,
    rhythm,
  };
}
