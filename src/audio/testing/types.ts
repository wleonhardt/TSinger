import type { ChordQuality, Composition, SynthName } from "../composition";
import type { SectionRole, VoiceId } from "../metadata";

export type WindowedSeries = number[];

export type PitchRange = {
  min: string | null;
  max: string | null;
};

export type SymbolicCollision = {
  beat: number;
  bar: number;
  pitches: string[];
  voices: string[];
  sectionId?: string;
  sectionRole?: SectionRole;
};

export type ExpandedEventKind = "note" | "chordTone";

export type ExpandedEventRole =
  | "lead"
  | "counterline"
  | "accent"
  | "bass"
  | "pad"
  | "drone"
  | "ornament"
  | "texture";

export type ExpandedScheduledEvent = {
  id: string;
  sourceKind: ExpandedEventKind;
  sourceIndex: number;
  synth: SynthName;
  voiceId: VoiceId;
  layerId?: string;
  role: ExpandedEventRole;
  pitch: string;
  midi: number;
  beat: number;
  endBeat: number;
  durationBeats: number;
  velocity: number;
  barIndex: number;
  sectionId?: string;
  sectionRole?: SectionRole;
  chordRoot?: string;
  chordQuality?: ChordQuality;
  toneIndex?: number;
};

export type EventCollection = {
  noteEvents: ExpandedScheduledEvent[];
  chordToneEvents: ExpandedScheduledEvent[];
  mergedEvents: ExpandedScheduledEvent[];
};

export type VoiceAnalysis = {
  voiceId: string;
  synths: SynthName[];
  noteCount: number;
  pitchRange: PitchRange;
  averageLeapSemitones: number;
  maxLeapSemitones: number;
  repeatedPitchRatio: number;
  registerCenterMidi: number | null;
};

export type RoughnessCause = {
  beat: number;
  bar: number;
  sectionId?: string;
  sectionRole?: SectionRole;
  pitchA: string;
  pitchB: string;
  midiA: number;
  midiB: number;
  layerIdA?: string;
  layerIdB?: string;
  voiceA?: string;
  voiceB?: string;
  synthA?: string;
  synthB?: string;
  intervalSemitones: number;
  overlapBeats: number;
  registerBand: "low" | "mid" | "high";
  score: number;
  reason: string;
  patch: string;
  severity: "info" | "warning" | "error";
};

export type SymbolicAnalysis = {
  noteCount: number;
  chordEventCount: number;
  uniquePitches: string[];
  pitchRange: PitchRange;
  averageLeapSemitones: number;
  maxLeapSemitones: number;
  averageLeadLeapSemitones?: number;
  voiceAnalyses: VoiceAnalysis[];
  highRegisterDissonanceWarnings: string[];
  simultaneousCollisions: SymbolicCollision[];
  roughnessCauses: RoughnessCause[];
  noteDensityByBar: number[];
  onsetCountByBar: number[];
  chordToneRatio: number;
  colorToneRatio: number;
  repeatedPitchRatio: number;
  registerCenterMidi: number | null;
  cadenceStrengthByBar: number[];
  duplicateEventWarnings: string[];
};

export type AudioFeatureAnalysis = {
  sampleRate: number;
  durationSeconds: number;
  rmsByWindow: WindowedSeries;
  peakByWindow: WindowedSeries;
  zeroCrossingRateByWindow: WindowedSeries;
  spectralCentroidByWindow: WindowedSeries;
  spectralRolloffByWindow: WindowedSeries;
  onsetStrengthByWindow: WindowedSeries;
  noveltyByBar: number[];
  roughnessByWindow: WindowedSeries;
  dcOffset: number;
  clippingSampleCount: number;
};

export type ValidationWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export type SectionAnalysis = {
  id: string;
  role: SectionRole;
  startBar: number;
  bars: number;
  description?: string;
  averageDensity: number;
  averageOnsets: number;
  averageCadenceStrength: number;
  averageNovelty: number | null;
};

export type PresetAnalysis = {
  presetId: string;
  title: string;
  renderedAtIso: string;
  durationSeconds: number;
  bars: number;
  bpm: number;
  beatsPerBar: number;
  sections: SectionAnalysis[];
  symbolic: SymbolicAnalysis;
  audio: AudioFeatureAnalysis;
  validationWarnings: ValidationWarning[];
  suggestedMusicalEdits: string[];
};

export type ComparisonDelta = {
  metric: string;
  before: number | string | null;
  after: number | string | null;
  delta?: number | null;
  interpretation: string;
};

export type PresetComparison = {
  presetIdA: string;
  presetIdB: string;
  summary: string;
  deltas: ComparisonDelta[];
};

export type AnalyzeOptions = {
  outputDir: string;
  generateCharts?: boolean;
  renderRepeats?: number;
  sampleRate?: number;
  offlineTailSeconds?: number;
  windowSize?: number;
  hopSize?: number;
};

export type OfflineRenderResult = {
  sampleRate: number;
  durationSeconds: number;
  channelData: Float32Array[];
  phraseRepeats: number;
  musicalDurationSeconds: number;
  tailSeconds: number;
};

export type ChartArtifact = {
  filename: string;
  content: string;
};

export type AnalysisArtifacts = {
  analysis: PresetAnalysis;
  events: EventCollection;
  report: string;
  charts: ChartArtifact[];
  render: OfflineRenderResult;
  composition: Composition;
};
