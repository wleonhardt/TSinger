import { getPitchClass, midiToNote, noteToMidi } from "../theory";

type MelodicOptions = {
  minPitch?: string;
  maxPitch?: string;
  anchorPitch?: string;
  preferDirection?: "up" | "down" | "nearest";
  maxLeapSemitones?: number;
};

type ChordVoiceLeadingOptions = {
  minPitch?: string;
  maxPitch?: string;
  anchorPitch?: string;
};

type CrossRelationContext = {
  previousLetter?: string;
};

function chooseNearestCandidate(
  candidates: string[],
  referencePitch: string,
  options: MelodicOptions = {},
): string | null {
  if (candidates.length === 0) {
    return null;
  }

  const referenceMidi = noteToMidi(referencePitch);
  const maxLeapSemitones = options.maxLeapSemitones ?? 12;

  return candidates.reduce((best, candidate) => {
    const candidateMidi = noteToMidi(candidate);
    const candidateDistance = Math.abs(candidateMidi - referenceMidi);
    const bestDistance = best ? Math.abs(noteToMidi(best) - referenceMidi) : Infinity;

    if (candidateDistance > maxLeapSemitones && bestDistance <= maxLeapSemitones) {
      return best;
    }

    if (candidateDistance < bestDistance) {
      return candidate;
    }

    if (candidateDistance === bestDistance) {
      if (options.preferDirection === "up" && candidateMidi >= referenceMidi) {
        return candidate;
      }

      if (options.preferDirection === "down" && candidateMidi <= referenceMidi) {
        return candidate;
      }

      if (!best || candidateMidi > noteToMidi(best)) {
        return candidate;
      }
    }

    return best;
  }, null as string | null);
}

export function nearestPitchClassInRegister(
  targetPitchClass: number,
  fromPitch: string,
  minPitch: string,
  maxPitch: string,
): string {
  const minMidi = noteToMidi(minPitch);
  const maxMidi = noteToMidi(maxPitch);
  const candidates: string[] = [];

  for (let midi = minMidi; midi <= maxMidi; midi += 1) {
    if (((midi % 12) + 12) % 12 === ((targetPitchClass % 12) + 12) % 12) {
      candidates.push(midiToNote(midi));
    }
  }

  return chooseNearestCandidate(candidates, fromPitch, {
    maxLeapSemitones: Number.POSITIVE_INFINITY,
  }) ?? minPitch;
}

export function pickNearestMelodicTone(
  previousPitch: string | null,
  allowedPitches: string[],
  options: MelodicOptions = {},
): string {
  const filtered = allowedPitches.filter((pitch) => {
    if (options.minPitch && noteToMidi(pitch) < noteToMidi(options.minPitch)) {
      return false;
    }

    if (options.maxPitch && noteToMidi(pitch) > noteToMidi(options.maxPitch)) {
      return false;
    }

    return true;
  });
  const referencePitch = previousPitch ?? options.anchorPitch ?? filtered[0];

  if (!referencePitch || filtered.length === 0) {
    return options.anchorPitch ?? previousPitch ?? "C4";
  }

  return chooseNearestCandidate(filtered, referencePitch, options) ?? filtered[0];
}

export function voiceLeadChord(
  previousVoicing: string[],
  nextChordTones: string[],
  options: ChordVoiceLeadingOptions = {},
): string[] {
  if (nextChordTones.length === 0) {
    return [];
  }

  const anchorPitch =
    options.anchorPitch ??
    previousVoicing[0] ??
    options.minPitch ??
    nextChordTones[0] ??
    "C4";
  const minPitch = options.minPitch ?? "C3";
  const maxPitch = options.maxPitch ?? "C6";
  const voiced = nextChordTones.map((tone, index) => {
    const reference = previousVoicing[index] ?? previousVoicing[index - 1] ?? anchorPitch;
    return nearestPitchClassInRegister(
      getPitchClass(tone),
      reference,
      minPitch,
      maxPitch,
    );
  });

  return voiced.sort((left, right) => noteToMidi(left) - noteToMidi(right));
}

export function avoidCrossRelation(
  previousPitch: string,
  candidatePitch: string,
  context: CrossRelationContext = {},
): boolean {
  const previousLetter = context.previousLetter ?? previousPitch[0]?.toUpperCase();
  const candidateLetter = candidatePitch[0]?.toUpperCase();

  if (!previousLetter || !candidateLetter) {
    return false;
  }

  if (previousLetter !== candidateLetter) {
    return false;
  }

  return getPitchClass(previousPitch) !== getPitchClass(candidatePitch);
}
