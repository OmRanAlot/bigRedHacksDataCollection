import type { Dataset, Point, Sample } from '../types/handwriting'
import { importSamples } from './db'
import { uuid } from './uuid'

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function validateDataset(value: unknown): Dataset {
  if (!object(value) || !object(value.metadata)) throw new Error('The file must contain a metadata object.')
  if (value.metadata.version !== 1) throw new Error('Unsupported dataset version. Expected version 1.')
  if (!Array.isArray(value.samples)) throw new Error('The file must contain a samples array.')
  const samples: Sample[] = value.samples.map((entry: unknown, index: number) => {
    const fail = (reason: string): never => { throw new Error(`Sample ${index + 1}: ${reason}`) }
    if (!object(entry)) return fail('expected an object.')
    if (typeof entry.label !== 'string' || !entry.label.trim()) return fail('label must be nonempty text.')
    if (entry.type !== 'glyph' && entry.type !== 'expression') return fail('type must be glyph or expression.')
    if (typeof entry.createdAt !== 'string' || !Number.isFinite(Date.parse(entry.createdAt))) return fail('createdAt must be a valid date.')
    if (!finite(entry.canvasWidth) || entry.canvasWidth <= 0 || !finite(entry.canvasHeight) || entry.canvasHeight <= 0) return fail('canvas dimensions must be positive finite numbers.')
    if (entry.id !== undefined && typeof entry.id !== 'string') return fail('id must be a string when provided.')
    if (entry.strokeWidth !== undefined && (!finite(entry.strokeWidth) || entry.strokeWidth <= 0)) return fail('strokeWidth must be a positive number.')
    if (entry.quality !== undefined && !['good', 'bad', 'redo'].includes(String(entry.quality))) return fail('quality must be good, bad, or redo.')
    if (!Array.isArray(entry.strokes) || entry.strokes.length === 0) return fail('strokes must be a nonempty array.')
    let lastTime = -1
    const strokes = entry.strokes.map((stroke: unknown, strokeIndex: number) => {
      if (!Array.isArray(stroke) || stroke.length === 0) return fail(`stroke ${strokeIndex + 1} must contain points.`)
      return stroke.map((point: unknown): Point => {
        if (!object(point) || !finite(point.x) || !finite(point.y) || !finite(point.t) || !finite(point.pressure)) return fail('every point needs finite x, y, t, and pressure values.')
        if (point.t < 0 || point.t < lastTime) return fail('timestamps must be nonnegative and ordered across strokes.')
        if (point.pressure < 0 || point.pressure > 1) return fail('pressure must be between 0 and 1.')
        lastTime = point.t
        return { x: point.x, y: point.y, t: point.t, pressure: point.pressure }
      })
    })
    return {
      id: typeof entry.id === 'string' ? entry.id : uuid(),
      label: entry.label, type: entry.type, createdAt: entry.createdAt,
      canvasWidth: entry.canvasWidth, canvasHeight: entry.canvasHeight, strokes,
      ...(entry.strokeWidth !== undefined ? { strokeWidth: entry.strokeWidth as number } : {}),
      ...(entry.quality !== undefined ? { quality: entry.quality as Sample['quality'] } : {}),
    }
  })
  return {
    metadata: { version: 1, exportedAt: typeof value.metadata.exportedAt === 'string' ? value.metadata.exportedAt : new Date().toISOString(), totalSamples: samples.length },
    samples,
  }
}

export async function importDataset(file: File): Promise<{ count: number; reassigned: number }> {
  let value: unknown
  try { value = JSON.parse(await file.text()) as unknown }
  catch { throw new Error('This file is not valid JSON. Select an exported handwriting dataset.') }
  const dataset = validateDataset(value)
  return importSamples(dataset.samples)
}
