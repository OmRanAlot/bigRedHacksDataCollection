import { describe, expect, it } from 'vitest'
import { validateDataset } from './importDataset'
import type { Sample } from '../types/handwriting'

export const fixture: Sample = {
  id: 'sample-1', label: 'θ', type: 'glyph', createdAt: '2026-10-03T12:00:00.000Z', canvasWidth: 800, canvasHeight: 400,
  strokes: [[{ x: 10.25, y: 12.75, t: 0, pressure: 0.1 }, { x: 820, y: -2, t: 19.23, pressure: 0.8 }], [{ x: 50, y: 60, t: 301, pressure: 0 }]],
}
const dataset = (sample: unknown = fixture) => ({ metadata: { version: 1 }, samples: [sample] })

describe('dataset validation', () => {
  it('preserves raw coordinates, pressure, boundaries, and fractional timestamps', () => {
    expect(validateDataset(dataset()).samples[0]).toEqual(fixture)
    expect(validateDataset({ metadata: { version: 1 }, samples: [] }).metadata.totalSamples).toBe(0)
  })
  it('accepts optional quality/style and generates missing IDs', () => {
    expect(validateDataset(dataset({ ...fixture, id: undefined })).samples[0]?.id).toMatch(/^[a-f0-9-]{36}$/)
    expect(validateDataset(dataset({ ...fixture, quality: 'redo', strokeWidth: 5 })).samples[0]?.strokeWidth).toBe(5)
  })
  it.each([
    {}, { samples: [] }, { metadata: { version: 2 }, samples: [] }, { metadata: { version: 1 }, samples: {} },
    dataset({ ...fixture, type: 'image' }), dataset({ ...fixture, label: '' }), dataset({ ...fixture, canvasWidth: 0 }),
    dataset({ ...fixture, createdAt: 'yesterday' }), dataset({ ...fixture, strokes: [] }), dataset({ ...fixture, strokes: [[]] }),
    dataset({ ...fixture, strokes: [[{ x: NaN, y: 0, t: 0, pressure: 0.5 }]] }),
    dataset({ ...fixture, strokes: [[{ x: 0, y: 0, t: -1, pressure: 0.5 }]] }),
    dataset({ ...fixture, strokes: [[{ x: 0, y: 0, t: 0, pressure: 2 }]] }),
    dataset({ ...fixture, strokes: [[{ x: 0, y: 0, t: 30, pressure: 0.5 }], [{ x: 0, y: 0, t: 20, pressure: 0.5 }]] }),
    dataset({ ...fixture, quality: 'maybe' }), dataset({ ...fixture, strokeWidth: -3 }),
  ])('rejects malformed input %#', value => { expect(() => validateDataset(value)).toThrow() })
})
