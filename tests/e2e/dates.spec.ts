import { test, expect } from '@playwright/test'
import { openApp, setContent, makeResume } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await setContent(page, makeResume({ jobs: 1, bullets: 1 }))
})

test('工作、项目和教育时间都可分别选择年份和月份', async ({ page }) => {
  await page.locator('.doc [data-key="work"] .org').first().click()
  let startYear = page.locator('.if-form select[aria-label="开始月份年份"]')
  let startMonth = page.locator('.if-form select[aria-label="开始月份月份"]')
  let endYear = page.locator('.if-form select[aria-label="结束月份年份"]')
  let endMonth = page.locator('.if-form select[aria-label="结束月份月份"]')
  await expect(startYear).toHaveValue('2020')
  await expect(startMonth).toHaveValue('01')
  await expect(page.locator('.if-form .if-month-select')).toHaveCount(2)
  await startYear.selectOption('2024')
  await startMonth.selectOption('06')
  await endYear.selectOption('2025')
  await endMonth.selectOption('05')
  await page.locator('.if-done').click()
  const work = await page.evaluate(() => (window as any).__ps.resume().work[0])
  expect([work.start, work.end]).toEqual(['2024-06', '2025-05'])
  await expect(page.locator('.doc [data-key="work"] .dates').first()).toContainText('2024.06 — 2025.05')

  await page.locator('.doc [data-key="projects"] .org').first().click()
  startYear = page.locator('.if-form select[aria-label="开始月份年份"]')
  startMonth = page.locator('.if-form select[aria-label="开始月份月份"]')
  await expect(startYear).toHaveValue('2022')
  await expect(startMonth).toHaveValue('03')
  await expect(page.locator('.if-form .if-month-select')).toHaveCount(2)
  await page.locator('.if-done').click()

  await page.locator('.doc [data-key="education"] .org').first().click()
  startYear = page.locator('.if-form select[aria-label="开始月份年份"]')
  startMonth = page.locator('.if-form select[aria-label="开始月份月份"]')
  await expect(startYear).toHaveValue('2016')
  await expect(startMonth).toHaveValue('09')
  await expect(page.locator('.if-form .if-month-select')).toHaveCount(2)
})

test('自定义条目时间也可分别选择年份和月份', async ({ page }) => {
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await setContent(page, {
    ...base,
    meta: {
      ...base.meta,
      order: ['work', 'train'],
      customSections: [{
        id: 'train',
        title: '培训经历',
        type: 'entry',
        list: [],
        text: '',
        entries: [{
          id: 't1', title: '系统运维培训', subtitle: '学员', time: '2023.07 — 2023.09',
          start: '2023-07', end: '2023-09', bullets: ['完成实验课程']
        }]
      }]
    }
  })
  await page.locator('.doc [data-key="train"] .org').click()
  await expect(page.locator('.if-form select[aria-label="开始月份年份"]')).toHaveValue('2023')
  await expect(page.locator('.if-form select[aria-label="开始月份月份"]')).toHaveValue('07')
  await expect(page.locator('.if-form select[aria-label="结束月份年份"]')).toHaveValue('2023')
  await expect(page.locator('.if-form select[aria-label="结束月份月份"]')).toHaveValue('09')
})

test('导入确认页的日期字段也可分别选择年份和月份', async ({ page }) => {
  await page.locator('.btn', { hasText: '导入简历' }).click()
  await page.locator('.raw').fill(`张三
13800001111  zhangsan@example.com  北京
工作经历
2020.07 — 2023.02  星海科技有限公司  开发工程师
• 负责终端维护
项目经历
2022.03 — 2022.11  网络改造项目  实施
• 完成门店实施
教育背景
2016.09 — 2019.06  北辰大学  计算机技术  本科`)
  await page.locator('.pane-head .btn.tiny').click()
  const dates = page.locator('.pane.right .date-selects select')
  await expect(dates).toHaveCount(12)
  await expect(page.getByLabel('工作开始年份')).toHaveValue('2020')
  await expect(page.getByLabel('工作开始月份')).toHaveValue('07')
  await expect(page.getByLabel('项目结束年份')).toHaveValue('2022')
  await expect(page.getByLabel('项目结束月份')).toHaveValue('11')
  await expect(page.getByLabel('教育开始年份')).toHaveValue('2016')
  await expect(page.getByLabel('教育开始月份')).toHaveValue('09')
  await expect(page.locator('.pane.right option').filter({ hasText: '至今' })).toHaveCount(0)
})
