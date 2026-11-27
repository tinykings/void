'use client';

import { animate, useMotionValue, useReducedMotion } from 'framer-motion';
import { useEffect, useState, type RefObject } from 'react';

const SLOP = 5;
const CLOSE_AT = 88;
const MAX_OFFSET = 88;

type PullPhase = 'idle' | 'pulling' | 'ready';
type Gesture = { id: number; x: number; y: number; captured: boolean; distance: number };

export const usePullToDismiss = (
  surfaceRef: RefObject<HTMLDivElement | null>,
  scrollRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  onDismiss: () => void,
) => {
  const offset = useMotionValue(0);
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<PullPhase>('idle');

  useEffect(() => {
    const surface = surfaceRef.current;
    const scroller = scrollRef.current;
    if (!enabled || !surface || !scroller) return;

    let gesture: Gesture | null = null;
    let animation: ReturnType<typeof animate> | undefined;
    const reset = (settle: boolean) => {
      gesture = null;
      setPhase('idle');
      animation?.stop();
      if (settle && !reducedMotion && offset.get() > 0) {
        animation = animate(offset, 0, { duration: 0.18, ease: 'easeOut' });
      } else {
        offset.set(0);
      }
    };

    const start = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        if (gesture) reset(true);
        return;
      }
      if (scroller.scrollTop > 1 || !window.matchMedia('(max-width: 767px)').matches) return;
      const target = event.target;
      if (!(target instanceof Element) ||
        (!scroller.contains(target) && !target.closest('[data-details-drag-handle]')) ||
        target.closest('button, a, input, select, textarea, [contenteditable], [aria-modal="true"]')) return;

      const touch = event.touches[0];
      animation?.stop();
      offset.set(0);
      gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, captured: false, distance: 0 };
    };

    const move = (event: TouchEvent) => {
      if (!gesture) return;
      const touch = event.touches[0];
      if (event.touches.length !== 1 || touch.identifier !== gesture.id) {
        reset(true);
        return;
      }
      const dy = touch.clientY - gesture.y;
      const dx = Math.abs(touch.clientX - gesture.x);

      if (!gesture.captured) {
        if (Math.max(Math.abs(dy), dx) < SLOP) return;
        if (dy <= dx || dy <= 0 || scroller.scrollTop > 1 || !event.cancelable) {
          // An upward/horizontal pan remains native scrolling for this gesture.
          reset(false);
          return;
        }
        gesture.captured = true;
      }

      event.preventDefault();
      gesture.distance = Math.max(0, dy);
      if (!reducedMotion) offset.set(Math.min(MAX_OFFSET, gesture.distance * 0.65));
      setPhase(gesture.distance >= CLOSE_AT ? 'ready' : 'pulling');
    };

    const end = (event: TouchEvent) => {
      if (!gesture || !Array.from(event.changedTouches).some((touch) => touch.identifier === gesture?.id)) return;
      const dismiss = gesture.captured && gesture.distance >= CLOSE_AT;
      reset(!dismiss);
      if (dismiss) onDismiss();
    };

    const cancel = () => { if (gesture) reset(true); };
    surface.addEventListener('touchstart', start, { passive: true });
    // Only a downward pull that starts at the top should suppress the browser pan.
    surface.addEventListener('touchmove', move, { passive: false });
    surface.addEventListener('touchend', end, { passive: true });
    surface.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      surface.removeEventListener('touchstart', start);
      surface.removeEventListener('touchmove', move);
      surface.removeEventListener('touchend', end);
      surface.removeEventListener('touchcancel', cancel);
      reset(false);
    };
  }, [enabled, offset, onDismiss, reducedMotion, scrollRef, surfaceRef]);

  return { offset, phase };
};
