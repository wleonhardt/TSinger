import type { Composition } from "../composition";
import { cinderCarousel } from "./cinderCarousel";
import { heliographProcession } from "./heliographProcession";
import { pinwheelCircuit } from "./pinwheelCircuit";
import { undertowAtlas } from "./undertowAtlas";

export {
  heliographProcession,
  undertowAtlas,
  cinderCarousel,
  pinwheelCircuit,
};

export const presets: Composition[] = [
  heliographProcession,
  undertowAtlas,
  cinderCarousel,
  pinwheelCircuit,
];
