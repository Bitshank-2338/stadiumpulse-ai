/**
 * Adapted from the StadiView / football-stadium reference project
 * (https://github.com/thebuggeddev/football-stadium), used under the
 * PolyForm Noncommercial License 1.0.0.
 * Required Notice: Copyright 2026 thebuggeddev. Contact: thebuggeddev@gmail.com.
 * Creator: https://x.com/thebuggeddev
 * Modifications: TypeScript port, modern three colorSpace API, StadiumPulse AI
 * palette (dark control-room tones), no availability/pricing concepts.
 */

import * as THREE from 'three';
import { mergeBoxes } from './geometry';
import { mulberry32 } from '../lib/rng';

const TAU = Math.PI * 2;

export interface TierSpec {
  name: string;
  firstSection: number;
  sections: number;
  rows: number;
  rx: number;
  rz: number;
  y: number;
  dr: number;
  dy: number;
}

/** Reference tier dimensions — preserved exactly (world scale contract). */
export const TIERS: readonly TierSpec[] = [
  { name: 'Lower Tier', firstSection: 101, sections: 32, rows: 18, rx: 63, rz: 46, y: 1.4, dr: 0.85, dy: 0.48 },
  { name: 'Club Tier', firstSection: 201, sections: 24, rows: 12, rx: 82, rz: 65, y: 15.2, dr: 0.8, dy: 0.6 },
  { name: 'Upper Tier', firstSection: 301, sections: 32, rows: 16, rx: 94, rz: 77, y: 27.6, dr: 0.8, dy: 0.7 },
] as const;

export const SEAT_SPACING = 0.58;
export const AISLE = 1.5;

export interface ArcTable {
  L: number;
  s: Float32Array;
  a: Float32Array;
  N: number;
}

/** Arc-length lookup table for an ellipse (port of reference arcTable). */
export function arcTable(rx: number, rz: number): ArcTable {
  const N = 1200;
  const s = new Float32Array(N + 1);
  const a = new Float32Array(N + 1);
  let L = 0;
  let px = rx;
  let pz = 0;
  for (let i = 1; i <= N; i++) {
    const ang = (i / N) * TAU;
    const x = rx * Math.cos(ang);
    const z = rz * Math.sin(ang);
    L += Math.hypot(x - px, z - pz);
    px = x;
    pz = z;
    s[i] = L;
    a[i] = ang;
  }
  return { L, s, a, N };
}

/** Angle at a given arc distance (binary search; port of reference thetaAt). */
export function thetaAt(tb: ArcTable, distAlong: number): number {
  let lo = 0;
  let hi = tb.N;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((tb.s[mid] ?? 0) < distAlong) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const s1 = tb.s[i - 1] ?? 0;
  const s2 = tb.s[i] ?? s1 + 1e-6;
  const a1 = tb.a[i - 1] ?? 0;
  const a2 = tb.a[i] ?? a1;
  const f = (distAlong - s1) / Math.max(1e-6, s2 - s1);
  return a1 + f * (a2 - a1);
}

export interface SeatingResult {
  mesh: THREE.InstancedMesh;
  seatCount: number;
  /** xyz per seat. */
  positions: Float32Array;
  /** Section number per seat (e.g. 315). */
  sectionOf: Uint16Array;
  /** Tier index per seat. */
  tierOf: Uint8Array;
  dispose: () => void;
}

/** StadiumPulse dark section palette: muted navy/steel with cyan pops. */
function sectionColor(tierIdx: number, sectionIdx: number): THREE.Color {
  const base =
    tierIdx === 0 ? 0x1f3a5f : tierIdx === 1 ? 0x24455c : 0x1b2c4f;
  const c = new THREE.Color(base);
  c.offsetHSL(((sectionIdx % 7) - 3) * 0.012, 0.02, ((sectionIdx % 4) - 1.5) * 0.02);
  // Every 8th section gets a cyan identity stripe.
  if (sectionIdx % 8 === 0) c.offsetHSL(-0.08, 0.15, 0.05);
  return c;
}

export function buildSeating(): SeatingResult {
  // Seat geometry: pan + backrest + pedestal (reference dimensions).
  const pan = new THREE.BoxGeometry(0.46, 0.06, 0.42);
  pan.translate(0, 0.42, 0.03);
  const back = new THREE.BoxGeometry(0.46, 0.48, 0.07);
  back.rotateX(-0.13);
  back.translate(0, 0.66, -0.21);
  const ped = new THREE.BoxGeometry(0.34, 0.4, 0.28);
  ped.translate(0, 0.2, 0.02);
  const seatGeo = mergeBoxes([pan, back, ped]);
  const seatMat = new THREE.MeshPhongMaterial({ shininess: 38, specular: 0x2c333f });

  // First pass: count seats and record per-row layout.
  interface RowLayout {
    rx: number;
    rz: number;
    y: number;
    tb: ArcTable;
    secLen: number;
    n: number;
  }
  const layout: RowLayout[][] = [];
  let seatCount = 0;
  for (const tier of TIERS) {
    const rows: RowLayout[] = [];
    for (let r = 0; r < tier.rows; r++) {
      const rx = tier.rx + r * tier.dr;
      const rz = tier.rz + r * tier.dr;
      const y = tier.y + r * tier.dy;
      const tb = arcTable(rx, rz);
      const secLen = tb.L / tier.sections;
      const usable = secLen - AISLE;
      const n = Math.floor(usable / SEAT_SPACING);
      rows.push({ rx, rz, y, tb, secLen, n });
      seatCount += n * tier.sections;
    }
    layout.push(rows);
  }

  const mesh = new THREE.InstancedMesh(seatGeo, seatMat, seatCount);
  mesh.frustumCulled = false;

  const positions = new Float32Array(seatCount * 3);
  const sectionOf = new Uint16Array(seatCount);
  const tierOf = new Uint8Array(seatCount);

  const dummy = new THREE.Object3D();
  const rng = mulberry32(20260719);
  const color = new THREE.Color();
  let idx = 0;

  TIERS.forEach((tier, ti) => {
    const rows = layout[ti];
    if (!rows) return;
    for (let sec = 0; sec < tier.sections; sec++) {
      const base = sectionColor(ti, sec);
      for (const row of rows) {
        const start = sec * row.secLen + AISLE / 2 + (row.secLen - AISLE - row.n * SEAT_SPACING) / 2;
        for (let k = 0; k < row.n; k++) {
          const d = start + k * SEAT_SPACING + SEAT_SPACING / 2;
          const th = thetaAt(row.tb, d);
          const x = row.rx * Math.cos(th);
          const z = row.rz * Math.sin(th);
          dummy.position.set(x, row.y, z);
          dummy.rotation.set(0, Math.atan2(-x, -z) + Math.PI, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(idx, dummy.matrix);
          color.copy(base).offsetHSL(0, 0, (rng() - 0.5) * 0.05);
          mesh.setColorAt(idx, color);
          positions[idx * 3] = x;
          positions[idx * 3 + 1] = row.y;
          positions[idx * 3 + 2] = z;
          sectionOf[idx] = tier.firstSection + sec;
          tierOf[idx] = ti;
          idx++;
        }
      }
    }
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  return {
    mesh,
    seatCount,
    positions,
    sectionOf,
    tierOf,
    dispose: () => {
      seatGeo.dispose();
      seatMat.dispose();
    },
  };
}
