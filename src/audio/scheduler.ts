import type { Composition } from "./composition";
import {
  beatToAudioTime,
  beatsToSeconds,
  getPhraseDurationSeconds,
} from "./timing";
import { buildChordPitches, noteToFrequency } from "./theory";
import {
  renderVoiceNote,
  type RenderAudioContext,
  type ScheduledVoiceHandle,
  type VoiceRegistry,
} from "./synths";

const PHRASE_FADE_FLOOR = 0.0001;
const MIN_PHRASE_START_DELAY = 0.02;

type HoldableAudioParam = AudioParam & {
  cancelAndHoldAtTime?: (cancelTime: number) => void;
};

type ScheduleCompositionParams = {
  context: RenderAudioContext;
  destination: AudioNode;
  composition: Composition;
  voices: VoiceRegistry;
  startedAt?: number;
};

export type ScheduleResult = {
  startedAt: number;
  endsAt: number;
  stop: () => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isOfflineContext(context: RenderAudioContext): boolean {
  return "startRendering" in (context as object);
}

function holdAtTime(
  param: HoldableAudioParam,
  when: number,
  fallbackValue: number,
): void {
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(when);
    return;
  }

  param.cancelScheduledValues(when);
  param.setValueAtTime(fallbackValue, when);
}

export function computeChordPan(index: number, count: number): number {
  if (count <= 1) {
    return 0;
  }

  if (count === 2) {
    return [-0.1, 0.1][index] ?? 0;
  }

  if (count === 3) {
    return [-0.14, 0, 0.14][index] ?? 0;
  }

  if (count === 4) {
    return [-0.18, -0.05, 0.05, 0.18][index] ?? 0;
  }

  const minPan = -0.2;
  const maxPan = 0.2;
  const step = (maxPan - minPan) / (count - 1);
  return minPan + step * index;
}

export function scheduleComposition({
  context,
  destination,
  composition,
  voices,
  startedAt,
}: ScheduleCompositionParams): ScheduleResult {
  const phraseBus = context.createGain();
  const activeVoices: ScheduledVoiceHandle[] = [];
  const phraseStart = Math.max(
    startedAt ?? context.currentTime + MIN_PHRASE_START_DELAY,
    context.currentTime + MIN_PHRASE_START_DELAY,
  );
  const phraseDurationSeconds = getPhraseDurationSeconds(
    composition.phrase.bars,
    composition.beatsPerBar,
    composition.bpm,
  );
  const endsAt = phraseStart + phraseDurationSeconds;

  phraseBus.gain.value = 1;
  phraseBus.connect(destination);

  for (const note of composition.phrase.notes) {
    const voice = voices[note.synth];
    if (!voice) {
      continue;
    }

    let frequency: number;
    try {
      frequency = noteToFrequency(note.pitch);
    } catch {
      continue;
    }

    let glideFrequency: number | undefined;
    if (note.glideTo) {
      try {
        glideFrequency = noteToFrequency(note.glideTo);
      } catch {
        glideFrequency = undefined;
      }
    }

    const startTime = beatToAudioTime(note.beat, composition.bpm, phraseStart);
    const durationSeconds = beatsToSeconds(Math.max(0, note.length), composition.bpm);
    if (durationSeconds <= 0) {
      continue;
    }

    activeVoices.push(
      renderVoiceNote({
        context,
        destination: phraseBus,
        voice,
        frequency,
        startTime,
        durationSeconds,
        options: {
          velocity: note.velocity ?? 0.72,
          pan: note.pan,
          endFrequency: glideFrequency,
        },
      }),
    );
  }

  for (const chord of composition.phrase.chords) {
    const voice = voices[chord.synth];
    if (!voice) {
      continue;
    }

    let pitches: string[];
    try {
      pitches = buildChordPitches(chord.root, chord.quality, chord.inversion);
    } catch {
      continue;
    }

    const chordDurationSeconds = beatsToSeconds(
      Math.max(0, chord.length),
      composition.bpm,
    );
    if (chordDurationSeconds <= 0) {
      continue;
    }

    const chordStart = beatToAudioTime(chord.beat, composition.bpm, phraseStart);
    const stagger = clamp(chord.spread ?? 0.01, 0.006, 0.018);

    for (const [index, pitch] of pitches.entries()) {
      let frequency: number;
      try {
        frequency = noteToFrequency(pitch);
      } catch {
        continue;
      }

      activeVoices.push(
        renderVoiceNote({
          context,
          destination: phraseBus,
          voice,
          frequency,
          startTime: chordStart + index * stagger,
          durationSeconds: chordDurationSeconds,
          options: {
            velocity: (chord.velocity ?? 0.3) * 0.94,
            pan: computeChordPan(index, pitches.length),
          },
        }),
      );
    }
  }

  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  if (!isOfflineContext(context)) {
    disconnectTimer = setTimeout(
      disconnectBus,
      Math.max(
        140,
        Math.round((endsAt - context.currentTime + 1.15) * 1000),
      ),
    );
  }
  let stopped = false;

  function disconnectBus(): void {
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }

    try {
      phraseBus.disconnect();
    } catch {
      // Phrase bus may already be disconnected.
    }
  }

  return {
    startedAt: phraseStart,
    endsAt,
    stop() {
      if (stopped) {
        return;
      }

      stopped = true;

      const releaseAt = Math.max(context.currentTime, phraseStart);
      holdAtTime(phraseBus.gain, releaseAt, 1);
      phraseBus.gain.exponentialRampToValueAtTime(
        PHRASE_FADE_FLOOR,
        releaseAt + 0.08,
      );

      for (const handle of activeVoices) {
        handle.stopAt(releaseAt);
      }

      if (!isOfflineContext(context)) {
        disconnectTimer = setTimeout(
          disconnectBus,
          Math.max(
            140,
            Math.round((releaseAt - context.currentTime + 0.34) * 1000),
          ),
        );
      } else {
        disconnectBus();
      }
    },
  };
}
