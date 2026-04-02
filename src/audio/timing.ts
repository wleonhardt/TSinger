export function beatsToSeconds(beats: number, bpm: number): number {
  return (60 / bpm) * beats;
}

export function beatToAudioTime(
  beat: number,
  bpm: number,
  audioStartTime: number,
): number {
  return audioStartTime + beatsToSeconds(beat, bpm);
}

export function getPhraseDurationSeconds(
  bars: number,
  beatsPerBar: number,
  bpm: number,
): number {
  return beatsToSeconds(bars * beatsPerBar, bpm);
}
