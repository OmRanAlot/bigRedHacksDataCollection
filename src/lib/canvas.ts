import type { Point, Stroke } from '../types/handwriting'

export const INK_COLOR = '#202a38'

export function prepareCanvas(canvas: HTMLCanvasElement, width: number, height: number, logicalWidth = width, logicalHeight = height): CanvasRenderingContext2D | null {
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.round(width * ratio))
  canvas.height = Math.max(1, Math.round(height * ratio))
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(canvas.width / logicalWidth, 0, 0, canvas.height / logicalHeight, 0, 0)
  return ctx
}

export function drawPoint(ctx: CanvasRenderingContext2D, point: Point, previous: Point | undefined, width: number): void {
  ctx.strokeStyle = INK_COLOR
  ctx.fillStyle = INK_COLOR
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  if (!previous) {
    ctx.arc(point.x, point.y, width / 2, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.moveTo(previous.x, previous.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }
}

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], width: number): void {
  for (const stroke of strokes) for (let i = 0; i < stroke.length; i++) {
    const point = stroke[i]
    if (point) drawPoint(ctx, point, stroke[i - 1], width)
  }
}
