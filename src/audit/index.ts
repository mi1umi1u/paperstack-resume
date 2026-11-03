import type { Resume } from '../core/model'

export type Level = 'err' | 'warn'

export interface Issue {
  id: string
  level: Level
  title: string
  detail: string
  rule: string
  evidence: string[]
  target?: string
}

export interface AuditResult {
  /** 可验证规则的通过比例，不代表真实性、录用概率或内容质量。 */
  score: number
  passed: number
  total: number
  issues: Issue[]
  good: string
  bullets: number
}

interface BulletRef {
  text: string
  target: string
  label: string
}

function bulletRefs(r: Resume): BulletRef[] {
  const out: BulletRef[] = []
  r.work.forEach(w => w.highlights.forEach((text, i) => {
    if (text.trim()) out.push({ text: text.trim(), target: 'work', label: `${w.company || '工作经历'} · 要点 ${i + 1}` })
  }))
  r.projects.forEach(p => p.highlights.forEach((text, i) => {
    if (text.trim()) out.push({ text: text.trim(), target: 'projects', label: `${p.name || '项目经历'} · 要点 ${i + 1}` })
  }))
  r.meta.customSections.forEach(sec => sec.entries.forEach(en => en.bullets.forEach((text, i) => {
    if (text.trim()) out.push({ text: text.trim(), target: sec.id, label: `${en.title || sec.title} · 要点 ${i + 1}` })
  })))
  return out
}

function parseMonth(value: string): number | null {
  const match = value.match(/((?:19|20)\d{2})(?:[./年-]\s*(\d{1,2}))?/)
  if (!match) return null
  const year = Number(match[1])
  const month = match[2] ? Number(match[2]) : 1
  if (month < 1 || month > 12) return null
  return year * 12 + month
}

