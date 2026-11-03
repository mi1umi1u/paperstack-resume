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

const RE_PHONE = /(?<!\d)(?:1[3-9]\d{9}|0\d{2,3}-?\d{7,8})(?!\d)/
const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/
const RE_MONTH = '(?:19|20)\\d{2}(?:\\s*[.\\-/年]\\s*(?:1[0-2]|0?[1-9])(?!\\d))?'
const RE_RANGE = new RegExp(`(${RE_MONTH})\\s*[—\\-~～至到]+\\s*(至今|现在|今|${RE_MONTH})`)
const RE_SINGLE_DATE = new RegExp(RE_MONTH)

/** 栏目别名表：命中即切换当前栏目 */
const SECTION_ALIASES: Array<[string, string[]]> = [
  ['work', ['工作经历', '工作经验', '职业经历', '任职经历', '工作履历', '工作背景', '工作简历', '实习经历', '实习经验', '在校实践经验', '教学经历']],
  ['projects', ['项目经历', '项目经验', '项目实践', '主要项目', '项目', '作品', '科研经历', '研究项目', '参与项目', '代表性科研项目']],
  ['education', ['教育背景', '教育经历', '学习经历', '学习简历', '学历情况', '教学背景', '学历', '教育']],
  ['skills', ['专业技能', '个人技能', '技能特长', '技能掌握', '编程与环境', '模型与框架', '个人能力', '技术栈', '核心能力', '技能', '能力']],
  ['certs', ['证书', '资格证书', '荣誉', '获奖', '获奖情况', '奖项', '认证']],
  ['summary', ['个人简介', '简介', '概览', '研究方向', '研究兴趣']],
  ['text', ['自我评价', '个人评价', '自我介绍', '个人总结', '关于我', '个人优势', '个人亮点', '优势']],
  ['basics', ['基本信息', '个人信息', '联系方式', '基础信息']],
  ['ignore', [
    '发表文章', '发表论文', '论文发表情况', '论文与专利', '主要论文', '国际期刊', '国内期刊',
    '学术会议', '专利', '申请/授权的发明专利', '代表性学术论文', '科研成果',
    '在校期间所获奖励', '获奖情况', '荣誉情况', '奖学金和奖励', '其它信息', '主导', '参与'
  ]]
]

const GENERIC_TITLE = /^(个人简历|求职简历|中文简历|英文简历|简历|resume|curriculumvitae|cv)$/i

const clean = (t: string) =>
  t.replace(/[\uE000-\uF8FF]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/^[\s\u00A0\u3000•·▪▫●○◆◇■□►▶➤▸‣∙\-–—*]+/, '')
    .replace(/^\d{1,2}\s*[、.)）]\s*/, '')
    .trim()

function splitNumberedLine(line: string): string[] {
  const markers = [...line.matchAll(/(?<!\d)(\d{1,2})\s*(?:[、)）]|\.(?=\s))/g)]
    .filter(match => match.index !== undefined)
  if (markers.length < 2) return [line]
  const numbers = markers.map(match => Number(match[1]))
  if (numbers[0] !== 1 || numbers[1] !== 2) return [line]
  const out: string[] = []
  if ((markers[0].index || 0) > 0) {
    const prefix = line.slice(0, markers[0].index).trim()
    if (prefix) out.push(prefix)
  }
  markers.forEach((match, i) => {
    const start = (match.index || 0) + match[0].length
    const end = markers[i + 1]?.index ?? line.length
    const text = line.slice(start, end).trim()
    if (text) out.push(text)
  })
  return out
}

const isSectionHeader = (line: string): string | null => {
  const compactHead = line
    .replace(/[（(][^）)]*[）)]/g, '')
    .split(/[:：]/)[0]
    .replace(/\s/g, '')
  const t = line
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[\s:：]/g, '')
  for (const [key, names] of SECTION_ALIASES) {
    if (names.includes(compactHead) || (t.length <= 16 && names.includes(t))) return key
  }
  return null
}

/** PDF 常见逐字定位会插入数字之间的空格，先还原可识别的日期和电话号码。 */
export function normalizeImportedText(value: string): string {
  return String(value || '')
    .replace(/(?<=\d)[ \t]+(?=\d)/g, '')
    .replace(/(?<=\d)[ \t]*([.．年])[ \t]*(?=\d)/g, '$1')
    .replace(/(?<=\d)[ \t]*[—–~～][ \t]*(?=\d|至今|现在|今)/g, ' — ')
}

