import { test, expect } from '@playwright/test'
import { APP_URL } from './helpers'

const FIRST_USE_URL = APP_URL.replace('&fresh=1', '')

test('清空数据需二次确认，并回到启动页，刷新后仍为空', async ({ page }) => {
  await page.goto(FIRST_USE_URL)
  await page.getByRole('button', { name: /^从零创建/ }).click()
  await page.waitForTimeout(400)

  let confirms = 0
  page.on('dialog', dialog => { confirms++; dialog.accept() })

  await page.getByRole('button', { name: '清空数据', exact: true }).click()
  await page.waitForTimeout(400)

  expect(confirms).toBe(2)
  await expect(page.locator('.start-screen')).toBeVisible()
  await expect(page.getByRole('button', { name: /^导入旧简历/ })).toBeVisible()

  await page.reload()
  await expect(page.locator('.start-screen')).toBeVisible()
})
