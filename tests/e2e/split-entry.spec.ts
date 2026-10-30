import { test, expect } from '@playwright/test'
import { openApp, setContent, makeResume } from './helpers'

const LONG = '负责核心系统迁移，' +
  '从需求梳理、方案评审到分批割接与回退预案全程跟进，' +
  '共迁移业务模块 40 余个，涉及表结构 200 多张，' +
  '在不停服窗口内完成 6 次灰度发布，' +
  '迁移后接口平均响应时间从 800 毫秒降到 240 毫秒，' +
  '并输出完整的应急预案与值班手册，' +
  '推动上线后的巡检和告警自动化，工单响应时间缩短 60%。'

test('被分页切开的条目，点击下一页片段仍编辑完整条目', async ({ page }) => {
  await openApp(page)
  const data = makeResume({ jobs: 1, bullets: 1 })
  data.work[0].highlights[0] = LONG.repeat(20)
  data.meta.order = ['work']
  await setContent(page, data, { autoFit: false })

  const sheets = page.locator('#app .sheet')
  await expect(sheets).toHaveCount(2)
  const tailLi = sheets.nth(1).locator('.item li').first()
  await tailLi.click()
  await page.waitForTimeout(400)

  await expect(page.locator('#app .sheet .if-form')).toBeVisible()
  await expect(page.locator('#app .sheet .if-form')).toContainText('公司')
  await expect(page.locator('#app .sheet .if-form input').first()).toHaveValue('第1家测试有限公司')
})
