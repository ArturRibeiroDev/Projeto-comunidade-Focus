export function clampCropOffset(value: number, imageSize: number, frameSize: number): number {
  const limit = Math.max(0, (imageSize - frameSize) / 2);
  return Math.max(-limit, Math.min(limit, value));
}
