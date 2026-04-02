import type { Composition } from "../composition";
import { scheduleComposition } from "../scheduler";
import { getPhraseDurationSeconds } from "../timing";
import type { RenderAudioContext, VoiceRegistry } from "../synths";
import type { OfflineRenderResult } from "./types";

const DEFAULT_SAMPLE_RATE = 44_100;
const DEFAULT_TAIL_SECONDS = 1.6;
const DEFAULT_RENDER_REPEATS = 1;
const INITIAL_RENDER_OFFSET_SECONDS = 0.02;

type OfflineAudioContextConstructor = new (
  numberOfChannels: number,
  length: number,
  sampleRate: number,
) => OfflineAudioContext;

type OfflineRenderableContext = RenderAudioContext & {
  readonly sampleRate: number;
  readonly destination: AudioNode;
  startRendering: () => Promise<AudioBuffer>;
};

async function getOfflineAudioContextConstructor(): Promise<OfflineAudioContextConstructor | null> {
  if (typeof globalThis.OfflineAudioContext === "function") {
    return globalThis.OfflineAudioContext as OfflineAudioContextConstructor;
  }

  try {
    const engine = await import("web-audio-engine");
    return engine.OfflineAudioContext as unknown as OfflineAudioContextConstructor;
  } catch {
    return null;
  }
}

function cloneChannelData(buffer: AudioBuffer): Float32Array[] {
  return Array.from({ length: buffer.numberOfChannels }, (_, index) => {
    const source = buffer.getChannelData(index);
    const copy = new Float32Array(source.length);
    copy.set(source);
    return copy;
  });
}

function trimLeadingSilence(
  channelData: Float32Array[],
  trimSamples: number,
): Float32Array[] {
  return channelData.map((channel) => {
    const safeTrim = Math.min(Math.max(0, trimSamples), channel.length);
    const trimmed = new Float32Array(channel.length - safeTrim);
    trimmed.set(channel.subarray(safeTrim));
    return trimmed;
  });
}

export async function renderCompositionOffline(params: {
  composition: Composition;
  voices: VoiceRegistry;
  repeats?: number;
  sampleRate?: number;
  tailSeconds?: number;
}): Promise<OfflineRenderResult> {
  const {
    composition,
    voices,
    repeats = DEFAULT_RENDER_REPEATS,
    sampleRate = DEFAULT_SAMPLE_RATE,
    tailSeconds = DEFAULT_TAIL_SECONDS,
  } = params;

  const OfflineContext = await getOfflineAudioContextConstructor();
  if (!OfflineContext) {
    throw new Error(
      "Offline rendering is unavailable in this environment. Install web-audio-engine or run in a browser with OfflineAudioContext support.",
    );
  }

  const repeatCount = Math.max(1, Math.trunc(repeats));
  const safeSampleRate = Math.max(8_000, Math.round(sampleRate));
  const safeTailSeconds = Math.max(0.2, tailSeconds);
  const phraseDurationSeconds = getPhraseDurationSeconds(
    composition.phrase.bars,
    composition.beatsPerBar,
    composition.bpm,
  );
  const totalDurationSeconds =
    INITIAL_RENDER_OFFSET_SECONDS +
    phraseDurationSeconds * repeatCount +
    safeTailSeconds;
  const frameCount = Math.ceil(totalDurationSeconds * safeSampleRate);
  const context = new OfflineContext(
    2,
    frameCount,
    safeSampleRate,
  ) as unknown as OfflineRenderableContext;

  for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
    scheduleComposition({
      context,
      destination: context.destination,
      composition,
      voices,
      startedAt: INITIAL_RENDER_OFFSET_SECONDS + repeatIndex * phraseDurationSeconds,
    });
  }

  const buffer = await context.startRendering();
  const trimSamples = Math.round(INITIAL_RENDER_OFFSET_SECONDS * buffer.sampleRate);
  const trimmedChannelData = trimLeadingSilence(cloneChannelData(buffer), trimSamples);
  const trimmedDurationSeconds =
    (trimmedChannelData[0]?.length ?? 0) / buffer.sampleRate;

  return {
    sampleRate: buffer.sampleRate,
    durationSeconds: trimmedDurationSeconds,
    channelData: trimmedChannelData,
    phraseRepeats: repeatCount,
    musicalDurationSeconds: phraseDurationSeconds * repeatCount,
    tailSeconds: safeTailSeconds,
  };
}
