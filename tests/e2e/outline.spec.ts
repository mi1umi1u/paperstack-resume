import { test, expect } from '@playwright/test'
import { openApp, setContent, makeResume } from './helpers'

async function dragRow(page: any, fromSel: string, toSel: string) {
  return page.evaluate(([from, to]: [string, string]) => {
    const src = document.querySelector(from) as HTMLElement
    const dst = document.querySelector(to) as HTMLElement
    if (!src || !dst) return 'missing'
    const dt = new DataTransfer()
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }))
    return 'ok'
  }, [fromSel, toSel]).then(async (r: string) => {
    await page.waitForTimeout(250)
    return r
  })
}

const getResume = (page: any) => page.evaluate(() => (window as any).__ps.resume())

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await setContent(page, makeResume({ jobs: 2, bullets: 2 }))
  await page.waitForTimeout(250)
})

test('默认只显示一级模块，二级收起', async ({ page }) => {
  await expect(page.locator('[data-module="work"]')).toBeVisible()
  await expect(page.locator('[data-item]')).toHaveCount(0)
  const fs = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.row.module')!).fontSize))
  expect(fs).toBeGreaterThanOrEqual(13)
})

test('展开模块后只显示名称，不带职位和时间', async ({ page }) => {
  await page.locator('[data-module="work"] .caret').click()
  const row = page.locator('[data-item="work:0"]')
  await expect(row).toBeVisible()
  await expect(row.locator('.i-title')).toHaveText('第1家测试有限公司')
  const text = await row.innerText()
  expect(text).not.toContain('运维工程师')
  expect(text).not.toContain('2020')
})

test('项目只显示项目名，教育只显示学校，证书没有二级', async ({ page }) => {
  const base = makeResume({ jobs: 1, bullets: 1 })
  await setContent(page, {
    ...base,
    meta: {
      ...base.meta,
      order: ['projects', 'education', 'sec_cert', 'sec_text'],
      customSections: [
        { id: 'sec_cert', title: '证书', type: 'list', entries: [], list: ['CET-6'], text: '' },
        { id: 'sec_text', title: '自我评价', type: 'text', entries: [], list: [], text: '一段话' }
      ]
    }
  })
  await page.waitForTimeout(300)

  await page.locator('[data-module="projects"] .caret').click()
  await expect(page.locator('[data-item^="projects:"]').first().locator('.i-title')).toHaveText('120 家连锁门店网络改造项目')

  await page.locator('[data-module="education"] .caret').click()
  await expect(page.locator('[data-item^="education:"]').first().locator('.i-title')).toHaveText('江南信息职业技术学院')

  await page.locator('[data-module="sec_cert"] .caret').click()
  await expect(page.locator('[data-item^="sec_cert:"]')).toHaveCount(0)
  await expect(page.locator('[data-module="sec_cert"]')).toContainText('(1)')

  await page.locator('[data-module="sec_text"] .caret').click()
  await expect(page.locator('[data-item^="sec_text:"]')).toHaveCount(0)
})

test('眼睛图标：隐藏后预览消失、大纲变灰', async ({ page }) => {
  const eye = page.locator('[data-module="projects"] .eye')
  await eye.click()
  await expect(page.locator('#app .sheet .doc')).not.toContainText('项目经历')
  await expect(page.locator('[data-module="projects"]')).toHaveClass(/hidden/)
  await eye.click()
  await expect(page.locator('#app .sheet .doc')).toContainText('项目经历')
})

test('点二级条目：预览定位并原地展开', async ({ page }) => {
  await page.locator('[data-module="work"] .caret').click()
  await page.locator('[data-item="work:1"]').click()
  await page.waitForTimeout(500)
  await expect(page.locator('#app .sheet .if-form')).toBeVisible()
})

test('拖动模块：项目经历排到前面', async ({ page }) => {
  const r1 = await getResume(page)
  expect(r1.meta.order[0]).toBe('work')
  await dragRow(page, '[data-module="projects"]', '[data-module="work"]')
  const r2 = await getResume(page)
  expect(r2.meta.order[0]).toBe('projects')
})

test('工作经历拖到项目经历：字段完整映射', async ({ page }) => {
  await page.locator('[data-module="work"] .caret').click()
  await page.locator('[data-module="projects"] .caret').click()
  await page.waitForTimeout(150)

  const before = await getResume(page)
  await dragRow(page, '[data-item="work:0"]', '[data-item="projects:0"]')
  const after = await getResume(page)

  expect(after.work.length).toBe(before.work.length - 1)
  expect(after.projects.length).toBe(before.projects.length + 1)
  const moved = after.projects.find((p: any) => p.name === before.work[0].company)
  expect(moved, '公司名应变成项目名').toBeTruthy()
  expect(moved.highlights.length).toBe(before.work[0].highlights.length)
})

