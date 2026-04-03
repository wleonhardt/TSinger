import type { Composition } from "../composition";
import { cinderCarousel } from "./cinderCarousel";
import { cinderCarouselV2 } from "./cinderCarouselV2";
import { heliographProcession } from "./heliographProcession";
import { heliographProcessionV2 } from "./heliographProcessionV2";
import { pinwheelCircuit } from "./pinwheelCircuit";
import { pinwheelCircuitV2 } from "./pinwheelCircuitV2";
import { undertowAtlas } from "./undertowAtlas";
import { undertowAtlasV2 } from "./undertowAtlasV2";

export {
  heliographProcession,
  heliographProcessionV2,
  undertowAtlas,
  undertowAtlasV2,
  cinderCarousel,
  cinderCarouselV2,
  pinwheelCircuit,
  pinwheelCircuitV2,
};

export const presets: Composition[] = [
  heliographProcession,
  heliographProcessionV2,
  undertowAtlas,
  undertowAtlasV2,
  cinderCarousel,
  cinderCarouselV2,
  pinwheelCircuit,
  pinwheelCircuitV2,
];
