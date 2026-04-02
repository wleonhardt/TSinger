import { describeVoiceId } from "../voiceIdentity";
import type { ExpandedScheduledEvent, RoughnessCause } from "./types";

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function intervalPenalty(intervalSemitones: number): number {
  const normalized = Math.min(
    modulo(intervalSemitones, 12),
    12 - modulo(intervalSemitones, 12),
  );

  switch (normalized) {
    case 0:
      return 0;
    case 1:
      return 1.15;
    case 2:
      return 0.8;
    case 3:
    case 4:
      return 0.18;
    case 5:
      return 0.24;
    case 6:
      return 0.92;
    default:
      return 0.12;
  }
}

function normalizedInterval(intervalSemitones: number): number {
  return Math.min(
    modulo(intervalSemitones, 12),
    12 - modulo(intervalSemitones, 12),
  );
}

function spacingMultiplier(intervalSemitones: number): number {
  const distance = Math.abs(intervalSemitones);

  if (distance <= 7) {
    return 1;
  }

  if (distance <= 12) {
    return 0.85;
  }

  if (distance <= 16) {
    return 0.65;
  }

  if (distance <= 24) {
    return 0.4;
  }

  if (distance <= 31) {
    return 0.22;
  }

  return 0.12;
}

function registerMultiplier(midiA: number, midiB: number): number {
  const averageMidi = (midiA + midiB) / 2;
  if (averageMidi >= 84) {
    return 1.45;
  }

  if (averageMidi >= 76) {
    return 1.25;
  }

  if (averageMidi >= 68) {
    return 1.1;
  }

  return 0.9;
}

function roleMultiplier(
  left: ExpandedScheduledEvent,
  right: ExpandedScheduledEvent,
): number {
  const roles = new Set([left.role, right.role]);

  if (roles.has("lead") && roles.has("accent")) {
    return 1.24;
  }

  if (roles.has("lead") && roles.has("counterline")) {
    return 1.2;
  }

  if (roles.has("lead") && roles.size === 1) {
    return 1.18;
  }

  if (roles.has("counterline") && roles.size === 1) {
    return 1.08;
  }

  if (roles.has("accent") && !roles.has("pad") && !roles.has("drone")) {
    return 1.12;
  }

  if (roles.has("ornament") && !roles.has("pad") && !roles.has("drone")) {
    return 1.06;
  }

  if (roles.has("pad") && roles.has("drone")) {
    return 0.74;
  }

  if (roles.has("bass") && Math.abs(left.midi - right.midi) >= 12) {
    return 0.82;
  }

  return 1;
}

function voiceInteractionMultiplier(
  left: ExpandedScheduledEvent,
  right: ExpandedScheduledEvent,
): number {
  const voices = new Set([left.voiceId, right.voiceId]);

  if (voices.has("lead") && voices.has("bells")) {
    return 1.26;
  }

  if (voices.has("lead") && voices.has("counterline")) {
    return 1.16;
  }

  if (voices.has("lead") && voices.has("pad")) {
    return 1.14;
  }

  if (voices.has("bells") && voices.has("pad")) {
    return 1.12;
  }

  if (voices.has("ornament") && voices.has("pad")) {
    return 0.92;
  }

  return 1;
}

function sourceKindMultiplier(
  left: ExpandedScheduledEvent,
  right: ExpandedScheduledEvent,
): number {
  if (left.sourceKind === "chordTone" && right.sourceKind === "chordTone") {
    return 0.78;
  }

  if (left.sourceKind !== right.sourceKind) {
    return 0.92;
  }

  return 1;
}

function overlapWeight(
  left: ExpandedScheduledEvent,
  right: ExpandedScheduledEvent,
  beat: number,
): number {
  const leftCenter = left.beat + left.durationBeats * 0.5;
  const rightCenter = right.beat + right.durationBeats * 0.5;
  const centerDistance =
    Math.abs(beat - leftCenter) + Math.abs(beat - rightCenter);

  if (centerDistance <= 0.35) {
    return 1.05;
  }

  if (centerDistance <= 0.8) {
    return 0.96;
  }

  return 0.84;
}

function densityMultiplier(activeEvents: ExpandedScheduledEvent[]): number {
  return 1 + Math.max(0, activeEvents.length - 3) * 0.06;
}

export function getActiveEventsAtBeat(
  events: ExpandedScheduledEvent[],
  beat: number,
): ExpandedScheduledEvent[] {
  return events.filter((event) => beat >= event.beat && beat < event.endBeat);
}

