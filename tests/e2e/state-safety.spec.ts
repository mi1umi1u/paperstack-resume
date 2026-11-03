import { test, expect } from '@playwright/test'
import { APP_URL, openApp, setContent, makeResume } from './helpers'

const FIRST_USE_URL = APP_URL.replace('&fresh=1', '')

async function createBlank(page: Parameters<typeof openApp>[0]) {
  await page.goto(FIRST_USE_URL)
  await page.getByRole('button', { name: /^从零创建/ }).click()
  await page.waitForTimeout(400)
}

async function createCopiedVersion(page: Parameters<typeof openApp>[0], name: string) {
  await page.getByTitle('新建简历').click()
  await page.getByRole('button', { name: '复制当前版本' }).click()
  const dialog = page.getByRole('dialog', { name: '新建版本' })
  await dialog.getByLabel('版本名称').fill(name)
  await dialog.getByRole('button', { name: '确定' }).click()
  await page.waitForTimeout(150)
}

test('输入框内的 Ctrl+Z 不撤销整份简历', async ({ page }) => {
  await openApp(page)
  await setContent(page, { ...makeResume({ jobs: 1, bullets: 2 }), basics: {
    ...makeResume().basics, name: '独立修改'
  } })
  await page.waitForTimeout(600)
  await page.locator('.doc [data-id] .org').first().click()
  await page.locator('.if-form input').first().press('Control+z')
  await page.waitForTimeout(200)

  expect(await page.evaluate(() => (window as any).__ps.resume().basics.name)).toBe('独立修改')
  await expect(page.locator('.if-form')).toBeVisible()
})

test('切换版本会先结束原地编辑，不把内容写进另一个版本', async ({ page }) => {
  await page.goto(FIRST_USE_URL)
  await page.getByRole('button', { name: /^从零创建/ }).click()
  await page.getByRole('button', { name: '示例', exact: true }).click()
  await page.waitForTimeout(250)
  await createCopiedVersion(page, '副本')

  const ids = await page.locator('.ver-select option').evaluateAll(options => options.map(o => (o as HTMLOptionElement).value))
  await page.locator('.ver-select').selectOption(ids[0])
  await page.locator('.doc [data-id] .org').first().click()
  await page.locator('.if-form input').first().fill('A版公司')
  await page.locator('.if-done').click()
  await page.locator('.doc [data-id] .org').first().click()
  await page.locator('.ver-select').selectOption(ids[1])
  await page.waitForTimeout(250)

  await expect(page.locator('.if-form')).toHaveCount(0)
  expect(await page.evaluate(() => (window as any).__ps.resume().work[0].company)).toBe('星澜数据科技（上海）有限公司')
})

test('编辑后立即清空数据，旧版本不会在刷新后复活', async ({ page }) => {
  await createBlank(page)
  const data = await page.evaluate(() => (window as any).__ps.resume())
  data.basics.name = '准备清空'
  await page.evaluate(d => (window as any).__ps.set(d), data)
  page.on('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '清空数据', exact: true }).click()
  await expect(page.locator('.start-screen')).toBeVisible()
  await page.reload()
  await expect(page.locator('.start-screen')).toBeVisible()
})

test('编辑后立即刷新，最新内容会落盘', async ({ page }) => {
  await createBlank(page)
  const data = await page.evaluate(() => (window as any).__ps.resume())
  data.basics.name = '立即刷新保留'
  await page.evaluate(d => (window as any).__ps.set(d), data)
  await page.reload()
  await expect(page.locator('#app .sheet')).toBeVisible()
  expect(await page.evaluate(() => (window as any).__ps.resume().basics.name)).toBe('立即刷新保留')
})

test('启动时先显示载入态，不闪出示例编辑器', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as any).__bootStates = []
    let last = ''
    setInterval(() => {
      const state = document.querySelector('.start-screen') ? 'start'
        : document.querySelector('.workspace') ? 'editor'
          : document.querySelector('.boot-screen') ? 'loading' : ''
      if (state && state !== last) {
        ;(window as any).__bootStates.push(state)
        last = state
      }
    }, 1)
  })
  await page.goto(FIRST_USE_URL)
  await expect(page.locator('.start-screen')).toBeVisible()
  const states = await page.evaluate(() => (window as any).__bootStates)
  expect(states).toContain('loading')
  expect(states).not.toContain('editor')
})

test('完整备份可以导出并恢复所有版本和快照', async ({ page }) => {
  await createBlank(page)
  const data = await page.evaluate(() => (window as any).__ps.resume())
  data.basics.name = '备份内容'
  await page.evaluate(d => (window as any).__ps.set(d), data)
  await createCopiedVersion(page, '备份副本')
  await page.getByRole('button', { name: '快照', exact: true }).click()
  await page.locator('.snapshot-modal input').fill('备份快照')
  await page.getByRole('button', { name: '保存快照' }).click()
  await page.waitForTimeout(350)
  await page.getByRole('button', { name: '关闭', exact: true }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '备份', exact: true }).click()
  await page.getByRole('button', { name: '下载全部版本与快照' }).click()
  const download = await downloadPromise
  const path = await download.path()
  expect(path).toBeTruthy()

  page.on('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '清空数据', exact: true }).click()
  await expect(page.locator('.start-screen')).toBeVisible()
  await page.getByLabel('恢复完整备份文件').setInputFiles(path!)
  await page.waitForTimeout(500)

  await expect(page.locator('.ver-select option')).toHaveCount(2)
  await expect(page.locator('.ver-select option')).toContainText(['我的简历', '备份副本'])
  await page.getByRole('button', { name: '快照', exact: true }).click()
  await expect(page.locator('.snap-item').last()).toContainText('备份快照')
})

test('浏览器禁用 localStorage 时仍能打开编辑器和结构大纲', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage disabled') }
    Storage.prototype.setItem = () => { throw new Error('storage disabled') }
  })
  await createBlank(page)
  await expect(page.locator('.outline')).toBeVisible()
  await expect(page.locator('.sheet')).toBeVisible()
})
