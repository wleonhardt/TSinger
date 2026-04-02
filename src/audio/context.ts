type AudioContextConstructor = new () => AudioContext;
type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };

const DEFAULT_MASTER_GAIN = 0.84;

let sharedContext: AudioContext | null = null;
let masterOutput: GainNode | null = null;
let primePromise: Promise<boolean> | null = null;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const globalWindow = window as WindowWithWebkitAudio;
  return globalWindow.AudioContext ?? globalWindow.webkitAudioContext ?? null;
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (sharedContext?.state === "closed") {
    sharedContext = null;
    masterOutput = null;
    primePromise = null;
  }

  if (sharedContext) {
    return sharedContext;
  }

  const AudioContextClass = getAudioContextConstructor();
  if (!AudioContextClass) {
    return null;
  }

  try {
    sharedContext = new AudioContextClass();
  } catch {
    sharedContext = null;
  }

  return sharedContext;
}

export function getMasterOutput(): GainNode | null {
  const context = getAudioContext();
  if (!context) {
    return null;
  }

  if (masterOutput?.context === context) {
    return masterOutput;
  }

  if (masterOutput) {
    try {
      masterOutput.disconnect();
    } catch {
      // Previous master node may already be disconnected.
    }
  }

  const gain = context.createGain();
  gain.gain.value = DEFAULT_MASTER_GAIN;
  gain.connect(context.destination);
  masterOutput = gain;

  return masterOutput;
}

export function isAudioPrimed(): boolean {
  return sharedContext?.state === "running";
}

export async function primeAudio(): Promise<boolean> {
  if (primePromise) {
    return primePromise;
  }

  const context = getAudioContext();
  const master = getMasterOutput();

  if (!context || !master) {
    return false;
  }

  primePromise = (async () => {
    if (context.state !== "running") {
      try {
        await context.resume();
      } catch {
        return false;
      }
    }

    return context.state === "running";
  })();

  try {
    return await primePromise;
  } finally {
    primePromise = null;
  }
}