export function estimateSymbolicRoughnessAtBeat(
  events: ExpandedScheduledEvent[],
  beat: number,
): number {
  const activeEvents = getActiveEventsAtBeat(events, beat);
  if (activeEvents.length <= 1) {
    return 0;
  }

  let roughness = 0;

  for (let index = 0; index < activeEvents.length; index += 1) {
    for (let inner = index + 1; inner < activeEvents.length; inner += 1) {
      const left = activeEvents[index]!;
      const right = activeEvents[inner]!;
      const interval = Math.abs(left.midi - right.midi);
      const penalty = intervalPenalty(interval);
      const velocityWeight = (left.velocity + right.velocity) / 2;

      roughness +=
        penalty *
        velocityWeight *
        registerMultiplier(left.midi, right.midi) *
        spacingMultiplier(interval) *
        roleMultiplier(left, right) *
        voiceInteractionMultiplier(left, right) *
        sourceKindMultiplier(left, right) *
        overlapWeight(left, right, beat);
    }
  }

  return Number((roughness * densityMultiplier(activeEvents)).toFixed(4));
}

function getOverlapBeats(
  left: ExpandedScheduledEvent,
  right: ExpandedScheduledEvent,
): number {
  return Math.max(0, Math.min(left.endBeat, right.endBeat) - Math.max(left.beat, right.beat));
}

function getRegisterBand(
  midiA: number,
  midiB: number,
): RoughnessCause["registerBand"] {
  const averageMidi = (midiA + midiB) / 2;

  if (averageMidi >= 76) {
    return "high";
  }

  if (averageMidi >= 56) {
    return "mid";
  }

  return "low";
}

function intervalName(intervalSemitones: number): string {
  switch (normalizedInterval(intervalSemitones)) {
    case 1:
      return "minor second";
    case 2:
      return "major second";
    case 3:
      return "minor third";
    case 4:
      return "major third";
    case 5:
      return "perfect fourth";
    case 6:
      return "tritone";
    case 7:
      return "perfect fifth";
    case 8:
      return "minor sixth";
    case 9:
      return "major sixth";
    case 10:
      return "minor seventh";
    case 11:
      return "major seventh";
    default:
      return "unison";
  }
}

function describeRoughnessInterval(intervalSemitones: number): string {
  const distance = Math.abs(intervalSemitones);
  const baseName = intervalName(intervalSemitones);

  if (distance <= 7) {
    return baseName;
  }

  return `${baseName} class`;
}

function capitalize(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return value[0]!.toUpperCase() + value.slice(1);
}

function getEventPairKey(event: ExpandedScheduledEvent): string {
  return event.layerId ?? `${event.voiceId}:${event.synth}`;
}

function sortEventPair(
  left: ExpandedScheduledEvent,
  right: ExpandedScheduledEvent,
): [ExpandedScheduledEvent, ExpandedScheduledEvent] {
  const leftKey = `${getEventPairKey(left)}|${left.pitch}|${left.beat.toFixed(4)}`;
  const rightKey = `${getEventPairKey(right)}|${right.pitch}|${right.beat.toFixed(4)}`;

  return leftKey <= rightKey ? [left, right] : [right, left];
}

function buildReason(params: {
  left: ExpandedScheduledEvent;
  right: ExpandedScheduledEvent;
  interval: number;
  registerBand: RoughnessCause["registerBand"];
}): string {
  const { left, right, interval, registerBand } = params;
  const [first, second] = sortEventPair(left, right);
  const voiceA = describeVoiceId(first.voiceId, first.synth);
  const voiceB = describeVoiceId(second.voiceId, second.synth);
  const registerText =
    registerBand === "high" ? "high" : registerBand === "mid" ? "mid" : "low";

  return `${capitalize(registerText)} ${describeRoughnessInterval(interval)} between ${voiceA} ${first.pitch} and ${voiceB} ${second.pitch}.`;
}

function buildPatch(params: {
  left: ExpandedScheduledEvent;
  right: ExpandedScheduledEvent;
  interval: number;
  overlapBeats: number;
}): string {
  const { left, right, interval, overlapBeats } = params;
  const voices = new Set([left.voiceId, right.voiceId]);
  const normalized = normalizedInterval(interval);

  if (voices.has("bells")) {
    return "Shorten or re-register the bell accent.";
  }

  if (voices.has("pad") || voices.has("drone")) {
    return overlapBeats >= 0.75
      ? "Thin or spread the sustained harmony under the exposed note."
      : "Open the harmony or shorten one sustained note.";
  }

  if (voices.has("lead") && voices.has("counterline")) {
    return "Separate the two lines by step or register here.";
  }

  if (voices.has("bass")) {
    return "Open the low spacing or simplify the bass attack.";
  }

  if (normalized === 1 || normalized === 2) {
    return "Re-register one note or shorten the overlap.";
  }

  if (normalized === 6) {
    return "Move one line by step to avoid the exposed tritone.";
  }

  return "Open the spacing or thin one note at this beat.";
}

function getExposureMultiplier(
  events: ExpandedScheduledEvent[],
  beat: number,
): number {
  const activeCount = getActiveEventsAtBeat(events, beat).length;

  if (activeCount <= 2) {
    return 1.18;
  }

  if (activeCount <= 4) {
    return 1;
  }

  return 0.9;
}

