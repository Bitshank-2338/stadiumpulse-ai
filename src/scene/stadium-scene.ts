/**
 * StadiumPulse AI scene controller.
 * Camera orbit, renderer setup and adaptive quality are adapted from the
 * StadiView / football-stadium reference project
 * (https://github.com/thebuggeddev/football-stadium), used under the
 * PolyForm Noncommercial License 1.0.0.
 * Required Notice: Copyright 2026 thebuggeddev. Contact: thebuggeddev@gmail.com.
 * Creator: https://x.com/thebuggeddev
 * Modifications: TypeScript class port, modern three colorSpace API, rAF-eased
 * transitions (no GSAP), operational overlays (markers/routes/heat) are
 * original StadiumPulse AI code.
 */

import * as THREE from 'three';
import { buildBowl } from './bowl';
import { buildSeating } from './seating';
import { buildCrowd } from './crowd';
import { AdaptiveQuality } from './quality';
import type { Vec3 } from '../types/domain';

export interface SceneMarker {
  id: string;
  position: Vec3;
  /** Hex color, e.g. 0xf87171 for urgent. */
  color: number;
  /** Pulsing animation for attention (incidents). */
  pulse?: boolean;
  /** Label used for a11y/debugging; not rendered in 3D. */
  label?: string;
}

export interface ZoneHeat {
  position: Vec3;
  /** 0..1 congestion. */
  intensity: number;
  radius?: number;
}

interface OrbitState {
  theta: number;
  phi: number;
  radius: number;
  thetaT: number;
  phiT: number;
  radiusT: number;
}

const HOME = { theta: 2.35, phi: 1.04, radius: 236 } as const;
const TARGET = new THREE.Vector3(0, 9, 0);

