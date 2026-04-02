declare module "web-audio-engine" {
  export class OfflineAudioContext {
    constructor(numberOfChannels: number, length: number, sampleRate: number);
    readonly currentTime: number;
    readonly sampleRate: number;
    readonly destination: AudioDestinationNode;
    createOscillator(): OscillatorNode;
    createGain(): GainNode;
    createStereoPanner(): StereoPannerNode;
    createBiquadFilter(): BiquadFilterNode;
    startRendering(): Promise<AudioBuffer>;
  }
}
