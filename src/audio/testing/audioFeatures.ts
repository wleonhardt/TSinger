import type { Composition } from "../composition";
import { buildRoughnessSeriesFromEvents } from "./roughness";
import type {
  AudioFeatureAnalysis,
  ExpandedScheduledEvent,
  OfflineRenderResult,
} from "./types";

const DEFAULT_WINDOW_SIZE = 1024;
const DEFAULT_HOP_SIZE = 256;
const ROLLOFF_RATIO = 0.85;

function nextPowerOfTwo(value: number): number {
  let power = 1;

  while (power < value) {
    power <<= 1;
  }

  return power;
}

function normalizeWindowSize(value: number | undefined): number {
  const requested = Math.max(32, Math.floor(value ?? DEFAULT_WINDOW_SIZE));
  return nextPowerOfTwo(requested);
}

function normalizeHopSize(value: number | undefined, windowSize: number): number {
  return Math.max(16, Math.min(windowSize, Math.floor(value ?? DEFAULT_HOP_SIZE)));
}

function mixDownToMono(channelData: Float32Array[]): Float32Array {
  if (channelData.length === 0) {
    return new Float32Array(0);
  }

  if (channelData.length === 1) {
    return channelData[0]!;
  }

  const length = channelData[0]!.length;
  const mono = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    let sum = 0;
    for (const channel of channelData) {
      sum += channel[index] ?? 0;
    }
    mono[index] = sum / channelData.length;
  }

  return mono;
}

function buildHannWindow(length: number): Float32Array {
  const window = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    window[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (length - 1)));
  }

  return window;
}

function bitReverse(index: number, bits: number): number {
  let reversed = 0;

  for (let bit = 0; bit < bits; bit += 1) {
    reversed = (reversed << 1) | ((index >>> bit) & 1);
  }

  return reversed;
}

function fftMagnitude(windowedSamples: Float32Array): Float32Array {
  const size = windowedSamples.length;
  const bits = Math.log2(size);
  const real = new Float64Array(size);
  const imag = new Float64Array(size);

  for (let index = 0; index < size; index += 1) {
    real[bitReverse(index, bits)] = windowedSamples[index] ?? 0;
  }

  for (let blockSize = 2; blockSize <= size; blockSize <<= 1) {
    const halfSize = blockSize >>> 1;
    const phaseStep = (-2 * Math.PI) / blockSize;

    for (let start = 0; start < size; start += blockSize) {
      for (let offset = 0; offset < halfSize; offset += 1) {
        const evenIndex = start + offset;
        const oddIndex = evenIndex + halfSize;
        const phase = phaseStep * offset;
        const cos = Math.cos(phase);
        const sin = Math.sin(phase);
        const treal = real[oddIndex]! * cos - imag[oddIndex]! * sin;
        const timag = real[oddIndex]! * sin + imag[oddIndex]! * cos;

        real[oddIndex] = real[evenIndex]! - treal;
        imag[oddIndex] = imag[evenIndex]! - timag;
        real[evenIndex] += treal;
        imag[evenIndex] += timag;
      }
    }
  }

  const magnitudes = new Float32Array(size / 2);
  for (let index = 0; index < size / 2; index += 1) {
    magnitudes[index] = Math.hypot(real[index]!, imag[index]!);
  }

  return magnitudes;
}

function sum(values: Float32Array): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((running, value) => running + value, 0) / values.length;
}

function barWindowRanges(
  windowCount: number,
  hopSize: number,
  sampleRate: number,
  totalBars: number,
  secondsPerBar: number,
): Array<{ startWindow: number; endWindow: number }> {
  return Array.from({ length: totalBars }, (_, barIndex) => {
    const barStartSeconds = barIndex * secondsPerBar;
    const barEndSeconds = (barIndex + 1) * secondsPerBar;
    const startWindow = Math.max(0, Math.floor((barStartSeconds * sampleRate) / hopSize));
    const endWindow = Math.min(
      windowCount,
      Math.ceil((barEndSeconds * sampleRate) / hopSize),
    );

    return {
      startWindow,
      endWindow: Math.max(startWindow + 1, endWindow),
    };
  });
}

