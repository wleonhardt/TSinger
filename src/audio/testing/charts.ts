import type { Composition } from "../composition";
import type {
  AudioFeatureAnalysis,
  ChartArtifact,
  ExpandedScheduledEvent,
  SymbolicAnalysis,
} from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";

function sampleSeries(series: number[], width: number): number[] {
  if (series.length <= width) {
    return series;
  }

  const bucketSize = series.length / width;
  return Array.from({ length: width }, (_, index) => {
    const start = Math.floor(index * bucketSize);
    const end = Math.min(series.length, Math.floor((index + 1) * bucketSize));
    const bucket = series.slice(start, Math.max(start + 1, end));
    return bucket.reduce((sum, value) => sum + value, 0) / bucket.length;
  });
}

function buildSvg(width: number, height: number, children: string): string {
  return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">${children}</svg>`;
}

function linePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
}

function horizontalGrid(params: {
  left: number;
  top: number;
  width: number;
  height: number;
  rows: number;
}): string {
  const { left, top, width, height, rows } = params;

  return Array.from({ length: rows + 1 }, (_, index) => {
    const y = top + (index / rows) * height;
    return `<line x1="${left}" y1="${y.toFixed(2)}" x2="${left + width}" y2="${y.toFixed(2)}" stroke="#e6ece8" stroke-width="1" />`;
  }).join("");
}

function verticalBarGuides(params: {
  left: number;
  top: number;
  width: number;
  height: number;
  barCount: number;
}): string {
  const { left, top, width, height, barCount } = params;

  return Array.from({ length: barCount + 1 }, (_, index) => {
    const x = left + (index / Math.max(1, barCount)) * width;
    return `<line x1="${x.toFixed(2)}" y1="${top}" x2="${x.toFixed(2)}" y2="${top + height}" stroke="#d1dbd5" stroke-width="${index < barCount ? 1 : 1.2}" />`;
  }).join("");
}

function buildTimeLabels(
  width: number,
  height: number,
  left: number,
  right: number,
  durationSeconds: number,
): string {
  const plotWidth = width - left - right;
  const markers = [0, 0.25, 0.5, 0.75, 1];

  return markers
    .map((marker) => {
      const x = left + plotWidth * marker;
      const label = `${(durationSeconds * marker).toFixed(1)}s`;
      return `<text x="${x.toFixed(2)}" y="${height - 10}" text-anchor="middle" font-size="11" fill="#71827b">${label}</text>`;
    })
    .join("");
}

function buildLegend(items: Array<{ label: string; color: string }>, x: number, y: number): string {
  return items
    .map((item, index) => {
      const offsetX = x + index * 122;
      return `
        <rect x="${offsetX}" y="${y}" width="12" height="12" rx="3" fill="${item.color}" />
        <text x="${offsetX + 18}" y="${y + 10}" font-size="11" fill="#51656d">${item.label}</text>
      `;
    })
    .join("");
}

export function buildWaveformSvg(params: {
  channelData: Float32Array[];
  durationSeconds: number;
}): string {
  const { channelData, durationSeconds } = params;
  const width = 960;
  const height = 260;
  const padding = { top: 34, right: 18, bottom: 28, left: 18 };
  const mono =
    channelData.length <= 1
      ? Array.from(channelData[0] ?? new Float32Array())
      : Array.from({ length: channelData[0]!.length }, (_, index) =>
          channelData.reduce((sum, channel) => sum + (channel[index] ?? 0), 0) /
          channelData.length,
        );
  const sampled = sampleSeries(mono, width - padding.left - padding.right);
  const points = sampled.map((value, index) => ({
    x: padding.left + index,
    y: height / 2 - value * (height * 0.36),
  }));
  const plotWidth = width - padding.left - padding.right;

  return buildSvg(
    width,
    height,
    `
      <rect width="${width}" height="${height}" fill="#f7f9f7" />
      ${horizontalGrid({
        left: padding.left,
        top: padding.top,
        width: plotWidth,
        height: height - padding.top - padding.bottom,
        rows: 4,
      })}
      <line x1="${padding.left}" y1="${height / 2}" x2="${width - padding.right}" y2="${height / 2}" stroke="#ccd8d1" stroke-width="1.2" />
      <path d="${linePath(points)}" fill="none" stroke="#28536a" stroke-width="1.5" />
      <text x="18" y="22" font-size="14" fill="#51656d">Waveform</text>
      <text x="18" y="40" font-size="11" fill="#7a8a83">Trimmed offline render with release tail</text>
      ${buildTimeLabels(width, height, padding.left, padding.right, durationSeconds)}
    `,
  );
}

