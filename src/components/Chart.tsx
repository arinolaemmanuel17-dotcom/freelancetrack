import { useEffect, useRef, useState } from 'react'
import { compactMoney, formatMoney } from '../utils'

// Grouped columns for money over months. Colors come from CSS tokens
// (--series-1, --series-2), validated for color-blind readers in both themes.
export interface MonthSeries {
  label: string
  color: string // CSS variable name, e.g. 'var(--series-1)'
  values: number[]
}

export function MonthColumns({
  months,
  series,
  currency,
  height = 220,
  title,
}: {
  months: string[] // labels
  series: MonthSeries[]
  currency: string
  height?: number
  title: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => setW(Math.max(260, Math.round(entries[0].contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = height
  const pad = { top: 16, right: 8, bottom: 26, left: 48 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const band = innerW / months.length
  const barW = Math.min(24, (band * 0.7) / series.length - 2)
  const groupW = series.length * barW + (series.length - 1) * 2
  const y = (v: number) => pad.top + innerH - (v / top) * innerH

  return (
    <figure className="chart" aria-label={title}>
      {series.length > 1 && (
        <div className="legend" aria-hidden="true">
          {series.map((s) => (
            <span key={s.label} className="legend-item">
              <span className="swatch" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="chart-wrap" ref={wrapRef}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="chart-svg">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="grid" />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="tick">
                {compactMoney(t, currency)}
              </text>
            </g>
          ))}
          {months.map((m, i) => {
            const gx = pad.left + band * i + (band - groupW) / 2
            return (
              <g key={m} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}>
                <rect x={pad.left + band * i} y={pad.top} width={band} height={innerH} fill="transparent" />
                {series.map((s, j) => {
                  const v = s.values[i] ?? 0
                  const h = Math.max(0, pad.top + innerH - y(v))
                  return <path key={s.label} d={roundTop(gx + j * (barW + 2), y(v), barW, h)} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.45} />
                })}
                <text x={pad.left + band * i + band / 2} y={H - 8} textAnchor="middle" className="tick">
                  {m}
                </text>
              </g>
            )
          })}
        </svg>
        {hover !== null && (
          <div className="tooltip" style={{ left: `${((pad.left + band * hover + band / 2) / W) * 100}%` }} role="status">
            <strong>{months[hover]}</strong>
            {series.map((s) => (
              <span key={s.label} className="tip-row">
                <span className="swatch" style={{ background: s.color }} />
                {s.label}: {formatMoney(s.values[hover] ?? 0, currency)}
              </span>
            ))}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Month</th>
            {series.map((s) => (
              <th key={s.label}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={m}>
              <td>{m}</td>
              {series.map((s) => (
                <td key={s.label}>{formatMoney(s.values[i] ?? 0, currency)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

// Horizontal bars with the value at the tip, for "by client / platform / service".
export function BarList({ rows, currency, empty, out }: { rows: { key: string; value: number }[]; currency: string; empty: string; out?: boolean }) {
  if (rows.length === 0) return <p className="muted small">{empty}</p>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className={out ? 'barlist out' : 'barlist'}>
      {rows.map((r) => (
        <li key={r.key}>
          <span className="barlist-label">{r.key}</span>
          <span className="barlist-track">
            <span className="barlist-bar" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </span>
          <span className="barlist-value num">{formatMoney(r.value, currency)}</span>
        </li>
      ))}
    </ul>
  )
}

function roundTop(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

function niceTicks(max: number): number[] {
  const raw = max / 4
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = 0; v <= max + step * 0.999; v += step) out.push(Math.round(v * 100) / 100)
  return out
}
