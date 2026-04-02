import type { ChordEvent, Composition, NoteEvent } from "./composition";
import {
  getAudioContext,
  getMasterOutput,
  isAudioPrimed,
  primeAudio,
} from "./context";
import { computeChordPan, scheduleComposition, type ScheduleResult } from "./scheduler";
import { getPhraseDurationSeconds, beatsToSeconds } from "./timing";
import { buildChordPitches, noteToFrequency } from "./theory";
import {
  renderVoiceNote,
  type VoiceRegistry,
  type VoiceRenderOptions,
} from "./synths";

const DEFAULT_MASTER_VOLUME = 0.72;
const DEFAULT_LIMITER_HEADROOM = 0.92;
const DEFAULT_PREVIEW_BPM = 84;
const DEFAULT_SCHEDULE_AHEAD_SECONDS = 0.25;
const MIN_START_DELAY_SECONDS = 0.02;

type ReadyState = {
  context: AudioContext;
  destination: GainNode;
};

export type PlaybackStatus = "idle" | "primed" | "playing" | "stopped";

export type EngineConfig = {
  masterVolume?: number;
  limiterHeadroom?: number;
  scheduleAheadSeconds?: number;
};

export type PhrasePlaybackHandle = {
  stop: () => void;
  isPlaying: () => boolean;
  getStartedAt: () => number | null;
};

