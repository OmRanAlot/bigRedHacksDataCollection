import type { Dataset, SampleType } from '../types/handwriting'
import { getAllSamples, getSamplesByType } from './db'

export async function buildDataset(type?: SampleType): Promise<Dataset> {
  const samples = type ? await getSamplesByType(type) : await getAllSamples()
  return { metadata: { version: 1, exportedAt: new Date().toISOString(), totalSamples: samples.length }, samples }
}

export async function exportDataset(type?: SampleType): Promise<void> {
  const dataset = await buildDataset(type)
  const blob = new Blob([JSON.stringify(dataset)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `handwriting-dataset${type ? `-${type}` : ''}-${new Date().toISOString().slice(0, 10)}.json`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // The click has started the download before the temporary URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
