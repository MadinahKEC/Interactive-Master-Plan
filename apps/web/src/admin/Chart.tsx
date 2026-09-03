import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

/** Minimal ECharts wrapper: inits once, updates option, resizes, disposes. */
export function Chart({ option, height = 230 }: { option: any; height?: number | string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    // SVG = vector output → razor-sharp on screen and, crucially, in print/PDF
    inst.current = echarts.init(ref.current, undefined, { renderer: 'svg' });
    const onResize = () => inst.current?.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('beforeprint', onResize);
    window.addEventListener('afterprint', onResize);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('beforeprint', onResize); window.removeEventListener('afterprint', onResize); inst.current?.dispose(); inst.current = null; };
  }, []);

  useEffect(() => { inst.current?.setOption(option, true); }, [option]);

  return <div ref={ref} style={{ width: '100%', height, direction: 'ltr' }} />;
}
