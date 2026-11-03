import { test, expect } from '@playwright/test'
import { openApp, setContent, makeResume } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await setContent(page, makeResume({ jobs: 1, bullets: 2 }))
})

test('导入时单行内的 1、2、3 编号会拆成多个要点', async ({ page }) => {
  await page.locator('.btn', { hasText: '导入简历' }).click()
  await page.locator('.raw').fill(`张三
13800001111  zhangsan@example.com  北京
工作经历
2020.07 — 2023.02  星海科技有限公司  开发工程师
• 1、负责终端运维 2、处理网络故障 3、整理操作手册`)
  await page.locator('.pane-head .btn.tiny').click()
  await expect(page.locator('.pane.right')).toContainText('3 条要点')
})

test('要点编辑框回车新增一条要点，Shift+回车保留框内换行', async ({ page }) => {
  await page.locator('.doc [data-id] .org').first().click()
  const bullets = page.locator('.if-bullet textarea')
  await expect(bullets).toHaveCount(2)

  await bullets.first().click()
  await bullets.first().press('End')
  await bullets.first().press('Enter')
  await expect(bullets).toHaveCount(3)
  const added = bullets.nth(1)
  await expect(added).toBeFocused()
  await added.fill('新增的职责')

  await added.press('Shift+Enter')
  await added.type('第二行说明')
  expect(await added.inputValue()).toBe('新增的职责\n第二行说明')
  await expect(bullets).toHaveCount(3)

  await page.locator('.if-done').click()
  await expect(page.locator('.doc [data-id]').first().locator('li')).toHaveCount(3)
})

test('直接点单个要点进入编辑时，回车也会展开并新增下一条', async ({ page }) => {
  await page.locator('.doc [data-id] li[data-bi]').first().click()
  await expect(page.locator('.if-bullet textarea')).toHaveCount(0)
  const single = page.locator('.if-form textarea[data-f="bullet"]')
  await single.click()
  await single.press('End')
  await single.press('Enter')
  await expect(page.locator('.if-bullet textarea')).toHaveCount(3)
  await expect(page.locator('.if-bullet textarea').nth(1)).toBeFocused()
})

test('简介中的回车会在预览中保留为换行', async ({ page }) => {
  await page.locator('.doc-head').click()
  const summary = page.locator('.if-area[data-f="summary"]')
  await summary.fill('第一行简介')
  await summary.press('End')
  await summary.press('Enter')
  await summary.type('第二行简介')
  await page.locator('.if-done').click()

  await expect(page.locator('.doc .summary')).toContainText(/第一行简介\s+第二行简介/)
  expect(await page.locator('.doc .summary').innerText()).toContain('第一行简介\n第二行简介')
})

test('技能与证书列表回车后会成为独立条目', async ({ page }) => {
  await page.locator('.doc [data-key="skills"]').click()
  const text = page.locator('.if-form textarea[data-k="skills"]')
  await text.fill('Windows')
  await text.press('End')
  await text.press('Enter')
  await text.type('Linux')
  await text.press('Enter')
  await text.type('TCP/IP')
  await page.locator('.if-done').click()
  await expect(page.locator('.doc [data-key="skills"] li.plain')).toHaveCount(3)
})

test('自定义段落模块的回车换行会显示在预览中', async ({ page }) => {
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await setContent(page, {
    ...base,
    meta: {
      ...base.meta,
      order: ['work', 'sec1'],
      customSections: [{
        id: 'sec1', title: '个人优势', type: 'text', entries: [], list: [], text: '原有内容'
      }]
    }
  })
  await page.locator('.doc [data-key="sec1"]').click()
  const text = page.locator('.if-form textarea[data-k="text:sec1"]')
  await text.fill('第一行优势')
  await text.press('End')
  await text.press('Enter')
  await text.type('第二行优势')
  await page.locator('.if-done').click()
  expect(await page.locator('.doc [data-key="sec1"] .desc').textContent()).toContain('第一行优势\n第二行优势')
})
