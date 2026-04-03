import type { BarRole } from "./authoring/rhythm";

export type VoiceId =
  | "lead"
  | "counterline"
  | "inner"
  | "bass"
  | "bells"
  | "ornament"
  | "drone"
  | "pad"
  | "texture"
  | (string & {});

export type SectionRole =
  | "statement"
  | "answer"
  | "shadow"
  | "bridge"
  | "return"
  | "cadence"
  | "variation"
  | "transition"
  | (string & {});

export type SectionBias = {
  density?: number;
  register?: number;
  brightness?: number;
  cadence?: number;
};

export type SectionPlanItem = {
  id: string;
  role: SectionRole;
  barRole?: BarRole;
  startBar: number;
  bars: number;
  bias?: SectionBias;
  densityBias?: number;
  registerBias?: number;
  brightnessBias?: number;
  cadenceWeight?: number;
  description?: string;
};

export type CompiledSection = SectionPlanItem & {
  startBeat: number;
  endBeat: number;
  endBar: number;
};
