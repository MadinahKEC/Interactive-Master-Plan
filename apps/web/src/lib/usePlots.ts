import { useEffect, useState } from 'react';
import type { PlotCollection } from '@kec/types';

/**
 * Loads the full plot dataset once (from /plots.geojson) for the data-driven sidebar:
 * KPIs, legend counts, sector counts and search fly-to. The map layer itself may use
 * vector tiles in production, but the aggregate UI always needs the whole set.
 */
export function usePlots() {
  const [data, setData] = useState<PlotCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/plots.geojson')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => alive && setData(j))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  return { data, error };
}
