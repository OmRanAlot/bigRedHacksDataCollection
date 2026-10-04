import { useEffect, useMemo, useRef, useState } from 'react'
import type { Quality, Sample, SampleSummary, SampleType } from '../types/handwriting'
import { deleteSample, getSample, updateQuality } from '../lib/db'
import { exportDataset } from '../lib/exportDataset'
import { importDataset } from '../lib/importDataset'
import { ReplayCanvas } from '../components/ReplayCanvas'

type Props = { samples: SampleSummary[]; defaultType: SampleType; onRefresh: () => Promise<void>; onError: (error: unknown) => void; onNotice: (message: string) => void }

export function ReviewPage({ samples, defaultType, onRefresh, onError, onNotice }: Props) {
  const [type, setType] = useState<SampleType | 'all'>('all')
  const [label, setLabel] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Sample | null>(null)
  const [exportType, setExportType] = useState<SampleType>(defaultType)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const operation = useRef(false)
  const labels = useMemo(() => {
    const counts = new Map<string, number>()
    for (const sample of samples) if (type === 'all' || sample.type === type) counts.set(sample.label, (counts.get(sample.label) ?? 0) + 1)
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [samples, type])
  const filtered = useMemo(() => samples.filter(sample => (type === 'all' || sample.type === type) && (!label || sample.label === label) && sample.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [samples, type, label, search])
  const pages = Math.max(1, Math.ceil(filtered.length / 30))
  const currentPage = Math.min(page, pages - 1)

  useEffect(() => {
    let cancelled = false
    setSelected(null)
    if (!selectedId) return
    setLoading(true)
    getSample(selectedId).then(sample => { if (!cancelled) setSelected(sample ?? null) }).catch(error => { if (!cancelled) onError(error) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedId, onError])

  async function perform(task: () => Promise<void>) {
    if (operation.current) return
    operation.current = true
    setBusy(true)
    try { await task() } catch (error) { onError(error) }
    finally { operation.current = false; setBusy(false) }
  }

  async function removeSelected() {
    if (!selected || !window.confirm(`Delete this “${selected.label}” sample? This cannot be undone unless you have an exported backup.`)) return
    await perform(async () => {
      await deleteSample(selected.id)
      setSelectedId(null); setSelected(null)
      await onRefresh()
      onNotice('Sample deleted. Queue progress has been preserved.')
    })
  }

  return <>
    <div className="section-top"><div><div className="eyebrow">Your handwriting archive</div><h1>Every mark, preserved.</h1><p className="muted">{samples.length.toLocaleString()} saved samples · original strokes, timing, and pressure</p></div></div>
    <section className="transfer-panel">
      <div className="button-row"><button className="primary" disabled={busy} onClick={() => void perform(() => exportDataset())}>Export Dataset</button><button disabled={busy} onClick={() => file.current?.click()}>Import Dataset</button></div>
      <div className="button-row"><select aria-label="Export prompt type" value={exportType} disabled={busy} onChange={event => setExportType(event.target.value as SampleType)}><option value="glyph">Glyph samples</option><option value="expression">Expression samples</option></select><button disabled={busy} onClick={() => void perform(() => exportDataset(exportType))}>Export Current Prompt Type</button></div>
      <input ref={file} type="file" accept=".json,application/json" aria-label="Import dataset file" className="sr-only" onChange={event => {
        const selectedFile = event.target.files?.[0]
        event.target.value = ''
        if (selectedFile) void perform(async () => {
          const result = await importDataset(selectedFile)
          await onRefresh()
          onNotice(`Imported ${result.count.toLocaleString()} samples. ${result.reassigned} colliding IDs reassigned.`)
        })
      }} />
      {busy && <span role="status" className="muted">Working with your local dataset…</span>}
    </section>
    <div className="review-layout">
      <section className="archive-panel">
        <div className="filter-bar"><input placeholder="Search labels…" aria-label="Search labels" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} />
          <select aria-label="Filter sample type" value={type} onChange={event => { setType(event.target.value as SampleType | 'all'); setLabel(''); setPage(0) }}><option value="all">All types</option><option value="glyph">Glyphs</option><option value="expression">Expressions</option></select>
          <select aria-label="Filter label" value={label} onChange={event => { setLabel(event.target.value); setPage(0) }}><option value="">All labels ({filtered.length})</option>{labels.map(([value, count]) => <option key={value} value={value}>{value} ({count})</option>)}</select>
        </div>
        <div className="sample-list">
          {filtered.slice(currentPage * 30, currentPage * 30 + 30).map(sample => <button className={`sample-row ${selectedId === sample.id ? 'selected' : ''}`} key={sample.id} disabled={busy} onClick={() => setSelectedId(sample.id)}>
            <span className={`sample-label ${sample.type}`}>{sample.label}</span><span className="sample-meta"><span>{sample.type} · {sample.strokeCount} strokes <span className={`quality-dot ${sample.quality ?? 'good'}`} title={`Quality: ${sample.quality ?? 'good'}`} /></span><time dateTime={sample.createdAt}>{new Date(sample.createdAt).toLocaleString()}</time></span><span className="row-arrow">↗</span>
          </button>)}
          {!filtered.length && <div className="empty-state"><h2>{samples.length ? 'No matching samples.' : 'Your archive starts here.'}</h2><p>{samples.length ? 'Try a different label or sample type.' : 'Save your first drawing in Collect, or import an existing dataset.'}</p></div>}
        </div>
        {filtered.length > 0 && <div className="pagination"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>{currentPage + 1} / {pages}</span><button disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>}
      </section>
      <section className="sample-detail">
        {selected ? <>
          <div className="eyebrow">Sample replay · {selected.type}</div><h2 className="review-target">{selected.label}</h2>
          <p className="muted small">{selected.canvasWidth} × {selected.canvasHeight} CSS px · {new Date(selected.createdAt).toLocaleString()}</p>
          <ReplayCanvas key={selected.id} sample={selected} />
          <div className="detail-actions"><label className="inline-label">Quality <select aria-label="Review quality" value={selected.quality ?? 'good'} disabled={busy} onChange={event => {
            const quality = event.target.value as Quality
            void perform(async () => { await updateQuality(selected.id, quality); setSelected({ ...selected, quality }); await onRefresh() })
          }}><option value="good">Good</option><option value="bad">Bad</option><option value="redo">Redo</option></select></label><button className="danger" disabled={busy} onClick={() => void removeSelected()}>Delete Sample</button></div>
        </> : <div className="empty-state"><div className="replay-symbol">↺</div><h2>{loading ? 'Loading strokes…' : 'See your writing unfold.'}</h2><p>Select a sample to replay its original stroke sequence and timing.</p></div>}
      </section>
    </div>
  </>
}