function extractPhone(raw: string): string {
  const compact = raw
    .replace(/\s+/g, '')
    .replace(/(?<=\d)[-–—](?=\d)/g, '')
  const mobile = compact.match(/(?<!\d)(?:\+?86)?(1[3-9]\d{9})(?!\d)/)
  if (mobile) return mobile[1]
  const landline = compact.match(/(?<!\d)0\d{2,3}-?\d{7,8}(?!\d)/)
  return landline?.[0] || ''
}

function extractName(lines: string[]): string {
  for (const line of lines) {
    if (!/姓名\s*[:：]/.test(line)) continue
    const after = line.split(/姓名\s*[:：]/)[1] || ''
    const name = after.split(/\s*(?:性别|民族|出生|电话|手机|邮箱)\s*[:：]?/)[0].replace(/\s+/g, '')
    if (/^[\u3400-\u9fff·]{2,6}$/.test(name)) return name
  }
  const titleIndex = lines.findIndex(line => GENERIC_TITLE.test(line.replace(/\s/g, '')))
  if (titleIndex >= 0) {
    const next = lines[titleIndex + 1] || ''
    const named = next.match(/^([\u3400-\u9fff·]{2,4})\s*[，,]/)
    if (named) return named[1]
  }
  for (const line of lines.slice(0, 24)) {
    const inline = line.match(/(?:个人简历\s*)?([\u3400-\u9fff·]{2,4})\s+(?:男|女)\b/)
    if (inline && !GENERIC_TITLE.test(inline[1])) return inline[1].replace(/\s+/g, '')
  }
  const candidate = lines.find(line => {
    const compact = line.replace(/\s+/g, '')
    return compact.length >= 2 && compact.length <= 4 &&
      !/\d|@|·|\||:|：/.test(line) &&
      !GENERIC_TITLE.test(compact) &&
      !isSectionHeader(line)
  })
  return candidate
    ? (/[\u3400-\u9fff]/.test(candidate) ? candidate.replace(/\s+/g, '') : candidate.replace(/\s+/g, ' '))
    : ''
}

const looksLikeOrg = (s: string) =>
  /(公司|集团|科技|有限|股份|银行|医院|学校|学院|大学|中心|事业部|工作室|研究所|政府|局|分公司|子公司)/.test(s) &&
  s.trim().length <= 70 &&
  !/^(负责|完成|参与|整理|处理|推动|编写|维护|使用|通过)/.test(s.trim())

const looksLikeSchool = (s: string) =>
  /(大学|学院|学校|中学|高中|职业技术学院)/.test(s) &&
  s.trim().length <= 70 &&
  !/[。；;]$/.test(s.trim()) &&
  !/^(负责|完成|参与|整理|处理|推动|编写|维护|使用|通过)/.test(s.trim())

const splitStartEnd = (line: string): { start?: string; end?: string; rest: string } => {
  const m = line.match(RE_RANGE)
  if (m) return { start: m[1].trim(), end: m[2].trim(), rest: line.replace(m[0], ' ').trim() }
  const m2 = line.match(RE_SINGLE_DATE)
  if (m2) return { start: m2[0].trim(), end: '', rest: line.replace(m2[0], ' ').trim() }
  return { rest: line }
}

