import { afterEach, describe, expect, it, vi } from 'vitest'
import { sampleResume } from '../src/core/model'
import { DeepSeekProvider } from '../src/ai/deepseek'
import { analyzeJDCoverage, applySelectedSuggestions, buildRewriteCandidates, parseAISuggestions } from '../src/ai/jdCoverage'
import { buildDeepSeekMessages, buildRedactedResume } from '../src/ai/privacy'
import { normalizeAISettings } from '../src/ai/settings'

afterEach(() => vi.unstubAllGlobals())

describe('DeepSeek 设置与请求', () => {
  it('默认关闭并使用 DeepSeek 官方地址', () => {
    const settings = normalizeAISettings({})
    expect(settings.enabled).toBe(false)
    expect(settings.baseUrl).toBe('https://api.deepseek.com')
    expect(settings.model).toBe('deepseek-flash')
  })

  it('请求使用 DeepSeek 路径、Bearer Key 和 JSON Output', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"suggestions":[]}' } }]
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new DeepSeekProvider({
      enabled: true,
      apiKey: 'sk-local-test',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-flash'
    })
    const content = await provider.chat([{ role: 'user', content: 'test' }])
    expect(content).toBe('{"suggestions":[]}')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer sk-local-test')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('deepseek-flash')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.stream).toBe(false)
  })

  it('DeepSeek 错误响应转成可读错误，不泄露 Key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'Insufficient Balance' }
    }), { status: 402, headers: { 'content-type': 'application/json' } })))
    const provider = new DeepSeekProvider({
      enabled: true,
      apiKey: 'sk-secret-never-print',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-flash'
    })
    await expect(provider.chat([{ role: 'user', content: 'test' }]))
      .rejects.toThrow('DeepSeek 请求失败：Insufficient Balance')
    try {
      await provider.chat([{ role: 'user', content: 'test' }])
    } catch (error: any) {
      expect(error.message).not.toContain('sk-secret-never-print')
    }
  })
})

describe('本地 JD 覆盖分析', () => {
  const jd = `负责 Linux 服务器日常运维
熟悉 VLAN 和 Python
要求掌握 Python 与 TensorFlow
熟悉 Kubernetes 集群`

  it('区分已覆盖、部分覆盖和缺少证据', () => {
    const result = analyzeJDCoverage(sampleResume(), jd)
    expect(result).toHaveLength(4)
    expect(result[0].status).toBe('covered')
    expect(result[1].status).toBe('partial')
    expect(result[2].status).toBe('missing')
    expect(result[3].status).toBe('missing')
    expect(result[0].evidence.length).toBeGreaterThan(0)
  })

  it('覆盖率只依据简历证据，不调用模型', () => {
    const result = analyzeJDCoverage(sampleResume(), '负责 Linux 运维')
    expect(result[0].matched).toContain('Linux')
    expect(result[0].evidence.some(x => x.includes('Linux') || x.includes('运维'))).toBe(true)
  })
})

describe('脱敏与建议审阅', () => {
  it('发送载荷不包含姓名、电话、邮箱、城市或照片', () => {
    const resume = sampleResume()
    resume.basics.image = 'data:image/jpeg;base64,AAAA'
    resume.basics.summary += ` 联系方式 ${resume.basics.name} ${resume.basics.phone} ${resume.basics.email} ${resume.basics.city}`
    const candidates = buildRewriteCandidates(resume)
    const coverage = analyzeJDCoverage(resume, '负责 Linux 运维')
    const payload = buildRedactedResume(resume, candidates, coverage, { includeOrganizations: true })
    expect(payload.text).not.toContain(resume.basics.name)
    expect(payload.text).not.toContain(resume.basics.phone)
    expect(payload.text).not.toContain(resume.basics.email)
    expect(payload.text).not.toContain(resume.basics.city)
    expect(payload.text).not.toContain('data:image')
    expect(payload.text).toContain('星澜数据科技')
  })

  it('关闭公司名后不在载荷中出现公司或项目名', () => {
    const resume = sampleResume()
    const candidates = buildRewriteCandidates(resume)
    const coverage = analyzeJDCoverage(resume, '负责 Linux 运维')
    const payload = buildRedactedResume(resume, candidates, coverage, { includeOrganizations: false })
    expect(payload.text).not.toContain('星澜数据科技')
    expect(payload.text).not.toContain('120 家连锁门店网络改造项目')
  })

  it('只接受真实候选，不采用新增数字或未知 id', () => {
    const resume = sampleResume()
    const candidates = buildRewriteCandidates(resume)
    const target = candidates.find(c => c.id.startsWith('work:'))!
    const raw = JSON.stringify({
      suggestions: [
        { candidateId: target.id, suggested: '负责 900 台终端运维，工单响应缩短到 5 分钟。', reason: '对应 JD' },
        { candidateId: 'invented-id', suggested: '编造的经历', reason: '无效' }
      ]
    })
    const suggestions = parseAISuggestions(raw, candidates)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].original).toBe(target.text)
    expect(suggestions[0].risks.some(x => x.includes('新增'))).toBe(true)
  })

  it('采用建议会生成独立简历，原简历不变', () => {
    const resume = sampleResume()
    const candidate = buildRewriteCandidates(resume).find(c => c.id.startsWith('work:'))!
    const suggestion = parseAISuggestions(JSON.stringify({
      suggestions: [{ candidateId: candidate.id, suggested: '负责终端运维并完善故障排查清单。', reason: '更简洁' }]
    }), [candidate])[0]
    const changed = applySelectedSuggestions(resume, [{ ...suggestion, selected: false }])
    expect(changed.work[0].highlights[0]).toBe(resume.work[0].highlights[0])

    const applied = applySelectedSuggestions(resume, [{ ...suggestion, selected: true }])
    expect(applied.work[0].highlights[0]).toBe('负责终端运维并完善故障排查清单。')
    expect(resume.work[0].highlights[0]).toContain('600')
  })

  it('系统提示明确禁止新增事实并强制 JSON 输出', () => {
    const messages = buildDeepSeekMessages('{}')
    expect(messages[0].content).toContain('不得新增')
    expect(messages[0].content).toContain('JSON')
  })
})