function normalizeBarVectors(vectors: number[][]): number[][] {
  if (vectors.length === 0) {
    return [];
  }

  const dimensions = vectors[0]!.length;
  const maxima = Array.from({ length: dimensions }, (_, index) =>
    Math.max(
      1e-6,
      ...vectors.map((vector) => Math.abs(vector[index] ?? 0)),
    ),
  );

  return vectors.map((vector) =>
    vector.map((value, index) => value / maxima[index]!),
  );
}

function buildStructuralBarVectors(
  composition: Composition,
  mergedEvents: ExpandedScheduledEvent[],
  totalBars: number,
): number[][] {
  const phraseBarVectors = Array.from({ length: composition.phrase.bars }, (_, barIndex) => {
    const barStart = barIndex * composition.beatsPerBar;
    const barEnd = barStart + composition.beatsPerBar;
    const barNotes = mergedEvents.filter(
      (event) =>
        event.sourceKind === "note" &&
        event.beat >= barStart &&
        event.beat < barEnd,
    );
    const leadAccentNotes = barNotes.filter(
      (event) => event.role === "lead" || event.role === "accent",
    );
    const occupiedBeats = barNotes.reduce((sum, event) => {
      const overlapStart = Math.max(event.beat, barStart);
      const overlapEnd = Math.min(event.endBeat, barEnd);
      return sum + Math.max(0, overlapEnd - overlapStart);
    }, 0);
    const weightSum = barNotes.reduce(
      (sum, event) => sum + Math.max(0.12, event.durationBeats) * event.velocity,
      0,
    );
    const registerCenter = weightSum > 0
      ? barNotes.reduce(
          (sum, event) =>
            sum + event.midi * Math.max(0.12, event.durationBeats) * event.velocity,
          0,
        ) / weightSum
      : 0;

    return [
      barNotes.length / Math.max(1, composition.beatsPerBar),
      occupiedBeats / Math.max(1, composition.beatsPerBar),
      registerCenter,
      leadAccentNotes.length / Math.max(1, composition.beatsPerBar),
    ];
  });

  return Array.from(
    { length: totalBars },
    (_, barIndex) => phraseBarVectors[barIndex % phraseBarVectors.length]!,
  );
}