const dateLeadsLine = (line: string): boolean => {
  const range = line.match(RE_RANGE)
  if (range?.index !== undefined) return range.index <= 4
  const single = line.match(RE_SINGLE_DATE)
  return single?.index !== undefined && single.index <= 4
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
  const normalizedRaw = normalizeImportedText(raw)
  const lines = normalizedRaw.split(/\r?\n/).flatMap(splitNumberedLine).map(clean).filter(Boolean)
  const r = blankResume()
  const unmatched: string[] = []
  const sectionSeen: string[] = []
  const entries: ParsedEntry[] = []

  r.basics.phone = extractPhone(normalizedRaw)
  r.basics.email = normalizedRaw.match(RE_EMAIL)?.[0] || ''
  r.basics.name = extractName(lines)

  let cur: string | null = null
  let curEntry: ParsedEntry | null = null
  let curText: { id: string; title: string; type: 'text'; entries: []; list: []; text: string } | null = null
  const orderKeys: string[] = []
  const BUILTIN: Record<string, string> = { work: 'work', projects: 'projects', education: 'education', skills: 'skills', certs: 'skills' }
  const orphanDates: Array<{ kind: ParsedEntry['kind']; start?: string; end?: string }> = []

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
      if (header !== 'ignore' && !sectionSeen.includes(header)) sectionSeen.push(header)
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
    if (cur === 'ignore') return
    if (RE_EMAIL.test(line) && RE_PHONE.test(line)) return
    if (line.replace(/\s/g, '').length <= 2) return

    if (cur === 'work' || cur === 'projects') {
      const { start, end, rest } = splitStartEnd(line)
      const hasDate = !!(start || end)
      const hasDelimiter = /[|｜·]/.test(line)
      if (hasDate && !rest) {
        orphanDates.push({ kind: cur === 'work' ? 'work' : 'projects', start: normDate(start), end: normDate(end) })
        return
      }
      const looksNew = (hasDate && dateLeadsLine(line) && rest.length <= 100) ||
        (cur === 'work' && looksLikeOrg(rest) && rest.length <= 70 && (!curEntry || curEntry.bullets.length > 0)) ||
        (cur === 'projects' && (hasDelimiter || (!curEntry && rest.length <= 60)))

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
      if (start && !rest) {
        orphanDates.push({ kind: 'education', start: normDate(start), end: normDate(end) })
        return
      }
      if (looksLikeSchool(rest) || (start && rest.length <= 100)) {
        const parts = rest.split(/\s{2,}|[|｜·]/).map(s => s.trim()).filter(Boolean)
        pushEntry('education', parts[0] || rest, parts.slice(1).join(' · '), normDate(start), normDate(end))
        return
      }
      const last = entries.filter(e => e.kind === 'education').pop()
      if (last && line.length <= 90 && /^(主修课程|专业课程|研究方向|导师|学位|学历)/.test(line)) {
        last.meta = [last.meta, line].filter(Boolean).join(' · ')
        return
      }
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
      r.basics.summary = (r.basics.summary ? r.basics.summary + '\n' : '') + line
      return
    }

    if (cur === 'basics') {
      const city = line.replace(RE_PHONE, '').replace(RE_EMAIL, '').trim()
      if (city && !r.basics.city) r.basics.city = city
      return
    }

    unmatched.push(line)
  })

  for (const kind of ['work', 'projects', 'education'] as const) {
    const open = entries.filter(e => e.kind === kind && !e.start)
    const dates = orphanDates.filter(d => d.kind === kind)
    open.forEach((entry, i) => {
      if (dates[i]) {
        entry.start = dates[i].start
        entry.end = dates[i].end
      }
    })
  }

  entries.forEach(e => {
    if (e.kind === 'work') {
      if (!e.title.trim() && !e.meta.trim()) return
      r.work.push({ id: uid('w'), company: e.title, role: e.meta, start: e.start || '', end: e.end || '', highlights: e.bullets.filter(Boolean) })
    } else if (e.kind === 'projects') {
      if (!e.title.trim()) return
      r.projects.push({
        id: uid('p'),
        name: e.title,
        role: e.meta,
        start: e.start || '',
        end: e.end || '',
        highlights: e.bullets.filter(Boolean)
      })
    } else {
      if (!e.title.trim() && !e.meta.trim()) return
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
  if (unmatched.length) conf -= Math.min(20, unmatched.length * 2)
  if (r.work.length > 8) conf -= 20
  if (r.work.length) {
    const dated = r.work.filter(w => w.start || w.end).length
    if (dated / r.work.length < 0.5) conf -= 20
    if (!r.work.some(w => w.highlights.length)) conf -= 10
  }
  if (r.projects.length && !r.projects.some(p => p.highlights.length)) conf -= 10
  if (r.education.length && !r.education.some(e => e.start || e.end)) conf -= 10
  conf = Math.max(0, Math.min(100, conf))

  return { resume: r, lines: lines.length, sections: sectionSeen, entries, unmatched, confidence: conf }
}

/** 把 pdfjs 的文字块还原成行；双栏排版按左右列分别排序，避免串行 */
export function layoutPdfPage(items: any[], pageWidth: number): string {
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
