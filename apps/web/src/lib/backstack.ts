/**
 * Back-gesture → close-topmost-overlay.
 *
 * On phones, the Android back button and the iOS/Android edge-swipe both fire a
 * `popstate`. We keep a single "trap" history entry while any overlay is open, so
 * a back gesture closes the top-most overlay instead of leaving the app. Overlays
 * register with a priority; the highest-priority open one closes first.
 *
 * The history sync is rAF-debounced so React 18 StrictMode's mount→unmount→mount
 * in dev can't push/pop spurious entries.
 */
import { useEffect, useRef } from 'react';

interface Entry { id: number; prio: number; close: () => void }

let stack: Entry[] = [];
let armed = false;      // is our trap history entry currently on the stack?
let popping = false;    // are we inside a popstate (trap already consumed)?
let nid = 0;
let raf = 0;

function sync() {
  raf = 0;
  const want = stack.length > 0;
  if (want && !armed) { window.history.pushState({ kecTrap: true }, ''); armed = true; }
  else if (!want && armed) { armed = false; if (!popping) window.history.back(); }
}
function scheduleSync() { if (!raf) raf = requestAnimationFrame(sync); }

function onPop() {
  armed = false; // the browser just consumed our trap entry
  const top = stack.length ? stack.reduce((a, b) => (b.prio >= a.prio ? b : a)) : null;
  if (top) {
    const willRemain = stack.length > 1; // other overlays besides the one we're closing
    popping = true;
    try { top.close(); } finally { popping = false; }
    // Re-arm the trap synchronously (no rAF gap) so a rapid second back closes the
    // next overlay instead of leaving the app.
    if (willRemain) { window.history.pushState({ kecTrap: true }, ''); armed = true; }
  }
}
if (typeof window !== 'undefined') window.addEventListener('popstate', onPop);

/** Register an open overlay; returns an unregister fn. */
export function registerBack(prio: number, close: () => void): () => void {
  const id = ++nid;
  stack.push({ id, prio, close });
  scheduleSync();
  return () => { stack = stack.filter((e) => e.id !== id); scheduleSync(); };
}

/** Close `close()` when the back gesture fires while `isOpen`. Higher `prio` closes first. */
export function useBackClose(isOpen: boolean, close: () => void, prio = 10) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!isOpen) return;
    return registerBack(prio, () => closeRef.current());
  }, [isOpen, prio]);
}
