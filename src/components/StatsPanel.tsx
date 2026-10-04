import type { SampleSummary } from '../types/handwriting'
import { summarize } from '../lib/stats'

export function StatsPanel({ samples }: { samples: SampleSummary[] }) {
  const stats = summarize(samples)
  const values = [
    ['Glyph samples', stats.glyphs.toLocaleString()], ['Expression samples', stats.expressions.toLocaleString()],
    ['Total strokes', stats.strokes.toLocaleString()], ['Total points', stats.points.toLocaleString()],
    ['Strokes / sample', stats.averageStrokes.toFixed(1)], ['Points / sample', stats.averagePoints.toFixed(1)],
  ]
  return <div className="stats-grid">{values.map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
}
