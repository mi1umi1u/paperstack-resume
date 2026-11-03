import { buildDeepSeekRequest } from './privacy'
import type { AISettings, AIProvider, ChatMessage, DeepSeekRequest } from './types'

export class DeepSeekProvider implements AIProvider {
  private readonly settings: AISettings

  constructor(settings: AISettings) {
    this.settings = settings
  }

  endpoint(): string {
    return new URL('chat/completions', this.settings.baseUrl.replace(/\/?$/, '/')).toString()
  }

  request(messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number } = {}): DeepSeekRequest {
    return buildDeepSeekRequest(
      this.settings.model,
      messages,
      opts.maxTokens ?? 1600,
      opts.temperature ?? 0
    )
  }

  async chat(messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number } = {}): Promise<string> {
    if (!this.settings.enabled) throw new Error('AI 功能未启用')
    if (!this.settings.apiKey.trim()) throw new Error('还没有填写 DeepSeek API Key')
    const response = await fetch(this.endpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.settings.apiKey.trim()}`
      },
      body: JSON.stringify(this.request(messages, opts))
    })

    const raw = await response.text()
    let data: any = null
    try { data = JSON.parse(raw) } catch { /* handled below */ }
    if (!response.ok) {
      const message = data?.error?.message || data?.message || `HTTP ${response.status}`
      throw new Error(`DeepSeek 请求失败：${message}`)
    }
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('DeepSeek 没有返回可读取的建议内容')
    }
    return content
  }
}
