import { test, expect } from '@playwright/test'
import { openApp, setContent, makeResume } from './helpers'

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await setContent(page, makeResume({ jobs: 2, bullets: 2 }))
  await page.waitForTimeout(200)
})

test('界面上没有独立编辑表单，也没有浮层', async ({ page }) => {
  await expect(page.locator('.outline')).toBeVisible()
  await expect(page.locator('.stage')).toBeVisible()
  await expect(page.locator('.editor')).toHaveCount(0)
  await expect(page.locator('.pop')).toHaveCount(0)
})

test('点公司名：在纸张里原地展开表单', async ({ page }) => {
  await page.locator('#app .sheet [data-id] .org').first().click()
  await expect(page.locator('#app .sheet .if-form')).toBeVisible()
  await expect(page.locator('#app .sheet .if-form')).toContainText('公司')
  await expect(page.locator('#app .sheet .if-form input').first()).toHaveValue('第1家测试有限公司')
})

test('改公司名点完成：重新排版，内容已更新', async ({ page }) => {
  await page.locator('#app .sheet [data-id] .org').first().click()
  await page.locator('#app .sheet .if-form input').first().fill('改过的公司名')
  await page.locator('.if-done').click()
  await page.waitForTimeout(300)
  await expect(page.locator('.if-form')).toHaveCount(0)
  await expect(page.locator('#app .sheet .doc')).toContainText('改过的公司名')
})

test('Esc 关闭原地编辑，内容已保存', async ({ page }) => {
  await page.locator('#app .sheet [data-id] .org').first().click()
  await page.locator('#app .sheet .if-form input').first().fill('Esc 之后还在')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await expect(page.locator('.if-form')).toHaveCount(0)
  await expect(page.locator('#app .sheet .doc')).toContainText('Esc 之后还在')
})

test('点要点：原地只展开这一条的编辑框', async ({ page }) => {
  await page.locator('#app .sheet li[data-bi]').first().click()
  await expect(page.locator('#app .sheet .if-form textarea')).toHaveCount(1)
  await page.locator('#app .sheet .if-form textarea').fill('重写后的第一条要点')
  await page.locator('.if-done').click()
  await page.waitForTimeout(300)
  await expect(page.locator('#app .sheet .doc')).toContainText('重写后的第一条要点')
})

test('点姓名：原地展开基本信息', async ({ page }) => {
  await page.locator('#app .sheet .name').click()
  await expect(page.locator('#app .sheet .if-form')).toContainText('一句话简介')
  await page.locator('#app .sheet .if-form input').first().fill('张三')
  await page.locator('.if-done').click()
  await page.waitForTimeout(300)
  await expect(page.locator('#app .sheet .name')).toHaveText('张三')
})

test('原地加一条要点', async ({ page }) => {
  await page.locator('#app .sheet [data-id] .org').first().click()
  const before = await page.locator('#app .sheet .if-bullet').count()
  await page.locator('.if-add').click()
  await page.waitForTimeout(150)
  await expect(page.locator('#app .sheet .if-bullet')).toHaveCount(before + 1)
})

test('点大纲一行：预览定位并原地展开', async ({ page }) => {
  await page.locator('[data-module="work"] .caret').click()
  await page.locator('[data-item="work:1"]').click()
  await page.waitForTimeout(500)
  await expect(page.locator('#app .sheet .if-form')).toBeVisible()
})

test('新增模块：先让用户起名，再填内容', async ({ page }) => {
  await page.locator('.add-module').click()
  await page.locator('.add-menu button', { hasText: '证书' }).click()
  await page.waitForTimeout(500)
  // 新模块打开的是改名表单
  await expect(page.locator('#app .sheet .if-form input').first()).toHaveValue('证书')
  await page.locator('.if-done').click()
  await page.waitForTimeout(300)
  await expect(page.locator('#app .sheet .doc')).toContainText('证书')
})


test('证书这类要点式模块：点模块行也能编辑', async ({ page }) => {
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await setContent(page, {
    ...base,
    meta: {
      ...base.meta,
      order: ['work', 'sec_cert'],
      customSections: [{ id: 'sec_cert', title: '证书', type: 'list', entries: [], list: ['CET-6 / 2021'], text: '' }]
    }
  })
  await page.waitForTimeout(300)
  await page.locator('[data-module="sec_cert"]').click()
  await page.waitForTimeout(400)
  await expect(page.locator('#app .sheet .if-form')).toBeVisible()
  await expect(page.locator('#app .sheet .if-form textarea')).toHaveValue('CET-6 / 2021')
})

