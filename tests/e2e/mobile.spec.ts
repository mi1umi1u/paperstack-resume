import { test, expect } from '@playwright/test'
import { openApp, setContent, makeResume } from './helpers'

test.use({ viewport: { width: 700, height: 900 } })

test('窄屏把大纲收进抽屉，预览保持主区域', async ({ page }) => {
  await openApp(page)
  await setContent(page, makeResume({ jobs: 2, bullets: 2 }))

  const workspace = page.locator('.workspace')
  await expect(page.getByRole('button', { name: '打开大纲' })).toBeVisible()
  await expect(workspace).not.toHaveClass(/panel-open/)
  const stageBox = await page.locator('.stage').boundingBox()
  expect(stageBox?.width).toBeGreaterThan(650)

  await page.getByRole('button', { name: '打开大纲' }).click()
  await expect(workspace).toHaveClass(/panel-open/)
  await expect(page.locator('.outline')).toBeVisible()
  await expect(page.locator('.mobile-panel-mask')).toBeVisible()
  const stageWhileOpen = await page.locator('.stage').boundingBox()
  expect(stageWhileOpen?.y).toBeLessThan(74)
  await expect(page.getByRole('button', { name: '关闭侧栏' })).toBeVisible()

  await page.locator('.mobile-panel-mask').click({ position: { x: 650, y: 300 } })
  await expect(workspace).not.toHaveClass(/panel-open/)
})

test('窄屏设计模式使用同一抽屉，切换模式后自动收起', async ({ page }) => {
  await openApp(page)
  await setContent(page, makeResume({ jobs: 1, bullets: 2 }))

  await page.getByRole('button', { name: '设计', exact: true }).click()
  await expect(page.getByRole('button', { name: '打开设计' })).toBeVisible()
  await expect(page.locator('.workspace')).not.toHaveClass(/panel-open/)
  await page.getByRole('button', { name: '打开设计' }).click()
  await expect(page.locator('.workspace')).toHaveClass(/panel-open/)
  await expect(page.locator('.design-panel')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.workspace')).not.toHaveClass(/panel-open/)
  await expect(page.locator('.stage')).toBeVisible()
})
