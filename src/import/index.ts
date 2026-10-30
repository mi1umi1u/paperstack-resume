import { blankResume, uid, type Resume } from '../core/model'

/** 从 Word / PDF / 文本里抽出来的原始行 */
export interface RawLine {
  text: string
  fontSize?: number
  bold?: boolean
  page?: number
}

export interface ParsedEntry {
  kind: 'work' | 'projects' | 'education'
  title: string
  meta: string
  bullets: string[]
  start?: string
  end?: string
}

export interface ParseResult {
  resume: Resume
  lines: number
  sections: string[]
  entries: ParsedEntry[]
  unmatched: string[]
  confidence: number          // 0–100，越高越可信
}

const RE_PHONE = /1[3-9]\d{9}|0\d{2,3}-?\d{7,8}/
const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/
const RE_MONTH = '(?:19|20)\\d{2}(?:\\s*[.\\-/年]\\s*(?:1[0-2]|0?[1-9])(?!\\d))?'
const RE_RANGE = new RegExp(`(${RE_MONTH})\\s*[—\\-~～至到]+\\s*(至今|现在|今|${RE_MONTH})`)
const RE_SINGLE_DATE = new RegExp(RE_MONTH)

/** 栏目别名表：命中即切换当前栏目 */
const SECTION_ALIASES: Array<[string, string[]]> = [
  ['work', ['工作经历', '工作经验', '职业经历', '任职经历', '工作履历', '工作背景', '实习经历', '实习经验']],
  ['projects', ['项目经历', '项目经验', '项目实践', '主要项目', '项目', '作品']],
  ['education', ['教育背景', '教育经历', '学习经历', '学历', '教育']],
  ['skills', ['专业技能', '个人技能', '技能特长', '技能', '技术栈', '核心能力', '能力']],
  ['certs', ['证书', '资格证书', '荣誉', '获奖', '获奖情况', '奖项', '认证']],
  ['summary', ['个人简介', '简介', '概览']],
  ['text', ['自我评价', '个人评价', '自我介绍', '个人总结', '关于我', '个人优势', '个人亮点', '优势']],
  ['basics', ['基本信息', '个人信息', '联系方式', '基础信息']]
]

const clean = (t: string) =>
  t.replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/^[\s\u00A0\u3000•·▪▫●○◆◇■□►▶➤▸‣∙\-–—*]+/, '')
    .trim()

const isSectionHeader = (line: string): string | null => {
  const t = line.replace(/[\s:：]/g, '')
  if (!t || t.length > 10) return null
  for (const [key, names] of SECTION_ALIASES) {
    if (names.includes(t)) return key
  }
  return null
}

const looksLikeOrg = (s: string) =>
  /(公司|集团|科技|有限|股份|银行|医院|学校|学院|大学|中心|事业部|工作室|研究所|政府|局|分公司|子公司)/.test(s)

const splitStartEnd = (line: string): { start?: string; end?: string; rest: string } => {
  const m = line.match(RE_RANGE)
  if (m) return { start: m[1].trim(), end: m[2].trim(), rest: line.replace(m[0], ' ').trim() }
  const m2 = line.match(RE_SINGLE_DATE)
  if (m2) return { start: m2[0].trim(), end: '', rest: line.replace(m2[0], ' ').trim() }
  return { rest: line }
}

const normDate = (s?: string) => {
  if (!s) return ''
  if (/至今|现在|今/.test(s)) return '至今'
  const m = s.match(/((?:19|20)\d{2})[.\-/年]?\s*(1[0-2]|0?[1-9])(?!\d)/)
  if (!m) return s
  return m[2] ? `${m[1]}.${m[2].padStart(2, '0')}` : m[1]
}

