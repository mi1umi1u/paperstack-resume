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
  await page.locator('.tpl-card', { hasText: '密' }).click()
  await page.locator('.tpl-card', { hasText: '密' }).getByRole('button', { name: '查看大图' }).click()
  await page.getByRole('button', { name: '应用这套模板' }).click()
  expect(await page.evaluate(() => (window as any).__ps.resume().meta.template)).toBe('mi')

  await edit.click()
  await expect(page.locator('.outline')).toBeVisible()
  await expect(page.locator('.design-panel')).toBeHidden()
  expect(await page.evaluate(() => (window as any).__ps.resume().meta.template)).toBe('mi')
})

test('设计面板右边缘可以拖拽调宽', async ({ page }) => {
  await page.getByRole('button', { name: '设计', exact: true }).click()
  const panel = page.locator('.design-panel')
  const before = await panel.boundingBox()
  const handle = await page.locator('.side-resizer').boundingBox()
  expect(before).toBeTruthy()
  expect(handle).toBeTruthy()

  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + 120)
  await page.mouse.down()
  await page.mouse.move(510, handle!.y + 120, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(150)

  const after = await panel.boundingBox()
  expect(after!.width).toBeGreaterThan(before!.width + 120)
})

test('编辑、设计和体检共用左侧栏宽度与折叠状态', async ({ page }) => {
  const workspace = page.locator('.workspace')
  const outline = page.locator('.outline')
  const editWidth = (await outline.boundingBox())!.width

  await page.getByRole('button', { name: '收起左侧面板' }).click()
  await expect(workspace).toHaveClass(/side-collapsed/)
  await expect(page.getByRole('button', { name: '展开左侧面板' })).toBeVisible()

  await page.getByRole('button', { name: '设计', exact: true }).click()
  await expect(workspace).toHaveClass(/side-collapsed/)
  await expect(page.locator('.design-panel')).toHaveCount(1)
  await page.getByRole('button', { name: '展开左侧面板' }).click()
  await page.waitForTimeout(260)
  const designWidth = (await page.locator('.design-panel').boundingBox())!.width
  expect(Math.abs(designWidth - editWidth)).toBeLessThan(2)

  await page.getByRole('button', { name: '收起左侧面板' }).click()
  await page.getByRole('button', { name: '体检', exact: true }).click()
  await expect(workspace).toHaveClass(/side-collapsed/)
  await expect(page.getByRole('button', { name: '展开左侧面板' })).toBeVisible()
})

test('体检模式显示可验证规则和问题清单', async ({ page }) => {
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await setContent(page, { ...base, work: base.work.map((w: any, i: number) => i === 0 ? { ...w, end: '' } : w) })
  await page.getByRole('button', { name: '体检', exact: true }).click()
  await expect(page.locator('.audit-panel')).toBeVisible()
  await expect(page.locator('.outline')).toBeHidden()
  await expect(page.locator('.stage')).toBeVisible()
  await expect(page.locator('.audit-panel')).toContainText('日期不完整')
  await expect(page.locator('.audit-panel')).toContainText('依据：')
  await expect(page.locator('.audit-panel')).toContainText('不判断经历真伪')
  await expect(page.locator('.audit-panel .audit-issue').first()).toBeVisible()
  await expect(page.locator('.modal')).toHaveCount(0)
})

test('点击体检问题定位到工作经历并进入编辑', async ({ page }) => {
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await setContent(page, { ...base, work: base.work.map((w: any, i: number) => i === 0 ? { ...w, end: '' } : w) })
  await page.getByRole('button', { name: '体检', exact: true }).click()
  await page.locator('.audit-issue', { hasText: '日期不完整' }).click()

  await expect(page.locator('.outline')).toBeVisible()
  await expect(page.locator('.audit-panel')).toBeHidden()
  await expect(page.locator('#app .sheet .if-form')).toBeVisible()
  await expect(page.locator('#app .sheet .if-form input').first()).toHaveValue('第1家测试有限公司')
})

test('点击缺姓名问题定位到基本信息', async ({ page }) => {
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await setContent(page, { ...base, basics: { ...base.basics, name: '' } })
  await page.getByRole('button', { name: '体检', exact: true }).click()
  await page.locator('.audit-issue', { hasText: '缺少姓名' }).click()

  await expect(page.locator('.outline')).toBeVisible()
  await expect(page.locator('#app .sheet .if-form')).toBeVisible()
  await expect(page.locator('#app .sheet .if-form')).toContainText('一句话简介')
})
