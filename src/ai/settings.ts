import type { AISettings } from './types'

const SETTINGS_KEY = 'paperstack.ai.settings.v1'

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash'
}

export function normalizeAISettings(input: Partial<AISettings> | null | undefined): AISettings {
  const model = input?.model === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : 'deepseek-flash'
  return {
    enabled: input?.enabled === true,
    apiKey: typeof input?.apiKey === 'string' ? input.apiKey.trim() : '',
    baseUrl: normalizeBaseUrl(input?.baseUrl || DEFAULT_AI_SETTINGS.baseUrl),
    model
  }
}

export function normalizeBaseUrl(value: string): string {
  const clean = String(value || '').trim().replace(/\/+$/, '')
  if (!clean) return DEFAULT_AI_SETTINGS.baseUrl
  try {
    const url = new URL(clean)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_AI_SETTINGS.baseUrl
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return DEFAULT_AI_SETTINGS.baseUrl
  }
}

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? normalizeAISettings(JSON.parse(raw)) : { ...DEFAULT_AI_SETTINGS }
  } catch {
    return { ...DEFAULT_AI_SETTINGS }
  }
}

export function saveAISettings(settings: AISettings): AISettings {
  const clean = normalizeAISettings(settings)
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(clean)) } catch { /* ignore */ }
  return clean
}

export function clearAISettings(): AISettings {
  try { localStorage.removeItem(SETTINGS_KEY) } catch { /* ignore */ }
  return { ...DEFAULT_AI_SETTINGS }
}
