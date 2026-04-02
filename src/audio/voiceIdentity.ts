import type { SynthName } from "./composition";
import type { VoiceId } from "./metadata";

type ResolveVoiceIdOptions = {
  ornament?: boolean;
  isPad?: boolean;
};

export function getDefaultVoiceIdForSynth(synth: SynthName): VoiceId {
  switch (synth) {
    case "softLead":
      return "lead";
    case "glassBell":
      return "bells";
    case "warmPad":
      return "pad";
    case "roundBass":
      return "bass";
    case "breathingDrone":
      return "drone";
    case "pluckyDust":
      return "ornament";
    default:
      return "texture";
  }
}

export function resolveVoiceId(
  voiceId: VoiceId | undefined,
  synth: SynthName,
  options: ResolveVoiceIdOptions = {},
): VoiceId {
  if (voiceId) {
    return voiceId;
  }

  if (options.isPad) {
    return "pad";
  }

  if (options.ornament) {
    return synth === "softLead" ? "ornament" : getDefaultVoiceIdForSynth(synth);
  }

  return getDefaultVoiceIdForSynth(synth);
}

export function isLeadVoiceId(voiceId: string | undefined): boolean {
  return voiceId === "lead";
}

export function describeVoiceId(
  voiceId: string | undefined,
  synth?: SynthName,
): string {
  if (voiceId && voiceId.length > 0) {
    return voiceId;
  }

  return synth ?? "layer";
}
