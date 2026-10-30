import { get, set } from 'idb-keyval'
import { blankResume, uid, DEFAULT_TITLES, type Resume, type CustomSection } from './model'

const IDB_KEY = 'paperstack.resume.v2'
const LS_KEY = 'paperstack.resume.v1'   // v0.3 的 localStorage 键，用于迁移

/** 任意来源的数据 → 合法 Resume（缺字段补默认，脏数据丢弃） */
export function normalize(input: any): Resume {
  const base = blankResume()
  const d = input || {}

  const b = d.basics || {}
  base.basics = {
    name: b.name || '',
    label: b.label || '',
    phone: b.phone || '',
    email: b.email || '',
    city: (b.location && b.location.city) || b.city || '',
    summary: b.summary || '',
    image: b.image || undefined,
    custom: Array.isArray(b.custom) ? b.custom.map((c: any) => ({ label: c.label || '', value: c.value || '' })) : []
  }

  base.work = (Array.isArray(d.work) ? d.work : []).map((w: any) => ({
    id: w.id || uid('w'),
    company: w.company || w.name || '',
    role: w.role || w.position || '',
    start: w.start || w.startDate || '',
    end: w.end || w.endDate || '',
    highlights: Array.isArray(w.highlights) ? w.highlights.slice() : [],
    pb: !!w.pb,
    keep: !!w.keep
  }))

  base.projects = (Array.isArray(d.projects) ? d.projects : []).map((p: any) => ({
    id: p.id || uid('p'),
    name: p.name || '',
    role: p.role || p.description || '',
    highlights: Array.isArray(p.highlights) ? p.highlights.slice() : [],
    pb: !!p.pb,
    keep: !!p.keep
  }))

  base.skills = (Array.isArray(d.skills) ? d.skills : [])
    .map((s: any) => (typeof s === 'string' ? s : s && s.name) || '')
    .filter(Boolean)

  base.education = (Array.isArray(d.education) ? d.education : []).map((e: any) => ({
    id: e.id || uid('e'),
    institution: e.institution || '',
    area: e.area || '',
    studyType: e.studyType || e.degree || '',
    start: e.start || e.startDate || '',
    end: e.end || e.endDate || ''
  }))

  const m = d.meta || {}
  base.meta.customSections = (Array.isArray(m.customSections) ? m.customSections : []).map((sec: any) => ({
    id: sec.id || uid('sec'),
    title: sec.title || '自定义模块',
    type: sec.type === 'list' || sec.type === 'text' ? sec.type : 'entry',
    entries: (Array.isArray(sec.entries) ? sec.entries : []).map((en: any) => ({
      id: en.id || uid('en'),
      title: en.title || '',
      subtitle: en.subtitle || '',
      time: en.time || '',
      bullets: Array.isArray(en.bullets) ? en.bullets : []
    })),
    list: Array.isArray(sec.list) ? sec.list : [],
    text: sec.text || ''
  })) as CustomSection[]

  const KEYS = ['work', 'projects', 'skills', 'education', ...base.meta.customSections.map(s => s.id)]
  const order = Array.isArray(m.order) ? m.order.filter((k: string) => KEYS.includes(k)) : []
  KEYS.forEach(k => { if (!order.includes(k)) order.push(k) })

  base.meta = {
    template: m.template || 'su',
    accent: m.accent || '#1B3557',
    font: m.font || 'song',
    density: m.density || 'normal',
    autoFit: m.autoFit !== false,
    order,
    titles: { ...DEFAULT_TITLES, ...(m.titles || {}) },
    customSections: base.meta.customSections,
    hidden: Array.isArray(m.hidden) ? m.hidden.filter((k: string) => KEYS.includes(k)) : [],
    showSummary: m.showSummary !== false
  }

  return base
}

/** 读取：优先 IndexedDB，其次迁移 v0.3 的 localStorage */
const timeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p.catch(() => null), new Promise<null>(res => setTimeout(() => res(null), ms))])

export async function loadResume(): Promise<Resume | null> {
  try {
    const saved = await timeout(get(IDB_KEY), 1200)
    if (saved) return normalize(saved)
  } catch { /* IndexedDB 不可用（隐私模式等），降级到 localStorage */ }

  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const migrated = normalize(JSON.parse(raw))
      await saveResume(migrated)
      localStorage.removeItem(LS_KEY)
      return migrated
    }
  } catch { /* ignore */ }
  return null
}

let timer: number | undefined
export function saveResume(r: Resume, delay = 300): void {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    set(IDB_KEY, JSON.parse(JSON.stringify(r))).catch(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(r)) } catch { /* ignore */ }
    })
  }, delay)
}

export function saveResumeNow(r: Resume): Promise<void> {
  return set(IDB_KEY, JSON.parse(JSON.stringify(r))).catch(() => undefined)
}
