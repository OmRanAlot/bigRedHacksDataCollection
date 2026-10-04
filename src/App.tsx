import { useCallback, useEffect, useRef, useState } from 'react'
import type { CollectionMode, Quality, Sample, SampleSummary, SessionState, Settings } from './types/handwriting'
import type { DrawingSnapshot, DrawingStatus } from './components/DrawingCanvas'
import { commitProgress, getSampleSummaries, syncSamplesWithLaptop } from './lib/db'
import { errorMessage, loadSessions, loadSettings, newSessionState, persistSessions, SESSION_KEY, SETTINGS_KEY } from './lib/session'
import { CollectPage } from './pages/CollectPage'
import { ReviewPage } from './pages/ReviewPage'
import { StatsPage } from './pages/StatsPage'
import { SettingsPage } from './pages/SettingsPage'
import { MainPage } from './pages/MainPage'
import { uuid } from './lib/uuid'

type Page = 'collect' | 'main' | 'review' | 'stats' | 'settings'
type AppData = { settings: Settings; state: SessionState }
type Notice = { kind: 'error' | 'success'; message: string }

export default function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [samples, setSamples] = useState<SampleSummary[]>([])
  const [page, setPage] = useState<Page>('collect')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [startupError, setStartupError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('ink-study.theme') === 'dark' } catch { return false }
  })
  const drawingStatus = useRef<DrawingStatus>({ strokes: 0, points: 0, active: false })
  const inFlight = useRef(false)
  const showError = useCallback((error: unknown) => setNotice({ kind: 'error', message: errorMessage(error) }), [])
  const showNotice = useCallback((message: string) => setNotice({ kind: 'success', message }), [])
  const refresh = useCallback(async () => { setSamples(await getSampleSummaries()) }, [])
  const onDrawingStatus = useCallback((status: DrawingStatus) => { drawingStatus.current = status }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const settings = loadSettings()
        await syncSamplesWithLaptop()
        const [state, summaries] = await Promise.all([loadSessions(settings), getSampleSummaries()])
        if (!cancelled) { setData({ settings, state }); setSamples(summaries) }
      } catch (error) { if (!cancelled) setStartupError(errorMessage(error)) }
    }
    void init()
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (drawingStatus.current.strokes > 0 || inFlight.current) event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { cancelled = true; window.removeEventListener('beforeunload', beforeUnload) }
  }, [])

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])

  function canLeave(): boolean {
    if (inFlight.current || drawingStatus.current.active) return false
    return !drawingStatus.current.strokes || window.confirm('Discard the current unsaved drawing? Saved samples will remain safe.')
  }

  function navigate(next: Page) {
    if (next === page || !canLeave()) return
    drawingStatus.current = { strokes: 0, points: 0, active: false }
    setPage(next)
  }

  function changeMode(mode: CollectionMode) {
    if (!data || mode === data.state.mode || !canLeave()) return
    const state = { ...data.state, mode }
    try {
      persistSessions(state)
      drawingStatus.current = { strokes: 0, points: 0, active: false }
      setData({ ...data, state })
    } catch (error) { showError(error) }
  }

  async function advance(snapshot?: DrawingSnapshot, quality: Quality = 'good'): Promise<boolean> {
    if (!data || inFlight.current) return false
    const session = data.state.sessions[data.state.mode]
    const prompt = session.prompts[session.index]
    if (!prompt) return false
    inFlight.current = true
    setBusy(true)
    setNotice(null)
    try {
      const next = { ...session, index: session.index + 1, skipped: session.skipped + (snapshot ? 0 : 1), completed: session.index + 1 === session.prompts.length }
      const sample: Sample | undefined = snapshot ? {
        id: uuid(), label: prompt.label, type: prompt.type, createdAt: new Date().toISOString(),
        ...snapshot, strokeWidth: data.settings.strokeWidth, quality,
      } : undefined
      await commitProgress({ id: session.id, nextIndex: next.index, skipped: next.skipped }, sample)
      const state: SessionState = { ...data.state, sessions: { ...data.state.sessions, [data.state.mode]: next } }
      // A committed receipt recovers this step if localStorage cannot be updated.
      try { persistSessions(state) } catch { showNotice('Sample progress was committed to IndexedDB. Session storage could not update; it will recover on refresh.') }
      setData({ ...data, state })
      if (sample) {
        const { strokes, ...summary } = sample
        setSamples(current => [{ ...summary, strokeCount: strokes.length, pointCount: strokes.reduce((sum, stroke) => sum + stroke.length, 0) }, ...current])
      }
      return true
    } catch (error) { showError(error); return false }
    finally { inFlight.current = false; setBusy(false) }
  }

  function saveSettings(settings: Settings, regenerate: boolean): boolean {
    if (!data) return false
    try {
      const state = regenerate ? newSessionState(settings, data.state.mode) : data.state
      const previousSessions = localStorage.getItem(SESSION_KEY)
      const previousSettings = localStorage.getItem(SETTINGS_KEY)
      try {
        persistSessions(state)
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      } catch (error) {
        if (previousSessions !== null) localStorage.setItem(SESSION_KEY, previousSessions)
        if (previousSettings !== null) localStorage.setItem(SETTINGS_KEY, previousSettings)
        throw error
      }
      setData({ settings: structuredClone(settings), state })
      showNotice(regenerate ? 'All prompt queues regenerated. Your collected samples are unchanged.' : 'Settings saved. Regenerate queues to apply changes to prompt ordering and repetitions.')
      return true
    } catch (error) { showError(error); return false }
  }

  function toggleTheme() {
    const next = !dark
    setDark(next)
    try { localStorage.setItem('ink-study.theme', next ? 'dark' : 'light') } catch (error) { showError(error) }
  }

  if (!data) return <main className="startup"><div className="brand-mark">i.</div><h1>Ink Study</h1>{startupError ? <><p role="alert">{startupError}</p><div className="button-row"><button onClick={() => location.reload()}>Try again</button><button onClick={() => {
    if (!confirm('Reset settings and prompt progress? This will NOT delete any collected samples.')) return
    try { localStorage.removeItem(SETTINGS_KEY); localStorage.removeItem(SESSION_KEY); location.reload() } catch (error) { setStartupError(errorMessage(error)) }
  }}>Reset session storage</button></div></> : <p role="status">Opening your local notebook…</p>}</main>

  const session = data.state.sessions[data.state.mode]
  const exportType = session.prompts[session.index]?.type ?? (data.state.mode === 'expression' ? 'expression' : 'glyph')
  return <>
    <header className="app-header"><div className="header-inner"><a href="#" className="brand" onClick={event => { event.preventDefault(); navigate('collect') }}><span className="brand-mark">i.</span><span>Ink Study<small>HANDWRITING DATASET COLLECTOR</small></span></a>
      <nav aria-label="Main navigation">{(['collect', 'main', 'review', 'stats', 'settings'] as const).map(item => <button key={item} aria-current={page === item ? 'page' : undefined} className={page === item ? 'active' : ''} disabled={busy} onClick={() => navigate(item)}>{item === 'review' ? 'Dataset / Review' : item.charAt(0).toUpperCase() + item.slice(1)}</button>)}</nav>
      <button className="theme-toggle" onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>{dark ? '☀' : '◐'}</button>
    </div></header>
    <main className={`main-content ${page === 'collect' || page === 'main' ? 'collection-width' : ''}`}>
      {notice && <div className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}><span>{notice.message}</span><button aria-label="Dismiss notification" onClick={() => setNotice(null)}>×</button></div>}
      {page === 'main' && <MainPage onError={showError} onNotice={showNotice} />}
      {page === 'collect' && <CollectPage key={session.id} session={session} settings={data.settings} savedCount={samples.length} busy={busy} onMode={changeMode} onAdvance={advance} onStatus={onDrawingStatus} onSettings={() => navigate('settings')} onError={showError} />}
      {page === 'review' && <ReviewPage samples={samples} defaultType={exportType} onRefresh={refresh} onError={showError} onNotice={showNotice} />}
      {page === 'stats' && <StatsPage samples={samples} settings={data.settings} />}
      {page === 'settings' && <SettingsPage settings={data.settings} onSave={saveSettings} onError={showError} />}
    </main>
    <footer className="app-footer"><span>Made for the way you write.</span><span>Local storage · No uploads · Raw strokes</span></footer>
  </>
}
