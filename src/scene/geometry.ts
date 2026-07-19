/**
 * Adapted from the StadiView / football-stadium reference project
 * (https://github.com/thebuggeddev/football-stadium), used under the
 * PolyForm Noncommercial License 1.0.0.
 * Required Notice: Copyright 2026 thebuggeddev. Contact: thebuggeddev@gmail.com.
 * Creator: https://x.com/thebuggeddev
 * Modifications: TypeScript port, modern three colorSpace API, StadiumPulse AI adaptations.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;

/**
 * Indexed elliptical ring strip between two ellipse rings (no gaps).
 * Port of the reference `ringStrip` helper.
 */
export function ringStrip(
  rx1: number,
  rz1: number,
  y1: number,
  rx2: number,
  rz2: number,
  y2: number,
  seg: number,
  mat: THREE.Material,
  repU = 12,
): THREE.Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * TAU;
    const c = Math.cos(a);
    const s = Math.sin(a);
    positions.push(rx1 * c, y1, rz1 * s);
    positions.push(rx2 * c, y2, rz2 * s);
    uvs.push((i / seg) * repU, 0, (i / seg) * repU, 1);
    if (i < seg) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/** Merge multiple BoxGeometries (or any BufferGeometry) into one mesh geometry. */
export function mergeBoxes(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('mergeBoxes: failed to merge geometries');
  for (const p of parts) p.dispose();
  return merged;
}

/** Procedural canvas texture helper (modern colorSpace API). */
export function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repX = 1,
  repY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvasTexture: 2D context unavailable');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repX !== 1 || repY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repX, repY);
  }
  tex.anisotropy = 4;
  return tex;
}
