import { test, expect } from '@playwright/test'
import { openApp, setContent, stats, pages, makeResume, APP_URL } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
})

test('1. 一页内容：不压缩，字号 14px、行高 1.66', async ({ page }) => {
  await setContent(page, makeResume({ jobs: 2, bullets: 3 }), { autoFit: true })
  const st = await stats(page)
  const p = await pages(page)
  expect(st.pages).toBe(1)
  expect(st.compressed).toBe(false)
  expect(p[0].font).toBeCloseTo(14, 0)
  expect(p[0].lh).toBeCloseTo(1.66, 1)
})

test('2. 只超几行：压回一页，字号不低于 13.5、行高不低于 1.45', async ({ page }) => {
  // 找到"刚好超出一页"的那一档
  let target = null as any
  for (let extra = 1; extra <= 24; extra++) {
    const data = makeResume({ jobs: 2, bullets: 3, extraBullets: extra })
    await setContent(page, data, { autoFit: false })
    const st = await stats(page)
    if (st.pages === 2) { target = data; break }
  }
  expect(target, '应能构造出只多出一点点的内容').not.toBeNull()

  await setContent(page, target, { autoFit: true })
  const st = await stats(page)
  const p = await pages(page)
  expect(st.pages).toBe(1)
  expect(st.compressed).toBe(true)
  expect(p[0].font).toBeGreaterThanOrEqual(13.5)
  expect(p[0].lh).toBeGreaterThanOrEqual(1.45)
})

test('3. 超出很多：拆成多页，且恢复默认样式', async ({ page }) => {
  await setContent(page, makeResume({ jobs: 7, bullets: 5 }), { autoFit: true })
  const st = await stats(page)
  const p = await pages(page)
  expect(st.pages).toBeGreaterThanOrEqual(2)
  expect(st.compressed).toBe(false)
  for (const pg of p) {
    expect(pg.font).toBeCloseTo(14, 0)
    expect(pg.lh).toBeCloseTo(1.66, 1)
  }
})

test('4. 页底不出现孤立的模块标题或公司名', async ({ page }) => {
  await setContent(page, makeResume({ jobs: 7, bullets: 5 }), { autoFit: true })
  const p = await pages(page)
  const nonLast = p.slice(0, -1)
  for (const pg of nonLast) {
    if (pg.lastTag === 'SECTION') {
      expect(pg.lastHasItem, '页底板块必须有公司/项目条目').toBe(true)
      expect(pg.lastItemHasBullet, '页底板块的条目必须带至少一条要点').toBe(true)
    }
  }
})

test('5. 被切开的长段落：下一页开头至少 2 行', async ({ page }) => {
  await setContent(page, makeResume({ jobs: 7, bullets: 5 }), { autoFit: true })
  const p = await pages(page)
  for (const pg of p.slice(1)) {
    if (!pg.firstItemHasHead) {
      expect(pg.firstLiLines, '续页的第一条要点至少 2 行').toBeGreaterThanOrEqual(2)
    }
  }
})

test('6. 非末页底部留白不超过内容高度的 10%', async ({ page }) => {
  await setContent(page, makeResume({ jobs: 7, bullets: 5 }), { autoFit: true })
  const p = await pages(page)
  expect(p.length).toBeGreaterThanOrEqual(2)
  for (const pg of p.slice(0, -1)) {
    expect(pg.gapPct).toBeLessThanOrEqual(0.105)
  }
})

test('7. 撑开不超过 8 / 20 / 24px，且字号行高不变', async ({ page }) => {
  await setContent(page, makeResume({ jobs: 7, bullets: 5 }), { autoFit: true })
  const p = await pages(page)
  for (const pg of p.slice(0, -1)) {
    expect(pg.exLi).toBeLessThanOrEqual(8.01)
    expect(pg.exItem).toBeLessThanOrEqual(20.01)
    expect(pg.exSec).toBeLessThanOrEqual(24.01)
    expect(pg.font).toBeCloseTo(14, 0)
  }
})

test('8. 反复修改后样式不累积缩水', async ({ page }) => {
  const small = makeResume({ jobs: 2, bullets: 3 })
  const big = makeResume({ jobs: 7, bullets: 5 })

  await setContent(page, small, { autoFit: true })
  expect((await stats(page)).pages).toBe(1)

  await setContent(page, big, { autoFit: true })
  expect((await stats(page)).pages).toBeGreaterThanOrEqual(2)

  await setContent(page, small, { autoFit: true })
  const st = await stats(page)
  const p = await pages(page)
  expect(st.pages).toBe(1)
  expect(p[0].font).toBeCloseTo(14, 0)
  expect(p[0].lh).toBeCloseTo(1.66, 1)
})

test('9. 导出 PDF 的页数与预览一致', async ({ page }) => {
  await setContent(page, makeResume({ jobs: 5, bullets: 4 }), { autoFit: true })
  const st = await stats(page)
  expect(st.pages).toBeGreaterThanOrEqual(2)

  const pdf = await page.pdf({ format: 'A4', printBackground: true })
  const text = pdf.toString('latin1')
  const count = (text.match(/\/Type\s*\/Page(?!s)/g) || []).length
  expect(count).toBe(st.pages)
})

test('10. 关闭 AI 时零网络请求', async ({ page }) => {
  const external: string[] = []
  page.on('request', r => {
    const u = r.url()
    if (!u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u)
  })
  await page.goto(APP_URL)
  await page.waitForSelector('#app .sheet')
  await setContent(page, makeResume({ jobs: 2, bullets: 3 }))
  expect(external, `不应有外部请求：${external.join(', ')}`).toEqual([])
})

test('11. file:// 双击打开即可用', async ({ page }) => {
  const box = await page.locator('#app .sheet').first().boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBeGreaterThan(800)
  await expect(page.locator('#app .sheet .doc')).toHaveCount(1)
})

test('12. 每一页的样式完全一致', async ({ page }) => {
  await setContent(page, makeResume({ jobs: 7, bullets: 5 }), { autoFit: true })
  const p = await pages(page)
  expect(p.length).toBeGreaterThanOrEqual(2)
  const fonts = new Set(p.map(x => x.font.toFixed(2)))
  const lhs = new Set(p.map(x => x.lh.toFixed(2)))
  expect(fonts.size, '所有页字号一致').toBe(1)
  expect(lhs.size, '所有页行高一致').toBe(1)
})
