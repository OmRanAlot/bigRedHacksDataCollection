import type { SampleSummary } from '../types/handwriting'

export function summarize(samples: SampleSummary[]) {
  const glyphs = samples.filter(sample => sample.type === 'glyph').length
  const strokes = samples.reduce((sum, sample) => sum + sample.strokeCount, 0)
  const points = samples.reduce((sum, sample) => sum + sample.pointCount, 0)
  const coverage = new Map<string, number>()
  for (const sample of samples) {
    const key = `${sample.type}:${sample.label}`
    coverage.set(key, (coverage.get(key) ?? 0) + 1)
  }
  return { glyphs, expressions: samples.length - glyphs, strokes, points, averageStrokes: samples.length ? strokes / samples.length : 0, averagePoints: samples.length ? points / samples.length : 0, coverage }
}