test('自我评价这类段落式模块：点模块行能编辑正文', async ({ page }) => {
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await setContent(page, {
    ...base,
    meta: {
      ...base.meta,
      order: ['work', 'sec_text'],
      customSections: [{ id: 'sec_text', title: '自我评价', type: 'text', entries: [], list: [], text: '一段评价' }]
    }
  })
  await page.waitForTimeout(300)
  await page.locator('[data-module="sec_text"]').click()
  await page.waitForTimeout(400)
  await expect(page.locator('#app .sheet .if-form textarea')).toHaveValue('一段评价')
})


test('空模块也渲染，点一下就能加第一条', async ({ page }) => {
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await setContent(page, {
    ...base,
    work: [],
    projects: [],
    education: [],
    skills: [],
    meta: { ...base.meta, order: ['work', 'education', 'skills', 'projects'] }
  })
  await page.waitForTimeout(300)

  // 四个空模块都出现在预览里
  for (const key of ['work', 'education', 'skills', 'projects']) {
    await expect(page.locator(`#app .sheet [data-key="${key}"]`)).toHaveCount(1)
  }

  // 点空的「教育背景」→ 自动建一条并展开表单
  await page.locator('#app .sheet [data-key="education"]').click()
  await page.waitForTimeout(400)
  await expect(page.locator('#app .sheet .if-form')).toBeVisible()
  const after = await page.evaluate(() => (window as any).__ps.resume())
  expect(after.education.length).toBe(1)
})

test('空的工作经历点开后可以填写并出现在预览', async ({ page }) => {
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await setContent(page, { ...base, work: [], meta: { ...base.meta, order: ['work'] } })
  await page.waitForTimeout(300)

  await page.locator('#app .sheet [data-key="work"]').click()
  await page.waitForTimeout(400)
  await page.locator('#app .sheet .if-form input').first().fill('新公司')
  await page.locator('.if-done').click()
  await page.waitForTimeout(300)
  await expect(page.locator('#app .sheet .doc')).toContainText('新公司')
})


test('大纲里点模块：直接打开内容编辑，不是只改标题', async ({ page }) => {
  await page.locator('[data-module="work"] .m-title').dispatchEvent('click')
  await page.waitForTimeout(700)
  const form = page.locator('#app .sheet .if-form')
  await expect(form).toBeVisible()
  await expect(form).toContainText('公司')
  await expect(form.locator('input').first()).toHaveValue('第1家测试有限公司')
})

test('点模块标题：能改名，也能加一条内容', async ({ page }) => {
  await page.locator('#app .sheet [data-key="work"] .sec-title').click()
  await page.waitForTimeout(400)
  await expect(page.locator('#app .sheet .if-form')).toContainText('模块标题')
  const before = await page.evaluate(() => (window as any).__ps.resume().work.length)
  await page.locator('.if-add').click()
  await page.waitForTimeout(400)
  await expect(page.locator('#app .sheet .if-form')).toContainText('公司')
  const after = await page.evaluate(() => (window as any).__ps.resume().work.length)
  expect(after).toBe(before + 1)
})


test('自定义条目式模块（实习经历）能改内容', async ({ page }) => {
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await setContent(page, {
    ...base,
    meta: {
      ...base.meta,
      order: ['work', 'sec_intern'],
      customSections: [{
        id: 'sec_intern', title: '实习经历', type: 'entry',
        entries: [{ id: 'en1', title: '某某公司', subtitle: '实习生', time: '2023.07', bullets: ['打过杂'] }],
        list: [], text: ''
      }]
    }
  })
  await page.waitForTimeout(300)

  await page.locator('[data-module="sec_intern"]').dispatchEvent('click')
  await page.waitForTimeout(600)
  await expect(page.locator('#app .sheet .if-form')).toBeVisible()
  await expect(page.locator('#app .sheet .if-form input').first()).toHaveValue('某某公司')

  await page.locator('#app .sheet .if-form input').first().fill('改过的公司')
  await page.locator('.if-done').click()
  await page.waitForTimeout(300)
  await expect(page.locator('#app .sheet .doc')).toContainText('改过的公司')
})
