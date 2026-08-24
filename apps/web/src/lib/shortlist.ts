import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** A per-user shortlist of plots to revisit and compare (persisted locally). */
interface ShortlistState {
  codes: string[];
  compareOpen: boolean;
  toggle: (code: string) => void;
  clear: () => void;
  setCompareOpen: (v: boolean) => void;
}

export const useShortlist = create<ShortlistState>()(
  persist(
    (set) => ({
      codes: [],
      compareOpen: false,
      toggle: (code) => set((s) => ({ codes: s.codes.includes(code) ? s.codes.filter((c) => c !== code) : [...s.codes, code] })),
      clear: () => set({ codes: [], compareOpen: false }),
      setCompareOpen: (compareOpen) => set({ compareOpen }),
    }),
    { name: 'kec_shortlist' },
  ),
);
