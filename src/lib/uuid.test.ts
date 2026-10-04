import { afterEach, expect, it, vi } from 'vitest'
import { uuid } from './uuid'

afterEach(() => vi.unstubAllGlobals())

it('generates valid unique v4 UUIDs without secure-context crypto.randomUUID', () => {
  const getRandomValues = crypto.getRandomValues.bind(crypto)
  vi.stubGlobal('crypto', { getRandomValues })
  const ids = Array.from({ length: 1000 }, () => uuid())
  expect(new Set(ids).size).toBe(1000)
  expect(ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))).toBe(true)
})
