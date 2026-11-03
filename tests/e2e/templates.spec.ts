import { test, expect } from '@playwright/test'
import { openApp, setContent, makeResume, stats } from './helpers'

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
  'base64'
)

async function applyFromGallery(page: Parameters<typeof openApp>[0], id: string) {
  await page.getByRole('button', { name: '设计', exact: true }).click()
  await page.locator(`.tpl-card[data-template="${id}"]`).click()
  await page.getByRole('button', { name: '应用此模板' }).click()
  await page.waitForTimeout(120)
}

test('Classic EN 应用英文标题和日期格式', async ({ page }) => {
  await openApp(page)
  await setContent(page, makeResume({ jobs: 1, bullets: 2 }))
  await applyFromGallery(page, 'en')

  const resume = await page.evaluate(() => (window as any).__ps.resume())
  expect(resume.meta.lang).toBe('en')
  await expect(page.locator('#app .sheet-wrap .doc-en')).toBeVisible()
  await expect(page.locator('#app .sheet-wrap .sec-title').first()).toHaveText(/work experience/i)
  await expect(page.locator('#app .sheet-wrap .dates').first()).toContainText('Jan 2020')
})

test('证件照可上传、拖动裁剪、压缩并渲染到“照”模板', async ({ page }) => {
  await openApp(page)
  await setContent(page, makeResume({ jobs: 1, bullets: 2 }))
  await page.getByRole('button', { name: '设计', exact: true }).click()

  await page.getByLabel('选择证件照').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: PNG_1PX
  })
  const dialog = page.getByRole('dialog', { name: '裁剪证件照' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: '保存照片' })).toBeEnabled()
  await dialog.getByRole('button', { name: '保存照片' }).click()

  const resume = await page.evaluate(() => (window as any).__ps.resume())
  expect(resume.basics.image).toMatch(/^data:image\/jpeg;base64,/)

  await applyFromGallery(page, 'zhao')
  await expect(page.locator('#app .sheet-wrap .doc-zhao img[data-role="profile-photo"]')).toBeVisible()
})

test('双栏模板只把侧栏放在第一页，主栏内容继续正常分页', async ({ page }) => {
  await openApp(page)
  const data = makeResume({ jobs: 5, bullets: 4 })
  data.skills = ['Windows 运维', 'Linux 排障', 'TCP/IP', 'MySQL', '综合布线', 'UOS 部署']
  await setContent(page, data)
  await applyFromGallery(page, 'lan')

  expect(await page.evaluate(() => (window as any).__ps.resume().meta.template)).toBe('lan')
  await expect(page.locator('#app .sheet-wrap')).toContainText('工作经历')
  expect((await stats(page)).pages).toBeGreaterThan(1)
  await expect(page.locator('#app .sheet-wrap .doc-side')).toHaveCount(1)
  await expect(page.locator('#app .sheet-wrap .sheet').first().locator('.doc-main')).toContainText('工作经历')
  await expect(page.locator('#app .sheet-wrap .sheet').nth(1).locator('.doc-main')).toBeVisible()

  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#app .sheet-wrap .sheet')).map(sheet => {
      const main = sheet.querySelector('.doc-main') as HTMLElement
      return main.scrollHeight > main.clientHeight + 1
    })
  )
  expect(overflow.every(Boolean)).toBe(false)
})

test('10 套模板都能渲染，并且“栏·浅”保持浅色侧栏', async ({ page }) => {
  await openApp(page)
  const data = makeResume({ jobs: 2, bullets: 2 })
  const ids = ['su', 'yin', 'mi', 'xian', 'zhou', 'zhao', 'kuai', 'lan', 'lanq', 'en']

  for (const id of ids) {
    await setContent(page, { ...data, meta: { ...data.meta, template: id, lang: id === 'en' ? 'en' : 'zh' } })
    await expect(page.locator(`#app .sheet-wrap .doc-${id}`).first()).toBeVisible()
    expect((await stats(page)).pages).toBeGreaterThanOrEqual(1)
  }

  await setContent(page, { ...data, meta: { ...data.meta, template: 'lanq', lang: 'zh' } })
  await expect(page.locator('#app .sheet-wrap .doc-lanq .doc-side')).toBeVisible()
  const background = await page.locator('#app .sheet-wrap .doc-lanq .doc-side').evaluate(el => getComputedStyle(el).backgroundColor)
  expect(background).toBe('rgb(233, 232, 228)')
})

test('双栏侧栏放不下时明确提示，不静默裁掉内容', async ({ page }) => {
  await openApp(page)
  const data = makeResume({ jobs: 1, bullets: 1 })
  data.skills = Array.from({ length: 80 }, (_, i) => `第 ${i + 1} 项需要精简的专业技能`)
  await setContent(page, { ...data, meta: { ...data.meta, template: 'lan', lang: 'zh' } })
  await page.getByRole('button', { name: '设计', exact: true }).click()

  await expect(page.locator('.fit-warning')).toContainText('侧栏内容超出第一页')
})

test('打印模式保留双栏底色，并隐藏无照片占位框', async ({ page }) => {
  await openApp(page)
  const data = makeResume({ jobs: 1, bullets: 1 })
  await setContent(page, { ...data, meta: { ...data.meta, template: 'lan', lang: 'zh' } })
  await page.emulateMedia({ media: 'print' })

  const print = await page.locator('#app .sheet').first().evaluate(sheet => ({
    colorAdjust: getComputedStyle(sheet).printColorAdjust,
    placeholder: getComputedStyle(sheet.querySelector('.photo-empty') as HTMLElement).display
  }))
  expect(print.colorAdjust).toBe('exact')
  expect(print.placeholder).toBe('none')
})
