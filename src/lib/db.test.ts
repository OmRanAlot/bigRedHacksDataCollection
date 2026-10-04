import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllSamples, commitProgress, deleteSample, getAllSamples, getProgress, getSample, getSampleSummaries, getSamplesByType, importSamples, openDatabase, saveSample, updateQuality } from './db'
import { buildDataset } from './exportDataset'
import type { Sample } from '../types/handwriting'

const sample: Sample = {
  id: 'db-sample', label: 'x', type: 'glyph', createdAt: '2026-10-03T12:00:00.000Z', canvasWidth: 800, canvasHeight: 400,
  strokes: [[{ x: 1.1, y: 2.2, t: 0, pressure: 0.5 }], [{ x: 3.3, y: 4.4, t: 500, pressure: 0.7 }]],
}
beforeEach(async () => { await clearAllSamples() })

describe('persistent sample storage', () => {
  it('saves, reads, filters, summarizes, flags, exports, and deletes real records', async () => {
    await saveSample(sample)
    await saveSample({ ...sample, id: 'expression', label: 'x + 2', type: 'expression' })
    expect(await getSample(sample.id)).toEqual(sample)
    expect(await getSamplesByType('glyph')).toHaveLength(1)
    expect(await getSampleSummaries()).toEqual(expect.arrayContaining([expect.objectContaining({ id: sample.id, strokeCount: 2, pointCount: 2 })]))
    await updateQuality(sample.id, 'redo')
    expect((await getSample(sample.id))?.quality).toBe('redo')
    const exported = await buildDataset('expression')
    expect(exported.metadata.totalSamples).toBe(1)
    expect(exported.samples[0]?.strokes).toEqual(sample.strokes)
    await deleteSample(sample.id)
    expect(await getSample(sample.id)).toBeUndefined()
  })

  it('commits a sample and a recovery receipt atomically and idempotently', async () => {
    const receipt = { id: crypto.randomUUID(), nextIndex: 437, skipped: 2 }
    await commitProgress(receipt, sample)
    await commitProgress(receipt, { ...sample, id: 'should-not-save' })
    expect(await getProgress(receipt.id)).toEqual(receipt)
    expect(await getAllSamples()).toHaveLength(1)
    const failedReceipt = { id: crypto.randomUUID(), nextIndex: 1, skipped: 0 }
    await expect(commitProgress(failedReceipt, sample)).rejects.toBeDefined()
    expect(await getProgress(failedReceipt.id)).toBeUndefined()
  })

  it('records skipped progress without creating a sample', async () => {
    const receipt = { id: crypto.randomUUID(), nextIndex: 1, skipped: 1 }
    await commitProgress(receipt)
    expect(await getProgress(receipt.id)).toEqual(receipt)
    expect(await getAllSamples()).toHaveLength(0)
  })

  it('resolves collisions against existing records and within the same import', async () => {
    await saveSample(sample)
    expect(await importSamples([sample, sample])).toEqual({ count: 2, reassigned: 2 })
    const all = await getAllSamples()
    expect(all).toHaveLength(3)
    expect(new Set(all.map(s => s.id)).size).toBe(3)
    expect(all.every(s => JSON.stringify(s.strokes) === JSON.stringify(sample.strokes))).toBe(true)
  })

  it('rolls back earlier writes if an import transaction fails', async () => {
    // Duplicate primary keys force a constraint error on the second insert.
    const db = await openDatabase()
    const tx = db.transaction('samples', 'readwrite')
    const done = new Promise<void>(resolve => { tx.onabort = () => resolve() })
    const store = tx.objectStore('samples')
    store.add(sample)
    store.add(sample)
    await done
    expect(await getAllSamples()).toHaveLength(0)
  })
})
