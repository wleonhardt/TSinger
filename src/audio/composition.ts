import type { CompiledSection, SectionRole, VoiceId } from "./metadata";
import type { TimingMetadata } from "./authoring/timing";

export type SynthName =
  | "softLead"
  | "glassBell"
  | "warmPad"
  | "roundBass"
  | "breathingDrone"
  | "pluckyDust";

export type ChordQuality =
  | "major"
  | "minor"
  | "sus2"
  | "sus4"
  | "major7"
  | "minor7"
  | "add9"
  | "minorAdd9";

export type NoteEvent = {
  beat: number;
  length: number;
  pitch: string;
  synth: SynthName;
  velocity?: number;
  glideTo?: string;
  pan?: number;
  voiceId?: VoiceId;
  layerId?: string;
  sectionId?: string;
  sectionRole?: SectionRole;
};

export type ChordEvent = {
  beat: number;
  length: number;
  root: string;
  quality: ChordQuality;
  synth: SynthName;
  velocity?: number;
  inversion?: number;
  spread?: number;
  voiceId?: VoiceId;
  layerId?: string;
  sectionId?: string;
  sectionRole?: SectionRole;
};

export type Phrase = {
  bars: number;
  notes: NoteEvent[];
  chords: ChordEvent[];
};

export type Composition = {
  id: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  key: {
    root: string;
    scale: string;
  };
  phrase: Phrase;
  loop: boolean;
  sections?: CompiledSection[];
  timing?: TimingMetadata;
};
