import type { ProgressReceipt, Sample, SampleSummary, SampleType } from '../types/handwriting'
import { uuid } from './uuid'

export const DB_NAME = 'ink-study'
let connection: Promise<IDBDatabase> | undefined
const laptopSamplesUrl = '/api/samples'
const laptopMainUrl = '/api/main'

function hasLaptopStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.fetch === 'function'
}

async function laptopRequest(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init)
  if (!response.ok) throw new Error(`Laptop storage request failed (${response.status}).`)
  return response
}

async function pushSamplesToLaptop(): Promise<void> {
  if (!hasLaptopStorage()) return
  await laptopRequest(laptopSamplesUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await getAllSamples()),
  })
}

export async function syncSamplesWithLaptop(): Promise<void> {
  if (!hasLaptopStorage()) return
  const response = await laptopRequest(laptopSamplesUrl)
  const remote = await response.json() as Sample[]
  const local = await getAllSamples()
  const merged = new Map(remote.map(sample => [sample.id, sample]))
  for (const sample of local) merged.set(sample.id, sample)
  const samples = [...merged.values()]
  const db = await openDatabase()
  const tx = writeTransaction(db, ['samples'])
  const done = finished(tx)
  const store = tx.objectStore('samples')
  store.clear()
  for (const sample of samples) store.put(sample)
  await done
  await laptopRequest(laptopSamplesUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(samples),
  })
}

export async function saveMainSample(sample: Sample): Promise<void> {
  await laptopRequest(laptopMainUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sample),
  })
}

export async function getMainSamples(): Promise<Sample[]> {
  const response = await laptopRequest(laptopMainUrl)
  return response.json() as Promise<Sample[]>
}

export function openDatabase(): Promise<IDBDatabase> {
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        const samples = db.createObjectStore('samples', { keyPath: 'id' })
        samples.createIndex('label', 'label')
        samples.createIndex('type', 'type')
        samples.createIndex('createdAt', 'createdAt')
        db.createObjectStore('progress', { keyPath: 'id' })
      }
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => { db.close(); connection = undefined }
        resolve(db)
      }
      request.onerror = () => { connection = undefined; reject(request.error) }
      request.onblocked = () => { connection = undefined; reject(new Error('Database upgrade blocked. Close other Ink Study tabs and reload.')) }
    })
  }
  return connection
}

function finished(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Storage transaction was cancelled.'))
    transaction.onerror = () => { /* The abort event reports the transaction failure. */ }
  })
}

function writeTransaction(db: IDBDatabase, stores: string[]): IDBTransaction {
  try { return db.transaction(stores, 'readwrite', { durability: 'strict' }) }
  catch { return db.transaction(stores, 'readwrite') }
}

async function read<T>(store: string, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const request = run(tx.objectStore(store))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const getSample = (id: string): Promise<Sample | undefined> => read('samples', store => store.get(id))
export const getAllSamples = (): Promise<Sample[]> => read('samples', store => store.getAll())
export const getSamplesByType = (type: SampleType): Promise<Sample[]> => read('samples', store => store.index('type').getAll(type))
export const getProgress = (id: string): Promise<ProgressReceipt | undefined> => read('progress', store => store.get(id))

export async function saveSample(sample: Sample): Promise<void> {
  const db = await openDatabase()
  const tx = writeTransaction(db, ['samples'])
  const done = finished(tx)
  tx.objectStore('samples').add(sample)
  await done
  await pushSamplesToLaptop()
}

// The receipt and sample commit together. Repeating a committed submission is a no-op.
export async function commitProgress(receipt: ProgressReceipt, sample?: Sample): Promise<void> {
  const db = await openDatabase()
  const tx = writeTransaction(db, ['samples', 'progress'])
  const done = finished(tx)
  const progress = tx.objectStore('progress')
  const request = progress.get(receipt.id)
  request.onsuccess = () => {
    const existing = request.result as ProgressReceipt | undefined
    if (existing && existing.nextIndex >= receipt.nextIndex) return
    if (sample) tx.objectStore('samples').add(sample)
    progress.put(receipt)
  }
  await done
  await pushSamplesToLaptop()
}

export async function deleteSample(id: string): Promise<void> {
  const db = await openDatabase()
  const tx = writeTransaction(db, ['samples'])
  const done = finished(tx)
  tx.objectStore('samples').delete(id)
  await done
  await pushSamplesToLaptop()
}

export async function updateQuality(id: string, quality: Sample['quality']): Promise<void> {
  const db = await openDatabase()
  const tx = writeTransaction(db, ['samples'])
  const done = finished(tx)
  const store = tx.objectStore('samples')
  const request = store.get(id)
  request.onsuccess = () => {
    const sample = request.result as Sample | undefined
    if (sample) store.put({ ...sample, quality })
  }
  await done
  await pushSamplesToLaptop()
}

export async function clearAllSamples(): Promise<void> {
  const db = await openDatabase()
  const tx = writeTransaction(db, ['samples'])
  const done = finished(tx)
  tx.objectStore('samples').clear()
  await done
  await pushSamplesToLaptop()
}

export async function getSampleSummaries(): Promise<SampleSummary[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('samples', 'readonly')
    const request = tx.objectStore('samples').index('createdAt').openCursor(null, 'prev')
    const summaries: SampleSummary[] = []
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      const { strokes, ...sample } = cursor.value as Sample
      summaries.push({ ...sample, strokeCount: strokes.length, pointCount: strokes.reduce((sum, stroke) => sum + stroke.length, 0) })
      cursor.continue()
    }
    tx.oncomplete = () => resolve(summaries)
    tx.onabort = () => reject(tx.error)
    request.onerror = () => reject(request.error)
  })
}

export async function importSamples(samples: Sample[]): Promise<{ count: number; reassigned: number }> {
  const db = await openDatabase()
  const tx = writeTransaction(db, ['samples'])
  const done = finished(tx)
  const store = tx.objectStore('samples')
  const request = store.getAllKeys()
  let reassigned = 0
  request.onsuccess = () => {
    const ids = new Set(request.result.map(String))
    for (const sample of samples) {
      let id = sample.id
      if (!id || ids.has(id)) {
        do { id = uuid() } while (ids.has(id))
        reassigned++
      }
      ids.add(id)
      store.add({ ...sample, id })
    }
  }
  await done
  await pushSamplesToLaptop()
  return { count: samples.length, reassigned }
}