export function buildRoughnessCauses(params: {
  events: ExpandedScheduledEvent[];
  beatsPerBar: number;
  cadenceStrengthByBar?: number[];
  limit?: number;
}): RoughnessCause[] {
  const { events, beatsPerBar, cadenceStrengthByBar = [], limit = 8 } = params;
  const sortedEvents = [...events].sort((left, right) => {
    if (left.beat !== right.beat) {
      return left.beat - right.beat;
    }

    return left.midi - right.midi;
  });
  const causes = new Map<string, RoughnessCause>();

  for (let index = 0; index < sortedEvents.length; index += 1) {
    const left = sortedEvents[index]!;

    for (let inner = index + 1; inner < sortedEvents.length; inner += 1) {
      const right = sortedEvents[inner]!;

      if (right.beat >= left.endBeat) {
        break;
      }

      const overlapBeats = getOverlapBeats(left, right);
      if (overlapBeats < 0.05) {
        continue;
      }

      const interval = Math.abs(left.midi - right.midi);
      const penalty = intervalPenalty(interval);
      if (penalty < 0.35) {
        continue;
      }

      const overlapStart = Math.max(left.beat, right.beat);
      const overlapMidpoint = overlapStart + overlapBeats * 0.5;
      const barIndex = Math.max(
        left.barIndex,
        Math.max(0, Math.floor(overlapStart / beatsPerBar)),
      );
      const cadenceFactor =
        0.94 + Math.min(0.26, (cadenceStrengthByBar[barIndex] ?? 0) * 0.08);
      const overlapScale = Math.max(0.35, Math.min(1.4, overlapBeats / 0.75));
      const score =
        penalty *
        ((left.velocity + right.velocity) / 2) *
        registerMultiplier(left.midi, right.midi) *
        spacingMultiplier(interval) *
        roleMultiplier(left, right) *
        voiceInteractionMultiplier(left, right) *
        sourceKindMultiplier(left, right) *
        cadenceFactor *
        overlapScale *
        getExposureMultiplier(sortedEvents, overlapMidpoint);

      if (score < 0.18) {
        continue;
      }

      const registerBand = getRegisterBand(left.midi, right.midi);
      const roundedBeat = Number(overlapStart.toFixed(4));
      const [first, second] = sortEventPair(left, right);
      const key = [
        barIndex,
        first.sectionId ?? second.sectionId ?? "",
        getEventPairKey(first),
        getEventPairKey(second),
        normalizedInterval(interval),
        registerBand,
      ].join("|");
      const severity: RoughnessCause["severity"] =
        score >= 0.72 ? "error" : score >= 0.4 ? "warning" : "info";
      const cause: RoughnessCause = {
        beat: roundedBeat,
        bar: barIndex + 1,
        sectionId: left.sectionId === right.sectionId ? left.sectionId : left.sectionId ?? right.sectionId,
        sectionRole:
          left.sectionRole === right.sectionRole
            ? left.sectionRole
            : left.sectionRole ?? right.sectionRole,
        pitchA: first.pitch,
        pitchB: second.pitch,
        midiA: first.midi,
        midiB: second.midi,
        layerIdA: first.layerId,
        layerIdB: second.layerId,
        voiceA: first.voiceId,
        voiceB: second.voiceId,
        synthA: first.synth,
        synthB: second.synth,
        intervalSemitones: interval,
        overlapBeats: Number(overlapBeats.toFixed(4)),
        registerBand,
        score: Number(score.toFixed(4)),
        reason: buildReason({
          left: first,
          right: second,
          interval,
          registerBand,
        }),
        patch: buildPatch({
          left: first,
          right: second,
          interval,
          overlapBeats,
        }),
        severity,
      };
      const previous = causes.get(key);

      if (!previous || cause.score > previous.score) {
        causes.set(key, cause);
      }
    }
  }

  return [...causes.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function buildRoughnessSeriesFromEvents(params: {
  events: ExpandedScheduledEvent[];
  bpm: number;
  durationSeconds: number;
  sampleRate: number;
  windowSize: number;
  hopSize: number;
}): number[] {
  const { events, bpm, durationSeconds, sampleRate, windowSize, hopSize } = params;
  const windowCount = Math.max(
    1,
    Math.floor((durationSeconds * sampleRate - windowSize) / hopSize) + 1,
  );

  return Array.from({ length: windowCount }, (_, index) => {
    const startSeconds = (index * hopSize) / sampleRate;
    const windowSeconds = windowSize / sampleRate;
    const beatScale = 60 / bpm;
    const sampleBeats = [0.25, 0.5, 0.75].map(
      (position) => (startSeconds + windowSeconds * position) / beatScale,
    );
    const roughness =
      sampleBeats.reduce(
        (sum, sampleBeat) => sum + estimateSymbolicRoughnessAtBeat(events, sampleBeat),
        0,
      ) / sampleBeats.length;
    return Number(roughness.toFixed(4));
  });
}
