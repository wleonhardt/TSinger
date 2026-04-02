import type { OfflineRenderResult } from "./types";

function clampToPcm(sample: number): number {
  return Math.max(-1, Math.min(1, sample));
}

export function encodeWav(render: OfflineRenderResult): Uint8Array {
  const numberOfChannels = Math.max(1, render.channelData.length);
  const length =
    render.channelData.length > 0
      ? Math.min(...render.channelData.map((channel) => channel.length))
      : 0;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = render.sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, value: string): void {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, render.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < length; index += 1) {
    for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
      const sample = render.channelData[channelIndex]?.[index] ?? 0;
      const clamped = clampToPcm(sample);
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(offset, Math.round(int16), true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}
