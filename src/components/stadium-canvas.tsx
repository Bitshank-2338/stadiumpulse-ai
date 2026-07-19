/**
 * StadiumPulse AI — React wrapper for the imperative StadiumScene.
 * Original StadiumPulse AI code.
 */

import { useEffect, useRef, useState } from 'react';
import { StadiumScene } from '../scene/stadium-scene';
import type { SceneMarker, ZoneHeat } from '../scene/stadium-scene';
import type { Vec3 } from '../types/domain';

export interface StadiumCanvasProps {
  reducedMotion?: boolean;
  markers?: SceneMarker[];
  routePath?: Vec3[] | null;
  routeColor?: number;
  zoneHeat?: ZoneHeat[];
  /** Focus request: when this changes to a position, camera flies there. */
  focus?: { position: Vec3; radius?: number } | null;
  className?: string;
}

export function StadiumCanvas({
  reducedMotion = false,
  markers,
  routePath,
  routeColor,
  zoneHeat,
  focus,
  className,
}: StadiumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<StadiumScene | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Mount once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: StadiumScene | null = null;
    try {
      scene = new StadiumScene(canvas, {
        onFirstFrame: () => setStatus('ready'),
      });
    } catch {
      setStatus('error');
      return;
    }
    sceneRef.current = scene;
    const ro = new ResizeObserver(() => scene?.resize());
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    sceneRef.current?.setMarkers(markers ?? []);
  }, [markers, status]);

  useEffect(() => {
    sceneRef.current?.setRoutePath(routePath ?? null, routeColor);
  }, [routePath, routeColor, status]);

  useEffect(() => {
    sceneRef.current?.setZoneHeat(zoneHeat ?? []);
  }, [zoneHeat, status]);

  useEffect(() => {
    if (focus) sceneRef.current?.focusOn(focus.position, focus.radius);
  }, [focus]);

  if (status === 'error') {
    return (
      <div
        role="img"
        aria-label="3D stadium map unavailable"
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: 280,
          background: 'var(--sp-surface)',
          border: '1px solid var(--sp-border)',
          borderRadius: 'var(--sp-radius)',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <p>
          The 3D stadium view is unavailable on this device (WebGL could not
          start). All guidance remains available in text form.
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} className={className}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="Interactive 3D stadium digital twin. Drag to rotate, scroll to zoom, arrow keys to orbit."
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      />
      {status === 'loading' && (
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--sp-bg)',
            color: 'var(--sp-text-muted)',
          }}
        >
          Building stadium…
        </div>
      )}
    </div>
  );
}
