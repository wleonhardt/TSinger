/// <reference types="node" />

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { presets } from "../presets";
import { voicePresets } from "../voicePresets";
import { generateAnalysisCharts } from "./charts";
import { comparePresetAnalyses } from "./compare";
import { mergeAllScheduledEvents } from "./collectEvents";
import { analyzeAudioFeatures } from "./audioFeatures";
import {
  buildPresetReport,
  buildComparisonReport,
  buildSuggestedMusicalEdits,
} from "./report";
import { renderCompositionOffline } from "./renderOffline";
import { buildSectionAnalyses } from "./sectionAnalysis";
import { analyzeSymbolically } from "./symbolicAnalysis";
import type { AnalyzeOptions, PresetAnalysis } from "./types";
import { validatePresetAnalysis } from "./validate";
import { encodeWav } from "./wav";

const DEFAULT_OPTIONS: AnalyzeOptions = {
  outputDir: "analysis-output",
  generateCharts: true,
  renderRepeats: 2,
  sampleRate: 44_100,
  offlineTailSeconds: 1.6,
  windowSize: 1024,
  hopSize: 256,
};

function printHelp(): void {
  console.log(`Usage:
  npx tsx src/audio/testing/cli.ts analyze <preset-id> [--output-dir dir] [--render-repeats n] [--sample-rate hz] [--tail-seconds s] [--window-size n] [--hop-size n] [--no-charts]
  npx tsx src/audio/testing/cli.ts analyze-all [--output-dir dir] [--render-repeats n]
  npx tsx src/audio/testing/cli.ts compare <preset-id|analysis.json> <preset-id|analysis.json> [--output-dir dir]
`);
}

function sanitizeName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
}

function findPresetById(presetId: string) {
  return presets.find((preset) => preset.id === presetId) ?? null;
}

function parseCli(argv: string[]): {
  command: string;
  positional: string[];
  options: AnalyzeOptions;
} {
  const positional: string[] = [];
  const options: AnalyzeOptions = { ...DEFAULT_OPTIONS };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;

    switch (arg) {
      case "--output-dir":
        options.outputDir = argv[index + 1] ?? options.outputDir;
        index += 1;
        break;
      case "--render-repeats":
        options.renderRepeats = Number.parseInt(argv[index + 1] ?? "2", 10);
        index += 1;
        break;
      case "--sample-rate":
        options.sampleRate = Number.parseInt(argv[index + 1] ?? "44100", 10);
        index += 1;
        break;
      case "--tail-seconds":
        options.offlineTailSeconds = Number.parseFloat(argv[index + 1] ?? "1.6");
        index += 1;
        break;
      case "--window-size":
        options.windowSize = Number.parseInt(argv[index + 1] ?? "1024", 10);
        index += 1;
        break;
      case "--hop-size":
        options.hopSize = Number.parseInt(argv[index + 1] ?? "256", 10);
        index += 1;
        break;
      case "--no-charts":
        options.generateCharts = false;
        break;
      default:
        positional.push(arg);
        break;
    }
  }

  return {
    command: positional[0] ?? "help",
    positional: positional.slice(1),
    options,
  };
}

async function ensureDir(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
}

