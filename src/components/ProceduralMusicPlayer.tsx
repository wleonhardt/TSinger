import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { PlaybackStatus } from "../audio/player";
import { createAudioEngine } from "../audio/player";
import { presets } from "../audio/presets";
import { voicePresets } from "../audio/voicePresets";

type PresetUiMeta = {
  description: string;
  mood: string;
};

type TransportUiMeta = {
  badge: string;
  title: string;
  detail: string;
};

const presetUiMeta: Record<string, PresetUiMeta> = {
  "heliograph-procession": {
    description: "A ceremonial ascent of mirrored light, vaulted harmonies, and disciplined return.",
    mood: "Radiant, architectural, processional",
  },
  "undertow-atlas": {
    description: "A five-beat horizon song where tidal pull and dark weather keep changing the same map.",
    mood: "Nocturnal, tidal, searching",
  },
  "cinder-carousel": {
    description: "A haunted ember-waltz: intimate machinery, scorched memory, and a tender final turn.",
    mood: "Fragile, haunted, intimate",
  },
  "pinwheel-circuit": {
    description: "A swung oscillator engine of bright hooks, braided motion, and clockwork release.",
    mood: "Kinetic, witty, airborne",
  },
};

const transportUiMeta: Record<PlaybackStatus, TransportUiMeta> = {
  idle: {
    badge: "Audio Locked",
    title: "Prime audio to begin",
    detail: "Browsers require a click before any sound can start.",
  },
  primed: {
    badge: "Ready",
    title: "Audio is ready",
    detail: "Start the loop or tap a preview tone.",
  },
  playing: {
    badge: "Playing",
    title: "Loop is running",
    detail: "The current preset is repeating on the audio clock.",
  },
  stopped: {
    badge: "Stopped",
    title: "Playback paused",
    detail: "Press play to start the phrase again.",
  },
};

function formatScale(scale: string): string {
  return scale
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (value) => value.toUpperCase());
}

