import type { Resume } from '../core/model'
import type { Target } from './target'

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

const fld = (label: string, k: string, f: string, value: string, extra = '') =>
  `<label class="if-field"><span>${label}</span><input data-k="${k}" data-f="${f}" ${extra} value="${esc(value)}"></label>`

const area = (k: string, f: string, value: string, i?: number) =>
  `<textarea class="if-area" data-k="${k}" data-f="${f}"${i !== undefined ? ` data-i="${i}"` : ''} rows="1">${esc(value)}</textarea>`

const dateParts = (value: string): [string, string] => {
  const match = String(value || '').match(/^((?:19|20)\d{2})(?:[./年-]\s*(\d{1,2}))?$/)
  return match ? [match[1], match[2] ? match[2].padStart(2, '0') : ''] : ['', '']
}

const dateField = (label: string, k: string, f: string, value: string) => {
  const [year, month] = dateParts(value)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear + 6 - 1960 + 1 }, (_, i) => String(currentYear + 6 - i))
  if (year && !years.includes(year)) years.unshift(year)
  return `<label class="if-field"><span>${label}</span>
    <div class="if-month-select">
      <select data-k="${k}" data-f="${f}" data-date-part="year" aria-label="${label}年份">
        <option value="">年</option>${years.map(v => `<option value="${v}"${v === year ? ' selected' : ''}>${v}年</option>`).join('')}
      </select>
      <select data-k="${k}" data-f="${f}" data-date-part="month" aria-label="${label}月份">
        <option value="">月</option>${Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
          .map(v => `<option value="${v}"${v === month ? ' selected' : ''}>${Number(v)}月</option>`).join('')}
      </select>
    </div>
  </label>`
}

const bulletRows = (k: string, arr: string[]) =>
  `<div class="if-bullets">${arr
    .map((t, i) => `<div class="if-bullet"><span>·</span>${area(k, 'bullet', t, i)}<button class="if-x" data-act="del" data-k="${k}" data-i="${i}">×</button></div>`)
    .join('')}</div>
   <button class="if-add" data-act="add" data-k="${k}">＋ 添加要点</button>`

/** 生成原地编辑用的表单 HTML（直接插进纸张，不参与排版测量） */
export function formHTML(t: Target, r: Resume): string {
  const m = r.meta
  const done = `<div class="if-foot"><button class="if-done" data-act="done">完成</button></div>`
  const sec = (key: string) => (m.customSections || []).find(s => s.id === key)

  if (t.kind === 'basics') {
    const b = r.basics
    return `<div class="if-form if-basics">
      <div class="if-grid">
        ${fld('姓名', 'basics', 'name', b.name)}
        ${fld('求职方向', 'basics', 'label', b.label)}
        ${fld('手机', 'basics', 'phone', b.phone)}
        ${fld('邮箱', 'basics', 'email', b.email)}
        ${fld('城市', 'basics', 'city', b.city)}
      </div>
      <div class="if-field wide"><span>一句话简介</span>${area('basics', 'summary', b.summary)}</div>
      ${done}
    </div>`
  }

  if (t.kind === 'bullet') {
    const list =
      t.key === 'work' ? r.work.find(w => w.id === t.id)?.highlights
      : t.key === 'projects' ? r.projects.find(p => p.id === t.id)?.highlights
      : sec(t.key)?.entries.find(e => e.id === t.id)?.bullets
    const k = t.key === 'work' ? `work:${t.id}` : t.key === 'projects' ? `projects:${t.id}` : `entry:${t.key}:${t.id}`
    return `<div class="if-form">${area(k, 'bullet', list?.[t.bi] || '', t.bi)}${done}</div>`
  }

  if (t.kind === 'work') {
    const w = r.work.find(x => x.id === t.id)
    if (!w) return ''
    const k = `work:${w.id}`
    return `<div class="if-form">
      <div class="if-grid">
        ${fld('公司', k, 'company', w.company)}
        ${fld('职位', k, 'role', w.role)}
        ${dateField('开始月份', k, 'start', w.start)}
        ${dateField('结束月份', k, 'end', w.end)}
      </div>
      <div class="if-label">要点</div>
      ${bulletRows(k, w.highlights)}
      ${done}
    </div>`
  }

  if (t.kind === 'projects') {
    const p = r.projects.find(x => x.id === t.id)
    if (!p) return ''
    const k = `projects:${p.id}`
    return `<div class="if-form">
      <div class="if-grid">
        ${fld('项目名', k, 'name', p.name)}
        ${fld('角色', k, 'role', p.role)}
        ${dateField('开始月份', k, 'start', p.start || '')}
        ${dateField('结束月份', k, 'end', p.end || '')}
      </div>
      <div class="if-label">要点</div>
      ${bulletRows(k, p.highlights)}
      ${done}
    </div>`
  }

  if (t.kind === 'education') {
    const e = r.education.find(x => x.id === t.id)
    if (!e) return ''
    const k = `education:${e.id}`
    return `<div class="if-form">
      <div class="if-grid">
        ${fld('学校', k, 'institution', e.institution)}
        ${fld('学历', k, 'studyType', e.studyType)}
        ${fld('专业', k, 'area', e.area)}
        ${dateField('开始月份', k, 'start', e.start)}
        ${dateField('结束月份', k, 'end', e.end)}
      </div>
      ${done}
    </div>`
  }

  if (t.kind === 'custom-entry') {
    const s = sec(t.key)
    const e = s?.entries.find(x => x.id === t.id)
    if (!s || !e) return ''
    const k = `entry:${s.id}:${e.id}`
    return `<div class="if-form">
      <div class="if-grid">
        ${fld('标题', k, 'title', e.title)}
        ${fld('副标题', k, 'subtitle', e.subtitle)}
        ${dateField('开始月份', k, 'start', e.start || '')}
        ${dateField('结束月份', k, 'end', e.end || '')}
      </div>
      <div class="if-label">要点</div>
      ${bulletRows(k, e.bullets)}
      ${done}
    </div>`
  }

  if (t.kind === 'skills') {
    const s = sec(t.key)
    const k = t.key === 'skills' ? 'skills' : `list:${t.key}`
    const val = t.key === 'skills' ? r.skills.join('\n') : (s?.list || []).join('\n')
    return `<div class="if-form"><div class="if-label">一行一条</div>${area(k, 'lines', val)}${done}</div>`
  }

  if (t.kind === 'custom-text') {
    const s = sec(t.key)
    return `<div class="if-form">${area(`text:${t.key}`, 'text', s?.text || '')}${done}</div>`
  }

  const s = sec(t.key)
  const title = s ? s.title : (m.titles[t.key] || '')
  const isEntryModule = t.key === 'work' || t.key === 'projects' || t.key === 'education' || s?.type === 'entry'
  const addMore = isEntryModule
    ? `<button class="if-add" data-act="add-item" data-k="${t.key}">＋ 添加一条内容</button>`
    : ''
  return `<div class="if-form">${fld('模块标题', `title:${t.key}`, 'title', title)}${addMore}${done}</div>`
}
