/**
 * Adapted from the StadiView / football-stadium reference project
 * (https://github.com/thebuggeddev/football-stadium), used under the
 * PolyForm Noncommercial License 1.0.0.
 * Required Notice: Copyright 2026 thebuggeddev. Contact: thebuggeddev@gmail.com.
 * Creator: https://x.com/thebuggeddev
 * Modifications: TypeScript port, occupancy derived from seeded RNG only,
 * sway respects reduced motion, no goal-excitement mechanic.
 */

import * as THREE from 'three';
import { mergeBoxes } from './geometry';
import { mulberry32 } from '../lib/rng';
import type { SeatingResult } from './seating';

const CLOTH = [0x27364f, 0x1d2a3f, 0x3c2f45, 0x223c33, 0x40303d, 0x2b2b31, 0x35455f, 0x203050];
const SKIN = [0xd9a17c, 0xc98d63, 0xa9714b, 0x8a5a3a, 0x6e452c, 0xe8b48f];

export interface CrowdResult {
  group: THREE.Group;
  /** Call each frame with elapsed seconds. */
  update: (t: number) => void;
  setReducedMotion: (b: boolean) => void;
  dispose: () => void;
}

export function buildCrowd(seating: SeatingResult, occupancy = 0.45): CrowdResult {
  const rng = mulberry32(90210);
  const occupied: number[] = [];
  for (let i = 0; i < seating.seatCount; i++) {
    if (rng() < occupancy) occupied.push(i);
  }

  // Torso: body + lap merged boxes; head: low-poly sphere.
  const body = new THREE.BoxGeometry(0.4, 0.52, 0.26);
  body.translate(0, 0.72, 0);
  const lap = new THREE.BoxGeometry(0.4, 0.12, 0.36);
  lap.translate(0, 0.5, 0.1);
  const torsoGeo = mergeBoxes([body, lap]);
  const headGeo = new THREE.SphereGeometry(0.13, 8, 6);
  headGeo.translate(0, 1.08, 0);

  const swayU = { value: 0 };
  const exciteU = { value: 1 };

  const makeSwayMaterial = (): THREE.MeshLambertMaterial => {
    const mat = new THREE.MeshLambertMaterial();
    mat.onBeforeCompile = (sh) => {
      sh.uniforms['uTime'] = swayU;
      sh.uniforms['uExcite'] = exciteU;
      sh.vertexShader =
        'uniform float uTime; uniform float uExcite;\n' +
        sh.vertexShader.replace(
          '#include <begin_vertex>',
          [
            '#include <begin_vertex>',
            'float swPh = instanceMatrix[3].x*1.7 + instanceMatrix[3].z*2.3;',
            'float swW = smoothstep(0.35,1.15,position.y)*uExcite;',
            'transformed.x += sin(uTime*1.7+swPh)*0.03*swW;',
            'transformed.z += cos(uTime*1.25+swPh)*0.018*swW;',
          ].join('\n'),
        );
    };
    return mat;
  };

  const torsoMat = makeSwayMaterial();
  const headMat = makeSwayMaterial();

  const torsos = new THREE.InstancedMesh(torsoGeo, torsoMat, occupied.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, occupied.length);
  torsos.frustumCulled = false;
  heads.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  occupied.forEach((seatIdx, i) => {
    const x = seating.positions[seatIdx * 3] ?? 0;
    const y = seating.positions[seatIdx * 3 + 1] ?? 0;
    const z = seating.positions[seatIdx * 3 + 2] ?? 0;
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, Math.atan2(-x, -z) + Math.PI, 0);
    dummy.updateMatrix();
    torsos.setMatrixAt(i, dummy.matrix);
    heads.setMatrixAt(i, dummy.matrix);
    color.setHex(CLOTH[Math.floor(rng() * CLOTH.length)] ?? 0x27364f);
    color.offsetHSL(0, 0, (rng() - 0.5) * 0.08);
    torsos.setColorAt(i, color);
    color.setHex(SKIN[Math.floor(rng() * SKIN.length)] ?? 0xd9a17c);
    heads.setColorAt(i, color);
  });
  torsos.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  if (torsos.instanceColor) torsos.instanceColor.needsUpdate = true;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;

  const group = new THREE.Group();
  group.add(torsos, heads);

  return {
    group,
    update: (t) => {
      swayU.value = t;
    },
    setReducedMotion: (b) => {
      exciteU.value = b ? 0 : 1;
    },
    dispose: () => {
      torsoGeo.dispose();
      headGeo.dispose();
      torsoMat.dispose();
      headMat.dispose();
    },
  };
}
