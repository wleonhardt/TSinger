import type { ChordEvent, NoteEvent } from "../composition";
import type { CompiledSection } from "../metadata";
import { midiToNote, noteToMidi, transpose } from "../theory";
import { resolveVoiceId } from "../voiceIdentity";
import {
  getAllowedTonesOverHarmony,
  getChordTones,
  pickColorTone,
  resolveScaleDegreeToPitch,
} from "./harmony";
import {
  getBrightnessAtBeat,
  getCadentialWeightAtBeat,
  getDensityAtBeat,
  getRegisterBiasAtBeat,
  shouldOrnament,
} from "./arrangement";
import { compileSections, findSectionAtBeat } from "./sections";
import { defaultRealization, realizeDrafts } from "./realization";
import {
  analyzeRhythmCoherence,
  computeRhythmVelocityFactor,
  getCadenceWindowAtBeat,
  getBarRoleAtBeat,
  inferRhythmRole,
  resolveCadenceWindows,
  resolveBarRole,
  rhythmOrnamentDensityFactor,
  type CadenceTimingContract,
  type ResolvedCadenceWindow,
  type RhythmRole,
} from "./rhythm";
import {
  addSpan,
  absoluteBeatToPosition,
  type BoundaryTarget,
  cadenceBeat,
  describeBoundaryTarget,
  describeSwingProfile,
  normalizeMeter,
  normalizeSwingProfile,
  positionToBeats,
  resolvePhraseBoundary,
  spanToBeats,
  type MeterSpec,
  type Position,
  type SwingProfile,
  type TimingIntent,
  type TimingMetadata,
} from "./timing";
import {
  type CompiledPhrase,
  type DraftLayerPlan,
  type HarmonyPlanItem,
  type MotifLayerPlan,
  type PadLayerPlan,
  type PatternNoteDraft,
  type PhraseLayerPlan,
  type PhrasePlan,
  type RegisterRange,
  type ValidationIssue,
} from "./types";
import {
  nearestPitchClassInRegister,
  pickNearestMelodicTone,
} from "./voiceLeading";

type ExpandedHarmonySpan = HarmonyPlanItem & {
  startBeat: number;
  endBeat: number;
};

