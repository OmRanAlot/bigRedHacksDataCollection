import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Guides, Stroke } from '../types/handwriting'
import { drawPoint, drawStrokes, prepareCanvas } from '../lib/canvas'

export type DrawingSnapshot = { strokes: Stroke[]; canvasWidth: number; canvasHeight: number }
export type DrawingStatus = { strokes: number; points: number; active: boolean }
export type DrawingHandle = { clear: () => void; undo: () => void; snapshot: () => DrawingSnapshot; isDrawing: () => boolean }
type Props = {
  width: number; height: number; strokeWidth: number; guides: Guides; disabled: boolean; penOnly: boolean
  onChange: (status: DrawingStatus) => void
}

export const DrawingCanvas = forwardRef<DrawingHandle, Props>(function DrawingCanvas({ width, height, strokeWidth, guides, disabled, penOnly, onChange }, ref) {
  const container = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const activePointer = useRef<number | null>(null)
  const origin = useRef<number | null>(null)
  const lastTime = useRef(0)
  const dimensions = useRef({ width, height })
  const [size, setSize] = useState(dimensions.current)
  const [hasInk, setHasInk] = useState(false)
  const changed = useCallback(() => {
    const count = strokes.current.reduce((sum, stroke) => sum + stroke.length, 0)
    setHasInk(count > 0)
    onChange({ strokes: strokes.current.length, points: count, active: activePointer.current !== null })
  }, [onChange])

  const redraw = useCallback(() => {
    if (!canvas.current) return
    const ctx = prepareCanvas(canvas.current, dimensions.current.width, dimensions.current.height)
    if (ctx) drawStrokes(ctx, strokes.current, strokeWidth)
  }, [strokeWidth])

  const measure = useCallback(() => {
    if (!container.current) return
    if (!strokes.current.length) {
      const available = container.current.clientWidth
      if (available <= 0) return
      const fittedWidth = Math.min(width, available)
      const next = { width: fittedWidth, height: fittedWidth * height / width }
      dimensions.current = next
      setSize(next)
    }
    redraw()
  }, [width, height, redraw])

  useLayoutEffect(() => {
    measure()
    const observer = new ResizeObserver(measure)
    if (container.current) observer.observe(container.current)
    window.addEventListener('resize', measure)
    let query: MediaQueryList
    const watchDpr = () => {
      query?.removeEventListener('change', watchDpr)
      measure()
      query = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      query.addEventListener('change', watchDpr)
    }
    watchDpr()
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); query?.removeEventListener('change', watchDpr) }
  }, [measure])

  const clear = useCallback(() => {
    if (activePointer.current !== null) return
    strokes.current = []
    origin.current = null
    lastTime.current = 0
    changed()
    measure()
  }, [changed, measure])

  useImperativeHandle(ref, () => ({
    clear,
    undo: () => {
      if (activePointer.current !== null) return
      strokes.current.pop()
      if (!strokes.current.length) { origin.current = null; lastTime.current = 0; measure() }
      redraw()
      changed()
    },
    snapshot: () => ({ strokes: structuredClone(strokes.current), canvasWidth: dimensions.current.width, canvasHeight: dimensions.current.height }),
    isDrawing: () => activePointer.current !== null,
  }), [clear, redraw, changed, measure])

  useEffect(() => () => {
    if (activePointer.current !== null && canvas.current?.hasPointerCapture(activePointer.current)) canvas.current.releasePointerCapture(activePointer.current)
  }, [])

  function append(event: PointerEvent) {
    const element = canvas.current
    const stroke = strokes.current.at(-1)
    if (!element || !stroke || origin.current === null) return
    const rect = element.getBoundingClientRect()
    const t = Math.max(lastTime.current, event.timeStamp - origin.current)
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top, t, pressure: event.pressure }
    lastTime.current = t
    const previous = stroke.at(-1)
    stroke.push(point)
    const ctx = element.getContext('2d')
    if (ctx) drawPoint(ctx, point, previous, strokeWidth)
  }

  function down(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled || activePointer.current !== null || event.button !== 0) return
    if (penOnly && event.pointerType !== 'pen') return
    event.preventDefault()
    activePointer.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    if (origin.current === null) origin.current = event.nativeEvent.timeStamp
    strokes.current.push([])
    append(event.nativeEvent)
    changed()
  }

  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerId !== activePointer.current) return
    event.preventDefault()
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? []
    for (const point of coalesced.length ? coalesced : [event.nativeEvent]) append(point)
  }

  function end(event: ReactPointerEvent<HTMLCanvasElement>, includePoint: boolean) {
    if (event.pointerId !== activePointer.current) return
    if (includePoint) append(event.nativeEvent)
    activePointer.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    changed()
  }

  return <div className="canvas-scroll" ref={container}>
    <div className="drawing-surface" style={{ width: size.width, height: size.height }}>
      <div aria-hidden="true" className={`guides ${guides.grid ? 'guide-grid' : ''}`}>
        {guides.top && <div className="guide-top" />}
        {guides.baseline && <div className="guide-baseline" />}
        {guides.center && <div className="guide-center" />}
        {guides.grid && <div className="guide-bounds" />}
      </div>
      {!hasInk && <div className="canvas-placeholder" aria-hidden="true"><span>Make your mark.</span><small>{penOnly ? 'Apple Pencil or stylus only' : 'Mouse, touch, or pen'}</small></div>}
      <canvas ref={canvas} aria-label="Handwriting canvas" data-testid="drawing-canvas" onPointerDown={down} onPointerMove={move}
        onPointerUp={event => end(event, true)} onPointerCancel={event => end(event, false)} onLostPointerCapture={event => end(event, false)} />
    </div>
  </div>
})
