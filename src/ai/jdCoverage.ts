import type { Resume } from '../core/model'
import type {
  AISuggestion,
  CoverageRequirement,
  RewriteCandidate,
  RewriteTarget
} from './types'

interface TermDef {
  label: string
  aliases: string[]
}

const TERMS: TermDef[] = [
  { label: 'Windows', aliases: ['windows'] },
  { label: 'Linux', aliases: ['linux', 'ubuntu', 'centos'] },
  { label: 'UOS', aliases: ['统信', 'uos'] },
  { label: 'TCP/IP', aliases: ['tcp/ip', 'tcp', 'ip 地址', 'ip地址'] },
  { label: 'VLAN', aliases: ['vlan'] },
  { label: 'DNS', aliases: ['dns'] },
  { label: 'MySQL', aliases: ['mysql'] },
  { label: 'Python', aliases: ['python'] },
  { label: 'Shell', aliases: ['shell', 'bash'] },
  { label: 'Docker', aliases: ['docker', '容器'] },
  { label: 'Kubernetes', aliases: ['kubernetes', 'k8s'] },
  { label: '监控', aliases: ['监控', 'zabbix', 'prometheus', 'grafana'] },
  { label: '自动化', aliases: ['自动化', '脚本'] },
  { label: '网络', aliases: ['网络', '交换机', '路由器', 'ap ', '布线'] },
  { label: '故障排查', aliases: ['故障', '排障', '排查', '工单'] },
  { label: '系统部署', aliases: ['部署', '装机', '系统安装'] },
  { label: '权限管理', aliases: ['权限', '账号'] },
  { label: '项目实施', aliases: ['实施', '上线', '交付', '验收'] },
  { label: '客户支持', aliases: ['客户', '客服', '客户服务'] },
  { label: '文档', aliases: ['文档', '手册', '清单'] }
]

