import type { Prompt } from '../types/handwriting'
import { GLYPHS } from './prompts'

function repeatSequentially(labels: string[], repetitions: number): Prompt[] {
  return labels.flatMap(label => Array.from({ length: repetitions }, () => ({ label, type: 'glyph' as const })))
}

const commonLetters = new Set('xynzabcdefgh i'.replace(' ', ''))
const lowercase = Array.from('abcdefghijklmnopqrstuvwxyz').flatMap(label => repeatSequentially([label], commonLetters.has(label) ? 40 : 20))
const digits = repeatSequentially(Array.from('0123456789'), 30)
const mathSymbols = repeatSequentially(GLYPHS.operators, 20)

export const MAIN_PROMPTS: Prompt[] = [...digits, ...lowercase, ...mathSymbols]
