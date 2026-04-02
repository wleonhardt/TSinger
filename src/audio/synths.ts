import type { SynthName } from "./composition";

const ENVELOPE_FLOOR = 0.0001;
const MIN_SEGMENT_SECONDS = 0.002;
const MIN_RELEASE_SECONDS = 0.03;
const STOP_SAFETY_SECONDS = 0.04;

export type EnvelopeSpec = {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
};

export type OscLayerSpec = {
  type: OscillatorType;
  gain: number;
  detuneCents?: number;
  octaveOffset?: number;
};

export type FilterSpec = {
  type: BiquadFilterType;
  frequency: number;
  q?: number;
};

export type LfoSpec = {
  frequencyHz: number;
  amount: number;
};

export type VoiceSpec = {
  id: string;
  displayName: string;
  layers: OscLayerSpec[];
  envelope: EnvelopeSpec;
  filter?: FilterSpec;
  vibrato?: LfoSpec;
  glideSeconds?: number;
  outputGain: number;
  stereoSpread?: number;
};

export type VoiceRenderOptions = {
  velocity: number;
  pan?: number;
  endFrequency?: number;
};

export type VoiceRegistry = Record<SynthName, VoiceSpec>;

export type ScheduledVoiceHandle = {
  stopAt: (when: number) => void;
};

export type RenderAudioContext = BaseAudioContext & {
  currentTime: number;
  createGain: () => GainNode;
  createOscillator: () => OscillatorNode;
  createStereoPanner: () => StereoPannerNode;
  createBiquadFilter: () => BiquadFilterNode;
};

type RenderVoiceNoteParams = {
  context: RenderAudioContext;
  destination: AudioNode;
  voice: VoiceSpec;
  frequency: number;
  startTime: number;
  durationSeconds: number;
  options?: Partial<VoiceRenderOptions>;
};

