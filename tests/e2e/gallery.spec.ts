import { test, expect } from '@playwright/test'
import { openApp } from './helpers'

test('模板画廊以统一样例渲染缩略图，选中后应用模板', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '设计', exact: true }).click()

  const cards = page.locator('.tpl-card')
  await expect(cards).toHaveCount(5)
  await expect(page.locator('.tpl-card .tpl-thumb .doc').first()).toBeVisible()

  await page.locator('.tpl-card', { hasText: '密' }).click()
  await page.getByRole('button', { name: '应用此模板' }).click()

  expect(await page.evaluate(() => (window as any).__ps.resume().meta.template)).toBe('mi')
})

test('画廊可按单双栏与照片筛选', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: '设计', exact: true }).click()

  await page.locator('.gallery-filters button', { hasText: '单栏' }).click()
  await expect(page.locator('.tpl-card')).toHaveCount(5)
  await page.locator('.gallery-filters button', { hasText: '双栏' }).click()
  await expect(page.locator('.gallery-empty')).toBeVisible()
})
