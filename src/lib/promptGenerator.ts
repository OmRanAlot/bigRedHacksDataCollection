import type { CollectionMode, Prompt, QueueSession, Settings } from '../types/handwriting'
import { EXPRESSIONS, GLYPHS } from './prompts'
import { uuid } from './uuid'

export const DEFAULT_SETTINGS: Settings = {
  repetitions: { digits: 20, lowercase: 15, uppercase: 10, operators: 20, greek: 15 },
  canvasWidth: 800, canvasHeight: 400, strokeWidth: 3,
  includeExpressions: true, shuffle: true, seed: 'ink-study',
}

export function seededRandom(seed: string): () => number {
  let state = 2166136261
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619)
  return () => {
    state += 0x6d2b79f5
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function generatePrompts(settings: Settings, mode: CollectionMode): Prompt[] {
  const entries: { prompt: Prompt; remaining: number }[] = []
  if (mode !== 'expression') {
    for (const category of Object.keys(GLYPHS) as (keyof typeof GLYPHS)[]) {
      const count = settings.repetitions[category]
      if (!Number.isInteger(count) || count < 0 || count > 500) throw new Error('Repetitions must be between 0 and 500.')
      if (count > 0) for (const label of GLYPHS[category]) entries.push({ prompt: { label, type: 'glyph' }, remaining: count })
    }
  }
  if (mode === 'expression' || (mode === 'mixed' && settings.includeExpressions)) {
    entries.push(...EXPRESSIONS.map(label => ({ prompt: { label, type: 'expression' as const }, remaining: 1 })))
  }
  let total = entries.reduce((sum, entry) => sum + entry.remaining, 0)
  if (entries.some(entry => entry.remaining > Math.ceil(total / 2))) throw new Error('These repetitions cannot avoid consecutive identical prompts.')
  const result: Prompt[] = []
  const random = seededRandom(`${settings.seed}:${mode}`)
  let cursor = 0
  while (total > 0) {
    const previous = result.at(-1)?.label
    // A label occupying half the remaining slots must be placed now to stay feasible.
    const forced = entries.find(entry => entry.remaining > total / 2)
    let chosen = forced?.prompt.label !== previous ? forced : undefined
    if (!chosen && settings.shuffle) {
      const candidates = entries.filter(entry => entry.remaining > 0 && entry.prompt.label !== previous)
      const weight = candidates.reduce((sum, entry) => sum + entry.remaining, 0)
      let ticket = random() * weight
      chosen = candidates.find(entry => { ticket -= entry.remaining; return ticket < 0 })
    } else if (!chosen) {
      for (let attempt = 0; attempt < entries.length; attempt++) {
        const entry = entries[cursor++ % entries.length]
        if (entry && entry.remaining > 0 && entry.prompt.label !== previous) { chosen = entry; break }
      }
    }
    if (!chosen) throw new Error('Could not generate a queue without adjacent identical prompts.')
    result.push({ ...chosen.prompt })
    chosen.remaining--
    total--
  }
  return result
}

export function createSession(settings: Settings, mode: CollectionMode): QueueSession {
  const prompts = generatePrompts(settings, mode)
  return { id: uuid(), mode, seed: settings.seed, prompts, index: 0, skipped: 0, completed: prompts.length === 0 }
}
