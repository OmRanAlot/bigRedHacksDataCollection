import { useState } from 'react'
import type { Settings } from '../types/handwriting'
import { CATEGORY_NAMES, EXPRESSIONS, GLYPHS } from '../lib/prompts'
import { validateSettings } from '../lib/session'
import { uuid } from '../lib/uuid'
import { StorageStatus } from '../components/StorageStatus'

type Props = { settings: Settings; onSave: (settings: Settings, regenerate: boolean) => boolean; onError: (error: unknown) => void }

export function SettingsPage({ settings, onSave, onError }: Props) {
  const [draft, setDraft] = useState<Settings>(() => structuredClone(settings))
  function submit(regenerate: boolean) {
    if (!validateSettings(draft)) { onError(new Error('Check your settings: repetitions 0–500, width 200–2400, height 100–1600, stroke width 0.5–20, and a nonempty seed up to 200 characters.')); return }
    if (regenerate && !window.confirm('Regenerate all three prompt queues? This resets prompt progress in every collection mode. Collected samples will NOT be deleted.')) return
    onSave(draft, regenerate)
  }
  return <>
    <div className="section-top"><div><div className="eyebrow">Collection preferences</div><h1>Make room for your process.</h1><p className="muted">Tune your paper, repetition goals, and prompt sequence.</p></div></div>
    <div className="settings-layout">
      <section className="settings-card"><h2>Repetition goals</h2><p>How many times each glyph appears in a new queue.</p><div className="settings-fields">{(Object.keys(GLYPHS) as (keyof typeof GLYPHS)[]).map(category => <label key={category}><span>{CATEGORY_NAMES[category]}<small>{GLYPHS[category].length} symbols</small></span><input type="number" min="0" max="500" step="1" value={draft.repetitions[category]} aria-label={`${CATEGORY_NAMES[category]} repetitions`} onChange={event => setDraft({ ...draft, repetitions: { ...draft.repetitions, [category]: Number(event.target.value) } })} /></label>)}</div></section>
      <section className="settings-card"><h2>Drawing paper</h2><p>Dimensions are in CSS pixels. Smaller screens fit the paper before the first stroke.</p><div className="settings-fields">
        <label><span>Canvas width<small>200–2400 px</small></span><input type="number" min="200" max="2400" value={draft.canvasWidth} onChange={event => setDraft({ ...draft, canvasWidth: Number(event.target.value) })} /></label>
        <label><span>Canvas height<small>100–1600 px</small></span><input type="number" min="100" max="1600" value={draft.canvasHeight} onChange={event => setDraft({ ...draft, canvasHeight: Number(event.target.value) })} /></label>
        <label><span>Stroke width<small>Visual only; pressure is always preserved</small></span><input type="number" min="0.5" max="20" step="0.5" value={draft.strokeWidth} onChange={event => setDraft({ ...draft, strokeWidth: Number(event.target.value) })} /></label>
      </div></section>
      <section className="settings-card queue-settings"><h2>Prompt sequence</h2><p>{EXPRESSIONS.length} expression prompts, each appearing once per queue.</p>
        <label className="checkbox-line"><input type="checkbox" checked={draft.includeExpressions} onChange={event => setDraft({ ...draft, includeExpressions: event.target.checked })} /><span>Include expressions in Mixed Collection</span></label>
        <label className="checkbox-line"><input type="checkbox" checked={draft.shuffle} onChange={event => setDraft({ ...draft, shuffle: event.target.checked })} /><span>Shuffle prompts using the seed below</span></label>
        <label className="seed-label">Random seed<div className="button-row"><input value={draft.seed} maxLength={200} onChange={event => setDraft({ ...draft, seed: event.target.value })} /><button onClick={() => setDraft({ ...draft, seed: uuid().slice(0, 12) })}>New seed</button></div></label>
        <p className="small muted">Identical symbols never appear consecutively. Without shuffling, repetitions are interleaved in a stable order.</p>
      </section>
    </div>
    <div className="settings-save"><div><strong>Samples stay safe.</strong><p>Save applies paper settings and coverage goals. Regenerate also rebuilds every queue and resets prompt progress.</p></div><div className="button-row"><button onClick={() => submit(false)}>Save settings</button><button className="primary" onClick={() => submit(true)}>Regenerate Prompt Queue</button></div></div>
    <StorageStatus />
  </>
}
