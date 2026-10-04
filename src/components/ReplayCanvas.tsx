import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Sample } from '../types/handwriting'
import { prepareCanvas } from '../lib/canvas'
import { advanceTime, durationOf, renderUntil } from '../lib/replay'
import type { ReplayCursor } from '../lib/replay'

export function ReplayCanvas({ sample }: { sample: Sample }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const cursor = useRef<ReplayCursor>({ stroke: 0, point: 0 })
  const time = useRef(0)
  const speedRef = useRef(1)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const duration = durationOf(sample.strokes)

  useLayoutEffect(() => {
    const redraw = () => {
      if (!canvas.current || !host.current) return
      const width = Math.min(sample.canvasWidth, host.current.clientWidth)
      if (!width) return
      const ctx = prepareCanvas(canvas.current, width, width * sample.canvasHeight / sample.canvasWidth, sample.canvasWidth, sample.canvasHeight)
      cursor.current = { stroke: 0, point: 0 }
      if (ctx) renderUntil(ctx, sample.strokes, cursor.current, time.current, sample.strokeWidth ?? 3)
    }
    redraw()
    const observer = new ResizeObserver(redraw)
    if (host.current) observer.observe(host.current)
    window.addEventListener('resize', redraw)
    return () => { observer.disconnect(); window.removeEventListener('resize', redraw) }
  }, [sample])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      time.current = advanceTime(time.current, now - previous, speedRef.current, duration)
      previous = now
      const ctx = canvas.current?.getContext('2d')
      if (ctx) renderUntil(ctx, sample.strokes, cursor.current, time.current, sample.strokeWidth ?? 3)
      setPosition(time.current)
      if (time.current >= duration) setPlaying(false)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, duration, sample])

  function restart(play: boolean) {
    time.current = 0
    setPosition(0)
    cursor.current = { stroke: 0, point: 0 }
    const ctx = canvas.current?.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, sample.canvasWidth, sample.canvasHeight)
      renderUntil(ctx, sample.strokes, cursor.current, 0, sample.strokeWidth ?? 3)
    }
    setPlaying(play)
  }

  return <div className="replay">
    <div ref={host} className="replay-surface"><canvas ref={canvas} aria-label="Sample replay" data-testid="replay-canvas" /></div>
    <div className="replay-timeline"><progress value={position} max={duration || 1} aria-label="Replay progress" /><span>{(position / 1000).toFixed(1)} / {(duration / 1000).toFixed(1)}s</span></div>
    <div className="button-row">
      <button className="primary" disabled={playing} onClick={() => { if (time.current >= duration) restart(true); else setPlaying(true) }}>Play</button>
      <button disabled={!playing} onClick={() => setPlaying(false)}>Pause</button>
      <button onClick={() => restart(false)}>Restart</button>
      <label className="inline-label">Speed <select aria-label="Replay speed" value={speed} onChange={event => { const next = Number(event.target.value); speedRef.current = next; setSpeed(next) }}>{[0.5, 1, 2, 4].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
    </div>
  </div>
}
