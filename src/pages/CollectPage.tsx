import { useCallback, useEffect, useRef, useState } from 'react'
import type { CollectionMode, Guides, Quality, QueueSession, Settings } from '../types/handwriting'
import { DrawingCanvas } from '../components/DrawingCanvas'
import type { DrawingHandle, DrawingSnapshot, DrawingStatus } from '../components/DrawingCanvas'
import { PromptDisplay } from '../components/PromptDisplay'
import { ProgressBar } from '../components/ProgressBar'

type Props = {
  session: QueueSession; settings: Settings; savedCount: number; busy: boolean
  onMode: (mode: CollectionMode) => void
  onAdvance: (snapshot?: DrawingSnapshot, quality?: Quality) => Promise<boolean>
  onStatus: (status: DrawingStatus) => void
  onSettings: () => void
  onError: (error: unknown) => void
}

export function CollectPage({ session, settings, savedCount, busy, onMode, onAdvance, onStatus, onSettings, onError }: Props) {
  const canvas = useRef<DrawingHandle>(null)
  const surface = useRef<HTMLDivElement>(null)
  const lock = useRef(false)
  const [status, setStatus] = useState<DrawingStatus>({ strokes: 0, points: 0, active: false })
  const [guides, setGuides] = useState<Guides>({ top: true, baseline: true, center: true, grid: false })
  const [quality, setQuality] = useState<Quality>('good')
  const [fullscreen, setFullscreen] = useState(false)
  const [penOnly, setPenOnly] = useState(() => {
    try { return localStorage.getItem('ink-study.pen-only') === 'true' } catch { return false }
  })
  const prompt = session.prompts[session.index]
  const blocked = busy || status.active
  const onChange = useCallback((next: DrawingStatus) => { setStatus(next); onStatus(next) }, [onStatus])

  const advance = useCallback(async (save: boolean) => {
    if (lock.current || busy || canvas.current?.isDrawing() || !prompt) return
    const snapshot = save ? canvas.current?.snapshot() : undefined
    if (save && !snapshot?.strokes.length) { onError(new Error('Write at least one stroke before saving.')); return }
    lock.current = true
    try {
      if (await onAdvance(snapshot, quality)) { canvas.current?.clear(); setQuality('good'); onChange({ strokes: 0, points: 0, active: false }) }
    } finally { lock.current = false }
  }, [busy, prompt, quality, onAdvance, onError, onChange])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (event.repeat || busy || canvas.current?.isDrawing() || !prompt) return
      const key = event.key.toLowerCase()
      const undo = ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'z') || (!event.ctrlKey && !event.metaKey && key === 'backspace')
      if (event.altKey || (event.shiftKey && key !== 'backspace')) return
      if (undo) { event.preventDefault(); canvas.current?.undo(); return }
      if (event.ctrlKey || event.metaKey) return
      // Preserve native keyboard activation when a button is focused.
      if (key === 'enter' && target instanceof HTMLElement && target.closest('button')) return
      if (['enter', 'c', 's'].includes(key)) event.preventDefault()
      if (key === 'enter') void advance(true)
      if (key === 'c') canvas.current?.clear()
      if (key === 's') void advance(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [advance, busy, prompt])

  useEffect(() => {
    const handler = () => setFullscreen(document.fullscreenElement === surface.current)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await surface.current?.requestFullscreen()
    } catch (error) { onError(error) }
  }

  return <div className="collect-page" ref={surface}>
    <div className="section-top">
      <div><div className="eyebrow">Collection workspace</div><h1>One stroke closer.</h1></div>
      <label className="mode-picker"><span className="sr-only">Collection mode</span><select aria-label="Collection mode" value={session.mode} disabled={blocked} onChange={event => onMode(event.target.value as CollectionMode)}>
        <option value="glyph">Glyph Collection</option><option value="expression">Expression Collection</option><option value="mixed">Mixed Collection</option>
      </select></label>
    </div>
    <div className="session-progress">
      <div><span>{session.completed ? 'Queue complete' : `Sample ${session.index + 1}`} <span className="muted">/ {session.prompts.length.toLocaleString()}</span></span><span className="mono">{session.prompts.length ? Math.round(session.index / session.prompts.length * 100) : 0}%</span></div>
      <ProgressBar value={session.index} max={session.prompts.length} label="Collection progress" />
    </div>
    {prompt ? <>
      <PromptDisplay prompt={prompt} />
      <section className="drawing-card">
        <div className="canvas-toolbar"><span className="eyebrow">Drawing paper</span><div className="guide-controls">
          {(['top', 'center', 'baseline', 'grid'] as const).map(guide => <label key={guide}><input type="checkbox" checked={guides[guide]} onChange={event => setGuides({ ...guides, [guide]: event.target.checked })} />{guide === 'top' ? 'Top line' : guide === 'center' ? 'Middle line' : guide === 'baseline' ? 'Baseline' : 'Grid'}</label>)}
          {document.fullscreenEnabled && <button className="icon-button" title={fullscreen ? 'Exit fullscreen' : 'Fullscreen collection'} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen collection'} onClick={() => void toggleFullscreen()}>{fullscreen ? '↙' : '⛶'}</button>}
        </div></div>
        <DrawingCanvas ref={canvas} width={settings.canvasWidth} height={settings.canvasHeight} strokeWidth={settings.strokeWidth} guides={guides} disabled={busy} penOnly={penOnly} onChange={onChange} />
        <div className="canvas-status"><span><span className="status-dot" /> Raw trajectory capture</span><span className="mono">{status.strokes} strokes · {status.points.toLocaleString()} points</span></div>
      </section>
      <div className="collection-actions">
        <div className="button-row"><button disabled={blocked || !status.strokes} onClick={() => canvas.current?.undo()}>Undo Stroke <kbd>⌫</kbd></button><button disabled={blocked || !status.strokes} onClick={() => canvas.current?.clear()}>Clear <kbd>C</kbd></button></div>
        <div className="button-row"><button disabled={blocked} onClick={() => void advance(false)}>Skip <kbd>S</kbd></button><button className="primary save-button" disabled={blocked || !status.strokes} onClick={() => void advance(true)}>{busy ? 'Saving…' : 'Save & Next'} <kbd>↵</kbd></button></div>
      </div>
      <div className="collection-footer"><label className="inline-label">Sample quality <select aria-label="Sample quality" value={quality} disabled={blocked} onChange={event => setQuality(event.target.value as Quality)}><option value="good">Good</option><option value="bad">Bad</option><option value="redo">Redo</option></select></label><span>Enter to save · Ctrl / ⌘ Z to undo</span></div>
      <label className="pen-only-control"><input type="checkbox" checked={penOnly} disabled={blocked} onChange={event => {
        setPenOnly(event.target.checked)
        try { localStorage.setItem('ink-study.pen-only', String(event.target.checked)) } catch (error) { onError(error) }
      }} />Pen only <span>Ignore fingers and palm touches while writing with a stylus.</span></label>
    </> : <section className="empty-state completion"><div className="completion-symbol">✓</div><h2>{session.prompts.length ? 'A page well filled.' : 'No prompts in this queue.'}</h2><p>{session.prompts.length ? `You finished ${session.prompts.length.toLocaleString()} prompts, including ${session.skipped} skipped. Your saved samples are ready to review and export.` : 'Set category repetitions or include expressions in Settings, then regenerate your queues.'}</p><button className="primary" onClick={onSettings}>Open Settings</button></section>}
    <div className="collection-summary"><span><strong data-testid="saved-count">{savedCount.toLocaleString()}</strong> saved samples</span><span>{session.index - session.skipped} saved in this queue · {session.skipped} skipped</span><span className="local-badge">● Stored on this device</span></div>
  </div>
}
