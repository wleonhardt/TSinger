import type { Composition } from "../composition";
import { scheduleComposition } from "../scheduler";
import { getPhraseDurationSeconds } from "../timing";
import type { VoiceRegistry } from "../synths";

type OfflineRenderOptions = {
  sampleRate?: number;
  tailSeconds?: number;
};

type WindowWithWebkitOffline = Window &
  typeof globalThis & {
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  };

export async function renderCompositionOffline(
  composition: Composition,
  voices: VoiceRegistry,
  options: OfflineRenderOptions = {},
): Promise<AudioBuffer | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const globalWindow = window as WindowWithWebkitOffline;
  const OfflineContextClass =
    globalWindow.OfflineAudioContext ?? globalWindow.webkitOfflineAudioContext;

  if (!OfflineContextClass) {
    return null;
  }

  const sampleRate = options.sampleRate ?? 44100;
  const tailSeconds = options.tailSeconds ?? 1.6;
  const phraseDuration = getPhraseDurationSeconds(
    composition.phrase.bars,
    composition.beatsPerBar,
    composition.bpm,
  );
  const totalSeconds = phraseDuration + tailSeconds;
  const frameCount = Math.ceil(totalSeconds * sampleRate);
  const context = new OfflineContextClass(2, frameCount, sampleRate);

  scheduleComposition({
    context: context as unknown as AudioContext,
    destination: context.destination,
    composition,
    voices,
    startedAt: 0,
  });

  return context.startRendering();
}
