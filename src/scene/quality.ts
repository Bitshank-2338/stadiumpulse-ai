/**
 * Adapted from the StadiView / football-stadium reference project
 * (https://github.com/thebuggeddev/football-stadium), used under the
 * PolyForm Noncommercial License 1.0.0.
 * Required Notice: Copyright 2026 thebuggeddev. Contact: thebuggeddev@gmail.com.
 * Creator: https://x.com/thebuggeddev
 * Modifications: TypeScript port; encapsulated as a class.
 */

import type * as THREE from 'three';

/** FPS-measured adaptive pixel-ratio controller (reference adaptQuality port). */
export class AdaptiveQuality {
  private frames = 0;
  private windowStart = 0;
  private ratio: number;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly min = 0.75,
    private readonly max = Math.min(2, window.devicePixelRatio || 1),
  ) {
    this.ratio = this.max;
    renderer.setPixelRatio(this.ratio);
  }

  tick(nowMs: number): void {
    this.frames++;
    if (this.windowStart === 0) this.windowStart = nowMs;
    const elapsed = nowMs - this.windowStart;
    if (elapsed < 2500) return;
    const fps = (this.frames / elapsed) * 1000;
    this.frames = 0;
    this.windowStart = nowMs;
    if (fps < 40 && this.ratio > this.min) {
      this.ratio = Math.max(this.min, this.ratio - 0.25);
      this.renderer.setPixelRatio(this.ratio);
    } else if (fps > 75 && this.ratio < this.max) {
      this.ratio = Math.min(this.max, this.ratio + 0.25);
      this.renderer.setPixelRatio(this.ratio);
    }
  }
}
