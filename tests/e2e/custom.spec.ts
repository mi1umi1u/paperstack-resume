import { test, expect } from '@playwright/test'
import { openApp, setContent, makeResume, pages } from './helpers'

function withCertificates() {
  const data: any = makeResume({ jobs: 2, bullets: 3 })
  data.meta.customSections = [
    { id: 'sec_cert', title: '证书', type: 'list', entries: [], list: ['CET-6 / 2021', '软考中级 · 网络工程师 / 2022'], text: '' }
  ]
  data.meta.order = ['sec_cert', 'work', 'projects', 'skills', 'education']
  return data
}

test.beforeEach(async ({ page }) => {
  await openApp(page)
})

test('要点式模块：CET-6 出现在预览里', async ({ page }) => {
  await setContent(page, withCertificates())
  const doc = page.locator('#app .sheet .doc')
  await expect(doc).toContainText('证书')
  await expect(doc).toContainText('CET-6')
  await expect(doc).toContainText('软考中级')
})

test('自定义模块跟随 order 排序', async ({ page }) => {
  await setContent(page, withCertificates())
  const text = await page.locator('#app .sheet .doc').innerText()
  expect(text.indexOf('证书')).toBeLessThan(text.indexOf('工作经历'))
  expect(text.indexOf('工作经历')).toBeLessThan(text.indexOf('项目经历'))
})

test('自定义模块参与分页，不会整块溢出', async ({ page }) => {
  const data: any = withCertificates()
  // 塞满内容，让分页必须处理这个自定义模块
  for (let i = 0; i < 6; i++) {
    data.work.push({ ...data.work[0], id: 'wx' + i })
  }
  data.meta.customSections[0].list = Array.from({ length: 30 }, (_, i) => `证书 ${i + 1} · 202${i % 10}`)

  await setContent(page, data, { autoFit: true })
  const p = await pages(page)
  expect(p.length).toBeGreaterThanOrEqual(2)
  for (const pg of p) expect(pg.overflow).toBe(false)
  const text = await page.locator('#app .sheet .doc').last().innerText()
  expect(text.length).toBeGreaterThan(0)
})
