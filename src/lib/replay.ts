import type { Stroke } from '../types/handwriting'
import { drawPoint } from './canvas'

export type ReplayCursor = { stroke: number; point: number }

export function durationOf(strokes: Stroke[]): number {
  return strokes.at(-1)?.at(-1)?.t ?? 0
}

// The cursor advances once per point, so each frame only visits newly visible data.
export function renderUntil(ctx: CanvasRenderingContext2D, strokes: Stroke[], cursor: ReplayCursor, time: number, width: number): void {
  while (cursor.stroke < strokes.length) {
    const stroke = strokes[cursor.stroke]
    if (!stroke) break
    const point = stroke[cursor.point]
    if (!point) { cursor.stroke++; cursor.point = 0; continue }
    if (point.t > time) break
    drawPoint(ctx, point, stroke[cursor.point - 1], width)
    cursor.point++
  }
}

export function advanceTime(current: number, elapsed: number, speed: number, duration: number): number {
  return Math.min(duration, current + Math.max(0, elapsed) * speed)
}