type TimingCompilationState = {
  meter: MeterSpec;
  swing: SwingProfile;
  symbolicPlacementCount: number;
  insights: TimingMetadata["insights"];
  issues: TimingMetadata["issues"];
  seenIntentKeys: Set<string>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function roundToGrid(value: number): number {
  return Number(value.toFixed(4));
}

function createTimingState(plan: PhrasePlan): TimingCompilationState {
  const normalizedMeter = normalizeMeter({
    beatsPerBar: plan.beatsPerBar,
    beatUnit: plan.meter?.beatUnit ?? 4,
    pickupBeats: plan.meter?.pickupBeats,
  });

  return {
    meter: normalizedMeter,
    swing: normalizeSwingProfile(plan.swing),
    symbolicPlacementCount: 0,
    insights: [
      {
        kind: "swing",
        message: `Timing grid: ${normalizedMeter.beatsPerBar}/${normalizedMeter.beatUnit} with ${describeSwingProfile(plan.swing)}.`,
      },
    ],
    issues:
      plan.meter && plan.meter.beatsPerBar !== plan.beatsPerBar
        ? [
            {
              code: "meter-mismatch",
              level: "warning",
              message: `Meter beatsPerBar (${plan.meter.beatsPerBar}) did not match phrase beatsPerBar (${plan.beatsPerBar}); compile used ${plan.beatsPerBar}.`,
            },
          ]
        : [],
    seenIntentKeys: new Set(),
  };
}

function buildTimingMetadata(state: TimingCompilationState): TimingMetadata {
  return {
    meter: state.meter,
    swing: state.swing,
    summary: `${state.meter.beatsPerBar}/${state.meter.beatUnit} meter, ${describeSwingProfile(state.swing)}.`,
    symbolicPlacementCount: state.symbolicPlacementCount,
    insights: state.insights,
    issues: state.issues,
  };
}

function incrementSymbolicCount(
  state: TimingCompilationState,
  enabled: boolean,
): void {
  if (enabled) {
    state.symbolicPlacementCount += 1;
  }
}

function resolveGlobalBeat(
  beat: number,
  at: Position | undefined,
  state: TimingCompilationState,
): number {
  if (at) {
    incrementSymbolicCount(state, true);
    return positionToBeats(at, state.meter, state.swing);
  }

  return beat;
}

function resolveGlobalLength(
  startBeat: number,
  at: Position | undefined,
  length: number,
  duration: PatternNoteDraft["duration"],
  state: TimingCompilationState,
): number {
  if (duration) {
    const startPosition = at ?? absoluteBeatToPosition(startBeat, state.meter, state.swing);
    incrementSymbolicCount(state, true);
    const endPosition = addSpan(startPosition, duration, state.meter);
    return positionToBeats(endPosition, state.meter, state.swing) -
      positionToBeats(startPosition, state.meter, state.swing);
  }

  return length;
}

function resolveLocalBeat(beat: number, state: TimingCompilationState): number {
  return beat;
}

function resolveBoundaryBeat(
  target: BoundaryTarget,
  intentKind: "cadence" | "pickup" | "boundary",
  state: TimingCompilationState,
): number {
  const position =
    intentKind === "cadence"
      ? cadenceBeat(target, state.meter)
      : resolvePhraseBoundary(target, state.meter);
  return positionToBeats(position, state.meter, state.swing);
}

function pushTimingInsight(
  state: TimingCompilationState,
  key: string,
  insight: TimingMetadata["insights"][number],
): void {
  if (state.seenIntentKeys.has(key)) {
    return;
  }

  state.seenIntentKeys.add(key);
  state.insights.push(insight);
}

function pushTimingIssue(
  state: TimingCompilationState,
  issue: TimingMetadata["issues"][number],
): void {
  state.issues.push(issue);
}

function formatBeatForMessage(
  beat: number,
  state: TimingCompilationState,
): string {
  const position = absoluteBeatToPosition(beat, state.meter, state.swing);
  const subdivision =
    position.subdivision !== undefined && position.subdivisionUnit !== undefined
      ? ` + ${position.subdivision}/${position.subdivisionUnit}`
      : "";

  return `bar ${position.bar}, beat ${position.beat}${subdivision}`;
}

function resolvePatternIntent(
  intent: TimingIntent | undefined,
  actualBeat: number,
  layerId: string,
  state: TimingCompilationState,
): void {
  if (!intent) {
    return;
  }

  if (intent.kind === "repeat") {
    pushTimingInsight(
      state,
      `${layerId}:repeat:${intent.startBar}:${intent.everyBars}:${intent.repetitions}:${intent.label ?? ""}`,
      {
        kind: "repeat",
        layerId,
        beat: actualBeat,
        message:
          intent.label ??
          `${layerId} repeats every ${intent.everyBars === 1 ? "bar" : `${intent.everyBars} bars`} for ${intent.repetitions} passes and stays bar-aligned.`,
      },
    );
    return;
  }

  const expectedBeat = resolveBoundaryBeat(intent.target, intent.kind, state);
  const delta = Math.abs(expectedBeat - actualBeat);
  const boundaryText = describeBoundaryTarget(intent.target);

  if (intent.kind === "pickup") {
    const expectedPickupBeat = positionToBeats(
      addSpan(resolvePhraseBoundary(intent.target, state.meter), {
        bars: intent.distance.bars !== undefined ? -intent.distance.bars : undefined,
        beats: intent.distance.beats !== undefined ? -intent.distance.beats : undefined,
        subdivisions:
          intent.distance.subdivisions !== undefined ? -intent.distance.subdivisions : undefined,
        subdivisionUnit: intent.distance.subdivisionUnit,
      }, state.meter),
      state.meter,
      state.swing,
    );
    const pickupDelta = Math.abs(expectedPickupBeat - actualBeat);
    if (pickupDelta <= 0.01) {
      pushTimingInsight(
        state,
        `${layerId}:pickup:${expectedPickupBeat.toFixed(3)}:${intent.label ?? ""}`,
        {
          kind: "pickup",
          layerId,
          beat: actualBeat,
          message:
            intent.label ??
            `${layerId} pickup lands ${intent.distance.subdivisions === 1 && intent.distance.subdivisionUnit === 2 ? "one 8th" : "in pickup space"} before ${boundaryText}.`,
        },
      );
    } else {
      pushTimingIssue(state, {
        code: "pickup-misalignment",
        level: "warning",
        layerId,
        beat: actualBeat,
        message: `${layerId} pickup missed ${boundaryText} by ${pickupDelta.toFixed(3)} beats.`,
      });
    }
    return;
  }

  if (delta <= 0.01) {
    pushTimingInsight(
      state,
      `${layerId}:${intent.kind}:${expectedBeat.toFixed(3)}:${intent.label ?? ""}`,
      {
        kind: intent.kind,
        layerId,
        beat: actualBeat,
        message:
          intent.label ??
          `${layerId} ${intent.kind === "cadence" ? "resolves" : "lands"} on ${boundaryText} as intended.`,
      },
    );
    return;
  }

  pushTimingIssue(state, {
    code: `${intent.kind}-misalignment`,
    level: "warning",
    layerId,
    beat: actualBeat,
    message: `${layerId} ${intent.kind} target missed ${boundaryText} by ${delta.toFixed(3)} beats.`,
  });
}

function normalizeArrangement(
  plan: PhrasePlan,
  state: TimingCompilationState,
): PhrasePlan["arrangement"] {
  if (!plan.arrangement) {
    return plan.arrangement;
  }

  const resolvePoints = (
    points: NonNullable<PhrasePlan["arrangement"]>["densityCurve"],
  ) =>
    points?.map((point) => {
      incrementSymbolicCount(state, point.at !== undefined);
      return {
        ...point,
        beat:
          point.at !== undefined
            ? positionToBeats(point.at, state.meter, state.swing)
            : point.beat,
      };
    });

  return {
    densityCurve: resolvePoints(plan.arrangement.densityCurve),
    registerCurve: resolvePoints(plan.arrangement.registerCurve),
    brightnessCurve: resolvePoints(plan.arrangement.brightnessCurve),
    cadenceCurve: resolvePoints(plan.arrangement.cadenceCurve),
    ornamentBaseProbability: plan.arrangement.ornamentBaseProbability,
  };
}

function normalizeDraftLayer(
  layer: DraftLayerPlan,
  state: TimingCompilationState,
): DraftLayerPlan {
  return {
    ...layer,
    notes: layer.notes.map((note) => {
      const beat = resolveGlobalBeat(note.beat, note.at, state);
      const length = resolveGlobalLength(beat, note.at, note.length, note.duration, state);

      return {
        ...note,
        beat,
        length,
      };
    }),
  };
}

function normalizeMotifLayer(
  layer: MotifLayerPlan,
  state: TimingCompilationState,
): MotifLayerPlan {
  incrementSymbolicCount(state, layer.positionOffset !== undefined);
  incrementSymbolicCount(state, layer.repeatEvery !== undefined);
  const beatOffset =
    (layer.beatOffset ?? 0) +
    (layer.positionOffset
      ? positionToBeats(layer.positionOffset, state.meter, state.swing)
      : 0);

  return {
    ...layer,
    beatOffset,
    repeatEveryBeats:
      layer.repeatEvery !== undefined
        ? spanToBeats(layer.repeatEvery, state.meter, state.swing)
        : layer.repeatEveryBeats,
  };
}

function normalizePhrasePlan(
  plan: PhrasePlan,
  state: TimingCompilationState,
): PhrasePlan {
  return {
    ...plan,
    arrangement: normalizeArrangement(plan, state),
    noteLayers: plan.noteLayers?.map((layer) =>
      layer.kind === "motif"
        ? normalizeMotifLayer(layer, state)
        : normalizeDraftLayer(layer, state),
    ),
  };
}

function validateCompiledTimingBounds(
  notes: NoteEvent[],
  chords: ChordEvent[],
  plan: PhrasePlan,
  state: TimingCompilationState,
): void {
  const phraseBeats = plan.bars * plan.beatsPerBar;
  const allEvents = [
    ...notes.map((note) => ({
      layerId: note.layerId ?? note.synth,
      beat: note.beat,
      endBeat: note.beat + note.length,
      type: "note" as const,
    })),
    ...chords.map((chord) => ({
      layerId: chord.layerId ?? chord.synth,
      beat: chord.beat,
      endBeat: chord.beat + chord.length,
      type: "chord" as const,
    })),
  ];

  for (const event of allEvents) {
    if (event.beat < -0.0001) {
      pushTimingIssue(state, {
        code: "negative-start",
        level: "warning",
        layerId: event.layerId,
        beat: event.beat,
        message: `${event.layerId} starts before the phrase at ${formatBeatForMessage(event.beat, state)}.`,
      });
    }

    if (event.endBeat > phraseBeats + 0.0001) {
      pushTimingIssue(state, {
        code: "phrase-overrun",
        level: "warning",
        layerId: event.layerId,
        beat: event.beat,
        message: `${event.layerId} overruns the phrase boundary by ${(event.endBeat - phraseBeats).toFixed(3)} beats.`,
      });
    }
  }
}

function midpointPitch(register: RegisterRange): string {
  const minMidi = noteToMidi(register.min);
  const maxMidi = noteToMidi(register.max);
  return midiToNote(Math.round((minMidi + maxMidi) / 2));
}

function expandHarmonyPlan(plan: PhrasePlan): ExpandedHarmonySpan[] {
  const sorted = [...plan.harmony].sort((left, right) => left.bar - right.bar);
  const phraseBeats = plan.bars * plan.beatsPerBar;

  return sorted.map((item, index) => {
    const startBeat = item.bar * plan.beatsPerBar;
    const nextBarBeat =
      sorted[index + 1]?.bar !== undefined
        ? sorted[index + 1]!.bar * plan.beatsPerBar
        : phraseBeats;
    const endBeat = item.lengthBars
      ? startBeat + item.lengthBars * plan.beatsPerBar
      : nextBarBeat;

    return {
      ...item,
      startBeat,
      endBeat,
    };
  });
}

function getHarmonyAtBeat(
  harmony: ExpandedHarmonySpan[],
  beat: number,
): ExpandedHarmonySpan {
  return (
    harmony.find((item) => beat >= item.startBeat && beat < item.endBeat) ??
    harmony[harmony.length - 1]!
  );
}

function getRegisterForLayer(
  layer: PhraseLayerPlan,
): RegisterRange {
  return (
    layer.register ?? {
      min: "C4",
      max: "C6",
      anchor: "A4",
    }
  );
}

function getBiasedAnchorPitch(
  register: RegisterRange,
  beat: number,
  plan: PhrasePlan,
  sections: CompiledSection[],
  previousPitch: string | null,
): string {
  const baseAnchor = previousPitch ?? register.anchor ?? midpointPitch(register);
  const registerBias = getRegisterBiasAtBeat(plan.arrangement, beat, sections);
  const brightness = getBrightnessAtBeat(plan.arrangement, beat, sections);
  const shift = Math.round(registerBias * 4 + (brightness - 0.5) * 4);
  const minMidi = noteToMidi(register.min);
  const maxMidi = noteToMidi(register.max);
  const shiftedMidi = clamp(noteToMidi(baseAnchor) + shift, minMidi, maxMidi);

  return midiToNote(shiftedMidi);
}

function coerceIntoRegister(
  pitch: string,
  register: RegisterRange,
  anchorPitch: string,
): string {
  const midi = noteToMidi(pitch);

  if (midi >= noteToMidi(register.min) && midi <= noteToMidi(register.max)) {
    return pitch;
  }

  return nearestPitchClassInRegister(
    noteToMidi(pitch) % 12,
    anchorPitch,
    register.min,
    register.max,
  );
}

function resolveChordDegreePitch(
  chordTones: string[],
  chordDegree: number,
): string {
  const chordLength = chordTones.length;
  const normalizedIndex = modulo(chordDegree, chordLength);
  const octaveCycles = Math.floor((chordDegree - normalizedIndex) / chordLength);

  return transpose(chordTones[normalizedIndex]!, octaveCycles * 12);
}

function pickTargetedHarmonicPitch(
  preferredPitch: string,
  previousPitch: string | null,
  allowedPitches: string[],
  register: RegisterRange,
  toneIntent: PatternNoteDraft["toneIntent"],
): string {
  const allowedInRange = allowedPitches.filter((pitch) => {
    const midi = noteToMidi(pitch);
    return midi >= noteToMidi(register.min) && midi <= noteToMidi(register.max);
  });

  if (allowedInRange.length === 0) {
    return preferredPitch;
  }

  const safePreferredPitch = pickNearestMelodicTone(preferredPitch, allowedInRange, {
    minPitch: register.min,
    maxPitch: register.max,
    anchorPitch: preferredPitch,
    preferDirection: "nearest",
    maxLeapSemitones: Number.POSITIVE_INFINITY,
  });

  if (!previousPitch) {
    return safePreferredPitch;
  }

  const maxLeapSemitones = toneIntent === "passing" ? 7 : 12;
  if (Math.abs(noteToMidi(safePreferredPitch) - noteToMidi(previousPitch)) <= maxLeapSemitones) {
    return safePreferredPitch;
  }

  return pickNearestMelodicTone(previousPitch, allowedInRange, {
    minPitch: register.min,
    maxPitch: register.max,
    anchorPitch: safePreferredPitch,
    preferDirection: toneIntent === "passing" ? "nearest" : "up",
    maxLeapSemitones,
  });
}

function normalizeCadenceContracts(
  plan: PhrasePlan,
): CadenceTimingContract[] {
  if (!plan.cadenceTiming) {
    return [];
  }

  return Array.isArray(plan.cadenceTiming)
    ? plan.cadenceTiming
    : [plan.cadenceTiming];
}

function resolveDraftRhythmRole(
  draft: PatternNoteDraft,
  layer: PhraseLayerPlan,
): RhythmRole | undefined {
  const voiceId = draft.voiceId ?? layer.voiceId;
  return inferRhythmRole(voiceId, layer.synth, draft.rhythmRole ?? layer.rhythmRole);
}

function shouldKeepDraft(
  layer: PhraseLayerPlan,
  draft: PatternNoteDraft,
  plan: PhrasePlan,
  sections: CompiledSection[],
  cadenceWindows: ResolvedCadenceWindow[],
  rhythmRole: RhythmRole | undefined,
): boolean {
  const meter = {
    beatsPerBar: plan.beatsPerBar,
    beatUnit: 4,
  } satisfies MeterSpec;
  const barRole = getBarRoleAtBeat(draft.beat, meter, sections);

  if (!draft.ornament) {
    return true;
  }

  if (layer.allowOrnaments === false) {
    return false;
  }

  const cadenceWindow = getCadenceWindowAtBeat(draft.beat, cadenceWindows);
  if (cadenceWindow) {
    if (
      cadenceWindow.thinBeforeArrival &&
      cadenceWindow.preCadenceStartBeat !== null &&
      draft.beat >= cadenceWindow.preCadenceStartBeat - 0.01 &&
      draft.beat < cadenceWindow.cadenceStartBeat - 0.01
    ) {
      return false;
    }

    if (draft.beat >= cadenceWindow.cadenceStartBeat - 0.01) {
      if (rhythmOrnamentDensityFactor(barRole, rhythmRole) <= 0.3) {
        return false;
      }

      if (
        !cadenceWindow.allowPickup &&
        draft.beat < cadenceWindow.targetAbsoluteBeat - 0.01
      ) {
        return false;
      }

      if (draft.beat >= cadenceWindow.targetAbsoluteBeat - 0.01) {
        return false;
      }
    }
  }

  if (getDensityAtBeat(plan.arrangement, draft.beat, sections) < 0.45) {
    return false;
  }

  return shouldOrnament(
    plan.arrangement,
    draft.beat,
    `${layer.id ?? layer.synth}:ornament`,
    sections,
  );
}

function resolveGlidePitch(
  draft: PatternNoteDraft,
  plan: PhrasePlan,
  register: RegisterRange,
  anchorPitch: string,
): string | undefined {
  if (draft.glideToDegree === undefined) {
    return undefined;
  }

  return resolveScaleDegreeToPitch(
    plan.key.root,
    plan.key.scale,
    draft.glideToDegree,
    register,
    anchorPitch,
  );
}

function resolveDraftPitch(
  draft: PatternNoteDraft,
  layer: PhraseLayerPlan,
  plan: PhrasePlan,
  span: ExpandedHarmonySpan,
  sections: CompiledSection[],
  previousPitch: string | null,
): { pitch: string; glideTo?: string } | null {
  const register = getRegisterForLayer(layer);
  const anchorPitch = getBiasedAnchorPitch(register, draft.beat, plan, sections, previousPitch);
  const chordTones = getChordTones(span.root, span.quality);
  let resolvedPitch: string | null = null;

  if (draft.pitch) {
    const looksAbsolute = /\d/.test(draft.pitch);
    resolvedPitch = looksAbsolute
      ? draft.pitch
      : nearestPitchClassInRegister(
          noteToMidi(`${draft.pitch}4`) % 12,
          previousPitch ?? anchorPitch,
          register.min,
          register.max,
        );
  } else if (draft.chordDegree !== undefined) {
    const target = resolveChordDegreePitch(chordTones, draft.chordDegree);
    resolvedPitch = nearestPitchClassInRegister(
      noteToMidi(target) % 12,
      previousPitch ?? anchorPitch,
      register.min,
      register.max,
    );
  } else if (draft.degree !== undefined) {
    const scalePitch = resolveScaleDegreeToPitch(
      plan.key.root,
      plan.key.scale,
      draft.degree,
      register,
      previousPitch ?? anchorPitch,
    );
    const chromaticPitch = draft.chromaticOffset
      ? transpose(scalePitch, draft.chromaticOffset)
      : scalePitch;

    if (draft.toneIntent === "color") {
      resolvedPitch =
        pickColorTone({
          chordRoot: span.root,
          chordQuality: span.quality,
          keyRoot: plan.key.root,
          scaleName: plan.key.scale,
          register,
          anchorPitch: chromaticPitch,
          preferBright: getBrightnessAtBeat(plan.arrangement, draft.beat, sections) > 0.55,
        }) ?? chromaticPitch;
    } else if (layer.clampToHarmony || draft.toneIntent === "chord") {
      const allowed = getAllowedTonesOverHarmony(
        span.root,
        span.quality,
        plan.key.root,
        plan.key.scale,
        {
          register,
          includeChordTones: true,
          includeScaleTones: draft.toneIntent !== "chord",
          includeColorTones: draft.toneIntent === "passing",
        },
      );

      resolvedPitch = pickTargetedHarmonicPitch(
        chromaticPitch,
        previousPitch,
        allowed,
        register,
        draft.toneIntent,
      );
    } else {
      resolvedPitch = chromaticPitch;
    }
  }

  if (!resolvedPitch) {
    return null;
  }

  if (draft.octaveOffset) {
    resolvedPitch = transpose(resolvedPitch, draft.octaveOffset * 12);
  }

  resolvedPitch = coerceIntoRegister(
    resolvedPitch,
    register,
    previousPitch ?? anchorPitch,
  );

  return {
    pitch: resolvedPitch,
    glideTo: resolveGlidePitch(draft, plan, register, resolvedPitch),
  };
}

function applyLayerVelocity(
  layer: PhraseLayerPlan,
  draft: PatternNoteDraft,
  plan: PhrasePlan,
  sections: CompiledSection[],
  rhythmRole: RhythmRole | undefined,
  barRole: ReturnType<typeof resolveBarRole>,
  cadenceWindows: ResolvedCadenceWindow[],
): number {
  const meter = {
    beatsPerBar: plan.beatsPerBar,
    beatUnit: 4,
  } satisfies MeterSpec;
  const density = getDensityAtBeat(plan.arrangement, draft.beat, sections);
  const cadence = getCadentialWeightAtBeat(plan.arrangement, draft.beat, sections);
  const baseVelocity = draft.velocity ?? 0.5;
  const scale = layer.velocityScale ?? 1;
  const cadenceWindow = getCadenceWindowAtBeat(draft.beat, cadenceWindows);
  let velocity =
    baseVelocity *
    scale *
    (0.92 + cadence * 0.12) *
    Math.min(1.1, 0.85 + density * 0.2) *
    computeRhythmVelocityFactor(draft.beat, meter, rhythmRole, barRole);

  if (draft.ornament) {
    velocity *= rhythmOrnamentDensityFactor(barRole, rhythmRole);
  }

  if (
    cadenceWindow &&
    cadenceWindow.thinBeforeArrival &&
    cadenceWindow.preCadenceStartBeat !== null &&
    draft.beat >= cadenceWindow.preCadenceStartBeat - 0.01 &&
    draft.beat < cadenceWindow.cadenceStartBeat - 0.01 &&
    (rhythmRole === "ornament" || rhythmRole === "punctuation")
  ) {
    velocity *= 0.72;
  }

  if (
    cadenceWindow &&
    draft.beat >= cadenceWindow.cadenceStartBeat - 0.01 &&
    (rhythmRole === "ornament" || rhythmRole === "punctuation") &&
    cadenceWindow.maxOrnamentVelocityNearCadence !== undefined
  ) {
    velocity = Math.min(velocity, cadenceWindow.maxOrnamentVelocityNearCadence);
  }

  return clamp(velocity, 0.04, 1);
}

function compileDraftNotes(
  drafts: PatternNoteDraft[],
  layer: PhraseLayerPlan,
  plan: PhrasePlan,
  harmony: ExpandedHarmonySpan[],
  sections: CompiledSection[],
  layerId: string,
  timingState: TimingCompilationState,
): NoteEvent[] {
  const sortedDrafts = [...drafts].sort((left, right) => left.beat - right.beat);
  const layerRhythmRole = inferRhythmRole(layer.voiceId, layer.synth, layer.rhythmRole);
  const realizationSpec =
    layer.realization === true
      ? defaultRealization(layerRhythmRole)
      : layer.realization;
  const realizedDrafts = realizationSpec
    ? realizeDrafts(sortedDrafts, realizationSpec, timingState.meter, sections, layerId)
    : sortedDrafts;
  const notes: NoteEvent[] = [];
  const cadenceWindows = resolveCadenceWindows(
    normalizeCadenceContracts(plan),
    timingState.meter,
    plan.bars,
  );
  let previousPitch: string | null = null;

  for (const draft of realizedDrafts) {
    const section = findSectionAtBeat(sections, draft.beat);
    const barRole = resolveBarRole(section ?? null);
    const voiceId = resolveVoiceId(
      draft.voiceId ?? layer.voiceId,
      layer.synth,
      { ornament: draft.ornament === true },
    );
    const rhythmRole = resolveDraftRhythmRole(draft, {
      ...layer,
      voiceId,
    });

    if (!shouldKeepDraft(layer, draft, plan, sections, cadenceWindows, rhythmRole)) {
      continue;
    }

    const span = getHarmonyAtBeat(harmony, draft.beat);
    const resolved = resolveDraftPitch(
      draft,
      layer,
      plan,
      span,
      sections,
      previousPitch,
    );
    if (!resolved) {
      continue;
    }

    previousPitch = resolved.pitch;
    resolvePatternIntent(draft.timingIntent ?? draft.at?.intent, draft.beat, layerId, timingState);
    notes.push({
      beat: roundToGrid(draft.beat),
      length: roundToGrid(Math.max(0.05, draft.length)),
      pitch: resolved.pitch,
      glideTo: resolved.glideTo,
      synth: layer.synth,
      velocity: roundToGrid(
        applyLayerVelocity(
          layer,
          draft,
          plan,
          sections,
          rhythmRole,
          barRole,
          cadenceWindows,
        ),
      ),
      pan: roundToGrid((draft.pan ?? 0) + (layer.pan ?? 0)),
      voiceId,
      rhythmRole,
      barRole,
      layerId,
      sectionId: section?.id,
      sectionRole: section?.role,
    });
  }

  return notes;
}

export function compileMotifToNotes(
  layer: MotifLayerPlan,
  plan: PhrasePlan,
  harmony: ExpandedHarmonySpan[],
  sections: CompiledSection[],
  layerId: string,
  timingState: TimingCompilationState,
): NoteEvent[] {
  const motifLength = layer.motif.steps.reduce(
    (length, step) => Math.max(length, step.beat + step.length),
    0,
  );
  const repeatEveryBeats = layer.repeatEveryBeats ?? motifLength;
  const repetitions = layer.repetitions ?? 1;
  const beatOffset = layer.beatOffset ?? 0;
  const drafts: PatternNoteDraft[] = [];

  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    for (const step of layer.motif.steps) {
      drafts.push({
        beat: beatOffset + repetition * repeatEveryBeats + step.beat,
        length: step.length,
        degree: layer.motif.anchorDegree + step.offset,
        chromaticOffset: step.chromaticOffset,
        octaveOffset: step.octaveOffset,
        velocity: step.velocity,
        pan: step.pan,
        toneIntent: step.toneIntent,
        ornament: step.ornament,
        voiceId: step.voiceId,
        rhythmRole: step.rhythmRole,
        timingIntent: step.timingIntent,
      });
    }
  }

  return compileDraftNotes(drafts, layer, plan, harmony, sections, layerId, timingState);
}

