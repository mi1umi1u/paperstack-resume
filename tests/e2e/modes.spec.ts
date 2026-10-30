import { test, expect } from '@playwright/test'
import { openApp, setContent, makeResume } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await setContent(page, makeResume({ jobs: 2, bullets: 2 }))
})

test('设计模式保留预览，可修改模板并切回编辑模式', async ({ page }) => {
  const edit = page.getByRole('button', { name: '编辑', exact: true })
  const design = page.getByRole('button', { name: '设计', exact: true })
  await expect(edit).toHaveAttribute('aria-pressed', 'true')

  await design.click()
  await expect(page.locator('.design-panel')).toBeVisible()
  await expect(page.locator('.outline')).toBeHidden()
  await expect(page.locator('.stage')).toBeVisible()
  await page.locator('.design-panel .chip', { hasText: '密' }).click()
  expect(await page.evaluate(() => (window as any).__ps.resume().meta.template)).toBe('mi')

  await edit.click()
  await expect(page.locator('.outline')).toBeVisible()
  await expect(page.locator('.design-panel')).toBeHidden()
  expect(await page.evaluate(() => (window as any).__ps.resume().meta.template)).toBe('mi')
})

test('体检模式在左侧显示实时分数和问题清单', async ({ page }) => {
  await page.getByRole('button', { name: '体检', exact: true }).click()
  await expect(page.locator('.audit-panel')).toBeVisible()
  await expect(page.locator('.outline')).toBeHidden()
  await expect(page.locator('.stage')).toBeVisible()
  await expect(page.locator('.audit-panel')).toContainText('没有任何数字')
  await expect(page.locator('.audit-panel .audit-issue').first()).toBeVisible()
  await expect(page.locator('.modal')).toHaveCount(0)
})

test('点击体检问题定位到工作经历并进入编辑', async ({ page }) => {
  await page.getByRole('button', { name: '体检', exact: true }).click()
  await page.locator('.audit-issue', { hasText: '没有任何数字' }).click()

  await expect(page.locator('.outline')).toBeVisible()
  await expect(page.locator('.audit-panel')).toBeHidden()
  await expect(page.locator('#app .sheet .if-form')).toBeVisible()
  await expect(page.locator('#app .sheet .if-form input').first()).toHaveValue('第1家测试有限公司')
})

test('点击缺姓名问题定位到基本信息', async ({ page }) => {
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await setContent(page, { ...base, basics: { ...base.basics, name: '' } })
  await page.getByRole('button', { name: '体检', exact: true }).click()
  await page.locator('.audit-issue', { hasText: '没填姓名' }).click()

  await expect(page.locator('.outline')).toBeVisible()
  await expect(page.locator('#app .sheet .if-form')).toBeVisible()
  await expect(page.locator('#app .sheet .if-form')).toContainText('一句话简介')
})
