/**
 * Adapted from the StadiView / football-stadium reference project
 * (https://github.com/thebuggeddev/football-stadium), used under the
 * PolyForm Noncommercial License 1.0.0.
 * Required Notice: Copyright 2026 thebuggeddev. Contact: thebuggeddev@gmail.com.
 * Creator: https://x.com/thebuggeddev
 * Modifications: TypeScript port, modern three colorSpace API, simplified
 * roof/facade, dark control-room palette, no scoreboard/match content.
 */

import * as THREE from 'three';
import { canvasTexture, ringStrip } from './geometry';
import { TIERS } from './seating';
import { mulberry32 } from '../lib/rng';

export const ROOF = { inRx: 92, inRz: 75, inY: 44, outRx: 120, outRz: 100, outY: 48 } as const;

/** y-levels of the two walkable concourse levels (matches stadium graph data). */
export const CONCOURSE_LEVELS = { ground: 0, upper: 27.6 } as const;

export interface BowlResult {
  group: THREE.Group;
  dispose: () => void;
}

export function buildBowl(): BowlResult {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  const rng = mulberry32(777);

  // ---- Ground plane with radial gradient --------------------------------
  const groundTex = track(
    canvasTexture(512, 512, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w / 2);
      g.addColorStop(0, '#0d1524');
      g.addColorStop(0.55, '#0a1120');
      g.addColorStop(1, '#04070e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }),
  );
  const groundMat = track(new THREE.MeshLambertMaterial({ map: groundTex }));
  const ground = new THREE.Mesh(
    track(new THREE.CircleGeometry(190, 72)),
    groundMat,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- Pitch: striped grass ---------------------------------------------
  const pitchTex = track(
    canvasTexture(1050, 680, (ctx, w, h) => {
      const stripes = 14;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#14803c' : '#0f6e33';
        ctx.fillRect((i / stripes) * w, 0, w / stripes + 1, h);
      }
      // pitch lines
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeRect(w * 0.03, h * 0.04, w * 0.94, h * 0.92);
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.04);
      ctx.lineTo(w / 2, h * 0.96);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, h * 0.13, 0, Math.PI * 2);
      ctx.stroke();
      // penalty boxes
      ctx.strokeRect(w * 0.03, h * 0.3, w * 0.13, h * 0.4);
      ctx.strokeRect(w * 0.84, h * 0.3, w * 0.13, h * 0.4);
    }),
  );
  const pitchMat = track(new THREE.MeshLambertMaterial({ map: pitchTex }));
  const pitch = new THREE.Mesh(track(new THREE.PlaneGeometry(105, 68)), pitchMat);
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = 0.02;
  pitch.receiveShadow = true;
  group.add(pitch);

  // Apron around pitch
  const apronMat = track(new THREE.MeshLambertMaterial({ color: 0x11182a }));
  const apron = new THREE.Mesh(track(new THREE.PlaneGeometry(125, 88)), apronMat);
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = 0.01;
  group.add(apron);

  // ---- Terraced tier slabs (ring strips with step shading) ----------------
  const stepTex = track(
    canvasTexture(64, 64, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#242e42');
      g.addColorStop(0.8, '#1a2130');
      g.addColorStop(0.85, '#0b101a');
      g.addColorStop(1, '#151c2a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 130; i++) {
        ctx.fillStyle = rng() > 0.5 ? '#000' : '#3a4a66';
        ctx.fillRect(rng() * w, rng() * h, 2, 1);
      }
    }),
  );
  stepTex.wrapS = stepTex.wrapT = THREE.RepeatWrapping;

  const SEG = 160;
  for (const t of TIERS) {
    const rxTop = t.rx + t.rows * t.dr;
    const rzTop = t.rz + t.rows * t.dr;
    const yTop = t.y + t.rows * t.dy;
    const slabTex = stepTex.clone();
    slabTex.repeat.set(24, t.rows);
    slabTex.needsUpdate = true;
    track(slabTex);
    const slabMat = track(new THREE.MeshLambertMaterial({ map: slabTex }));
    const slab = ringStrip(t.rx - 1.2, t.rz - 1.2, t.y - 0.5, rxTop + 0.8, rzTop + 0.8, yTop - 0.03, SEG, slabMat, 24);
    slab.receiveShadow = true;
    group.add(slab);

    // Front fascia wall dropping from tier front to below.
    const fasciaMat = track(new THREE.MeshLambertMaterial({ color: 0x121a2b }));
    const fascia = ringStrip(t.rx - 1.2, t.rz - 1.2, t.y - 0.5, t.rx - 1.2, t.rz - 1.2, Math.max(0, t.y - 3.2), SEG, fasciaMat, 24);
    group.add(fascia);

    // Back parapet
    const parapet = ringStrip(rxTop + 0.8, rzTop + 0.8, yTop - 0.03, rxTop + 1.0, rzTop + 1.0, yTop + 1.1, SEG, fasciaMat, 24);
    group.add(parapet);
  }

  // ---- Concourse glass bands between tiers (lit windows) ------------------
  const glassTex = track(
    canvasTexture(1024, 64, (ctx, w, h) => {
      ctx.fillStyle = '#070c17';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 64; i++) {
        const lit = rng() < 0.6;
        ctx.fillStyle = lit
          ? `rgba(103,232,249,${0.25 + rng() * 0.5})` // cyan control-room glow
          : 'rgba(20,30,50,0.8)';
        ctx.fillRect(i * (w / 64) + 2, 10, w / 64 - 4, h - 20);
      }
    }, 10, 1),
  );
  const glassMat = track(new THREE.MeshBasicMaterial({ map: glassTex }));
  const t0 = TIERS[0];
  const t1 = TIERS[1];
  const t2 = TIERS[2];
  if (t0 && t1 && t2) {
    const g1 = ringStrip(
      t0.rx + t0.rows * t0.dr + 1,
      t0.rz + t0.rows * t0.dr + 1,
      t0.y + t0.rows * t0.dy + 1.1,
      t1.rx - 1.2,
      t1.rz - 1.2,
      t1.y - 0.5,
      SEG,
      glassMat,
      10,
    );
    group.add(g1);
    const g2 = ringStrip(
      t1.rx + t1.rows * t1.dr + 1,
      t1.rz + t1.rows * t1.dr + 1,
      t1.y + t1.rows * t1.dy + 1.1,
      t2.rx - 1.2,
      t2.rz - 1.2,
      t2.y - 0.5,
      SEG,
      glassMat,
      10,
    );
    group.add(g2);
  }

  // ---- Roof ring + supports ----------------------------------------------
  const roofTex = track(
    canvasTexture(512, 64, (ctx, w, h) => {
      ctx.fillStyle = '#0e1626';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#182238' : '#0a1120';
        ctx.fillRect(0, (i / 8) * h, w, h / 8);
      }
    }, 16, 1),
  );
  const roofMat = track(
    new THREE.MeshLambertMaterial({ map: roofTex, side: THREE.DoubleSide }),
  );
  const roof = ringStrip(ROOF.inRx, ROOF.inRz, ROOF.inY, ROOF.outRx, ROOF.outRz, ROOF.outY, 140, roofMat, 16);
  group.add(roof);

  // Roof edge light band (cyan operational identity)
  const edgeMat = track(
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.7 }),
  );
  const edge = ringStrip(ROOF.inRx, ROOF.inRz, ROOF.inY - 0.4, ROOF.inRx, ROOF.inRz, ROOF.inY + 0.4, 140, edgeMat, 1);
  group.add(edge);

  // Support columns
  const colGeo = track(new THREE.CylinderGeometry(0.7, 0.9, ROOF.outY, 8));
  const colMat = track(new THREE.MeshLambertMaterial({ color: 0x1a2436 }));
  const columns = new THREE.InstancedMesh(colGeo, colMat, 48);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * (ROOF.outRx - 2), ROOF.outY / 2, Math.sin(a) * (ROOF.outRz - 2));
    dummy.updateMatrix();
    columns.setMatrixAt(i, dummy.matrix);
  }
  group.add(columns);
  track(columns.geometry);

  // ---- Floodlights ---------------------------------------------------------
  const floodMat = track(
    new THREE.MeshBasicMaterial({ color: 0xdff6ff }),
  );
  const floodGeo = track(new THREE.BoxGeometry(6, 2.4, 0.8));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const lamp = new THREE.Mesh(floodGeo, floodMat);
    lamp.position.set(Math.cos(a) * ROOF.inRx, ROOF.inY - 1.6, Math.sin(a) * ROOF.inRz);
    lamp.lookAt(0, 0, 0);
    group.add(lamp);
  }

  return {
    group,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
