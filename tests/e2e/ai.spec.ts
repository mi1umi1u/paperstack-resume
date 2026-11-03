import { test, expect } from '@playwright/test'
import { openApp, setContent, makeResume } from './helpers'

const JD = `负责 Linux 服务器日常运维
熟悉 VLAN 和 Python
熟悉 Kubernetes 集群`

test('无 AI 设置时也能在本地分析 JD 覆盖', async ({ page }) => {
  let networkCalls = 0
  await page.route('https://api.deepseek.com/**', async route => {
    networkCalls++
    await route.abort()
  })
  await openApp(page)
  await setContent(page, makeResume({ jobs: 1, bullets: 2 }))
  await page.getByRole('button', { name: 'AI 优化', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'DeepSeek JD 优化' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('岗位描述').fill(JD)
  await dialog.getByRole('button', { name: '分析覆盖' }).click()

  await expect(dialog.locator('.ai-coverage-item')).toHaveCount(3)
  await expect(dialog.locator('.ai-coverage-item').first()).toContainText('已覆盖')
  await expect(dialog.locator('.ai-coverage-item').nth(1)).toContainText('部分覆盖')
  await expect(dialog.locator('.ai-coverage-item').nth(2)).toContainText('缺少证据')
  await expect(dialog).toContainText('不会联网')
  expect(networkCalls).toBe(0)
})

test('DeepSeek 请求先展示脱敏载荷，建议逐条采用后另存新版本', async ({ page }) => {
  let capturedRequest: any = null
  await page.route('https://api.deepseek.com/chat/completions', async route => {
    capturedRequest = route.request().postDataJSON()
    const userText = capturedRequest.messages?.[1]?.content || ''
    const candidateId = userText.match(/"id":"(work:[^"]+)"/)?.[1]
    expect(candidateId).toBeTruthy()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              suggestions: [{
                candidateId,
                suggested: '负责 600 余台办公终端运维，并整理故障排查清单，缩短平均响应时间。',
                reason: '突出终端运维规模、运维流程和效率结果。'
              }]
            })
          }
        }]
      })
    })
  })

  await openApp(page)
  await setContent(page, makeResume({ jobs: 1, bullets: 2 }))
  await page.getByRole('button', { name: 'AI 优化', exact: true }).click()
  const review = page.getByRole('dialog', { name: 'DeepSeek JD 优化' })
  await review.getByRole('button', { name: '配置 DeepSeek' }).click()

  const settings = page.getByRole('dialog', { name: 'DeepSeek AI 设置' })
  await settings.getByLabel('DeepSeek API Key').fill('sk-e2e-test')
  await settings.getByLabel('DeepSeek 模型').selectOption('deepseek-flash')
  await settings.getByRole('button', { name: '已关闭' }).click()
  await settings.getByRole('button', { name: '保存设置' }).click()
  await expect(settings).toBeHidden()

  await review.getByLabel('岗位描述').fill(JD)
  await review.getByRole('button', { name: '分析覆盖' }).click()
  await review.getByRole('button', { name: '请求 DeepSeek' }).click()

  const confirm = page.getByRole('dialog', { name: '确认发送到 DeepSeek' })
  await expect(confirm).toBeVisible()
  await expect(confirm).toContainText('https://api.deepseek.com/chat/completions')
  const payload = await confirm.getByLabel('实际发送载荷').textContent()
  expect(payload).toContain('Linux')
  expect(payload).not.toContain('陈 一鸣')
  expect(payload).not.toContain('chen@example.com')
  expect(payload).not.toContain('138 0013 8000')
  expect(payload).not.toContain('sk-e2e-test')

  await confirm.getByLabel('我已核对上述实际发送内容，并同意发送到 DeepSeek。').check()
  await confirm.getByRole('button', { name: '发送并获取建议' }).click()

  await expect(review.locator('.ai-suggestion')).toHaveCount(1)
  await expect(review.locator('.ai-suggestion')).toContainText('原文')
  await expect(review.locator('.ai-suggestion')).toContainText('建议')
  expect(capturedRequest.model).toBe('deepseek-flash')
  expect(capturedRequest.response_format).toEqual({ type: 'json_object' })
  await review.locator('.ai-suggestion-check input').check()

  await review.getByLabel('AI 新版本名称').fill('DeepSeek 运维版')
  await review.getByRole('button', { name: '采用所选并另存版本' }).click()
  await expect(review).toBeHidden()

  const current = await page.evaluate(() => (window as any).__ps.resume())
  expect(current.work[0].highlights[0]).toContain('整理故障排查清单')
  await expect(page.locator('.ver-select option')).toHaveCount(2)
  await expect(page.locator('.ver-select')).toContainText('DeepSeek 运维版')

  const originalOption = await page.locator('.ver-select option').filter({ hasText: '原版本' }).getAttribute('value')
  await page.locator('.ver-select').selectOption(originalOption!)
  await page.waitForTimeout(150)
  const original = await page.evaluate(() => (window as any).__ps.resume())
  expect(original.work[0].highlights[0]).toContain('负责第 1 项工作')
})
