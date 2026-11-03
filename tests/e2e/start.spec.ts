import { test, expect } from '@playwright/test'
import { APP_URL } from './helpers'

const FIRST_USE_URL = APP_URL.replace('&fresh=1', '')

test('首次使用显示导入与从零创建双入口，并说明本地隐私', async ({ page }) => {
  await page.goto(FIRST_USE_URL)

  await expect(page.locator('.start-screen')).toBeVisible()
  await expect(page.getByRole('button', { name: /^导入旧简历/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^从零创建/ })).toBeVisible()
  await expect(page.locator('.start-screen')).toContainText('数据只保存在本机浏览器')
  await expect(page.locator('.workspace')).toBeHidden()
})

test('从零创建进入默认模板的空白简历', async ({ page }) => {
  await page.goto(FIRST_USE_URL)
  await page.getByRole('button', { name: /^从零创建/ }).click()

  await expect(page.locator('.start-screen')).toBeHidden()
  await expect(page.locator('.workspace')).toBeVisible()
  await expect(page.locator('.ver-select option')).toHaveCount(1)
  await expect(page.locator('.ver-select')).toHaveValue(/.+/)
  const resume = await page.evaluate(() => (window as any).__ps.resume())
  expect(resume.basics.name).toBe('')
  expect(resume.work).toEqual([])
  expect(resume.meta.template).toBe('su')
})

test('从启动页导入旧简历，确认后进入新版本编辑器', async ({ page }) => {
  await page.goto(FIRST_USE_URL)
  await page.getByRole('button', { name: /^导入旧简历/ }).click()
  await expect(page.locator('.import-modal')).toBeVisible()

  await page.locator('.raw').fill('张三\n13800001111\n工作经历\n2020.07 — 2023.02 星辰科技有限公司 运维工程师')
  await page.locator('.pane-head .btn.tiny').click()
  await page.locator('.btn.primary', { hasText: '导入为新版本' }).click()

  await expect(page.locator('.start-screen')).toBeHidden()
  await expect(page.locator('.workspace')).toBeVisible()
  const resume = await page.evaluate(() => (window as any).__ps.resume())
  expect(resume.basics.name).toBe('张三')
})

test('已有版本再次打开直达编辑器，新建时仍显示双入口', async ({ page }) => {
  await page.goto(FIRST_USE_URL)
  await page.getByRole('button', { name: /^从零创建/ }).click()
  await page.waitForTimeout(500)
  await page.reload()

  await expect(page.locator('.workspace')).toBeVisible()
  await expect(page.locator('.start-screen')).toBeHidden()
  page.on('dialog', dialog => dialog.dismiss())
  await page.locator('.ver .btn').first().click()
  await expect(page.locator('.start-screen')).toBeVisible()
  await expect(page.getByRole('button', { name: /^导入旧简历/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^从零创建/ })).toBeVisible()
})

test('新建页仍可将当前简历复制为独立版本', async ({ page }) => {
  await page.goto(FIRST_USE_URL)
  await page.getByRole('button', { name: /^从零创建/ }).click()
  await page.waitForTimeout(400)
  await page.locator('.ver .btn').first().click()

  const copy = page.getByRole('button', { name: '复制当前版本' })
  await expect(copy).toBeVisible()
  await copy.click()
  const prompt = page.getByRole('dialog', { name: '新建版本' })
  await prompt.getByLabel('版本名称').fill('当前简历副本')
  await prompt.getByRole('button', { name: '确定' }).click()

  await expect(page.locator('.start-screen')).toBeHidden()
  await expect(page.locator('.ver-select option')).toHaveCount(2)
  await expect(page.locator('.ver-select')).toHaveValue(/.+/)
  await expect(page.locator('.ver-select option:checked')).toHaveText('当前简历副本')
})