export function ProceduralMusicPlayer() {
  const engineRef = useRef<ReturnType<typeof createAudioEngine> | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const disposeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!engineRef.current) {
    engineRef.current = createAudioEngine(voicePresets);
  }

  const engine = engineRef.current;
  const [selectedPresetId, setSelectedPresetId] = useState(presets[0]?.id ?? "");
  const [status, setStatus] = useState<PlaybackStatus>(engine.getStatus());
  const [isPrimed, setIsPrimed] = useState(engine.isPrimed());
  const [isBusy, setIsBusy] = useState(false);

  const selectedPreset =
    presets.find((preset) => preset.id === selectedPresetId) ?? presets[0];
  const presetMeta = presetUiMeta[selectedPreset.id];
  const transportMeta = transportUiMeta[status];
  const controlsDisabled = isBusy && status !== "playing";

  function refreshState(): void {
    if (!mountedRef.current) {
      return;
    }

    setStatus(engine.getStatus());
    setIsPrimed(engine.isPrimed());
  }

  useEffect(() => {
    mountedRef.current = true;
    if (disposeTimerRef.current) {
      clearTimeout(disposeTimerRef.current);
      disposeTimerRef.current = null;
    }

    return () => {
      mountedRef.current = false;
      engine.stop();
      disposeTimerRef.current = setTimeout(() => {
        engine.dispose();
        disposeTimerRef.current = null;
      }, 0);
    };
  }, [engine]);

  async function runTask(task: () => Promise<unknown>): Promise<void> {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsBusy(true);

    try {
      await task();
    } finally {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      refreshState();
      setIsBusy(false);
    }
  }

  async function handlePrimeClick(): Promise<void> {
    await runTask(() => engine.prime());
  }

  async function handlePlayToggle(): Promise<void> {
    if (!selectedPreset) {
      return;
    }

    if (engine.getStatus() === "playing") {
      requestIdRef.current += 1;
      engine.stop();
      refreshState();
      setIsBusy(false);
      return;
    }

    await runTask(() => engine.playComposition(selectedPreset));
  }

  async function handlePresetChange(
    event: ChangeEvent<HTMLSelectElement>,
  ): Promise<void> {
    const nextPresetId = event.target.value;
    const nextPreset =
      presets.find((preset) => preset.id === nextPresetId) ?? presets[0];

    setSelectedPresetId(nextPresetId);

    if (!nextPreset || engine.getStatus() !== "playing") {
      refreshState();
      return;
    }

    await runTask(() => engine.playComposition(nextPreset));
  }

  async function handlePreviewBell(): Promise<void> {
    await runTask(() =>
      engine.playNote({
        beat: 0,
        length: 0.9,
        pitch: "C6",
        synth: "glassBell",
        velocity: 0.32,
        pan: 0.16,
      }),
    );
  }

  async function handlePreviewLead(): Promise<void> {
    await runTask(() =>
      engine.playNote({
        beat: 0,
        length: 0.8,
        pitch: "E5",
        synth: "softLead",
        velocity: 0.56,
        glideTo: "G5",
        pan: -0.06,
      }),
    );
  }

  if (!selectedPreset) {
    return null;
  }

  return (
    <section className="player-shell" aria-label="Procedural music player">
      <header className="player-hero">
        <div className="hero-heading">
          <p className="eyebrow">Procedural Web Audio</p>
          <h1 className="player-title">TSinger</h1>
        </div>
        <p className="player-subtitle">
          A compact ambient instrument that generates soft looping music
          entirely in the browser.
        </p>
      </header>

      <div className="player-grid">
        <section className="surface surface-current">
          <div className="surface-header">
            <div>
              <p className="section-label">Current Preset</p>
              <h2 className="preset-title">{selectedPreset.title}</h2>
            </div>
            <span className="status-pill" data-state={status}>
              <span className="status-dot" aria-hidden="true" />
              {transportMeta.badge}
            </span>
          </div>

          <p className="preset-description">{presetMeta.description}</p>

          <div className="meta-row">
            <span className="meta-pill">{selectedPreset.bpm} BPM</span>
            <span className="meta-pill">
              Key {selectedPreset.key.root} {formatScale(selectedPreset.key.scale)}
            </span>
            <span className="meta-pill">{presetMeta.mood}</span>
          </div>
        </section>

        <section className="surface">
          <div className="surface-header surface-header-stack">
            <div>
              <p className="section-label">Preset Library</p>
              <h3 className="section-title">Choose a sound world</h3>
            </div>
          </div>

          <div className="field">
            <label htmlFor="preset-select">Built-in preset</label>
            <div className="select-wrap">
              <select
                id="preset-select"
                value={selectedPreset.id}
                onChange={(event) => {
                  void handlePresetChange(event);
                }}
                aria-describedby="preset-help"
                disabled={controlsDisabled}
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.title}
                  </option>
                ))}
              </select>
            </div>
            <p id="preset-help" className="field-hint">
              Changing presets while playing restarts the loop cleanly on the
              newly selected composition.
            </p>
          </div>
        </section>

        <section className="surface surface-transport">
          <div className="surface-header surface-header-stack">
            <div>
              <p className="section-label">Transport</p>
              <h3 className="section-title">Start or stop the loop</h3>
            </div>
          </div>

          <div className="status-card" role="status" aria-live="polite">
            <div className="status-card-line">
              <span className="status-dot" data-state={status} aria-hidden="true" />
              <strong>{transportMeta.title}</strong>
            </div>
            <p className="status-copy">{transportMeta.detail}</p>
          </div>

          <div className="button-row button-row-transport">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void handlePrimeClick();
              }}
              disabled={controlsDisabled}
            >
              {isPrimed ? "Audio Ready" : "Prime Audio"}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                void handlePlayToggle();
              }}
              aria-pressed={status === "playing"}
              data-active={status === "playing"}
              disabled={controlsDisabled}
            >
              {status === "playing" ? "Stop Loop" : "Play Loop"}
            </button>
          </div>
        </section>

        <section className="surface">
          <div className="surface-header surface-header-stack">
            <div>
              <p className="section-label">Voice Preview</p>
              <h3 className="section-title">Tap a single tone</h3>
            </div>
          </div>

          <p className="section-copy">
            Quick one-shot previews for the bright bell and the gentle lead.
          </p>

          <div className="preview-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void handlePreviewBell();
              }}
              disabled={controlsDisabled}
            >
              Preview Bell
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void handlePreviewLead();
              }}
              disabled={controlsDisabled}
            >
              Preview Lead
            </button>
          </div>
        </section>

        <footer className="surface surface-footer">
          <div className="status-row">
            <span className="meta-pill">Transport: {transportMeta.badge}</span>
            <span className="meta-pill">
              Audio: {isPrimed ? "Primed" : "Waiting for interaction"}
            </span>
          </div>

          <p className="help-copy">
            Audio starts only after interaction. Play also resumes audio if
            needed.
          </p>
        </footer>
      </div>
    </section>
  );
}