export function buildPianoRollSvg(
  composition: Composition,
  events: ExpandedScheduledEvent[],
): string {
  const width = 960;
  const height = 400;
  const padding = { top: 40, right: 18, bottom: 42, left: 54 };
  const workingWidth = width - padding.left - padding.right;
  const workingHeight = height - padding.top - padding.bottom;
  const totalBeats = composition.phrase.bars * composition.beatsPerBar;
  const minMidi = events.length > 0 ? Math.min(...events.map((event) => event.midi), 48) : 48;
  const maxMidi = events.length > 0 ? Math.max(...events.map((event) => event.midi), 84) : 84;
  const colors: Record<string, string> = {
    lead: "#245464",
    accent: "#4a7d77",
    bass: "#7d5c3c",
    pad: "#a9b8b0",
    drone: "#8f9e98",
    texture: "#64757d",
  };

  const barBands = Array.from({ length: composition.phrase.bars }, (_, index) => {
    const x = padding.left + (index / composition.phrase.bars) * workingWidth;
    const bandWidth = workingWidth / composition.phrase.bars;
    const fill = index % 2 === 0 ? "#fafcfa" : "#f4f7f4";
    return `<rect x="${x.toFixed(2)}" y="${padding.top}" width="${bandWidth.toFixed(2)}" height="${workingHeight}" fill="${fill}" />`;
  }).join("");

  const beatLines = Array.from({ length: totalBeats + 1 }, (_, beat) => {
    const x = padding.left + (beat / totalBeats) * workingWidth;
    const isBar = beat % composition.beatsPerBar === 0;
    return `<line x1="${x.toFixed(2)}" y1="${padding.top}" x2="${x.toFixed(2)}" y2="${height - padding.bottom}" stroke="${isBar ? "#c7d2cb" : "#e5ebe7"}" stroke-width="${isBar ? 1.2 : 0.8}" />`;
  }).join("");

  const noteRects = events.map((event) => {
    const x = padding.left + (event.beat / totalBeats) * workingWidth;
    const widthPx = Math.max(
      3,
      ((event.endBeat - event.beat) / totalBeats) * workingWidth,
    );
    const normalized =
      1 - (event.midi - minMidi) / Math.max(1, maxMidi - minMidi);
    const y = padding.top + normalized * workingHeight;
    const fill = colors[event.role] ?? colors.texture;

    return `<rect x="${x.toFixed(2)}" y="${(y - 5).toFixed(2)}" width="${widthPx.toFixed(2)}" height="9" rx="3" fill="${fill}" opacity="${event.sourceKind === "chordTone" ? 0.28 : 0.82}" />`;
  }).join("");

  const barLabels = Array.from({ length: composition.phrase.bars }, (_, index) => {
    const x = padding.left + ((index + 0.5) / composition.phrase.bars) * workingWidth;
    return `<text x="${x.toFixed(2)}" y="26" text-anchor="middle" font-size="11" fill="#71827b">Bar ${index + 1}</text>`;
  }).join("");

  return buildSvg(
    width,
    height,
    `
      <rect width="${width}" height="${height}" fill="#f7f9f7" />
      ${barBands}
      ${beatLines}
      ${noteRects}
      <text x="18" y="22" font-size="14" fill="#51656d">Piano Roll</text>
      <text x="18" y="40" font-size="11" fill="#7a8a83">Raw notes + expanded chord tones</text>
      ${barLabels}
      <text x="18" y="${padding.top + 6}" font-size="11" fill="#71827b">High: ${maxMidi}</text>
      <text x="18" y="${height - padding.bottom}" font-size="11" fill="#71827b">Low: ${minMidi}</text>
      ${buildLegend(
        [
          { label: "Lead", color: colors.lead },
          { label: "Accent", color: colors.accent },
          { label: "Bass", color: colors.bass },
          { label: "Pad/Drone", color: colors.pad },
        ],
        54,
        height - 24,
      )}
    `,
  );
}

