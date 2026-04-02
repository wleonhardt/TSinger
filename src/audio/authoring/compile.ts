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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function roundToGrid(value: number): number {
  return Number(value.toFixed(4));
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

function shouldKeepDraft(
  layer: PhraseLayerPlan,
  draft: PatternNoteDraft,
  plan: PhrasePlan,
  sections: CompiledSection[],
): boolean {
  if (!draft.ornament) {
    return true;
  }

  if (layer.allowOrnaments === false) {
    return false;
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
): number {
  const density = getDensityAtBeat(plan.arrangement, draft.beat, sections);
  const cadence = getCadentialWeightAtBeat(plan.arrangement, draft.beat, sections);
  const baseVelocity = draft.velocity ?? 0.5;
  const scale = layer.velocityScale ?? 1;

  return clamp(
    baseVelocity * scale * (0.92 + cadence * 0.12) * Math.min(1.1, 0.85 + density * 0.2),
    0.04,
    1,
  );
}

function compileDraftNotes(
  drafts: PatternNoteDraft[],
  layer: PhraseLayerPlan,
  plan: PhrasePlan,
  harmony: ExpandedHarmonySpan[],
  sections: CompiledSection[],
  layerId: string,
): NoteEvent[] {
  const sortedDrafts = [...drafts].sort((left, right) => left.beat - right.beat);
  const notes: NoteEvent[] = [];
  let previousPitch: string | null = null;

  for (const draft of sortedDrafts) {
    if (!shouldKeepDraft(layer, draft, plan, sections)) {
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

    const section = findSectionAtBeat(sections, draft.beat);
    const voiceId = resolveVoiceId(
      draft.voiceId ?? layer.voiceId,
      layer.synth,
      { ornament: draft.ornament === true },
    );
    previousPitch = resolved.pitch;
    notes.push({
      beat: roundToGrid(draft.beat),
      length: roundToGrid(Math.max(0.05, draft.length)),
      pitch: resolved.pitch,
      glideTo: resolved.glideTo,
      synth: layer.synth,
      velocity: roundToGrid(applyLayerVelocity(layer, draft, plan, sections)),
      pan: roundToGrid((draft.pan ?? 0) + (layer.pan ?? 0)),
      voiceId,
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
      });
    }
  }

  return compileDraftNotes(drafts, layer, plan, harmony, sections, layerId);
}

export function compilePatternLayer(
  layer: DraftLayerPlan,
  plan: PhrasePlan,
  harmony: ExpandedHarmonySpan[],
  sections: CompiledSection[],
  layerId: string,
): NoteEvent[] {
  return compileDraftNotes(layer.notes, layer, plan, harmony, sections, layerId);
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
  const sections = compileSections(plan);
  const harmony = expandHarmonyPlan(plan);
  const noteLayers = plan.noteLayers ?? [];
  const chords: ChordEvent[] =
    plan.padLayers && plan.padLayers.length > 0
      ? plan.padLayers.flatMap((layer) =>
          (layer.overrideHarmony ?? plan.harmony).map((item, index, list) => {
            const nextBar = list[index + 1]?.bar;
            const lengthBars =
              item.lengthBars ?? (nextBar !== undefined ? nextBar - item.bar : 1);
            const beat = item.bar * plan.beatsPerBar;
            const layerId = getResolvedLayerId(layer, index, "pad");

            return {
              beat,
              length: lengthBars * plan.beatsPerBar,
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
      : plan.harmony
          .filter((item) => item.synth)
          .map((item, index, list) => {
            const nextBar = list[index + 1]?.bar;
            const lengthBars =
              item.lengthBars ?? (nextBar !== undefined ? nextBar - item.bar : 1);
            const beat = item.bar * plan.beatsPerBar;

            return {
              beat,
              length: lengthBars * plan.beatsPerBar,
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
        ? compileMotifToNotes(layer, plan, harmony, sections, layerId)
        : compilePatternLayer(layer, plan, harmony, sections, layerId);
    }),
  );

  return {
    notes,
    chords: normalizeAndSortChords(chords),
    sections,
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