export function compilePatternLayer(
  layer: DraftLayerPlan,
  plan: PhrasePlan,
  harmony: ExpandedHarmonySpan[],
  sections: CompiledSection[],
  layerId: string,
  timingState: TimingCompilationState,
): NoteEvent[] {
  return compileDraftNotes(layer.notes, layer, plan, harmony, sections, layerId, timingState);
}

export function mergeEventLayers(...layers: NoteEvent[][]): NoteEvent[] {
  return normalizeAndSortEvents(layers.flat());
}

export function normalizeAndSortEvents(events: NoteEvent[]): NoteEvent[] {
  const seen = new Set<string>();

  return [...events]
    .filter((event) => event.length > 0)
    .map((event) => ({
      ...event,
      beat: roundToGrid(event.beat),
      length: roundToGrid(event.length),
      velocity: event.velocity !== undefined ? roundToGrid(event.velocity) : undefined,
      pan: event.pan !== undefined ? roundToGrid(event.pan) : undefined,
    }))
    .sort((left, right) => {
      if (left.beat !== right.beat) {
        return left.beat - right.beat;
      }

      if (left.synth !== right.synth) {
        return left.synth.localeCompare(right.synth);
      }

      return left.pitch.localeCompare(right.pitch);
    })
    .filter((event) => {
      const key = [
        event.beat,
        event.synth,
        event.voiceId ?? "",
        event.layerId ?? "",
        event.pitch,
        event.length,
      ].join("|");
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function normalizeAndSortChords(chords: ChordEvent[]): ChordEvent[] {
  return [...chords]
    .map((chord) => ({
      ...chord,
      beat: roundToGrid(chord.beat),
      length: roundToGrid(chord.length),
      velocity: chord.velocity !== undefined ? roundToGrid(chord.velocity) : undefined,
    }))
    .sort((left, right) => left.beat - right.beat);
}

function getResolvedLayerId(
  layer: Pick<PhraseLayerPlan, "id" | "kind" | "synth"> | Pick<PadLayerPlan, "id" | "synth">,
  index: number,
  prefix: string,
): string {
  return layer.id ?? `${prefix}:${index}:${layer.synth}`;
}

function getSectionMetadata(
  sections: CompiledSection[],
  beat: number,
): Pick<NoteEvent, "sectionId" | "sectionRole"> {
  const section = findSectionAtBeat(sections, beat);

  return {
    sectionId: section?.id,
    sectionRole: section?.role,
  };
}

export function compilePhrasePlan(plan: PhrasePlan): CompiledPhrase {
  const timingState = createTimingState(plan);
  const normalizedPlan = normalizePhrasePlan(plan, timingState);
  const sections = compileSections(normalizedPlan);
  const cadenceContracts = normalizeCadenceContracts(normalizedPlan);
  const harmony = expandHarmonyPlan(normalizedPlan);
  const noteLayers = normalizedPlan.noteLayers ?? [];
  const chords: ChordEvent[] =
    normalizedPlan.padLayers && normalizedPlan.padLayers.length > 0
      ? normalizedPlan.padLayers.flatMap((layer) =>
          (layer.overrideHarmony ?? normalizedPlan.harmony).map((item, index, list) => {
            const nextBar = list[index + 1]?.bar;
            const lengthBars =
              item.lengthBars ?? (nextBar !== undefined ? nextBar - item.bar : 1);
            const beat = item.bar * normalizedPlan.beatsPerBar;
            const layerId = getResolvedLayerId(layer, index, "pad");

            return {
              beat,
              length: lengthBars * normalizedPlan.beatsPerBar,
              root: item.root,
              quality: item.quality,
              synth: layer.synth,
              velocity: (item.velocity ?? 0.22) * (layer.velocityScale ?? 1),
              inversion: item.inversion,
              spread: item.spread,
              voiceId: resolveVoiceId(layer.voiceId, layer.synth, { isPad: true }),
              layerId,
              ...getSectionMetadata(sections, beat),
            };
          }),
        )
      : normalizedPlan.harmony
          .filter((item) => item.synth)
          .map((item, index, list) => {
            const nextBar = list[index + 1]?.bar;
            const lengthBars =
              item.lengthBars ?? (nextBar !== undefined ? nextBar - item.bar : 1);
            const beat = item.bar * normalizedPlan.beatsPerBar;

            return {
              beat,
              length: lengthBars * normalizedPlan.beatsPerBar,
              root: item.root,
              quality: item.quality,
              synth: item.synth!,
              velocity: item.velocity,
              inversion: item.inversion,
              spread: item.spread,
              voiceId: resolveVoiceId(undefined, item.synth!, { isPad: true }),
              layerId: `harmony:${index}:${item.synth!}`,
              ...getSectionMetadata(sections, beat),
            };
          });

  const notes = mergeEventLayers(
    ...noteLayers.map((layer, index) => {
      const layerId = getResolvedLayerId(layer, index, layer.kind);
      return layer.kind === "motif"
        ? compileMotifToNotes(layer, normalizedPlan, harmony, sections, layerId, timingState)
        : compilePatternLayer(layer, normalizedPlan, harmony, sections, layerId, timingState);
    }),
  );
  validateCompiledTimingBounds(notes, chords, normalizedPlan, timingState);
  const rhythm = analyzeRhythmCoherence(
    notes,
    timingState.meter,
    normalizedPlan.bars,
    sections,
    cadenceContracts,
  );
  if (timingState.symbolicPlacementCount > 0) {
    timingState.insights.push({
      kind: "boundary",
      message: `${timingState.symbolicPlacementCount} symbolic timing placements were normalized into absolute beat events.`,
    });
  }

  return {
    notes,
    chords: normalizeAndSortChords(chords),
    sections,
    timing: buildTimingMetadata(timingState),
    rhythm,
  };
}

export function validateCompiledPhrase(compiled: CompiledPhrase): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const note of compiled.notes) {
    const midi = noteToMidi(note.pitch);
    if (midi < 24 || midi > 100) {
      issues.push({
        level: "warning",
        message: `Pitch ${note.pitch} sits outside the usual instrument range.`,
      });
    }

    const key = `${note.beat}|${note.pitch}|${note.synth}|${note.voiceId ?? ""}|${note.layerId ?? ""}`;
    if (seen.has(key)) {
      issues.push({
        level: "warning",
        message: `Duplicate note event at beat ${note.beat} for ${note.pitch}.`,
      });
    }
    seen.add(key);
  }

  return issues;
}