export function buildDensitySvg(symbolic: SymbolicAnalysis): string {
  const width = 760;
  const height = 300;
  const padding = { top: 40, right: 20, bottom: 34, left: 44 };
  const barCount = symbolic.noteDensityByBar.length;
  const workingWidth = width - padding.left - padding.right;
  const workingHeight = height - padding.top - padding.bottom;
  const maxDensity = Math.max(1, ...symbolic.noteDensityByBar);
  const maxOnsets = Math.max(1, ...symbolic.onsetCountByBar);
  const maxCadence = Math.max(1, ...symbolic.cadenceStrengthByBar);
  const barWidth = workingWidth / Math.max(1, barCount);

  const bars = symbolic.noteDensityByBar.map((density, index) => {
    const normalizedHeight = (density / maxDensity) * workingHeight;
    const x = padding.left + index * barWidth + 10;
    const y = padding.top + (workingHeight - normalizedHeight);
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(10, barWidth - 20).toFixed(2)}" height="${normalizedHeight.toFixed(2)}" rx="6" fill="#9db8ad" />`;
  }).join("");

  const onsetPoints = symbolic.onsetCountByBar.map((count, index) => ({
    x: padding.left + index * barWidth + barWidth / 2,
    y: padding.top + (1 - count / maxOnsets) * workingHeight,
  }));
  const cadencePoints = symbolic.cadenceStrengthByBar.map((value, index) => ({
    x: padding.left + index * barWidth + barWidth / 2,
    y: padding.top + (1 - value / maxCadence) * workingHeight,
  }));
  const barLabels = Array.from({ length: barCount }, (_, index) => {
    const x = padding.left + index * barWidth + barWidth / 2;
    return `<text x="${x.toFixed(2)}" y="${height - 10}" text-anchor="middle" font-size="11" fill="#71827b">${index + 1}</text>`;
  }).join("");

  return buildSvg(
    width,
    height,
    `
      <rect width="${width}" height="${height}" fill="#f7f9f7" />
      ${horizontalGrid({
        left: padding.left,
        top: padding.top,
        width: workingWidth,
        height: workingHeight,
        rows: 4,
      })}
      ${verticalBarGuides({
        left: padding.left,
        top: padding.top,
        width: workingWidth,
        height: workingHeight,
        barCount,
      })}
      ${bars}
      <path d="${linePath(onsetPoints)}" fill="none" stroke="#28536a" stroke-width="2" />
      <path d="${linePath(cadencePoints)}" fill="none" stroke="#9a5b4f" stroke-width="2" stroke-dasharray="6 4" />
      <text x="18" y="22" font-size="14" fill="#51656d">Bar Density</text>
      <text x="18" y="40" font-size="11" fill="#7a8a83">Density bars, onset contour, and cadence contour</text>
      ${barLabels}
      ${buildLegend(
        [
          { label: "Density", color: "#9db8ad" },
          { label: "Onsets", color: "#28536a" },
          { label: "Cadence", color: "#9a5b4f" },
        ],
        44,
        height - 26,
      )}
    `,
  );
}

export function buildRoughnessSvg(audio: AudioFeatureAnalysis, barCount: number): string {
  const width = 960;
  const height = 240;
  const padding = { top: 34, right: 18, bottom: 28, left: 40 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const series = sampleSeries(audio.roughnessByWindow, plotWidth);
  const maxValue = Math.max(0.001, ...series);
  const threshold = maxValue * 0.72;
  const points = series.map((value, index) => ({
    x: padding.left + index,
    y: padding.top + (1 - value / maxValue) * plotHeight,
  }));

  return buildSvg(
    width,
    height,
    `
      <rect width="${width}" height="${height}" fill="#f7f9f7" />
      ${horizontalGrid({
        left: padding.left,
        top: padding.top,
        width: plotWidth,
        height: plotHeight,
        rows: 4,
      })}
      ${verticalBarGuides({
        left: padding.left,
        top: padding.top,
        width: plotWidth,
        height: plotHeight,
        barCount,
      })}
      <rect x="${padding.left}" y="${padding.top}" width="${plotWidth}" height="${(threshold / maxValue) * plotHeight}" fill="transparent" />
      <line
        x1="${padding.left}"
        y1="${(padding.top + (1 - threshold / maxValue) * plotHeight).toFixed(2)}"
        x2="${width - padding.right}"
        y2="${(padding.top + (1 - threshold / maxValue) * plotHeight).toFixed(2)}"
        stroke="#c79a91"
        stroke-width="1"
        stroke-dasharray="5 5"
      />
      <path d="${linePath(points)}" fill="none" stroke="#9a5b4f" stroke-width="1.8" />
      <text x="18" y="22" font-size="14" fill="#51656d">Roughness</text>
      <text x="18" y="40" font-size="11" fill="#7a8a83">Windowed symbolic roughness aligned to the render</text>
      ${buildTimeLabels(width, height, padding.left, padding.right, audio.durationSeconds)}
    `,
  );
}

export function generateAnalysisCharts(params: {
  composition: Composition;
  symbolic: SymbolicAnalysis;
  audio: AudioFeatureAnalysis;
  events: ExpandedScheduledEvent[];
  channelData: Float32Array[];
}): ChartArtifact[] {
  const { composition, symbolic, audio, events, channelData } = params;

  return [
    {
      filename: "waveform.svg",
      content: buildWaveformSvg({
        channelData,
        durationSeconds: audio.durationSeconds,
      }),
    },
    { filename: "piano-roll.svg", content: buildPianoRollSvg(composition, events) },
    { filename: "density.svg", content: buildDensitySvg(symbolic) },
    {
      filename: "roughness.svg",
      content: buildRoughnessSvg(audio, symbolic.noteDensityByBar.length),
    },
  ];
}