export class StadiumScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock = new THREE.Clock();
  private readonly quality: AdaptiveQuality;
  private readonly bowl: ReturnType<typeof buildBowl>;
  private readonly seating: ReturnType<typeof buildSeating>;
  private readonly crowd: ReturnType<typeof buildCrowd>;

  private readonly markerGroup = new THREE.Group();
  private readonly heatGroup = new THREE.Group();
  private routeLine: THREE.Mesh | null = null;
  private routeGeo: THREE.TubeGeometry | null = null;
  private readonly routeMat: THREE.MeshBasicMaterial;
  private readonly markerResources: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
  private pulseMeshes: THREE.Mesh[] = [];

  private orbit: OrbitState = {
    theta: HOME.theta,
    phi: HOME.phi,
    radius: HOME.radius,
    thetaT: HOME.theta,
    phiT: HOME.phi,
    radiusT: HOME.radius,
  };

  private reducedMotion: boolean;
  private raf = 0;
  private disposed = false;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private lastInteraction = 0;
  private pinchDist = 0;
  private onFirstFrame: (() => void) | null;

  private readonly listeners: [EventTarget, string, EventListener][] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: { reducedMotion?: boolean; onFirstFrame?: () => void } = {},
  ) {
    this.reducedMotion = opts.reducedMotion ?? false;
    this.onFirstFrame = opts.onFirstFrame ?? null;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.quality = new AdaptiveQuality(this.renderer);

    this.camera = new THREE.PerspectiveCamera(
      50,
      canvas.clientWidth / Math.max(1, canvas.clientHeight),
      0.5,
      900,
    );

    this.scene.background = new THREE.Color(0x04070e);
    this.scene.fog = new THREE.Fog(0x04070e, 260, 620);

    // Lights (reference-inspired rig, trimmed)
    this.scene.add(new THREE.HemisphereLight(0x9db8e8, 0x0a0f1a, 0.85));
    this.scene.add(new THREE.AmbientLight(0x33415e, 0.5));
    const sun = new THREE.DirectionalLight(0xdfeaff, 1.15);
    sun.position.set(120, 160, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -140;
    sun.shadow.camera.right = 140;
    sun.shadow.camera.top = 140;
    sun.shadow.camera.bottom = -140;
    this.scene.add(sun);

    this.bowl = buildBowl();
    this.scene.add(this.bowl.group);

    this.seating = buildSeating();
    this.scene.add(this.seating.mesh);

    this.crowd = buildCrowd(this.seating);
    this.crowd.setReducedMotion(this.reducedMotion);
    this.scene.add(this.crowd.group);

    this.scene.add(this.markerGroup);
    this.scene.add(this.heatGroup);
    this.routeMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.9,
    });

    this.bindInput();
    this.resize();
    this.loop();
  }

  // ---- public API ---------------------------------------------------------

  setReducedMotion(b: boolean): void {
    this.reducedMotion = b;
    this.crowd.setReducedMotion(b);
  }

  goHome(): void {
    this.orbit.thetaT = HOME.theta;
    this.orbit.phiT = HOME.phi;
    this.orbit.radiusT = HOME.radius;
  }

  /** Fly camera toward a world position (eased via orbit targets). */
  focusOn(p: Vec3, radius = 120): void {
    this.orbit.thetaT = Math.atan2(p.z, p.x) + 0.001;
    this.orbit.phiT = 0.95;
    this.orbit.radiusT = radius;
  }

  zoomBy(f: number): void {
    this.orbit.radiusT = THREE.MathUtils.clamp(this.orbit.radiusT * f, 60, 360);
  }

  setMarkers(markers: SceneMarker[]): void {
    // Clear old
    this.markerGroup.clear();
    for (const r of this.markerResources) {
      r.geo.dispose();
      r.mat.dispose();
    }
    this.markerResources.length = 0;
    this.pulseMeshes = [];

    for (const m of markers) {
      const geo = new THREE.ConeGeometry(1.6, 4.2, 6);
      const mat = new THREE.MeshBasicMaterial({ color: m.color });
      const cone = new THREE.Mesh(geo, mat);
      cone.position.set(m.position.x, m.position.y + 6, m.position.z);
      cone.rotation.x = Math.PI; // point downward
      cone.userData['markerId'] = m.id;
      this.markerGroup.add(cone);
      this.markerResources.push({ geo, mat });

      const ringGeo = new THREE.RingGeometry(2.2, 3.2, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: m.color,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(m.position.x, m.position.y + 0.15, m.position.z);
      this.markerGroup.add(ring);
      this.markerResources.push({ geo: ringGeo, mat: ringMat });
      if (m.pulse) this.pulseMeshes.push(ring, cone);
    }
  }

  setRoutePath(path: Vec3[] | null, color = 0x22d3ee): void {
    if (this.routeLine) {
      this.markerGroup.remove(this.routeLine);
      this.scene.remove(this.routeLine);
      this.routeGeo?.dispose();
      this.routeLine = null;
      this.routeGeo = null;
    }
    if (!path || path.length < 2) return;
    const pts = path.map((p) => new THREE.Vector3(p.x, p.y + 1.2, p.z));
    const curve = new THREE.CatmullRomCurve3(pts);
    this.routeGeo = new THREE.TubeGeometry(curve, Math.max(24, path.length * 8), 0.7, 6, false);
    this.routeMat.color.setHex(color);
    this.routeLine = new THREE.Mesh(this.routeGeo, this.routeMat);
    this.scene.add(this.routeLine);
  }

  setZoneHeat(zones: ZoneHeat[]): void {
    this.heatGroup.clear();
    for (const child of this.heatDisposables) child.dispose();
    this.heatDisposables.length = 0;
    for (const z of zones) {
      if (z.intensity <= 0.05) continue;
      const geo = new THREE.CircleGeometry(z.radius ?? 10, 24);
      const color = new THREE.Color().setHSL(
        THREE.MathUtils.lerp(0.33, 0, Math.min(1, z.intensity)), // green→red
        0.85,
        0.5,
      );
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16 + z.intensity * 0.3,
        depthWrite: false,
      });
      const disc = new THREE.Mesh(geo, mat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(z.position.x, z.position.y + 0.4, z.position.z);
      this.heatGroup.add(disc);
      this.heatDisposables.push(geo, mat);
    }
  }
  private heatDisposables: { dispose: () => void }[] = [];

  resize(): void {
    const w = this.canvas.clientWidth;
    const h = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const [target, type, fn] of this.listeners) {
      target.removeEventListener(type, fn);
    }
    this.setMarkers([]);
    this.setRoutePath(null);
    this.setZoneHeat([]);
    this.routeMat.dispose();
    this.bowl.dispose();
    this.seating.dispose();
    this.crowd.dispose();
    this.renderer.dispose();
  }

  // ---- input (adapted orbit controls) -------------------------------------

  private on<K extends keyof HTMLElementEventMap>(
    target: EventTarget,
    type: K | string,
    fn: EventListener,
  ): void {
    target.addEventListener(type, fn, { passive: false });
    this.listeners.push([target, type, fn]);
  }

  private bindInput(): void {
    const pointers = new Map<number, { x: number; y: number }>();

    this.on(this.canvas, 'pointerdown', ((e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.lastInteraction = performance.now();
      this.canvas.setPointerCapture(e.pointerId);
    }) as EventListener);

    this.on(this.canvas, 'pointermove', ((e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.lastInteraction = performance.now();
      if (pointers.size === 2) {
        const [p1, p2] = [...pointers.values()];
        if (p1 && p2) {
          const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (this.pinchDist > 0) {
            this.orbit.radiusT = THREE.MathUtils.clamp(
              this.orbit.radiusT * (this.pinchDist / d),
              60,
              360,
            );
          }
          this.pinchDist = d;
        }
        return;
      }
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.orbit.thetaT -= dx * 0.0045;
      this.orbit.phiT = THREE.MathUtils.clamp(this.orbit.phiT - dy * 0.003, 0.14, 1.46);
    }) as EventListener);

    const end = ((e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) this.pinchDist = 0;
      if (pointers.size === 0) this.dragging = false;
    }) as EventListener;
    this.on(this.canvas, 'pointerup', end);
    this.on(this.canvas, 'pointercancel', end);

    this.on(this.canvas, 'wheel', ((e: WheelEvent) => {
      e.preventDefault();
      this.lastInteraction = performance.now();
      this.zoomBy(e.deltaY > 0 ? 1.08 : 0.92);
    }) as EventListener);

    this.on(this.canvas, 'keydown', ((e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'ArrowLeft') this.orbit.thetaT += 0.12;
      else if (k === 'ArrowRight') this.orbit.thetaT -= 0.12;
      else if (k === 'ArrowUp')
        this.orbit.phiT = THREE.MathUtils.clamp(this.orbit.phiT - 0.08, 0.14, 1.46);
      else if (k === 'ArrowDown')
        this.orbit.phiT = THREE.MathUtils.clamp(this.orbit.phiT + 0.08, 0.14, 1.46);
      else if (k === '+' || k === '=') this.zoomBy(0.88);
      else if (k === '-') this.zoomBy(1.12);
      else if (k === 'Home') this.goHome();
      else return;
      this.lastInteraction = performance.now();
      e.preventDefault();
    }) as EventListener);
  }

  // ---- render loop ---------------------------------------------------------

  private firstFrameDone = false;

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const now = performance.now();

    // Idle auto-rotate (disabled under reduced motion)
    if (!this.reducedMotion && now - this.lastInteraction > 6000 && !this.dragging) {
      this.orbit.thetaT += dt * 0.016;
    }

    // Smoothed orbit interpolation (reference smoothing constant)
    const k = Math.min(1, dt * 5.5);
    this.orbit.theta += (this.orbit.thetaT - this.orbit.theta) * k;
    this.orbit.phi += (this.orbit.phiT - this.orbit.phi) * k;
    this.orbit.radius += (this.orbit.radiusT - this.orbit.radius) * k;

    const { theta, phi, radius } = this.orbit;
    this.camera.position.set(
      TARGET.x + radius * Math.sin(phi) * Math.cos(theta),
      TARGET.y + radius * Math.cos(phi),
      TARGET.z + radius * Math.sin(phi) * Math.sin(theta),
    );
    this.camera.lookAt(TARGET);

    if (!this.reducedMotion) {
      this.crowd.update(t);
      const pulse = 0.55 + 0.45 * Math.sin(t * 3.2);
      for (const m of this.pulseMeshes) {
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.3 + pulse * 0.6;
        mat.transparent = true;
      }
    }

    this.quality.tick(now);
    this.renderer.render(this.scene, this.camera);

    if (!this.firstFrameDone) {
      this.firstFrameDone = true;
      this.onFirstFrame?.();
      this.onFirstFrame = null;
    }
  };
}
