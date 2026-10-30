import { test, expect } from '@playwright/test'
import { APP_URL } from './helpers'

const FIRST_USE_URL = APP_URL.replace('&fresh=1', '')

test('命名快照可创建并在刷新后保留', async ({ page }) => {
  await page.goto(FIRST_USE_URL)
  await page.getByRole('button', { name: /^从零创建/ }).click()
  await page.waitForTimeout(400)

  await page.getByRole('button', { name: '快照', exact: true }).click()
  await expect(page.locator('.snapshot-modal')).toBeVisible()
  await page.locator('.snapshot-modal input').fill('投递前')
  await page.getByRole('button', { name: '保存快照' }).click()
  await page.waitForTimeout(400)
  await expect(page.locator('.snap-item .snap-name')).toHaveText('投递前')

  await page.reload()
  await page.getByRole('button', { name: '快照', exact: true }).click()
  await expect(page.locator('.snap-item .snap-name')).toHaveText('投递前')
})

test('恢复快照生成新副本，原版本保留', async ({ page }) => {
  await page.goto(FIRST_USE_URL)
  await page.getByRole('button', { name: /^从零创建/ }).click()
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await page.evaluate(async (b) => { (b.basics as any).name = '原内容'; await (window as any).__ps.set(b) }, base)
  await page.waitForTimeout(400)

  await page.getByRole('button', { name: '快照', exact: true }).click()
  await page.locator('.snapshot-modal input').fill('快照前')
  await page.getByRole('button', { name: '保存快照' }).click()
  await page.waitForTimeout(300)

  const changed = await page.evaluate(() => (window as any).__ps.resume())
  await page.evaluate(async (c) => { (c.basics as any).name = '改动后'; await (window as any).__ps.set(c) }, changed)
  await page.waitForTimeout(300)

  await page.getByRole('button', { name: '恢复为新版本' }).click()
  await page.waitForTimeout(500)

  await expect(page.locator('.ver-select option')).toHaveCount(2)
  await expect(page.locator('.ver-select option:checked')).toContainText('快照前')
  const resume = await page.evaluate(() => (window as any).__ps.resume())
  expect(resume.basics.name).toBe('原内容')
})