async function removeFileIfPresent(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error: unknown) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function analyzePreset(
  presetId: string,
  options: AnalyzeOptions,
): Promise<PresetAnalysis> {
  const preset = findPresetById(presetId);
  if (!preset) {
    throw new Error(`Unknown preset id: ${presetId}`);
  }

  const outputDir = path.resolve(options.outputDir, sanitizeName(preset.id));
  await ensureDir(outputDir);

  const render = await renderCompositionOffline({
    composition: preset,
    voices: voicePresets,
    repeats: options.renderRepeats,
    sampleRate: options.sampleRate,
    tailSeconds: options.offlineTailSeconds,
  });
  const events = mergeAllScheduledEvents(preset);
  const symbolic = analyzeSymbolically(preset, events);
  const audio = analyzeAudioFeatures({
    composition: preset,
    render,
    mergedEvents: events.mergedEvents,
    windowSize: options.windowSize,
    hopSize: options.hopSize,
  });

  const analysis: PresetAnalysis = {
    presetId: preset.id,
    title: preset.title,
    renderedAtIso: new Date().toISOString(),
    durationSeconds: render.durationSeconds,
    bars: preset.phrase.bars,
    bpm: preset.bpm,
    beatsPerBar: preset.beatsPerBar,
    sections: [],
    symbolic,
    audio,
    validationWarnings: [],
    suggestedMusicalEdits: [],
  };
  analysis.sections = buildSectionAnalyses({
    composition: preset,
    symbolic,
    audio,
  });
  analysis.validationWarnings = validatePresetAnalysis(analysis);
  analysis.suggestedMusicalEdits = buildSuggestedMusicalEdits(analysis);
  const report = buildPresetReport(analysis);

  await writeFile(
    path.join(outputDir, "analysis.json"),
    `${JSON.stringify(analysis, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(outputDir, "events.json"),
    `${JSON.stringify(
      {
        composition: preset,
        noteEvents: events.noteEvents,
        chordToneEvents: events.chordToneEvents,
        mergedEvents: events.mergedEvents,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(path.join(outputDir, "report.md"), report, "utf8");
  await writeFile(path.join(outputDir, "render.wav"), encodeWav(render));

  if (options.generateCharts !== false) {
    const charts = generateAnalysisCharts({
      composition: preset,
      symbolic,
      audio,
      events: events.mergedEvents,
      channelData: render.channelData,
    });

    for (const chart of charts) {
      await writeFile(path.join(outputDir, chart.filename), chart.content, "utf8");
    }
  } else {
    await Promise.all(
      ["waveform.svg", "piano-roll.svg", "density.svg", "roughness.svg"].map((filename) =>
        removeFileIfPresent(path.join(outputDir, filename)),
      ),
    );
  }

  console.log(`Analyzed ${preset.id} -> ${outputDir}`);
  return analysis;
}

async function loadAnalysisFromReference(
  reference: string,
  options: AnalyzeOptions,
): Promise<PresetAnalysis> {
  const preset = findPresetById(reference);
  if (preset) {
    return analyzePreset(reference, options);
  }

  const filePath = path.resolve(reference);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as PresetAnalysis;
}

async function analyzeAll(options: AnalyzeOptions): Promise<void> {
  for (const preset of presets) {
    await analyzePreset(preset.id, options);
  }
}

async function compareReferences(
  referenceA: string,
  referenceB: string,
  options: AnalyzeOptions,
): Promise<void> {
  const analysisA = await loadAnalysisFromReference(referenceA, options);
  const analysisB = await loadAnalysisFromReference(referenceB, options);
  const comparison = comparePresetAnalyses(analysisA, analysisB);
  const report = buildComparisonReport(comparison);
  const outputDir = path.resolve(
    options.outputDir,
    "comparisons",
    `${sanitizeName(analysisA.presetId)}__vs__${sanitizeName(analysisB.presetId)}`,
  );

  await ensureDir(outputDir);
  await writeFile(
    path.join(outputDir, "comparison.json"),
    `${JSON.stringify(comparison, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(outputDir, "comparison.md"), report, "utf8");

  console.log(`Compared ${analysisA.presetId} vs ${analysisB.presetId} -> ${outputDir}`);
}

async function main(): Promise<void> {
  const { command, positional, options } = parseCli(process.argv.slice(2));

  switch (command) {
    case "analyze":
      if (positional.length < 1) {
        printHelp();
        process.exitCode = 1;
        return;
      }
      await analyzePreset(positional[0]!, options);
      return;
    case "analyze-all":
      await analyzeAll(options);
      return;
    case "compare":
      if (positional.length < 2) {
        printHelp();
        process.exitCode = 1;
        return;
      }
      await compareReferences(positional[0]!, positional[1]!, options);
      return;
    default:
      printHelp();
      return;
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