/** 文本 → Resume 草稿（规则识别，结果交给确认页核对） */
export function parseText(raw: string): ParseResult {
  const lines = raw.split(/\r?\n/).map(clean).filter(Boolean)
  const r = blankResume()
  const unmatched: string[] = []
  const sectionSeen: string[] = []
  const entries: ParsedEntry[] = []

  r.basics.phone = raw.match(RE_PHONE)?.[0] || ''
  r.basics.email = raw.match(RE_EMAIL)?.[0] || ''

  const nameLine = lines.find(l => l.length >= 2 && l.length <= 6 && !/\d|@|·|\||:/.test(l) && !isSectionHeader(l))
  if (nameLine) r.basics.name = nameLine.replace(/\s+/g, ' ')

  let cur: string | null = null
  let curEntry: ParsedEntry | null = null
  let curText: { id: string; title: string; type: 'text'; entries: []; list: []; text: string } | null = null
  const orderKeys: string[] = []
  const BUILTIN: Record<string, string> = { work: 'work', projects: 'projects', education: 'education', skills: 'skills', certs: 'skills' }

  const pushEntry = (kind: ParsedEntry['kind'], title: string, meta: string, start?: string, end?: string) => {
    const e: ParsedEntry = { kind, title, meta, bullets: [], start, end }
    entries.push(e)
    curEntry = e
    return e
  }

  lines.forEach(line => {
    const header = isSectionHeader(line)
    if (header) {
      cur = header
      curEntry = null
      curText = null
      if (!sectionSeen.includes(header)) sectionSeen.push(header)
      if (header === 'text') {
        // 个人优势这类：单独成一个段落模块，不并进技能
        const sec = { id: uid('sec'), title: line.replace(/[\s:：]/g, ''), type: 'text' as const, entries: [] as [], list: [] as [], text: '' }
        r.meta.customSections.push(sec)
        curText = sec
        orderKeys.push(sec.id)
      } else {
        const k = BUILTIN[header]
        if (k && !orderKeys.includes(k)) orderKeys.push(k)
      }
      return
    }
    if (RE_EMAIL.test(line) && RE_PHONE.test(line)) return
    if (line.replace(/\s/g, '').length <= 2) return

    if (cur === 'work' || cur === 'projects') {
      const { start, end, rest } = splitStartEnd(line)
      const hasDate = !!(start || end)
      const looksNew = hasDate || (looksLikeOrg(rest) && rest.length <= 30 && (!curEntry || curEntry.bullets.length > 0))

      if (looksNew) {
        const parts = rest.split(/\s{2,}|[|｜·]/).map(s => s.trim()).filter(Boolean)
        let title = parts[0] || rest
        let meta = parts.slice(1).join(' · ')
        if (!meta && parts.length === 1) {
          const m = rest.match(/^(.{2,20}?(?:公司|集团|科技|有限|中心|学院|大学|医院|银行|事务所))[\s　]+(.+)$/)
          if (m) { title = m[1]; meta = m[2] }
        }
        pushEntry(cur === 'work' ? 'work' : 'projects', title, meta, normDate(start), normDate(end))
        return
      }
      if (curEntry) { curEntry.bullets.push(line); return }
      pushEntry(cur === 'work' ? 'work' : 'projects', line, '')
      return
    }

    if (cur === 'education') {
      const { start, end, rest } = splitStartEnd(line)
      if (looksLikeOrg(rest) || start) {
        const parts = rest.split(/\s{2,}|[|｜·]/).map(s => s.trim()).filter(Boolean)
        pushEntry('education', parts[0] || rest, parts.slice(1).join(' · '), normDate(start), normDate(end))
        return
      }
      const last = entries.filter(e => e.kind === 'education').pop()
      if (last) { last.meta = [last.meta, line].filter(Boolean).join(' · '); return }
      unmatched.push(line)
      return
    }

    if (cur === 'skills' || cur === 'certs') {
      const parts = line.split(/[、，,；;]|　·　/).map(s => s.trim()).filter(Boolean)
      if (parts.length > 1) r.skills.push(...parts)
      else r.skills.push(line)
      return
    }

    if (cur === 'text' && curText) {
      curText.text = curText.text ? curText.text + '\n' + line : line
      return
    }

    if (cur === 'summary') {
      r.basics.summary = (r.basics.summary ? r.basics.summary + ' ' : '') + line
      return
    }

    if (cur === 'basics') {
      const city = line.replace(RE_PHONE, '').replace(RE_EMAIL, '').trim()
      if (city && !r.basics.city) r.basics.city = city
      return
    }

    unmatched.push(line)
  })

  entries.forEach(e => {
    if (e.kind === 'work') {
      r.work.push({ id: uid('w'), company: e.title, role: e.meta, start: e.start || '', end: e.end || '', highlights: e.bullets.filter(Boolean) })
    } else if (e.kind === 'projects') {
      r.projects.push({ id: uid('p'), name: e.title, role: e.meta, highlights: e.bullets.filter(Boolean) })
    } else {
      const meta = e.meta || ''
      const degree = meta.match(/(专科|本科|硕士|博士|大专|高中|中专|研究生)/)?.[0] || ''
      r.education.push({
        id: uid('e'),
        institution: e.title,
        area: meta.replace(degree, '').replace(/^[·\s]+/, '').trim(),
        studyType: degree,
        start: e.start || '',
        end: e.end || ''
      })
    }
  })

  if (!r.basics.summary) {
    // 只在第一个栏目标题之前找简介，避免把工作要点当成简介
    const firstHeader = lines.findIndex(l => !!isSectionHeader(l))
    const head = lines.slice(0, firstHeader < 0 ? lines.length : firstHeader)
    const first = head.find(l =>
      l.length >= 20 && !RE_PHONE.test(l) && !RE_EMAIL.test(l) &&
      !RE_RANGE.test(l) && !RE_SINGLE_DATE.test(l) && /[。，；]/.test(l)
    )
    if (first) r.basics.summary = first
  }

  // 栏目顺序：按原文出现顺序，未出现的补在后面
  const rest = ['work', 'projects', 'skills', 'education'].filter(k => !orderKeys.includes(k))
  r.meta.order = [...orderKeys, ...rest]

  let conf = 0
  if (r.basics.name) conf += 20
  if (r.basics.phone || r.basics.email) conf += 20
  if (r.work.length) conf += 25
  if (r.projects.length) conf += 15
  if (r.skills.length) conf += 10
  if (r.education.length) conf += 10
  if (sectionSeen.length >= 3) conf += 10
  if (lines.length && unmatched.length > lines.length * 0.3) conf -= 15
  conf = Math.max(0, Math.min(100, conf))

  return { resume: r, lines: lines.length, sections: sectionSeen, entries, unmatched, confidence: conf }
}

