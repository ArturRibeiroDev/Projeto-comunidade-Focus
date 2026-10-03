import { describe, expect, it } from 'vitest';
import { clampCropOffset } from './avatarCrop';

describe('avatar crop offset', () => {
  it('keeps the image covering the frame when dragged or zoomed', () => {
    expect(clampCropOffset(100, 400, 280)).toBe(60);
    expect(clampCropOffset(-100, 400, 280)).toBe(-60);
    expect(clampCropOffset(40, 280, 280)).toBe(0);
    expect(clampCropOffset(20, 560, 280)).toBe(20);
  });
});