/** 只报告可由当前数据直接验证的问题，不判断真实性或录用概率。 */
export function audit(r: Resume): AuditResult {
  const issues: Issue[] = []
  const refs = bulletRefs(r)
  const total = 9

  if (!r.basics.name.trim()) {
    issues.push({
      id: 'name', level: 'err', title: '缺少姓名', target: 'basics',
      detail: '基本信息中的姓名为空。',
      rule: '基本信息必须有姓名。', evidence: ['姓名：空']
    })
  }

  if (!r.basics.phone.trim() && !r.basics.email.trim()) {
    issues.push({
      id: 'contact', level: 'err', title: '缺少联系方式', target: 'basics',
      detail: '手机和邮箱至少填写一项。',
      rule: '至少存在一个联系方式。', evidence: ['手机：空', '邮箱：空']
    })
  }

  const hasContent = r.work.length || r.projects.length || r.education.length ||
    r.meta.customSections.some(sec => sec.text.trim() || sec.list.length || sec.entries.length)
  if (!hasContent) {
    issues.push({
      id: 'content', level: 'err', title: '没有任何经历或教育内容', target: 'work',
      detail: '当前简历只有基本信息。',
      rule: '至少存在一条工作、项目、教育或自定义模块内容。', evidence: ['经历与教育模块均为空']
    })
  }

  const missingDates: string[] = []
  r.work.forEach(w => {
    if (!w.start.trim() || !w.end.trim()) missingDates.push(`${w.company || '未命名工作'}：${w.start || '空'} — ${w.end || '空'}`)
  })
  r.education.forEach(e => {
    if (!e.start.trim() || !e.end.trim()) missingDates.push(`${e.institution || '未命名学校'}：${e.start || '空'} — ${e.end || '空'}`)
  })
  if (missingDates.length) {
    issues.push({
      id: 'dates', level: 'warn', title: `${missingDates.length} 条工作或教育记录日期不完整`, target: 'work',
      detail: '开始时间和结束时间应同时存在；“至今”可作为结束时间。',
      rule: '工作和教育记录必须同时有开始、结束字段。', evidence: missingDates.slice(0, 6)
    })
  }

  const noBullets: string[] = []
  r.work.forEach(w => { if (!w.highlights.some(x => x.trim())) noBullets.push(w.company || '未命名工作') })
  r.projects.forEach(p => { if (!p.highlights.some(x => x.trim())) noBullets.push(p.name || '未命名项目') })
  if (noBullets.length) {
    issues.push({
      id: 'bullets', level: 'warn', title: `${noBullets.length} 条经历没有要点`, target: 'work',
      detail: '条目存在，但没有可展示的职责或结果。',
      rule: '每条工作或项目经历至少包含一条非空要点。', evidence: noBullets
    })
  }

  const duplicateGroups = new Map<string, BulletRef[]>()
  refs.forEach(ref => {
    const key = ref.text.replace(/\s+/g, '').toLowerCase()
    duplicateGroups.set(key, [...(duplicateGroups.get(key) || []), ref])
  })
  const duplicateEvidence = [...duplicateGroups.values()]
    .filter(group => group.length > 1)
    .flatMap(group => group.map(ref => `${ref.label}：${ref.text}`))
  if (duplicateEvidence.length) {
    issues.push({
      id: 'duplicates', level: 'warn', title: '存在完全重复的要点', target: 'work',
      detail: '相同文字会在最终简历中重复出现。',
      rule: '比较去除空白后的要点全文，完全相同视为重复。', evidence: duplicateEvidence.slice(0, 8)
    })
  }

  const numbered = refs.filter(ref => /(?:^|\s)\d{1,2}\s*[、)）].*\d{1,2}\s*[、)）]/.test(ref.text))
  if (numbered.length) {
    issues.push({
      id: 'numbered', level: 'warn', title: `${numbered.length} 条要点内有多个编号条目`, target: numbered[0].target,
      detail: '回车或编号后的内容仍挤在同一个要点里，应拆成多条要点。',
      rule: '同一条要点中检测到两个或以上“数字 + 、/)/）”编号。',
      evidence: numbered.slice(0, 4).map(ref => `${ref.label}：${ref.text}`)
    })
  }

  const invalidDates: string[] = []
  const checkOrder = (label: string, start: string, end: string) => {
    if (!start || !end || /至今|现在|今/.test(end)) return
    const a = parseMonth(start)
    const b = parseMonth(end)
    if (a !== null && b !== null && a > b) invalidDates.push(`${label}：${start} — ${end}`)
  }
  r.work.forEach(w => checkOrder(w.company || '未命名工作', w.start, w.end))
  r.education.forEach(e => checkOrder(e.institution || '未命名学校', e.start, e.end))
  if (invalidDates.length) {
    issues.push({
      id: 'order', level: 'err', title: '存在结束时间早于开始时间的记录', target: 'work',
      detail: '请核对日期是否填反。',
      rule: '将日期归一为年月后比较，开始时间不得晚于结束时间；结束为“至今”时跳过。',
      evidence: invalidDates
    })
  }

  const percentages = refs.filter(ref => /[%％]/.test(ref.text) && !/(从|由|降至|降到|升至|提升到|提升了|下降到|下降了)/.test(ref.text))
  if (percentages.length) {
    issues.push({
      id: 'percentage', level: 'warn', title: `${percentages.length} 条百分比没有前后数值`, target: percentages[0].target,
      detail: '这里只指出缺少可核对的前后数据；如果原始事实只记录百分比，可以忽略。',
      rule: '出现百分比时，检查同一条要点是否包含“从/由/到/降至/升至”等变化语境。',
      evidence: percentages.slice(0, 4).map(ref => `${ref.label}：${ref.text}`)
    })
  }

  const passed = Math.max(0, total - issues.length)
  const score = Math.round((passed / total) * 100)
  return {
    score,
    passed,
    total,
    issues,
    good: issues.length ? '' : `当前 ${total} 项自动规则全部通过；这不代表内容真实或一定适合投递。`,
    bullets: refs.length
  }
}