/** 把 pdfjs 的文字块还原成行；双栏排版按左右列分别排序，避免串行 */
function layoutPdfPage(items: any[], pageWidth: number): string {
  const blocks = items
    .filter(it => typeof it.str === 'string' && it.str.trim())
    .map(it => ({ str: it.str, x: it.transform[4] as number, y: it.transform[5] as number }))

  if (!blocks.length) return ''

  // 判断是不是双栏：左右两侧都有大量文字块，且中间有空白带
  const mid = pageWidth / 2
  const left = blocks.filter(b => b.x < mid - 20)
  const right = blocks.filter(b => b.x > mid + 20)
  const twoCol = left.length > 10 && right.length > 10

  const groupLines = (list: typeof blocks) => {
    const rows: { y: number; items: typeof blocks }[] = []
    list.forEach(b => {
      const row = rows.find(r => Math.abs(r.y - b.y) < 3)
      if (row) row.items.push(b)
      else rows.push({ y: b.y, items: [b] })
    })
    rows.sort((a, b) => b.y - a.y)
    return rows.map(r => r.items.sort((a, b) => a.x - b.x).map(i => i.str).join(' ').trim()).filter(Boolean)
  }

  if (!twoCol) return groupLines(blocks).join('\n')
  return [...groupLines(left), ...groupLines(right)].join('\n')
}

/** 读文件：docx / pdf / txt */
export async function readFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const out = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return out.value
  }

  if (name.endsWith('.pdf')) {
    const pdfjs: any = await import('pdfjs-dist')
    const worker: any = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker&inline')
    pdfjs.GlobalWorkerOptions.workerPort = new worker.default()
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const width = page.getViewport({ scale: 1 }).width
      pages.push(layoutPdfPage(content.items as any[], width))
    }
    const text = pages.join('\n')
    if (text.replace(/\s/g, '').length < 20) {
      throw new Error('这份 PDF 是图片格式，提取不到文字。请复制文字后用「粘贴文本」导入。')
    }
    return text
  }

  return file.text()
}

export { ocrAvailable, recognizeImage } from './ocr'
