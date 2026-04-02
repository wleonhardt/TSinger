import type {
  ChordEvent,
  ChordQuality,
  NoteEvent,
  SynthName,
} from "../composition";
import type { CompiledSection, SectionPlanItem, VoiceId } from "../metadata";
import type {
  MeterSpec,
  Position,
  Span,
  SwingProfile,
  TimingIntent,
  TimingMetadata,
} from "./timing";

export type ToneIntent = "chord" | "scale" | "color" | "passing";
export type { SectionPlanItem, VoiceId };
export type {
  MeterSpec,
  Position,
  Span,
  SwingProfile,
  TimingIntent,
  TimingMetadata,
};

export type RegisterRange = {
  min: string;
  max: string;
  anchor?: string;
};

export type HarmonyPlanItem = {
  bar: number;
  root: string;
  quality: ChordQuality;
  lengthBars?: number;
  synth?: SynthName;
  velocity?: number;
  inversion?: number;
  spread?: number;
  tag?: string;
};

export type MotifStep = {
  beat: number;
  length: number;
  offset: number;
  chromaticOffset?: number;
  octaveOffset?: number;
  velocity?: number;
  pan?: number;
  toneIntent?: ToneIntent;
  ornament?: boolean;
  voiceId?: VoiceId;
  timingIntent?: TimingIntent;
};

export type Motif = {
  anchorDegree: number;
  steps: MotifStep[];
};

export type PatternNoteDraft = {
  beat: number;
  length: number;
  at?: Position;
  duration?: Span;
  pitch?: string;
  degree?: number;
  chordDegree?: number;
  chromaticOffset?: number;
  octaveOffset?: number;
  velocity?: number;
  pan?: number;
  toneIntent?: ToneIntent;
  ornament?: boolean;
  glideToDegree?: number;
  voiceId?: VoiceId;
  timingIntent?: TimingIntent;
};

type LayerPlanBase = {
  id?: string;
  synth: SynthName;
  voiceId?: VoiceId;
  register?: RegisterRange;
  velocityScale?: number;
  pan?: number;
  clampToHarmony?: boolean;
  allowOrnaments?: boolean;
};

export type MotifLayerPlan = LayerPlanBase & {
  kind: "motif";
  motif: Motif;
  repeatEveryBeats?: number;
  repeatEvery?: Span;
  repetitions?: number;
  beatOffset?: number;
  positionOffset?: Position;
};

export type DraftLayerPlan = LayerPlanBase & {
  kind: "draft";
  notes: PatternNoteDraft[];
};

export type PhraseLayerPlan = MotifLayerPlan | DraftLayerPlan;

export type ArrangementCurvePoint = {
  beat: number;
  at?: Position;
  value: number;
};

export type ArrangementSpec = {
  densityCurve?: ArrangementCurvePoint[];
  registerCurve?: ArrangementCurvePoint[];
  brightnessCurve?: ArrangementCurvePoint[];
  cadenceCurve?: ArrangementCurvePoint[];
  ornamentBaseProbability?: number;
};

export type PadLayerPlan = {
  id?: string;
  synth: SynthName;
  voiceId?: VoiceId;
  velocityScale?: number;
  overrideHarmony?: HarmonyPlanItem[];
};

export type PhrasePlan = {
  bars: number;
  beatsPerBar: number;
  meter?: MeterSpec;
  swing?: SwingProfile;
  key: {
    root: string;
    scale: string;
  };
  harmony: HarmonyPlanItem[];
  sections?: SectionPlanItem[];
  padLayers?: PadLayerPlan[];
  noteLayers?: PhraseLayerPlan[];
  arrangement?: ArrangementSpec;
};

export type CompiledPhrase = {
  notes: NoteEvent[];
  chords: ChordEvent[];
  sections: CompiledSection[];
  timing?: TimingMetadata;
};

export type ValidationIssue = {
  level: "warning" | "error";
  message: string;
};
