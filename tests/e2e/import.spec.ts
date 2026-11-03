import { test, expect } from '@playwright/test'
import { openApp } from './helpers'
import { resolve } from 'node:path'

const SAMPLE = `张三
13800001111  zhangsan@example.com  北京
工作经历
2020.07 — 2023.02  星辰科技有限公司  运维工程师
• 负责 600 台终端日常运维，月均工单 90 单
• 把高频故障整理成清单，响应时间从 40 分钟降到 15 分钟
项目经历
2022.03 — 2022.11  连锁门店网络改造
• 完成 120 家门店布线与设备调试
技能
Windows / Linux、TCP/IP、VLAN
教育背景
2016.09 — 2019.06  江南信息职业技术学院  计算机网络技术 专科
`

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await page.locator('.btn', { hasText: '导入简历' }).click()
  await expect(page.locator('.import-modal')).toBeVisible()
})

test('左右对照：左边原文、右边识别结果', async ({ page }) => {
  await page.locator('.raw').fill(SAMPLE)
  await page.locator('.pane-head .btn.tiny').click()
  await page.waitForTimeout(200)

  // 右边出现识别结果（姓名/公司是输入框）
  await expect(page.locator('.pane.right .row.edit input').first()).toHaveValue('张三')
  await expect(page.locator('.pane.right .entry-input').first()).toHaveValue('星辰科技有限公司')
  await expect(page.locator('.pane.right .entry-input:not(.small):not(.tiny)').last()).toHaveValue('江南信息职业技术学院')
  // 左边原文还在
  await expect(page.locator('.raw')).toHaveValue(SAMPLE)
})

test('识别出公司、日期、要点数量', async ({ page }) => {
  await page.locator('.raw').fill(SAMPLE)
  await page.locator('.pane-head .btn.tiny').click()
  await page.waitForTimeout(200)

  const right = page.locator('.pane.right')
  await expect(right).toContainText('工作经历')
  await expect(right).toContainText('2 条要点')
  await expect(right).toContainText('项目经历')
  await expect(page.locator('.pane.right .entry-line input').first()).toHaveValue('运维工程师')
})

test('置信度显示', async ({ page }) => {
  await page.locator('.raw').fill(SAMPLE)
  await page.locator('.pane-head .btn.tiny').click()
  await page.waitForTimeout(200)
  const score = await page.locator('.conf-score').innerText()
  expect(Number(score)).toBeGreaterThan(50)
})

test('导入为新版本：写入预览且不覆盖原版本', async ({ page }) => {
  const before = await page.evaluate(() => (window as any).__ps.resume())
  await page.locator('.raw').fill(SAMPLE)
  await page.locator('.pane-head .btn.tiny').click()
  await page.waitForTimeout(200)
  await page.locator('.btn.primary', { hasText: '导入为新版本' }).click()
  await page.waitForTimeout(400)

  const after = await page.evaluate(() => (window as any).__ps.resume())
  expect(after.basics.name).toBe('张三')
  expect(after.work.length).toBe(1)
  expect(after.work[0].company).toContain('星辰')
  // 版本数 +1
  const versions = await page.locator('.ver-select option').count()
  expect(versions).toBeGreaterThan(1)
  expect(before.basics.name).not.toBe('张三')
})


test('确认页里能直接改名字和公司，导入后生效', async ({ page }) => {
  await page.locator('.raw').fill(SAMPLE)
  await page.locator('.pane-head .btn.tiny').click()
  await page.waitForTimeout(200)

  await page.locator('.pane.right .row.edit input').first().fill('李四')
  await page.locator('.pane.right .entry-input:not(.small):not(.tiny)').first().fill('改过的公司')

  await page.locator('.btn.primary', { hasText: '导入为新版本' }).click()
  await page.waitForTimeout(400)

  const r = await page.evaluate(() => (window as any).__ps.resume())
  expect(r.basics.name).toBe('李四')
  expect(r.work[0].company).toBe('改过的公司')
})

test('确认页能改日期字段', async ({ page }) => {
  await page.locator('.raw').fill(SAMPLE)
  await page.locator('.pane-head .btn.tiny').click()
  await page.waitForTimeout(200)

  await page.getByLabel('工作开始年份').selectOption('2021')
  await page.getByLabel('工作开始月份').selectOption('05')
  await page.locator('.btn.primary', { hasText: '导入为新版本' }).click()
  await page.waitForTimeout(400)

  const r = await page.evaluate(() => (window as any).__ps.resume())
  expect(r.work[0].start).toBe('2021-05')
})

test('公开来源重建的 PDF 夹具可通过文件选择导入', async ({ page }) => {
  await page.getByRole('button', { name: '选择文件' }).click()
  await page.locator('.import-modal input[type="file"]').setInputFiles(
    resolve('tests/fixtures/resume-corpus/pdf/01-geography.pdf')
  )
  await expect(page.locator('.pane.right .row.edit input').first()).toHaveValue('林知远', { timeout: 15000 })
  await expect(page.locator('.pane.right .entry-input').first()).toHaveValue('北辰地理研究院')
  await expect(page.locator('.pane.right')).toContainText('项目经历')
})

test('公开来源重建的 DOCX 夹具可通过文件选择导入', async ({ page }) => {
  await page.getByRole('button', { name: '选择文件' }).click()
  await page.locator('.import-modal input[type="file"]').setInputFiles(
    resolve('tests/fixtures/resume-corpus/docx/06-ai.docx')
  )
  await expect(page.locator('.pane.right .row.edit input').first()).toHaveValue('唐予川', { timeout: 15000 })
  await expect(page.locator('.pane.right .entry-input').first()).toHaveValue('南岭智能技术有限公司')
  await expect(page.locator('.pane.right')).toContainText('2 条要点')
})
