import type { CollectionMode, QueueSession, SessionState, Settings } from '../types/handwriting'
import { createSession, DEFAULT_SETTINGS } from './promptGenerator'
import { getProgress } from './db'
import { GLYPHS } from './prompts'
import { uuid } from './uuid'

export const SETTINGS_KEY = 'ink-study.settings.v1'
export const SESSION_KEY = 'ink-study.sessions.v1'
const MODES: CollectionMode[] = ['glyph', 'expression', 'mixed']

export function validateSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object') return false
  const s = value as Partial<Settings>
  return typeof s.seed === 'string' && s.seed.length > 0 && s.seed.length <= 200 &&
    typeof s.shuffle === 'boolean' && typeof s.includeExpressions === 'boolean' &&
    typeof s.canvasWidth === 'number' && Number.isInteger(s.canvasWidth) && s.canvasWidth >= 200 && s.canvasWidth <= 2400 &&
    typeof s.canvasHeight === 'number' && Number.isInteger(s.canvasHeight) && s.canvasHeight >= 100 && s.canvasHeight <= 1600 &&
    typeof s.strokeWidth === 'number' && Number.isFinite(s.strokeWidth) && s.strokeWidth >= 0.5 && s.strokeWidth <= 20 &&
    !!s.repetitions && Object.keys(GLYPHS).every(key => {
      const count = s.repetitions?.[key as keyof typeof GLYPHS]
      return typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= 500
    })
}

export function loadSettings(): Settings {
  const stored = localStorage.getItem(SETTINGS_KEY)
  if (stored) {
    let value: unknown
    try { value = JSON.parse(stored) as unknown } catch { throw new Error('Saved settings are corrupted. Use Reset session storage to recover; samples will remain safe.') }
    if (!validateSettings(value)) throw new Error('Saved settings are invalid. Use Reset session storage to recover; samples will remain safe.')
    return value
  }
  const settings = { ...DEFAULT_SETTINGS, repetitions: { ...DEFAULT_SETTINGS.repetitions }, seed: uuid().slice(0, 12) }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  return settings
}

export function newSessionState(settings: Settings, mode: CollectionMode = 'glyph'): SessionState {
  return { version: 1, mode, sessions: { glyph: createSession(settings, 'glyph'), expression: createSession(settings, 'expression'), mixed: createSession(settings, 'mixed') } }
}

function validQueue(value: unknown, mode: CollectionMode): value is QueueSession {
  if (!value || typeof value !== 'object') return false
  const q = value as Partial<QueueSession>
  return typeof q.id === 'string' && q.id.length > 0 && q.mode === mode && typeof q.seed === 'string' &&
    Array.isArray(q.prompts) && q.prompts.every((p: unknown) => {
      if (!p || typeof p !== 'object') return false
      const prompt = p as { label?: unknown; type?: unknown }
      return typeof prompt.label === 'string' && prompt.label.length > 0 && (prompt.type === 'glyph' || prompt.type === 'expression')
    }) && typeof q.index === 'number' && Number.isInteger(q.index) && q.index >= 0 && q.index <= q.prompts.length &&
    typeof q.skipped === 'number' && Number.isInteger(q.skipped) && q.skipped >= 0 && q.skipped <= q.index &&
    q.completed === (q.index === q.prompts.length)
}

export async function loadSessions(settings: Settings): Promise<SessionState> {
  const raw = localStorage.getItem(SESSION_KEY)
  let state = newSessionState(settings)
  if (raw) {
    let parsed: Partial<SessionState>
    try { parsed = JSON.parse(raw) as Partial<SessionState> } catch { throw new Error('Saved session is corrupted. Reset session storage to recover; samples will remain safe.') }
    if (!parsed || parsed.version !== 1 || !MODES.includes(parsed.mode as CollectionMode) || !parsed.sessions || !MODES.every(mode => validQueue(parsed.sessions?.[mode], mode))) {
      throw new Error('Saved session is invalid. Reset session storage to recover; samples will remain safe.')
    }
    state = parsed as SessionState
  }
  for (const mode of MODES) {
    const queue = state.sessions[mode]
    const receipt = await getProgress(queue.id)
    if (receipt && receipt.nextIndex > queue.index) {
      queue.index = Math.min(receipt.nextIndex, queue.prompts.length)
      queue.skipped = receipt.skipped
      queue.completed = queue.index === queue.prompts.length
    }
  }
  persistSessions(state)
  return state
}

export function persistSessions(state: SessionState): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(state))
}

export function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return 'Browser storage is full. Export a backup before freeing storage. Your current drawing has been kept.'
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
