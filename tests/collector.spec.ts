import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Sample } from '../src/types/handwriting'

async function draw(page: Page, offset = 0) {
  const bounds = await page.getByTestId('drawing-canvas').boundingBox()
  if (!bounds) throw new Error('Canvas not visible')
  await page.mouse.move(bounds.x + 90 + offset, bounds.y + 90)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 160 + offset, bounds.y + 130, { steps: 6 })
  await page.mouse.move(bounds.x + 180 + offset, bounds.y + 70, { steps: 6 })
  await page.mouse.up()
}

async function records(page: Page): Promise<Sample[]> {
  return page.evaluate(async () => {
    return new Promise<Sample[]>((resolve, reject) => {
      const open = indexedDB.open('ink-study', 1)
      open.onsuccess = () => {
        const db = open.result
        const request = db.transaction('samples').objectStore('samples').getAll()
        request.onsuccess = () => { resolve(request.result as Sample[]); db.close() }
        request.onerror = () => { reject(request.error); db.close() }
      }
      open.onerror = () => reject(open.error)
    })
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('drawing-canvas')).toBeVisible()
})

test('collects raw trajectories, undoes strokes, survives refresh, and keeps independent mode sessions', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.screenshot({ path: testInfo.outputPath('desktop-collect.png'), fullPage: true })
  await expect(page.getByRole('button', { name: 'Save & Next' })).toBeDisabled()
  const label = await page.getByTestId('target').textContent()
  await page.getByLabel('Baseline', { exact: true }).check()
  await page.getByLabel('Grid', { exact: true }).check()
  await draw(page)
  await draw(page, 80)
  await page.keyboard.press('Control+z')
  await expect(page.getByText(/1 strokes ·/)).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('saved-count')).toHaveText('1')
  const saved = (await records(page))[0]
  expect(saved?.label).toBe(label)
  expect(saved?.strokes).toHaveLength(1)
  expect(saved?.strokes[0]?.length).toBeGreaterThan(10)
  expect(saved?.strokes[0]?.[0]).toMatchObject({ x: 90, y: 90, t: 0, pressure: 0.5 })
  expect(saved?.strokes[0]?.at(-1)?.pressure).toBe(0)
  const next = await page.getByTestId('target').textContent()
  await page.reload()
  await expect(page.getByTestId('target')).toHaveText(next ?? '')
  await expect(page.getByText('Sample 2', { exact: false })).toBeVisible()
  await expect(page.getByTestId('saved-count')).toHaveText('1')
  await page.getByLabel('Collection mode').selectOption('expression')
  await page.getByRole('button', { name: /^Skip/ }).click()
  await expect(page.getByText('Sample 2', { exact: false })).toBeVisible()
  await page.getByLabel('Collection mode').selectOption('glyph')
  await expect(page.getByTestId('target')).toHaveText(next ?? '')
  await expect(page.getByText('Sample 2', { exact: false })).toBeVisible()
  expect(errors).toEqual([])
})