type HoldableAudioParam = AudioParam & {
  cancelAndHoldAtTime?: (cancelTime: number) => void;
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

function exponentialInterpolate(
  startValue: number,
  endValue: number,
  progress: number,
): number {
  const safeStart = Math.max(startValue, ENVELOPE_FLOOR);
  const safeEnd = Math.max(endValue, ENVELOPE_FLOOR);
  const ratio = clamp(progress, 0, 1);

  return safeStart * (safeEnd / safeStart) ** ratio;
}

function getEnvelopeValueAtTime(
  when: number,
  startTime: number,
  attackEnd: number,
  decayEnd: number,
  releaseStart: number,
  releaseEnd: number,
  peakGain: number,
  sustainGain: number,
): number {
  if (when <= startTime) {
    return ENVELOPE_FLOOR;
  }

  if (when < attackEnd) {
    const progress = (when - startTime) / Math.max(attackEnd - startTime, MIN_SEGMENT_SECONDS);
    return exponentialInterpolate(ENVELOPE_FLOOR, peakGain, progress);
  }

  if (when < decayEnd) {
    const progress = (when - attackEnd) / Math.max(decayEnd - attackEnd, MIN_SEGMENT_SECONDS);
    return exponentialInterpolate(peakGain, sustainGain, progress);
  }

  if (when < releaseStart) {
    return sustainGain;
  }

  if (when < releaseEnd) {
    const progress = (when - releaseStart) / Math.max(releaseEnd - releaseStart, MIN_SEGMENT_SECONDS);
    return exponentialInterpolate(sustainGain, ENVELOPE_FLOOR, progress);
  }

  return ENVELOPE_FLOOR;
}

function safeStop(
  oscillator: OscillatorNode,
  when: number,
  state: { stopped: boolean; stopTime: number },
): void {
  if (state.stopped || when >= state.stopTime) {
    return;
  }

  try {
    oscillator.stop(when);
    state.stopTime = when;
  } catch {
    state.stopped = true;
  }
}

export function renderVoiceNote({
  context,
  destination,
  voice,
  frequency,
  startTime,
  durationSeconds,
  options,
}: RenderVoiceNoteParams): ScheduledVoiceHandle {
  const safeStartTime = Math.max(startTime, context.currentTime + 0.005);
  const velocity = clamp(options?.velocity ?? 0.72, 0.01, 1);
  const baseFrequency = Math.max(ENVELOPE_FLOOR, frequency);
  const noteLength = Math.max(MIN_RELEASE_SECONDS, durationSeconds);
  const releaseStart = safeStartTime + noteLength;
  const releaseEnd =
    releaseStart + Math.max(MIN_RELEASE_SECONDS, voice.envelope.release);
  const finalStopTime = releaseEnd + STOP_SAFETY_SECONDS;
  const deterministicOffset = voice.stereoSpread
    ? Math.sin(baseFrequency * 0.03125) * voice.stereoSpread
    : 0;
  const finalPan = clamp((options?.pan ?? 0) + deterministicOffset, -1, 1);

  const mixBus = context.createGain();
  const noteGain = context.createGain();
  const panner = context.createStereoPanner();
  const filterSpec = voice.filter;
  const filter = filterSpec ? context.createBiquadFilter() : null;
  const disconnectables: AudioNode[] = [mixBus, noteGain, panner];
  const oscillators: OscillatorNode[] = [];
  const oscillatorStates: Array<{ stopped: boolean; stopTime: number }> = [];

  if (filter) {
    const activeFilterSpec = filterSpec;
    filter.type = activeFilterSpec!.type;
    filter.frequency.value = activeFilterSpec!.frequency;
    filter.Q.value = activeFilterSpec!.q ?? 0.0001;
    disconnectables.push(filter);
  }

  mixBus.gain.value = 1;
  noteGain.gain.value = ENVELOPE_FLOOR;
  panner.pan.value = finalPan;

  if (filter) {
    mixBus.connect(filter);
    filter.connect(noteGain);
  } else {
    mixBus.connect(noteGain);
  }

  noteGain.connect(panner);
  panner.connect(destination);

  let vibratoOscillator: OscillatorNode | null = null;
  let vibratoGain: GainNode | null = null;
  let vibratoState: { stopped: boolean; stopTime: number } | null = null;

  if (voice.vibrato) {
    vibratoOscillator = context.createOscillator();
    vibratoGain = context.createGain();
    vibratoOscillator.type = "sine";
    vibratoOscillator.frequency.value = voice.vibrato.frequencyHz;
    vibratoGain.gain.value = voice.vibrato.amount;
    vibratoOscillator.connect(vibratoGain);
    vibratoState = { stopped: false, stopTime: finalStopTime };
    disconnectables.push(vibratoGain);
  }

  for (const layer of voice.layers) {
    const oscillator = context.createOscillator();
    const layerGain = context.createGain();
    const octaveOffset = layer.octaveOffset ?? 0;
    const layerFrequency = baseFrequency * 2 ** octaveOffset;

    oscillator.type = layer.type;
    oscillator.frequency.setValueAtTime(layerFrequency, safeStartTime);
    oscillator.detune.setValueAtTime(layer.detuneCents ?? 0, safeStartTime);

    if (voice.glideSeconds && options?.endFrequency) {
      const glideEnd = Math.min(
        safeStartTime + Math.max(MIN_SEGMENT_SECONDS, voice.glideSeconds),
        releaseStart,
      );
      const glideTarget = Math.max(
        ENVELOPE_FLOOR,
        options.endFrequency * 2 ** octaveOffset,
      );
      oscillator.frequency.linearRampToValueAtTime(glideTarget, glideEnd);
    }

    if (vibratoGain) {
      vibratoGain.connect(oscillator.detune);
    }

    layerGain.gain.value = voice.outputGain * layer.gain;
    oscillator.connect(layerGain);
    layerGain.connect(mixBus);

    disconnectables.push(layerGain);
    oscillators.push(oscillator);
    oscillatorStates.push({ stopped: false, stopTime: finalStopTime });
  }

  const peakGain = Math.max(ENVELOPE_FLOOR * 2, velocity);
  const sustainGain = Math.max(
    ENVELOPE_FLOOR * 2,
    peakGain * clamp(voice.envelope.sustain, 0, 1),
  );
  const attackEnd = Math.min(
    safeStartTime + Math.max(MIN_SEGMENT_SECONDS, voice.envelope.attack),
    releaseStart,
  );
  const decayEnd = Math.min(
    attackEnd + Math.max(MIN_SEGMENT_SECONDS, voice.envelope.decay),
    releaseStart,
  );

  noteGain.gain.setValueAtTime(ENVELOPE_FLOOR, safeStartTime);
  noteGain.gain.exponentialRampToValueAtTime(peakGain, attackEnd);

  if (decayEnd > attackEnd + 0.0005) {
    noteGain.gain.exponentialRampToValueAtTime(sustainGain, decayEnd);
  } else {
    noteGain.gain.setValueAtTime(sustainGain, decayEnd);
  }

  noteGain.gain.setValueAtTime(sustainGain, releaseStart);
  noteGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, releaseEnd);

  for (const [index, oscillator] of oscillators.entries()) {
    oscillator.start(safeStartTime);
    safeStop(oscillator, finalStopTime, oscillatorStates[index]);
  }

  if (vibratoOscillator && vibratoState) {
    vibratoOscillator.start(safeStartTime);
    safeStop(vibratoOscillator, finalStopTime, vibratoState);
  }

  let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  let releasedEarly = false;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;

    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }

    for (const node of disconnectables) {
      try {
        node.disconnect();
      } catch {
        // Nodes may already be disconnected.
      }
    }

    if (vibratoOscillator) {
      try {
        vibratoOscillator.disconnect();
      } catch {
        // Node may already be disconnected.
      }
    }

    for (const oscillator of oscillators) {
      try {
        oscillator.disconnect();
      } catch {
        // Node may already be disconnected.
      }
    }
  };

  if (!isOfflineContext(context)) {
    cleanupTimer = setTimeout(
      cleanup,
      Math.max(
        60,
        Math.round((finalStopTime - context.currentTime + 0.1) * 1000),
      ),
    );
  }

  return {
    stopAt(when: number) {
      if (releasedEarly || cleanedUp) {
        return;
      }

      releasedEarly = true;

      const releaseNow = Math.max(safeStartTime, when, context.currentTime);
      const stopFadeEnd =
        releaseNow + Math.max(MIN_RELEASE_SECONDS, voice.envelope.release * 0.75);
      const heldGain = getEnvelopeValueAtTime(
        releaseNow,
        safeStartTime,
        attackEnd,
        decayEnd,
        releaseStart,
        releaseEnd,
        peakGain,
        sustainGain,
      );

      holdAtTime(noteGain.gain, releaseNow, heldGain);
      noteGain.gain.exponentialRampToValueAtTime(ENVELOPE_FLOOR, stopFadeEnd);

      for (const [index, oscillator] of oscillators.entries()) {
        safeStop(oscillator, stopFadeEnd + STOP_SAFETY_SECONDS, oscillatorStates[index]);
      }

      if (vibratoOscillator && vibratoState) {
        safeStop(
          vibratoOscillator,
          stopFadeEnd + STOP_SAFETY_SECONDS,
          vibratoState,
        );
      }

      if (cleanupTimer) {
        clearTimeout(cleanupTimer);
      }

      if (!isOfflineContext(context)) {
        cleanupTimer = setTimeout(
          cleanup,
          Math.max(
            60,
            Math.round(
              (stopFadeEnd - context.currentTime + STOP_SAFETY_SECONDS + 0.12) *
                1000,
            ),
          ),
        );
      }
    },
  };
}
