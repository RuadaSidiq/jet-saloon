/** Single-series bar chart (SVG, server-rendered). Title names the series; each bar has a hover tooltip; a table view is provided. */
export function BarChart({ title, data, format = (n: number) => String(n) }: { title: string; data: { label: string; value: number }[]; format?: (n: number) => string }) {
  const W = 640, H = 180, pad = { l: 36, r: 8, t: 10, b: 22 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = (W - pad.l - pad.r) / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(24, step - 2));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [...new Set([0, max / 2, max].map((t) => Math.round(t)))];
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-semibold">{title}</figcaption>
      {data.length === 0 ? <p className="py-8 text-center text-sm text-muted">No data for this period</p> : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e6edf6" strokeWidth={1} />
              <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#64748b">{format(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = pad.l + i * step + (step - bw) / 2;
            const top = y(d.value);
            const h = H - pad.b - top;
            return (
              <g key={d.label} className="group">
                <rect x={pad.l + i * step} y={pad.t} width={step} height={H - pad.t - pad.b} fill="transparent" />
                {h > 0 && <path d={`M${x},${H - pad.b} V${top + Math.min(4, h)} Q${x},${top} ${x + Math.min(4, bw / 2)},${top} H${x + bw - Math.min(4, bw / 2)} Q${x + bw},${top} ${x + bw},${top + Math.min(4, h)} V${H - pad.b} Z`} fill="#1769D2" className="group-hover:fill-[#123D75]" />}
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </g>
            );
          })}
          {[0, Math.floor(data.length / 2), data.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
            <text key={i} x={pad.l + i * step + step / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#64748b">{data[i].label}</text>
          ))}
        </svg>
      )}
      {data.length > 0 && (
        <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer">View as table</summary>
          <table className="mt-2 w-full"><tbody>{data.map((d) => <tr key={d.label}><td className="py-0.5">{d.label}</td><td className="tabular text-right text-ink">{format(d.value)}</td></tr>)}</tbody></table>
        </details>
      )}
    </figure>
  );
}
