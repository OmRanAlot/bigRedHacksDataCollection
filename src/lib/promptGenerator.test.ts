import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, generatePrompts } from './promptGenerator'
import { EXPRESSIONS, GLYPHS } from './prompts'

describe('prompt generation', () => {
  it('includes every glyph with its exact configured count', () => {
    const prompts = generatePrompts(DEFAULT_SETTINGS, 'glyph')
    expect(prompts).toHaveLength(1900)
    for (const category of Object.keys(GLYPHS) as (keyof typeof GLYPHS)[]) {
      for (const label of GLYPHS[category]) expect(prompts.filter(p => p.label === label)).toHaveLength(DEFAULT_SETTINGS.repetitions[category])
    }
  })

  it('includes at least 120 unique expressions and required examples', () => {
    expect(EXPRESSIONS.length).toBeGreaterThanOrEqual(120)
    expect(new Set(EXPRESSIONS).size).toBe(EXPRESSIONS.length)
    expect(EXPRESSIONS).toContain('e^(iπ) + 1 = 0')
    expect(generatePrompts(DEFAULT_SETTINGS, 'expression')).toHaveLength(EXPRESSIONS.length)
    expect(generatePrompts(DEFAULT_SETTINGS, 'mixed')).toHaveLength(1900 + EXPRESSIONS.length)
    expect(generatePrompts({ ...DEFAULT_SETTINGS, includeExpressions: false }, 'mixed')).toHaveLength(1900)
  })

  it('is reproducible, varies with seed, and never repeats adjacent labels', () => {
    const initial = generatePrompts(DEFAULT_SETTINGS, 'glyph')
    expect(generatePrompts(DEFAULT_SETTINGS, 'glyph')).toEqual(initial)
    expect(generatePrompts({ ...DEFAULT_SETTINGS, seed: 'different' }, 'glyph')).not.toEqual(initial)
    for (let seed = 0; seed < 25; seed++) {
      for (const shuffle of [true, false]) {
        const prompts = generatePrompts({ ...DEFAULT_SETTINGS, shuffle, seed: String(seed) }, 'mixed')
        expect(prompts.every((p, index) => index === 0 || p.label !== prompts[index - 1]?.label)).toBe(true)
      }
    }
  })

  it('supports zero-count and imbalanced category settings without losing repetitions', () => {
    const settings = { ...DEFAULT_SETTINGS, repetitions: { digits: 500, lowercase: 0, uppercase: 0, operators: 0, greek: 0 } }
    const prompts = generatePrompts(settings, 'glyph')
    expect(prompts).toHaveLength(5000)
    expect(prompts.every((p, index) => index === 0 || p.label !== prompts[index - 1]?.label)).toBe(true)
    expect(generatePrompts({ ...settings, repetitions: { ...settings.repetitions, digits: 0 } }, 'glyph')).toEqual([])
    expect(() => generatePrompts({ ...settings, repetitions: { ...settings.repetitions, digits: -1 } }, 'glyph')).toThrow()
  })
})
