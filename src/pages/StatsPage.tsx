import { useMemo } from 'react'
import type { SampleSummary, Settings } from '../types/handwriting'
import { StatsPanel } from '../components/StatsPanel'
import { ProgressBar } from '../components/ProgressBar'
import { CATEGORY_NAMES, EXPRESSIONS, GLYPHS } from '../lib/prompts'
import { summarize } from '../lib/stats'

export function StatsPage({ samples, settings }: { samples: SampleSummary[]; settings: Settings }) {
  const stats = useMemo(() => summarize(samples), [samples])
  return <>
    <div className="section-top"><div><div className="eyebrow">Dataset coverage</div><h1>A clearer picture.</h1><p className="muted">Coverage across all saved and imported samples. Quality flags do not exclude samples.</p></div></div>
    <StatsPanel samples={samples} />
    {(Object.keys(GLYPHS) as (keyof typeof GLYPHS)[]).map(category => <section className="coverage-section" key={category}>
      <div className="section-heading"><h2>{CATEGORY_NAMES[category]}</h2><span>{settings.repetitions[category]} samples per symbol</span></div>
      <div className="coverage-grid">{GLYPHS[category].map(label => {
        const count = stats.coverage.get(`glyph:${label}`) ?? 0
        const goal = settings.repetitions[category]
        return <div className={`coverage-cell ${count >= goal && goal > 0 ? 'covered' : ''}`} key={label}><div><span className="coverage-symbol">{label}</span><span className="mono">{count} / {goal}</span></div><ProgressBar value={count} max={goal} label={`${label}: ${count} of ${goal} samples`} /></div>
      })}</div>
    </section>)}
    <section className="coverage-section"><div className="section-heading"><h2>Expressions</h2><span>{EXPRESSIONS.filter(label => stats.coverage.has(`expression:${label}`)).length} / {EXPRESSIONS.length} covered</span></div><details><summary>View expression coverage</summary><div className="expression-coverage">{EXPRESSIONS.map(label => <div key={label}><span>{label}</span><span className="mono">{stats.coverage.get(`expression:${label}`) ?? 0} / 1</span></div>)}</div></details></section>
  </>
}