test('不能放的位置：拖到技能模块不生效', async ({ page }) => {
  await page.locator('[data-module="work"] .caret').click()
  const before = await getResume(page)
  await dragRow(page, '[data-item="work:0"]', '[data-module="skills"]')
  const after = await getResume(page)
  expect(after.work.length).toBe(before.work.length)
  expect(after.projects.length).toBe(before.projects.length)
})

test('拖拽后 Ctrl+Z 能撤回', async ({ page }) => {
  const before = await getResume(page)
  await dragRow(page, '[data-module="projects"]', '[data-module="work"]')
  expect((await getResume(page)).meta.order[0]).toBe('projects')
  await page.waitForTimeout(600)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(250)
  expect((await getResume(page)).meta.order[0]).toBe(before.meta.order[0])
})

test('拖动右边缘可以改宽度', async ({ page }) => {
  const before = await page.evaluate(() => document.querySelector('.outline')!.getBoundingClientRect().width)
  const box = await page.locator('.outline-resizer').boundingBox()
  await page.mouse.move(box!.x + 3, box!.y + 100)
  await page.mouse.down()
  await page.mouse.move(box!.x + 110, box!.y + 100, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(150)
  const after = await page.evaluate(() => document.querySelector('.outline')!.getBoundingClientRect().width)
  expect(after).toBeGreaterThan(before + 50)
})

test('窗口矮时大纲自己滚动，能回到顶部', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 560 })
  await setContent(page, makeResume({ jobs: 8, bullets: 3 }))
  await page.waitForTimeout(300)
  await page.locator('[data-module="work"] .caret').click()
  await page.waitForTimeout(150)

  const box = await page.evaluate(() => {
    const body = document.querySelector('.outline-body') as HTMLElement
    const scrollable = body.scrollHeight > body.clientHeight + 2
    body.scrollTop = 5000
    const bottom = body.scrollTop
    body.scrollTop = 0
    return { scrollable, bottom, top: body.scrollTop }
  })
  expect(box.scrollable).toBe(true)
  expect(box.bottom).toBeGreaterThan(100)
  expect(box.top).toBe(0)
})


test('双击模块名可以改名（技能 / 个人优势也一样）', async ({ page }) => {
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await setContent(page, {
    ...base,
    meta: {
      ...base.meta,
      order: ['skills', 'sec1'],
      customSections: [{ id: 'sec1', title: '个人优势', type: 'text', entries: [], list: [], text: '一段话' }]
    }
  })
  await page.waitForTimeout(300)

  await page.locator('[data-module="skills"] .m-title').dblclick()
  const rename = page.getByRole('dialog', { name: '修改模块名称' })
  await rename.getByLabel(/模块名称/).fill('核心技能')
  await rename.getByRole('button', { name: '确定' }).click()
  await expect(page.locator('[data-module="skills"] .m-title')).toHaveText('核心技能')

  await page.locator('[data-module="sec1"] .m-title').dblclick()
  await rename.getByLabel(/模块名称/).fill('我的优势')
  await rename.getByRole('button', { name: '确定' }).click()
  await expect(page.locator('[data-module="sec1"] .m-title')).toHaveText('我的优势')
})

test('自定义模块有删除按钮，内置模块没有', async ({ page }) => {
  const base = await page.evaluate(() => (window as any).__ps.resume())
  await setContent(page, {
    ...base,
    meta: {
      ...base.meta,
      order: ['work', 'sec1'],
      customSections: [{ id: 'sec1', title: '实习经历', type: 'entry', entries: [], list: [], text: '' }]
    }
  })
  await page.waitForTimeout(300)

  await expect(page.locator('[data-module="sec1"] .del')).toHaveCount(1)
  await expect(page.locator('[data-module="work"] .del')).toHaveCount(0)

  page.once('dialog', d => d.accept())
  await page.locator('[data-module="sec1"] .del').click({ force: true })
  await page.waitForTimeout(300)
  await expect(page.locator('[data-module="sec1"]')).toHaveCount(0)
})

test('新增模块菜单：常用模块齐全 + 自定义', async ({ page }) => {
  await page.locator('.add-module').click()
  const menu = page.locator('.add-menu')
  for (const name of ['个人优势', '工作经历', '项目经历', '教育经历', '技能', '证书', '自我评价', '自定义模块']) {
    await expect(menu).toContainText(name)
  }
})

test('新增「个人优势」会建模块并直接进入编辑', async ({ page }) => {
  await page.locator('.add-module').click()
  await page.locator('.add-menu button', { hasText: '个人优势' }).click()
  await page.waitForTimeout(500)
  const r = await page.evaluate(() => (window as any).__ps.resume())
  expect(r.meta.customSections.some((s: any) => s.title === '个人优势')).toBe(true)
})

test('新增「工作经历」不会重复建模块', async ({ page }) => {
  const before = await page.evaluate(() => (window as any).__ps.resume().meta.order.filter((k: string) => k === 'work').length)
  await page.locator('.add-module').click()
  await page.locator('.add-menu button', { hasText: '工作经历' }).click()
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => (window as any).__ps.resume().meta.order.filter((k: string) => k === 'work').length)
  expect(after).toBe(before)
})
