export type Point = { x: number; y: number; t: number; pressure: number }
export type Stroke = Point[]
export type SampleType = 'glyph' | 'expression'
export type CollectionMode = SampleType | 'mixed'
export type Quality = 'good' | 'bad' | 'redo'

export type Sample = {
  id: string
  label: string
  type: SampleType
  createdAt: string
  canvasWidth: number
  canvasHeight: number
  strokes: Stroke[]
  strokeWidth?: number
  quality?: Quality
}

export type SampleSummary = Omit<Sample, 'strokes'> & { strokeCount: number; pointCount: number }
export type Dataset = {
  metadata: { version: 1; exportedAt: string; totalSamples: number }
  samples: Sample[]
}
export type Prompt = { label: string; type: SampleType }
export type Category = 'digits' | 'lowercase' | 'uppercase' | 'operators' | 'greek'
export type Settings = {
  repetitions: Record<Category, number>
  canvasWidth: number
  canvasHeight: number
  strokeWidth: number
  includeExpressions: boolean
  shuffle: boolean
  seed: string
}
export type QueueSession = {
  id: string
  mode: CollectionMode
  seed: string
  prompts: Prompt[]
  index: number
  skipped: number
  completed: boolean
}
export type SessionState = {
  version: 1
  mode: CollectionMode
  sessions: Record<CollectionMode, QueueSession>
}
export type ProgressReceipt = { id: string; nextIndex: number; skipped: number }
export type Guides = { top: boolean; baseline: boolean; center: boolean; grid: boolean }
