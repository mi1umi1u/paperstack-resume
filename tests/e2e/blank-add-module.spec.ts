import { test, expect } from '@playwright/test'
import { APP_URL } from './helpers'

const FIRST_USE_URL = APP_URL.replace('&fresh=1', '')

test('从零创建后能新增模块并在预览出现', async ({ page }) => {
  await page.goto(FIRST_USE_URL)
  await page.getByRole('button', { name: /^从零创建/ }).click()

  await page.locator('.add-module').click()
  await page.locator('.add-menu button', { hasText: '证书' }).click()
  await page.waitForTimeout(500)

  await expect(page.locator('#app .sheet [data-key^="sec_"]').first()).toBeVisible()
  await page.locator('.if-done').click()
  await page.waitForTimeout(300)
  await expect(page.locator('#app .sheet .doc')).toContainText('证书')
})

test('空白简历页首显示个人信息占位，点击可填写', async ({ page }) => {
  await page.goto(FIRST_USE_URL)
  await page.getByRole('button', { name: /^从零创建/ }).click()

  const head = page.locator('#app .sheet .doc-head')
  await expect(head).toBeVisible()
  await expect(head).toContainText('点击填写')

  await head.click()
  await page.waitForTimeout(400)
  await expect(page.locator('#app .sheet .if-form')).toBeVisible()
  await expect(page.locator('#app .sheet .if-form')).toContainText('姓名')
})
