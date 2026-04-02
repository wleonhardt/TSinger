import type {
  ChordEvent,
  ChordQuality,
  NoteEvent,
  SynthName,
} from "../composition";
import type { CompiledSection, SectionPlanItem, VoiceId } from "../metadata";

export type ToneIntent = "chord" | "scale" | "color" | "passing";
export type { SectionPlanItem, VoiceId };

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
};

export type Motif = {
  anchorDegree: number;
  steps: MotifStep[];
};

export type PatternNoteDraft = {
  beat: number;
  length: number;
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
  repetitions?: number;
  beatOffset?: number;
};

export type DraftLayerPlan = LayerPlanBase & {
  kind: "draft";
  notes: PatternNoteDraft[];
};

export type PhraseLayerPlan = MotifLayerPlan | DraftLayerPlan;

export type ArrangementCurvePoint = {
  beat: number;
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
};

export type ValidationIssue = {
  level: "warning" | "error";
  message: string;
};