export function analyzeAudioFeatures(params: {
  composition: Composition;
  render: OfflineRenderResult;
  mergedEvents: ExpandedScheduledEvent[];
  windowSize?: number;
  hopSize?: number;
}): AudioFeatureAnalysis {
  const { composition, render, mergedEvents } = params;
  const mono = mixDownToMono(render.channelData);
  const windowSize = normalizeWindowSize(params.windowSize);
  const hopSize = normalizeHopSize(params.hopSize, windowSize);
  const window = buildHannWindow(windowSize);
  const paddedLength = Math.max(windowSize, mono.length);
  const windowCount = Math.max(
    1,
    Math.floor((paddedLength - windowSize) / hopSize) + 1,
  );
  const rmsByWindow: number[] = [];
  const peakByWindow: number[] = [];
  const zeroCrossingRateByWindow: number[] = [];
  const spectralCentroidByWindow: number[] = [];
  const spectralRolloffByWindow: number[] = [];
  const onsetStrengthByWindow: number[] = [];
  let previousSpectrum: Float32Array | null = null;

  for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
    const start = windowIndex * hopSize;
    const segment = new Float32Array(windowSize);
    let squaredSum = 0;
    let absolutePeak = 0;
    let zeroCrossings = 0;
    let previousValue = 0;

    for (let offset = 0; offset < windowSize; offset += 1) {
      const sample = mono[start + offset] ?? 0;
      segment[offset] = sample * window[offset]!;
      squaredSum += sample * sample;
      absolutePeak = Math.max(absolutePeak, Math.abs(sample));

      if (offset > 0 && Math.sign(sample) !== Math.sign(previousValue)) {
        zeroCrossings += 1;
      }

      previousValue = sample;
    }

    const spectrum = fftMagnitude(segment);
    const totalMagnitude = Math.max(1e-9, sum(spectrum));
    let centroidAccumulator = 0;
    let cumulative = 0;
    let rolloff = 0;

    for (let bin = 0; bin < spectrum.length; bin += 1) {
      const frequency = (bin * render.sampleRate) / windowSize;
      const magnitude = spectrum[bin] ?? 0;

      centroidAccumulator += frequency * magnitude;
      cumulative += magnitude;
      if (rolloff === 0 && cumulative / totalMagnitude >= ROLLOFF_RATIO) {
        rolloff = frequency;
      }
    }

    let flux = 0;
    if (previousSpectrum) {
      for (let bin = 0; bin < spectrum.length; bin += 1) {
        const delta = Math.max(0, (spectrum[bin] ?? 0) - (previousSpectrum[bin] ?? 0));
        flux += delta;
      }
    }

    previousSpectrum = spectrum;
    rmsByWindow.push(Number(Math.sqrt(squaredSum / windowSize).toFixed(6)));
    peakByWindow.push(Number(absolutePeak.toFixed(6)));
    zeroCrossingRateByWindow.push(Number((zeroCrossings / windowSize).toFixed(6)));
    spectralCentroidByWindow.push(Number((centroidAccumulator / totalMagnitude).toFixed(3)));
    spectralRolloffByWindow.push(Number(rolloff.toFixed(3)));
    onsetStrengthByWindow.push(Number(flux.toFixed(6)));
  }

  const roughnessByWindow = buildRoughnessSeriesFromEvents({
    events: mergedEvents,
    bpm: composition.bpm,
    durationSeconds: render.musicalDurationSeconds,
    sampleRate: render.sampleRate,
    windowSize,
    hopSize,
  }).map((value) => Number(value.toFixed(6)));

  const secondsPerBar = (60 / composition.bpm) * composition.beatsPerBar;
  const totalBars = Math.max(1, composition.phrase.bars * Math.max(1, render.phraseRepeats));
  const barRanges = barWindowRanges(
    rmsByWindow.length,
    hopSize,
    render.sampleRate,
    totalBars,
    secondsPerBar,
  );
  const barFeatureVectors = barRanges.map((range) => {
    const sliceStart = range.startWindow;
    const sliceEnd = range.endWindow;

    return [
      average(rmsByWindow.slice(sliceStart, sliceEnd)),
      average(peakByWindow.slice(sliceStart, sliceEnd)),
      average(spectralCentroidByWindow.slice(sliceStart, sliceEnd)) / (render.sampleRate / 2),
      average(spectralRolloffByWindow.slice(sliceStart, sliceEnd)) / (render.sampleRate / 2),
      average(onsetStrengthByWindow.slice(sliceStart, sliceEnd)),
      average(roughnessByWindow.slice(sliceStart, sliceEnd)),
      average(zeroCrossingRateByWindow.slice(sliceStart, sliceEnd)),
    ];
  });
  const structuralBarVectors = buildStructuralBarVectors(
    composition,
    mergedEvents,
    totalBars,
  );
  const normalizedBarVectors = normalizeBarVectors(
    barFeatureVectors.map((vector, index) => [
      ...vector,
      ...structuralBarVectors[index]!,
    ]),
  );
  const noveltyWeights = [
    0.45,
    0.25,
    0.5,
    0.3,
    0.45,
    0.35,
    0.15,
    0.8,
    0.7,
    0.45,
    0.75,
  ];
  const noveltyByBar = normalizedBarVectors.map((vector, barIndex) => {

    if (barIndex === 0) {
      return 0;
    }

    const previousVector = normalizedBarVectors[barIndex - 1]!;
    const distance =
      vector.reduce((sum, value, index) => {
        const delta = Math.abs(value - previousVector[index]!);
        return sum + delta * (noveltyWeights[index] ?? 1);
      }, 0) / noveltyWeights.length;

    return Number(distance.toFixed(6));
  });

  const dcOffset =
    mono.length > 0
      ? Number((mono.reduce((sum, sample) => sum + sample, 0) / mono.length).toFixed(8))
      : 0;
  const clippingSampleCount = mono.reduce(
    (count, sample) => count + (Math.abs(sample) >= 0.999 ? 1 : 0),
    0,
  );

  return {
    sampleRate: render.sampleRate,
    durationSeconds: render.durationSeconds,
    rmsByWindow,
    peakByWindow,
    zeroCrossingRateByWindow,
    spectralCentroidByWindow,
    spectralRolloffByWindow,
    onsetStrengthByWindow,
    noveltyByBar,
    roughnessByWindow,
    dcOffset,
    clippingSampleCount,
  };
}
