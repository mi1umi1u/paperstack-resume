import { test, expect } from '@playwright/test'
import { openApp, setContent, makeResume } from './helpers'

test('设计模式显示分页报告：页数、字号、行高与下限', async ({ page }) => {
  await openApp(page)
  await setContent(page, makeResume({ jobs: 3, bullets: 4 }))
  await page.getByRole('button', { name: '设计', exact: true }).click()

  const report = page.locator('.fit-report')
  await expect(report).toBeVisible()
  await expect(report).toContainText('页')
  await expect(report).toContainText('字号')
  await expect(report).toContainText('行高')
  await expect(report).toContainText('下限')
})

test('页数目标：选择 1 页可压缩回一页，自动恢复原页数', async ({ page }) => {
  await openApp(page)
  // 构造“只超几行”的内容：自动分页是 2 页，压一页能收成 1 页
  let target = makeResume({ jobs: 2, bullets: 3 })
  for (let extra = 1; extra <= 20; extra++) {
    const data = makeResume({ jobs: 2, bullets: 3, extraBullets: extra })
    await setContent(page, data, { autoFit: true })
    const st = await page.evaluate(() => (window as any).__ps.stats())
    if (st.pages === 2) { target = data; break }
  }
  await setContent(page, target, { autoFit: true })
  await page.getByRole('button', { name: '设计', exact: true }).click()

  await page.locator('.design-panel .chip', { hasText: '1 页' }).click()
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => (window as any).__ps.stats().pages)).toBe(1)

  await page.locator('.design-panel .chip', { hasText: '自动' }).click()
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => (window as any).__ps.stats().pages)).toBe(2)
})

test('目标已可满足时不应误报已压缩', async ({ page }) => {
  await openApp(page)
  await setContent(page, makeResume({ jobs: 1, bullets: 2 }), { autoFit: true })
  await page.getByRole('button', { name: '设计', exact: true }).click()

  await page.locator('.design-panel .chip', { hasText: '3 页' }).click()
  await page.waitForTimeout(300)
  const st = await page.evaluate(() => (window as any).__ps.stats())
  expect(st.pages).toBe(1)
  expect(st.compressed).toBe(false)
  await expect(page.locator('.fit-report')).not.toContainText('已压缩')
})