test('clear and shortcuts preserve input editing and prevent blank saves', async ({ page }) => {
  await draw(page)
  await page.keyboard.press('c')
  await expect(page.getByRole('button', { name: 'Save & Next' })).toBeDisabled()
  await expect(page.getByText(/0 strokes · 0 points/)).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toContainText('at least one stroke')
  await page.getByLabel('Collection mode').focus()
  await page.keyboard.press('s')
  await expect(page.getByText('Sample 1', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Random seed').fill('cs-enter')
  await expect(page.getByLabel('Random seed')).toHaveValue('cs-enter')
  expect(await records(page)).toHaveLength(0)
})

test('exports exact data, imports collisions, rejects malformed files, and deletes samples', async ({ page }) => {
  await draw(page)
  await page.getByRole('button', { name: 'Save & Next' }).click()
  await expect(page.getByTestId('saved-count')).toHaveText('1')
  const original = (await records(page))[0]
  await page.getByRole('button', { name: 'Dataset / Review' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Dataset', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^handwriting-dataset-\d{4}-\d{2}-\d{2}\.json$/)
  const downloadedPath = await download.path()
  if (!downloadedPath) throw new Error('Download path unavailable')
  await page.getByLabel('Import dataset file').setInputFiles(downloadedPath)
  await expect(page.getByRole('status')).toContainText('Imported 1 samples. 1 colliding IDs reassigned.')
  const imported = await records(page)
  expect(imported).toHaveLength(2)
  expect(imported[0]?.strokes).toEqual(original?.strokes)
  expect(imported[1]?.strokes).toEqual(original?.strokes)
  expect(imported[0]?.id).not.toBe(imported[1]?.id)
  await page.getByLabel('Import dataset file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"samples":[]}') })
  await expect(page.getByRole('alert')).toContainText('metadata')
  expect(await records(page)).toHaveLength(2)
  await page.locator('.sample-row').first().click()
  await expect(page.getByTestId('replay-canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'Restart', exact: true }).click()
  await page.getByLabel('Replay speed').selectOption('4')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Delete Sample' }).click()
  await expect(page.getByRole('status')).toContainText('Sample deleted')
  expect(await records(page)).toHaveLength(1)
})

test('recovers a committed save when localStorage progress is stale', async ({ page }) => {
  const initialState = await page.evaluate(() => localStorage.getItem('ink-study.sessions.v1'))
  await draw(page)
  await page.getByRole('button', { name: 'Save & Next' }).click()
  await expect(page.getByTestId('saved-count')).toHaveText('1')
  await page.evaluate(value => { if (value) localStorage.setItem('ink-study.sessions.v1', value) }, initialState)
  await page.reload()
  await expect(page.getByText('Sample 2', { exact: false })).toBeVisible()
  expect(await records(page)).toHaveLength(1)
})

test('keeps raw CSS coordinates and draft dimensions across resize on a high-DPI display', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  await page.goto('/')
  const canvas = page.getByTestId('drawing-canvas')
  await expect(canvas).toBeVisible()
  const initial = await canvas.evaluate(element => ({ backing: (element as HTMLCanvasElement).width, css: element.getBoundingClientRect().width }))
  expect(initial.backing).toBe(initial.css * 2)
  await draw(page)
  await page.setViewportSize({ width: 450, height: 900 })
  expect(await canvas.evaluate(element => element.getBoundingClientRect().width)).toBe(initial.css)
  await page.getByRole('button', { name: 'Save & Next' }).click()
  await expect(page.getByTestId('saved-count')).toHaveText('1')
  const sample = (await records(page))[0]
  expect(sample?.canvasWidth).toBe(initial.css)
  expect(sample?.strokes[0]?.[0]?.x).toBe(90)
  expect(await canvas.evaluate(element => element.getBoundingClientRect().width)).toBeLessThan(initial.css)
  await context.close()
})

test('preserves cancelled pen strokes, raw pressure, single-point dots, and rejects repeated saves', async ({ page }) => {
  await page.getByTestId('drawing-canvas').evaluate(element => {
    // Synthetic pointer IDs cannot be natively captured; capture itself is covered by mouse tests.
    element.setPointerCapture = () => undefined
    const bounds = element.getBoundingClientRect()
    const point = { bubbles: true, pointerId: 77, pointerType: 'pen', button: 0, clientX: bounds.left + 30.25, clientY: bounds.top + 35.5, pressure: 0.73 }
    element.dispatchEvent(new PointerEvent('pointerdown', point))
    element.dispatchEvent(new PointerEvent('pointercancel', { ...point, pressure: 0 }))
  })
  await expect(page.getByText(/1 strokes · 1 points/)).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('saved-count')).toHaveText('1')
  const sample = (await records(page))[0]
  expect(sample?.strokes[0]).toHaveLength(1)
  expect(sample?.strokes[0]?.[0]?.pressure).toBeCloseTo(0.73)
  expect(sample?.strokes[0]?.[0]?.x).toBe(30.25)
})

test('retains a drawing on a failed save and allows retry', async ({ page }) => {
  await draw(page)
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction
    let failed = false
    IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase['transaction']>) {
      const tx = original.apply(this, args)
      if (args[1] === 'readwrite' && !failed) { failed = true; queueMicrotask(() => tx.abort()) }
      return tx
    }
  })
  await page.getByRole('button', { name: 'Save & Next' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByText(/1 strokes ·/)).toBeVisible()
  expect(await records(page)).toHaveLength(0)
  await page.getByRole('button', { name: 'Save & Next' }).click()
  await expect(page.getByTestId('saved-count')).toHaveText('1')
})

test('regenerates queues while retaining samples and updates coverage', async ({ page }) => {
  await draw(page)
  await page.getByRole('button', { name: 'Save & Next' }).click()
  await expect(page.getByTestId('saved-count')).toHaveText('1')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  for (const category of ['Digits', 'Lowercase', 'Uppercase', 'Math symbols', 'Greek']) await page.getByLabel(`${category} repetitions`).fill(category === 'Digits' ? '1' : '0')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Regenerate Prompt Queue' }).click()
  await expect(page.getByRole('status')).toContainText('All prompt queues regenerated')
  await page.getByRole('button', { name: 'Collect', exact: true }).click()
  await expect(page.getByText('Sample 1', { exact: false })).toContainText('/ 10')
  await expect(page.getByTestId('saved-count')).toHaveText('1')
  await page.getByRole('button', { name: 'Stats', exact: true }).click()
  await expect(page.getByText('Total points', { exact: true })).toBeVisible()
  await expect(page.locator('.stat-card').first()).toContainText('1')
})