export type AudioEngine = {
  prime: () => Promise<boolean>;
  isPrimed: () => boolean;
  getStatus: () => PlaybackStatus;
  playComposition: (composition: Composition) => Promise<PhrasePlaybackHandle | null>;
  playPhraseOnce: (
    composition: Composition,
    phraseOffsetBeats?: number,
  ) => Promise<PhrasePlaybackHandle | null>;
  playNote: (
    note: NoteEvent,
    options?: Partial<VoiceRenderOptions>,
  ) => Promise<boolean>;
  playChord: (
    chord: ChordEvent,
    options?: Partial<VoiceRenderOptions>,
  ) => Promise<boolean>;
  stop: () => void;
  dispose: () => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createAudioEngine(
  voices: VoiceRegistry,
  config: EngineConfig = {},
): AudioEngine {
  let status: PlaybackStatus = "idle";
  let outputBus: GainNode | null = null;
  let activeRuns: ScheduleResult[] = [];
  let loopTimer: ReturnType<typeof setTimeout> | null = null;
  let finishTimer: ReturnType<typeof setTimeout> | null = null;
  let transportToken = 0;
  let actionToken = 0;
  let disposed = false;
  let previewBpm = DEFAULT_PREVIEW_BPM;

  function clearLoopTimer(): void {
    if (loopTimer) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
  }

  function clearFinishTimer(): void {
    if (finishTimer) {
      clearTimeout(finishTimer);
      finishTimer = null;
    }
  }

  function ensureOutputBus(): GainNode | null {
    if (disposed) {
      return null;
    }

    const context = getAudioContext();
    const master = getMasterOutput();

    if (!context || !master) {
      return null;
    }

    if (outputBus?.context === context) {
      return outputBus;
    }

    if (outputBus) {
      try {
        outputBus.disconnect();
      } catch {
        // Output bus may already be disconnected.
      }
    }

    outputBus = context.createGain();
    outputBus.gain.value = clamp(
      (config.masterVolume ?? DEFAULT_MASTER_VOLUME) *
        (config.limiterHeadroom ?? DEFAULT_LIMITER_HEADROOM),
      0.05,
      0.85,
    );
    outputBus.connect(master);

    return outputBus;
  }

  async function ensureReady(): Promise<ReadyState | null> {
    if (disposed) {
      return null;
    }

    const primed = await primeAudio();
    const context = getAudioContext();
    const destination = ensureOutputBus();

    if (!primed || !context || !destination || context.state !== "running") {
      return null;
    }

    return { context, destination };
  }

  function stopActiveRuns(): void {
    const runsToStop = activeRuns;
    activeRuns = [];

    for (const run of runsToStop) {
      run.stop();
    }
  }

  function resetTransport(nextStatus: PlaybackStatus): number {
    transportToken += 1;
    clearLoopTimer();
    clearFinishTimer();
    stopActiveRuns();
    status = nextStatus;
    return transportToken;
  }

  function startAction(): number {
    actionToken += 1;
    return actionToken;
  }

  function isCurrentAction(token: number): boolean {
    return !disposed && token === actionToken;
  }

  function scheduleRunCleanup(run: ScheduleResult, token: number): void {
    const context = getAudioContext();
    const delayMs = Math.max(
      140,
      Math.round((run.endsAt - (context?.currentTime ?? 0) + 1.4) * 1000),
    );

    setTimeout(() => {
      if (disposed || token !== transportToken) {
        return;
      }

      activeRuns = activeRuns.filter((candidate) => candidate !== run);
    }, delayMs);
  }

  function createHandle(token: number, startedAt: number): PhrasePlaybackHandle {
    return {
      stop() {
        if (token === transportToken && !disposed) {
          engine.stop();
        }
      },
      isPlaying() {
        return token === transportToken && status === "playing";
      },
      getStartedAt() {
        return token === transportToken ? startedAt : null;
      },
    };
  }

  function scheduleCompletion(run: ScheduleResult, token: number): void {
    const context = getAudioContext();
    clearFinishTimer();

    finishTimer = setTimeout(() => {
      if (disposed || token !== transportToken) {
        return;
      }

      activeRuns = activeRuns.filter((candidate) => candidate !== run);
      status = "stopped";
    }, Math.max(140, Math.round((run.endsAt - (context?.currentTime ?? 0) + 0.8) * 1000)));
  }

  function normalizeLoopBoundary(
    boundaryTime: number,
    phraseDurationSeconds: number,
    currentTime: number,
  ): number {
    let normalizedBoundary = boundaryTime;
    const latestSafeStart = currentTime + MIN_START_DELAY_SECONDS;

    while (normalizedBoundary + phraseDurationSeconds <= latestSafeStart) {
      normalizedBoundary += phraseDurationSeconds;
    }

    return normalizedBoundary;
  }

  function queueLoop(
    composition: Composition,
    boundaryTime: number,
    phraseDurationSeconds: number,
    token: number,
  ): void {
    const context = getAudioContext();
    if (!context || disposed || token !== transportToken) {
      return;
    }

    const scheduleAheadSeconds =
      config.scheduleAheadSeconds ?? DEFAULT_SCHEDULE_AHEAD_SECONDS;
    const normalizedBoundary = normalizeLoopBoundary(
      boundaryTime,
      phraseDurationSeconds,
      context.currentTime + scheduleAheadSeconds,
    );
    const delayMs = Math.max(
      0,
      Math.round(
        (normalizedBoundary - context.currentTime - scheduleAheadSeconds) * 1000,
      ),
    );

    clearLoopTimer();
    loopTimer = setTimeout(() => {
      if (disposed || token !== transportToken) {
        return;
      }

      const currentContext = getAudioContext();
      const destination = ensureOutputBus();
      if (!currentContext || !destination || currentContext.state !== "running") {
        status = "stopped";
        return;
      }

      const scheduledBoundary = normalizeLoopBoundary(
        boundaryTime,
        phraseDurationSeconds,
        currentContext.currentTime,
      );
      const run = scheduleComposition({
        context: currentContext,
        destination,
        composition,
        voices,
        startedAt: scheduledBoundary,
      });

      activeRuns.push(run);
      scheduleRunCleanup(run, token);
      queueLoop(
        composition,
        scheduledBoundary + phraseDurationSeconds,
        phraseDurationSeconds,
        token,
      );
    }, delayMs);
  }

  const engine: AudioEngine = {
    async prime() {
      const action = actionToken;
      const ready = await ensureReady();

      if (!ready) {
        if (status !== "playing") {
          status = "idle";
        }
        return false;
      }

      if (!disposed && action === actionToken && status !== "playing") {
        status = "primed";
      }

      return true;
    },

    isPrimed() {
      return isAudioPrimed();
    },

    getStatus() {
      return status;
    },

    async playComposition(composition) {
      const action = startAction();
      const ready = await ensureReady();

      if (!ready || !isCurrentAction(action)) {
        return null;
      }

      previewBpm = composition.bpm;
      const token = resetTransport("stopped");
      const run = scheduleComposition({
        context: ready.context,
        destination: ready.destination,
        composition,
        voices,
      });
      const phraseDurationSeconds = getPhraseDurationSeconds(
        composition.phrase.bars,
        composition.beatsPerBar,
        composition.bpm,
      );

      activeRuns = [run];
      scheduleRunCleanup(run, token);
      status = "playing";

      if (composition.loop) {
        queueLoop(
          composition,
          run.startedAt + phraseDurationSeconds,
          phraseDurationSeconds,
          token,
        );
      } else {
        scheduleCompletion(run, token);
      }

      return createHandle(token, run.startedAt);
    },

    async playPhraseOnce(composition, phraseOffsetBeats = 0) {
      const action = startAction();
      const ready = await ensureReady();

      if (!ready || !isCurrentAction(action)) {
        return null;
      }

      previewBpm = composition.bpm;
      const token = resetTransport("stopped");
      const phraseStartOffset = beatsToSeconds(
        Math.max(0, phraseOffsetBeats),
        composition.bpm,
      );
      const run = scheduleComposition({
        context: ready.context,
        destination: ready.destination,
        composition,
        voices,
        startedAt: ready.context.currentTime + MIN_START_DELAY_SECONDS + phraseStartOffset,
      });

      activeRuns = [run];
      scheduleRunCleanup(run, token);
      status = "playing";
      scheduleCompletion(run, token);

      return createHandle(token, run.startedAt);
    },

    async playNote(note, options) {
      const ready = await ensureReady();
      const voice = voices[note.synth];

      if (!ready || !voice) {
        return false;
      }

      let frequency: number;
      try {
        frequency = noteToFrequency(note.pitch);
      } catch {
        return false;
      }

      let endFrequency = options?.endFrequency;
      if (endFrequency === undefined && note.glideTo) {
        try {
          endFrequency = noteToFrequency(note.glideTo);
        } catch {
          endFrequency = undefined;
        }
      }

      renderVoiceNote({
        context: ready.context,
        destination: ready.destination,
        voice,
        frequency,
        startTime: ready.context.currentTime + 0.01,
        durationSeconds: beatsToSeconds(Math.max(note.length, 0.125), previewBpm),
        options: {
          velocity: options?.velocity ?? note.velocity ?? 0.72,
          pan: options?.pan ?? note.pan,
          endFrequency,
        },
      });

      if (status !== "playing") {
        status = "primed";
      }

      return true;
    },

    async playChord(chord, options) {
      const ready = await ensureReady();
      const voice = voices[chord.synth];

      if (!ready || !voice) {
        return false;
      }

      let pitches: string[];
      try {
        pitches = buildChordPitches(chord.root, chord.quality, chord.inversion);
      } catch {
        return false;
      }

      const startTime = ready.context.currentTime + 0.01;
      const spread = clamp(chord.spread ?? 0.01, 0.006, 0.018);
      const durationSeconds = beatsToSeconds(
        Math.max(chord.length, 0.25),
        previewBpm,
      );
      let renderedCount = 0;

      for (const [index, pitch] of pitches.entries()) {
        let frequency: number;
        try {
          frequency = noteToFrequency(pitch);
        } catch {
          continue;
        }

        renderVoiceNote({
          context: ready.context,
          destination: ready.destination,
          voice,
          frequency,
          startTime: startTime + index * spread,
          durationSeconds,
          options: {
            velocity: (options?.velocity ?? chord.velocity ?? 0.3) * 0.94,
            pan: options?.pan ?? computeChordPan(index, pitches.length),
            endFrequency: options?.endFrequency,
          },
        });
        renderedCount += 1;
      }

      if (renderedCount === 0) {
        return false;
      }

      if (status !== "playing") {
        status = "primed";
      }

      return true;
    },

    stop() {
      startAction();
      resetTransport("stopped");
    },

    dispose() {
      disposed = true;
      startAction();
      resetTransport("idle");

      if (outputBus) {
        try {
          outputBus.disconnect();
        } catch {
          // Output bus may already be disconnected.
        }
      }

      outputBus = null;
    },
  };

  return engine;
}
