export interface AISettings {
  enabled: boolean
  apiKey: string
  baseUrl: string
  model: 'deepseek-flash' | 'deepseek-v4-pro'
}

export type CoverageStatus = 'covered' | 'partial' | 'missing'

export interface CoverageRequirement {
  id: string
  text: string
  status: CoverageStatus
  matched: string[]
  evidence: string[]
}

export type RewriteTarget =
  | { kind: 'summary' }
  | { kind: 'work'; itemId: string; index: number }
  | { kind: 'project'; itemId: string; index: number }
  | { kind: 'skills'; index: number }
  | { kind: 'custom-entry'; sectionId: string; itemId: string; index: number }
  | { kind: 'custom-list'; sectionId: string; index: number }
  | { kind: 'custom-text'; sectionId: string }

export interface RewriteCandidate {
  id: string
  label: string
  section: string
  text: string
  target: RewriteTarget
}

export interface AISuggestion {
  id: string
  candidateId: string
  label: string
  section: string
  original: string
  suggested: string
  reason: string
  risks: string[]
  selected?: boolean
  target: RewriteTarget
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIProvider {
  chat(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string>
}

export interface DeepSeekRequest {
  model: string
  messages: ChatMessage[]
  max_tokens: number
  temperature: number
  response_format: { type: 'json_object' }
  thinking: { type: 'disabled' }
  stream: false
}
