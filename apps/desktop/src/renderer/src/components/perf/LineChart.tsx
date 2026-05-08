import { memo, useMemo } from 'react';

interface Marker {
  t: number;
  color?: string;
  title?: string;
}

interface LineChartProps {
  /** Each datum: `{ t: ms timestamp, v: value }`. */
  data: { t: number; v: number }[];
  /** Sliding window length (ms). Used to lay out the X axis. */
  windowMs: number;
  /** "Now" timestamp — the right edge of the chart. */
  now: number;
  /** Optional fixed Y range. If unset, auto-fits to data + 10% headroom. */
  yMin?: number;
  yMax?: number;
  /** Horizontal threshold lines, e.g. `[{ y: 16, label: 'budget' }]`. */
  thresholds?: { y: number; color?: string; label?: string }[];
  /** Discrete vertical markers (timestamps), e.g. for jank events. */
  markers?: Marker[];
  /** Line + fill colour. */
  color?: string;
  fillOpacity?: number;
  height?: number;
  /** Format the Y axis tick labels. */
  formatY?: (v: number) => string;
  /** Optional title shown top-left. */
  title?: string;
  /** Optional unit shown next to the latest value. */
  unit?: string;
}

const DEFAULT_HEIGHT = 96;

function LineChartImpl({
  data,
  windowMs,
  now,
  yMin,
  yMax,
  thresholds = [],
  markers = [],
  color = '#a78bfa',
  fillOpacity = 0.12,
  height = DEFAULT_HEIGHT,
  formatY = (v) => v.toString(),
  title,
  unit,
}: LineChartProps) {
  const W = 1000;
  const H = height;
  const padL = 36;
  const padR = 8;
  const padT = title ? 22 : 8;
  const padB = 18;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xMin = now - windowMs;
  const xMax = now;

  const { yLo, yHi, points, fillPath } = useMemo(() => {
    if (data.length === 0) {
      return { yLo: yMin ?? 0, yHi: yMax ?? 1, points: '', fillPath: '' };
    }
    const vals = data.map((d) => d.v);
    let lo = yMin ?? Math.min(0, ...vals);
    let hi = yMax ?? Math.max(...vals);
    if (hi - lo < 1e-3) hi = lo + 1; // avoid /0
    const headroom = (hi - lo) * 0.1;
    if (yMin === undefined) lo -= 0;
    if (yMax === undefined) hi += headroom;

    const x = (t: number) =>
      padL + ((t - xMin) / Math.max(1, xMax - xMin)) * innerW;
    const y = (v: number) =>
      padT + (1 - (v - lo) / Math.max(1e-6, hi - lo)) * innerH;

    const pts = data.map((d) => `${x(d.t).toFixed(1)},${y(d.v).toFixed(1)}`).join(' ');
    const last = data[data.length - 1];
    const first = data[0];
    const fp = `M ${x(first.t).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts.replaceAll(',', ' ').replaceAll('  ', ' L ')} L ${x(last.t).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

    return { yLo: lo, yHi: hi, points: pts, fillPath: fp };
  }, [data, xMin, xMax, innerW, innerH, padL, padT, yMin, yMax]);

  const yToPx = (v: number) =>
    padT + (1 - (v - yLo) / Math.max(1e-6, yHi - yLo)) * innerH;
  const tToPx = (t: number) =>
    padL + ((t - xMin) / Math.max(1, xMax - xMin)) * innerW;

  const latest = data.length > 0 ? data[data.length - 1].v : null;

  // Y ticks — 3 evenly spaced.
  const ticks = [yLo, (yLo + yHi) / 2, yHi];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-full block"
      style={{ height }}
    >
      {title && (
        <text x={padL} y={14} fill="#888" fontSize={11} fontFamily="Inter, sans-serif">
          {title}
        </text>
      )}
      {latest !== null && (
        <text
          x={W - padR}
          y={14}
          fill="#e5e5e5"
          fontSize={11}
          fontFamily="JetBrains Mono, monospace"
          textAnchor="end"
        >
          {formatY(latest)}
          {unit ? ` ${unit}` : ''}
        </text>
      )}

      {/* Y grid */}
      {ticks.map((t, i) => (
        <g key={`yt-${i}`}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yToPx(t)}
            y2={yToPx(t)}
            stroke="rgba(167,139,250,0.06)"
            strokeWidth={1}
          />
          <text
            x={padL - 6}
            y={yToPx(t) + 3}
            fill="#666"
            fontSize={9}
            fontFamily="JetBrains Mono, monospace"
            textAnchor="end"
          >
            {formatY(t)}
          </text>
        </g>
      ))}

      {/* Threshold lines */}
      {thresholds.map((th, i) => {
        const py = yToPx(th.y);
        if (py < padT || py > padT + innerH) return null;
        return (
          <g key={`th-${i}`}>
            <line
              x1={padL}
              x2={W - padR}
              y1={py}
              y2={py}
              stroke={th.color ?? '#fbbf24'}
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.6}
            />
            {th.label && (
              <text
                x={W - padR - 4}
                y={py - 3}
                fill={th.color ?? '#fbbf24'}
                fontSize={9}
                fontFamily="JetBrains Mono, monospace"
                textAnchor="end"
                opacity={0.8}
              >
                {th.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Jank / event markers */}
      {markers.map((m, i) => {
        const px = tToPx(m.t);
        if (px < padL || px > W - padR) return null;
        return (
          <line
            key={`mk-${i}`}
            x1={px}
            x2={px}
            y1={padT}
            y2={padT + innerH}
            stroke={m.color ?? '#f87171'}
            strokeWidth={1}
            opacity={0.55}
          >
            {m.title && <title>{m.title}</title>}
          </line>
        );
      })}

      {/* Filled area + line */}
      {data.length > 1 && (
        <>
          <path d={fillPath} fill={color} opacity={fillOpacity} />
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {/* X axis labels — left = "Ns ago", right = "now" */}
      <text
        x={padL}
        y={H - 4}
        fill="#666"
        fontSize={9}
        fontFamily="JetBrains Mono, monospace"
      >
        −{Math.round(windowMs / 1000)}s
      </text>
      <text
        x={W - padR}
        y={H - 4}
        fill="#666"
        fontSize={9}
        fontFamily="JetBrains Mono, monospace"
        textAnchor="end"
      >
        now
      </text>
    </svg>
  );
}

export const LineChart = memo(LineChartImpl);
