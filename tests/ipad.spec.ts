import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // LAN HTTP Safari does not expose the secure-context randomUUID method.
  await page.addInitScript(() => { Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }) })
  await page.goto('/')
  await expect(page.getByTestId('drawing-canvas')).toBeVisible()
})

test('iPad touch input saves characters and expressions and survives reopening', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.screenshot({ path: testInfo.outputPath('ipad-collect.png'), fullPage: true })
  await page.getByTestId('drawing-canvas').tap({ position: { x: 140, y: 110 } })
  await expect(page.getByRole('button', { name: 'Save & Next' })).toBeEnabled()
  await page.getByRole('button', { name: 'Save & Next' }).tap()
  await expect(page.getByTestId('saved-count')).toHaveText('1')
  await page.getByLabel('Collection mode').selectOption('expression')
  await page.getByTestId('drawing-canvas').tap({ position: { x: 160, y: 120 } })
  await page.getByRole('button', { name: 'Save & Next' }).tap()
  await expect(page.getByTestId('saved-count')).toHaveText('2')
  await page.reload()
  await expect(page.getByTestId('saved-count')).toHaveText('2')
  await page.getByRole('button', { name: 'Dataset / Review' }).tap()
  await expect(page.locator('.sample-row')).toHaveCount(2)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Dataset', exact: true }).tap()
  const download = await downloadPromise
  const path = await download.path()
  if (!path) throw new Error('Dataset download failed in WebKit')
  await page.getByLabel('Import dataset file').setInputFiles(path)
  await expect(page.getByRole('status')).toContainText('Imported 2 samples. 2 colliding IDs reassigned.')
  await page.getByLabel('Filter sample type').selectOption('expression')
  await expect(page.locator('.sample-row')).toHaveCount(2)
  await page.locator('.sample-row').first().tap()
  await expect(page.getByTestId('replay-canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Play', exact: true }).tap()
  expect(errors).toEqual([])
})

test('pen-only input rejects fingers and retains stylus pressure', async ({ page }) => {
  await page.getByLabel('Pen only', { exact: false }).check()
  await page.getByTestId('drawing-canvas').tap({ position: { x: 100, y: 100 } })
  await expect(page.getByRole('button', { name: 'Save & Next' })).toBeDisabled()
  await page.getByTestId('drawing-canvas').evaluate(element => {
    element.setPointerCapture = () => undefined
    const bounds = element.getBoundingClientRect()
    const pointer = { pointerId: 7, pointerType: 'pen', bubbles: true, button: 0, clientX: bounds.left + 100, clientY: bounds.top + 100, pressure: 0.8 }
    element.dispatchEvent(new PointerEvent('pointerdown', pointer))
    element.dispatchEvent(new PointerEvent('pointerup', { ...pointer, pressure: 0 }))
  })
  await page.getByRole('button', { name: 'Save & Next' }).tap()
  await expect(page.getByTestId('saved-count')).toHaveText('1')
  await page.reload()
  await expect(page.getByLabel('Pen only', { exact: false })).toBeChecked()
})

test('tablet layout stays within the viewport in portrait and landscape', async ({ page }) => {
  for (const viewport of [{ width: 834, height: 1194 }, { width: 1194, height: 834 }]) {
    await page.setViewportSize(viewport)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const save = await page.getByRole('button', { name: 'Save & Next' }).boundingBox()
    expect(save?.height).toBeGreaterThanOrEqual(44)
    await page.getByRole('button', { name: 'Settings', exact: true }).tap()
    await expect(page.getByText('Keep your collection safe')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Collect', exact: true }).tap()
  }
})
