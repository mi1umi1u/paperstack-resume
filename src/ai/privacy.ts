import type { Resume } from '../core/model'
import type { CoverageRequirement, DeepSeekRequest, RewriteCandidate } from './types'

export interface PayloadOptions {
  includeOrganizations?: boolean
}

export interface RedactedResumePayload {
  text: string
  candidates: Array<Pick<RewriteCandidate, 'id' | 'section' | 'label' | 'text'>>
}

/** 构造真正会发送的简历载荷。姓名、电话、邮箱、地址和照片永远不进入载荷。 */
export function buildRedactedResume(
  resume: Resume,
  candidates: RewriteCandidate[],
  coverage: CoverageRequirement[],
  options: PayloadOptions = {}
): RedactedResumePayload {
  const includeOrganizations = options.includeOrganizations !== false
  const directRedactions = [
    { text: resume.basics.name, replacement: '[姓名]' },
    { text: resume.basics.phone, replacement: '[电话]' },
    { text: resume.basics.email, replacement: '[邮箱]' },
    { text: resume.basics.city, replacement: '[城市]' }
  ].filter(item => item.text).sort((a, b) => b.text.length - a.text.length)
  const organizationRedactions = [
    ...resume.work.map(w => w.company).filter(Boolean).map(text => ({ text, replacement: '[公司]' })),
    ...resume.projects.map(p => p.name).filter(Boolean).map(text => ({ text, replacement: '[项目]' }))
  ].sort((a, b) => b.text.length - a.text.length)
  const replace = (value: string, items: typeof directRedactions) => items.reduce((text, item) =>
    text.split(item.text).join(item.replacement), value)
  const redactDirect = (value: string) => replace(value, directRedactions)
  const redactAll = (value: string) => replace(redactDirect(value), organizationRedactions)
  const workContext = includeOrganizations
    ? resume.work.map((w, i) => ({
      company: redactDirect(w.company),
      role: redactDirect(w.role),
      dates: [w.start, w.end].filter(Boolean).join(' — '),
      order: i + 1
    }))
    : []
  const projectContext = includeOrganizations
    ? resume.projects.map((p, i) => ({ name: redactDirect(p.name), role: redactDirect(p.role), order: i + 1 }))
    : []

  return {
    text: JSON.stringify({
      resume: {
        summary: includeOrganizations ? redactDirect(resume.basics.summary) : redactAll(resume.basics.summary),
        workContext,
        projectContext,
        candidates: candidates.map(c => ({
          id: c.id,
          section: c.section,
          label: includeOrganizations ? redactDirect(c.label) : redactAll(c.label),
          text: includeOrganizations ? redactDirect(c.text) : redactAll(c.text)
        }))
      },
      jdCoverage: coverage.map(c => ({
        requirement: c.text,
        status: c.status,
        matchedTerms: c.matched
      }))
    }),
    candidates
  }
}

export function buildDeepSeekMessages(payload: string): DeepSeekRequest['messages'] {
  return [
    {
      role: 'system',
      content:
        '你是严谨的中文简历改写助手。只能改写用户提供的 candidates 中已有事实的表述，不得新增候选人没有做过的职责、技术、项目、公司、职位、日期或数字。' +
        '输出必须是 JSON 对象，格式为 {"suggestions":[{"candidateId":"原样返回候选 id","suggested":"修改后的完整文本","reason":"为什么这样改"}]}。' +
        '如果某个候选没有能够在不改变事实的前提下改进，就不要返回它。不要输出 Markdown，不要输出 JSON 以外的内容。'
    },
    {
      role: 'user',
      content: `请根据 JD 覆盖结果优化候选文本。尤其关注 partial 和 missing，但绝不编造经历。\n${payload}`
    }
  ]
}

export function buildDeepSeekRequest(
  model: string,
  messages: DeepSeekRequest['messages'],
  maxTokens = 1600,
  temperature = 0
): DeepSeekRequest {
  return {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    response_format: { type: 'json_object' },
    thinking: { type: 'disabled' },
    stream: false
  }
}
