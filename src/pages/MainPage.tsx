import { useEffect, useMemo, useRef, useState } from 'react'
import type { Quality, Sample } from '../types/handwriting'
import { DrawingCanvas } from '../components/DrawingCanvas'
import type { DrawingHandle, DrawingSnapshot } from '../components/DrawingCanvas'
import { getMainSamples, saveMainSample } from '../lib/db'
import { MAIN_PROMPTS } from '../lib/mainPrompts'
import { DEFAULT_SETTINGS } from '../lib/promptGenerator'
import { uuid } from '../lib/uuid'

const MAIN_INDEX_KEY = 'ink-study.main.index'

export function MainPage({ onError, onNotice }: { onError: (error: unknown) => void; onNotice: (message: string) => void }) {
  const canvas = useRef<DrawingHandle>(null)
  const [index, setIndex] = useState(() => Number(localStorage.getItem(MAIN_INDEX_KEY) ?? 0))
  const [busy, setBusy] = useState(false)
  const [strokes, setStrokes] = useState(0)
  const [saved, setSaved] = useState(0)
  const prompt = MAIN_PROMPTS[index]
  const progress = useMemo(() => `${Math.min(index, MAIN_PROMPTS.length).toLocaleString()} / ${MAIN_PROMPTS.length.toLocaleString()}`, [index])

  useEffect(() => { getMainSamples().then(samples => setSaved(samples.length)).catch(onError) }, [onError])

  async function save() {
    if (busy || !prompt || !strokes) return
    const snapshot: DrawingSnapshot | undefined = canvas.current?.snapshot()
    if (!snapshot) return
    setBusy(true)
    try {
      const sample: Sample = { id: uuid(), label: prompt.label, type: 'glyph', createdAt: new Date().toISOString(), ...snapshot, strokeWidth: DEFAULT_SETTINGS.strokeWidth, quality: 'good' as Quality }
      await saveMainSample(sample)
      const next = index + 1
      localStorage.setItem(MAIN_INDEX_KEY, String(next))
      setIndex(next); setSaved(value => value + 1); setStrokes(0); canvas.current?.clear()
    } catch (error) { onError(error) }
    finally { setBusy(false) }
  }

  function skip() {
    if (busy || !prompt) return
    const next = index + 1
    localStorage.setItem(MAIN_INDEX_KEY, String(next))
    setIndex(next); setStrokes(0); canvas.current?.clear()
  }

  return <><div className="section-top"><div><div className="eyebrow">Main collection</div><h1>Core character set.</h1><p className="muted">Digits, common letters, Greek, and uppercase characters · saved to <code>data\main.json</code></p></div></div>
    <div className="session-progress"><div><span>{prompt ? `Sample ${index + 1}` : 'Main queue complete'} <span className="muted">/ {MAIN_PROMPTS.length.toLocaleString()}</span></span><span className="mono">{progress}</span></div></div>
    {prompt ? <section className="drawing-card"><div className="canvas-toolbar"><span className="eyebrow">Write: <strong>{prompt.label}</strong></span></div>
      <DrawingCanvas ref={canvas} width={DEFAULT_SETTINGS.canvasWidth} height={DEFAULT_SETTINGS.canvasHeight} strokeWidth={DEFAULT_SETTINGS.strokeWidth} guides={{ top: true, center: true, baseline: true, grid: false }} disabled={busy} penOnly={false} onChange={status => setStrokes(status.strokes)} />
      <div className="collection-actions"><div className="button-row"><button disabled={busy || !strokes} onClick={() => canvas.current?.undo()}>Undo Stroke</button><button disabled={busy || !strokes} onClick={() => { canvas.current?.clear(); setStrokes(0) }}>Clear</button></div><div className="button-row"><button disabled={busy} onClick={skip}>Skip</button><button className="primary save-button" disabled={busy || !strokes} onClick={() => void save()}>{busy ? 'Saving…' : 'Save & Next'}</button></div></div>
    </section> : <section className="empty-state completion"><h2>Main queue complete.</h2><p>{saved.toLocaleString()} samples are stored in <code>data\main.json</code>.</p></section>}
    <div className="collection-summary"><span><strong>{saved.toLocaleString()}</strong> main samples saved</span><span className="local-badge">● Stored on laptop</span></div>
  </>
}