const norm = (value: string) => String(value || '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()

function aliasesFor(term: TermDef): string[] {
  return term.aliases.map(norm).filter(Boolean)
}

function resumeFragments(resume: Resume): Array<{ text: string; where: string }> {
  const out: Array<{ text: string; where: string }> = []
  if (resume.basics.summary) out.push({ text: resume.basics.summary, where: '个人简介' })
  resume.work.forEach(w => {
    w.highlights.forEach((text, i) => {
      if (text) out.push({ text, where: `${w.company || '工作经历'} · 要点 ${i + 1}` })
    })
  })
  resume.projects.forEach(p => {
    p.highlights.forEach((text, i) => {
      if (text) out.push({ text, where: `${p.name || '项目经历'} · 要点 ${i + 1}` })
    })
  })
  resume.skills.forEach((text, i) => {
    if (text) out.push({ text, where: `技能 ${i + 1}` })
  })
  resume.meta.customSections.forEach(sec => {
    if (sec.text) out.push({ text: sec.text, where: sec.title })
    sec.list.forEach((text, i) => {
      if (text) out.push({ text, where: `${sec.title} ${i + 1}` })
    })
    sec.entries.forEach(en => {
      en.bullets.forEach((text, i) => {
        if (text) out.push({ text, where: `${en.title || sec.title} · 要点 ${i + 1}` })
      })
    })
  })
  return out
}

function extractRequirements(jd: string): string[] {
  const lines = String(jd || '')
    .split(/\r?\n/)
    .map(line => line.replace(/^[\s>*#\-•·\d.、)）]+/, '').trim())
    .filter(Boolean)

  const candidates = lines.length >= 2
    ? lines.flatMap(line => line.length > 90 ? line.split(/[；;。]/) : [line])
    : String(jd || '').split(/[；;。\n]/)

  const headings = /^(岗位职责|工作职责|任职要求|岗位要求|加分项|我们希望你|职位描述)[:：]?$/i
  const seen = new Set<string>()
  return candidates
    .map(line => line.trim())
    .filter(line => line.length >= 2 && line.length <= 220 && !headings.test(line))
    .filter(line => {
      const key = norm(line)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 20)
}

export function analyzeJDCoverage(resume: Resume, jd: string): CoverageRequirement[] {
  const fragments = resumeFragments(resume)
  const resumeText = norm(fragments.map(f => f.text).join('\n'))

  return extractRequirements(jd).map((text, index) => {
    const line = norm(text)
    const terms = TERMS.filter(term => aliasesFor(term).some(a => line.includes(a)))
    const matched = terms.filter(term => aliasesFor(term).some(a => resumeText.includes(a))).map(t => t.label)
    const matchedTerms = terms.filter(term => aliasesFor(term).some(a => resumeText.includes(a)))

    let status: CoverageRequirement['status'] = 'missing'
    if (terms.length) {
      status = matched.length === terms.length ? 'covered' : matched.length ? 'partial' : 'missing'
    } else {
      const phrases = line
        .split(/[，,、/和及与或|]/)
        .map(s => s.replace(/(熟悉|熟练|具备|能够|负责|负责过|优先|经验|能力|以上|相关|工作)/g, '').trim())
        .filter(s => s.length >= 2)
      const phraseHits = phrases.filter(s => resumeText.includes(s))
      status = phraseHits.length ? 'covered' : 'missing'
    }

    const evidence = fragments
      .filter(f => matchedTerms.some(term => aliasesFor(term).some(a => norm(f.text).includes(a))))
      .slice(0, 3)
      .map(f => `${f.where}：${f.text}`)

    return {
      id: `jd_${index + 1}`,
      text,
      status,
      matched,
      evidence
    }
  })
}

export function buildRewriteCandidates(resume: Resume): RewriteCandidate[] {
  const out: RewriteCandidate[] = []
  if (resume.basics.summary.trim()) {
    out.push({
      id: 'summary',
      label: '个人简介',
      section: '简介',
      text: resume.basics.summary,
      target: { kind: 'summary' }
    })
  }

  resume.work.forEach((w, wi) => w.highlights.forEach((text, i) => {
    if (!text.trim()) return
    out.push({
      id: `work:${w.id}:${i}`,
      label: `${w.company || `工作经历 ${wi + 1}`} · 要点 ${i + 1}`,
      section: '工作经历',
      text,
      target: { kind: 'work', itemId: w.id, index: i }
    })
  }))

  resume.projects.forEach((p, pi) => p.highlights.forEach((text, i) => {
    if (!text.trim()) return
    out.push({
      id: `project:${p.id}:${i}`,
      label: `${p.name || `项目 ${pi + 1}`} · 要点 ${i + 1}`,
      section: '项目经历',
      text,
      target: { kind: 'project', itemId: p.id, index: i }
    })
  }))

  resume.skills.forEach((text, i) => {
    if (!text.trim()) return
    out.push({
      id: `skill:${i}`,
      label: `技能 ${i + 1}`,
      section: '技能',
      text,
      target: { kind: 'skills', index: i }
    })
  })

  resume.meta.customSections.forEach(sec => {
    if (sec.type === 'text' && sec.text.trim()) {
      out.push({
        id: `custom-text:${sec.id}`,
        label: sec.title,
        section: sec.title,
        text: sec.text,
        target: { kind: 'custom-text', sectionId: sec.id }
      })
    }
    if (sec.type === 'list') sec.list.forEach((text, i) => {
      if (!text.trim()) return
      out.push({
        id: `custom-list:${sec.id}:${i}`,
        label: `${sec.title} ${i + 1}`,
        section: sec.title,
        text,
        target: { kind: 'custom-list', sectionId: sec.id, index: i }
      })
    })
    if (sec.type === 'entry') sec.entries.forEach(en => en.bullets.forEach((text, i) => {
      if (!text.trim()) return
      out.push({
        id: `custom-entry:${sec.id}:${en.id}:${i}`,
        label: `${en.title || sec.title} · 要点 ${i + 1}`,
        section: sec.title,
        text,
        target: { kind: 'custom-entry', sectionId: sec.id, itemId: en.id, index: i }
      })
    }))
  })

  return out.slice(0, 48)
}

function risksFor(original: string, suggested: string): string[] {
  const risks: string[] = []
  const numbers = (s: string) => new Set(s.match(/\d+(?:\.\d+)?%?/g) || [])
  const before = numbers(original)
  const addedNumbers = [...numbers(suggested)].filter(n => !before.has(n))
  if (addedNumbers.length) risks.push(`新增了原文没有的数字或指标：${addedNumbers.join('、')}。请确认有事实依据。`)

  const claims = ['主导', '从零到一', '从0到1', '精通', '专家', '独立负责', '大幅', '显著']
  const addedClaims = claims.filter(word => suggested.includes(word) && !original.includes(word))
  if (addedClaims.length) risks.push(`新增了更强的能力表述：${addedClaims.join('、')}。请确认没有夸大。`)

  if (suggested.length > original.length * 1.8 && suggested.length - original.length > 35) {
    risks.push('建议明显变长，可能降低简历可读性。')
  }
  return risks
}

export function parseAISuggestions(raw: string, candidates: RewriteCandidate[]): AISuggestion[] {
  const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('DeepSeek 返回内容不是有效 JSON')
  let data: any
  try {
    data = JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new Error('DeepSeek 返回的 JSON 无法解析')
  }
  if (!Array.isArray(data?.suggestions)) throw new Error('DeepSeek 返回结果缺少 suggestions 数组')

  const byId = new Map(candidates.map(c => [c.id, c]))
  const seen = new Set<string>()
  return data.suggestions.slice(0, 20).flatMap((item: any, index: number) => {
    const candidate = byId.get(String(item?.candidateId || ''))
    const suggested = typeof item?.suggested === 'string' ? item.suggested.trim() : ''
    if (!candidate || !suggested || suggested.length > 2000 || suggested === candidate.text || seen.has(candidate.id)) return []
    seen.add(candidate.id)
    return [{
      id: `s${index + 1}_${candidate.id}`,
      candidateId: candidate.id,
      label: candidate.label,
      section: candidate.section,
      original: candidate.text,
      suggested,
      reason: String(item?.reason || '使职责与岗位要求更清晰地对应。'),
      risks: risksFor(candidate.text, suggested),
      selected: false,
      target: candidate.target
    }]
  })
}

export function applySelectedSuggestions(resume: Resume, suggestions: AISuggestion[]): Resume {
  const copy = JSON.parse(JSON.stringify(resume)) as Resume
  suggestions.filter(s => s.selected !== false).forEach(s => {
    const t = s.target
    if (t.kind === 'summary') copy.basics.summary = s.suggested
    else if (t.kind === 'work') {
      const item = copy.work.find(w => w.id === t.itemId)
      if (item && item.highlights[t.index] !== undefined) item.highlights[t.index] = s.suggested
    } else if (t.kind === 'project') {
      const item = copy.projects.find(p => p.id === t.itemId)
      if (item && item.highlights[t.index] !== undefined) item.highlights[t.index] = s.suggested
    } else if (t.kind === 'skills') {
      if (copy.skills[t.index] !== undefined) copy.skills[t.index] = s.suggested
    } else {
      const sec = copy.meta.customSections.find(x => x.id === t.sectionId)
      if (!sec) return
      if (t.kind === 'custom-text') sec.text = s.suggested
      else if (t.kind === 'custom-list') {
        if (sec.list[t.index] !== undefined) sec.list[t.index] = s.suggested
      } else {
        const item = sec.entries.find(en => en.id === t.itemId)
        if (item && item.bullets[t.index] !== undefined) item.bullets[t.index] = s.suggested
      }
    }
  })
  return copy
}

export const coverageLabel = (status: CoverageRequirement['status']): string =>
  status === 'covered' ? '已覆盖' : status === 'partial' ? '部分覆盖' : '缺少证据'
