import type { SynthName } from "./composition";
import type { VoiceSpec } from "./synths";

export const voicePresets: Record<SynthName, VoiceSpec> = {
  softLead: {
    id: "softLead",
    displayName: "Soft Lead",
    layers: [
      { type: "triangle", gain: 0.8 },
      { type: "sine", gain: 0.35, detuneCents: 4 },
    ],
    envelope: { attack: 0.012, decay: 0.14, sustain: 0.52, release: 0.22 },
    filter: { type: "lowpass", frequency: 3000, q: 0.7 },
    vibrato: { frequencyHz: 4.5, amount: 6 },
    glideSeconds: 0.03,
    outputGain: 0.17,
    stereoSpread: 0.06,
  },

  glassBell: {
    id: "glassBell",
    displayName: "Glass Bell",
    layers: [
      { type: "sine", gain: 1.0 },
      { type: "triangle", gain: 0.18, octaveOffset: 1 },
    ],
    envelope: { attack: 0.004, decay: 0.32, sustain: 0.08, release: 0.28 },
    filter: { type: "lowpass", frequency: 4700, q: 0.55 },
    outputGain: 0.14,
    stereoSpread: 0.1,
  },

  warmPad: {
    id: "warmPad",
    displayName: "Warm Pad",
    layers: [
      { type: "triangle", gain: 0.7 },
      { type: "sine", gain: 0.45, detuneCents: -5 },
    ],
    envelope: { attack: 0.16, decay: 0.34, sustain: 0.68, release: 0.62 },
    filter: { type: "lowpass", frequency: 1650, q: 0.8 },
    outputGain: 0.115,
    stereoSpread: 0.12,
  },

  roundBass: {
    id: "roundBass",
    displayName: "Round Bass",
    layers: [
      { type: "sine", gain: 0.9 },
      { type: "triangle", gain: 0.15, detuneCents: 3 },
    ],
    envelope: { attack: 0.01, decay: 0.16, sustain: 0.4, release: 0.16 },
    filter: { type: "lowpass", frequency: 820, q: 0.72 },
    outputGain: 0.15,
    stereoSpread: 0.02,
  },

  breathingDrone: {
    id: "breathingDrone",
    displayName: "Breathing Drone",
    layers: [
      { type: "sine", gain: 0.8 },
      { type: "triangle", gain: 0.25, detuneCents: -3 },
    ],
    envelope: { attack: 0.65, decay: 0.45, sustain: 0.82, release: 0.95 },
    filter: { type: "lowpass", frequency: 1100, q: 0.6 },
    vibrato: { frequencyHz: 0.18, amount: 3 },
    outputGain: 0.1,
    stereoSpread: 0.1,
  },

  pluckyDust: {
    id: "pluckyDust",
    displayName: "Plucky Dust",
    layers: [
      { type: "triangle", gain: 0.8 },
      { type: "sine", gain: 0.2, octaveOffset: 1 },
    ],
    envelope: { attack: 0.002, decay: 0.075, sustain: 0.03, release: 0.06 },
    filter: { type: "lowpass", frequency: 3600, q: 0.55 },
    outputGain: 0.095,
    stereoSpread: 0.18,
  },
};
