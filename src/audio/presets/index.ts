import type { Composition } from "../composition";
import { glassGarden } from "./glassGarden";
import { lowTideMemory } from "./lowTideMemory";
import { paperLanterns } from "./paperLanterns";
import { quietArcade } from "./quietArcade";

export { glassGarden, quietArcade, lowTideMemory, paperLanterns };

export const presets: Composition[] = [
  glassGarden,
  quietArcade,
  lowTideMemory,
  paperLanterns,
];
