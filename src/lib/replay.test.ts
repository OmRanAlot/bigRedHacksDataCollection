import { describe, expect, it, vi } from 'vitest'
import { advanceTime, durationOf, renderUntil } from './replay'
import { summarize } from './stats'
import type { Stroke } from '../types/handwriting'

describe('timed replay', () => {
  const strokes: Stroke[] = [[{ x: 0, y: 0, t: 0, pressure: 0.5 }, { x: 1, y: 1, t: 100, pressure: 0.6 }], [{ x: 2, y: 2, t: 1000, pressure: 0.7 }]]
  it('uses original timing and never bridges stroke boundaries', () => {
    const fake = { beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() }
    const ctx = fake as unknown as CanvasRenderingContext2D
    const cursor = { stroke: 0, point: 0 }
    renderUntil(ctx, strokes, cursor, 0, 3)
    expect(fake.arc).toHaveBeenCalledTimes(1)
    renderUntil(ctx, strokes, cursor, 500, 3)
    expect(fake.lineTo).toHaveBeenCalledTimes(1)
    expect(fake.arc).toHaveBeenCalledTimes(1)
    renderUntil(ctx, strokes, cursor, 1000, 3)
    expect(fake.arc).toHaveBeenCalledTimes(2)
    expect(fake.lineTo).toHaveBeenCalledTimes(1)
    renderUntil(ctx, strokes, cursor, 2000, 3)
    expect(fake.arc).toHaveBeenCalledTimes(2)
    expect(durationOf(strokes)).toBe(1000)
  })
  it('scales time and clamps at the end', () => {
    expect(advanceTime(100, 50, 0.5, 1000)).toBe(125)
    expect(advanceTime(100, 50, 4, 1000)).toBe(300)
    expect(advanceTime(990, 50, 4, 1000)).toBe(1000)
    expect(advanceTime(100, 0, 2, 1000)).toBe(100)
  })
  it('handles empty stats and computes averages across all samples', () => {
    expect(summarize([]).averagePoints).toBe(0)
    const base = { id: 'one', label: 'x', createdAt: '', canvasWidth: 800, canvasHeight: 400 }
    const stats = summarize([{ ...base, type: 'glyph', strokeCount: 2, pointCount: 10 }, { ...base, id: 'two', type: 'expression', strokeCount: 4, pointCount: 20 }])
    expect(stats).toMatchObject({ glyphs: 1, expressions: 1, strokes: 6, points: 30, averageStrokes: 3, averagePoints: 15 })
    expect(stats.coverage.get('glyph:x')).toBe(1)
  })
})
