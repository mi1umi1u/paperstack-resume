import { test, expect } from '@playwright/test'
import { openApp } from './helpers'

test('模板画廊以统一样例渲染缩略图，选中后应用模板', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '设计', exact: true }).click()

  const cards = page.locator('.tpl-card')
  await expect(cards).toHaveCount(10)
  await expect(page.locator('.tpl-card .tpl-thumb .doc').first()).toBeVisible()

  await page.locator('.tpl-card', { hasText: '密' }).click()
  await page.getByRole('button', { name: '应用此模板' }).click()

  expect(await page.evaluate(() => (window as any).__ps.resume().meta.template)).toBe('mi')
})

test('画廊可按单双栏、照片与英文筛选', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '设计', exact: true }).click()

  await page.locator('.gallery-filters button', { hasText: '单栏' }).click()
  await expect(page.locator('.tpl-card')).toHaveCount(8)
  await page.locator('.gallery-filters button', { hasText: '双栏' }).click()
  await expect(page.locator('.tpl-card')).toHaveCount(2)
  await page.locator('.gallery-filters button', { hasText: '照片' }).click()
  await expect(page.locator('.tpl-card')).toHaveCount(3)
  await page.locator('.gallery-filters button', { hasText: '英文' }).click()
  await expect(page.locator('.tpl-card')).toHaveCount(1)
  await expect(page.locator('.tpl-card')).toContainText('Classic EN')
})

test('模板可放大预览，再从预览确认选择', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '设计', exact: true }).click()
  const card = page.locator('.tpl-card', { hasText: '轴' })
  await card.getByRole('button', { name: '查看大图' }).click()

  const dialog = page.getByRole('dialog', { name: '轴模板预览' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.gallery-preview-sheet .doc-zhou')).toBeVisible()
  const cardBox = await dialog.boundingBox()
  const viewport = page.viewportSize()!
  expect(cardBox).toBeTruthy()
  expect(Math.abs((cardBox!.x + cardBox!.width / 2) - viewport.width / 2)).toBeLessThan(8)
  await dialog.getByRole('button', { name: '选择这套' }).click()
  await page.getByRole('button', { name: '应用此模板' }).click()
  expect(await page.evaluate(() => (window as any).__ps.resume().meta.template)).toBe('zhou')
})
