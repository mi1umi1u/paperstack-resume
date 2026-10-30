import type { Resume } from '../core/model'

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** 清洗从 Word/PDF 粘来的隐形字符与项目符号 */
export function cleanLine(t: unknown): string {
  return String(t ?? '')
    .replace(/[\uE000-\uF8FF]/g, '')                 // Wingdings 等私有区符号
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')     // 零宽字符、软连字符
    .replace(/^[\s\u00A0\u3000•·▪▫●○◆◇■□►▶➤▸‣∙\-\u2013\u2014\u2212*]+/, '')
    .trim()
}

const fmt = (a: string, b: string) => (a && b ? `${a} — ${b}` : a || b)

function bullets(arr: string[]): string {
  const items = (arr || []).map(cleanLine)
  if (!items.length) return ''
  return `<ul>${items.map((t, i) => `<li data-bi="${i}">${esc(t)}</li>`).join('')}</ul>`
}

/** 空模块也要渲染，否则预览里点不到、没法添加第一条 */
function emptySection(head: string, key: string): string {
  return `<section class="sec" data-key="${esc(key)}">${head}<div class="sec-body"><p class="placeholder">点击填写</p></div></section>`
}

function sectionHtml(r: Resume, key: string): string {
  const custom = (r.meta.customSections || []).find(s => s.id === key)
  const title = custom ? custom.title : ((r.meta.titles as any)[key] || '')
  const head = title ? `<h2 class="sec-title">${esc(title)}</h2>` : ''
  let body = ''

  if (custom) {
    const empty = `<p class="placeholder">点击填写</p>`
    if (custom.type === 'entry') {
      const list = custom.entries.filter(e => e.title || e.subtitle || e.bullets.some(Boolean))
      if (!list.length) return `<section class="sec" data-key="${esc(key)}">${head}<div class="sec-body">${empty}</div></section>`
      body = list.map(e => `<div class="item" data-id="${esc(e.id)}">
        <div class="item-head"><span class="dates">${esc(e.time || '')}</span>
        <span class="org">${esc(e.title || '')}</span>
        <span class="sub">${esc(e.subtitle || '')}</span></div>
        ${bullets(e.bullets)}</div>`).join('')
      return `<section class="sec" data-key="${esc(key)}">${head}<div class="sec-body">${body}</div></section>`
    }
    if (custom.type === 'list') {
      const items = custom.list.map(cleanLine).filter(Boolean)
      if (!items.length) return `<section class="sec" data-key="${esc(key)}">${head}<div class="sec-body">${empty}</div></section>`
      body = `<ul class="skill-list">${items.map((t, i) => `<li class="plain" data-bi="${i}">${esc(t)}</li>`).join('')}</ul>`
      return `<section class="sec" data-key="${esc(key)}">${head}<div class="sec-body">${body}</div></section>`
    }
    const text = (custom.text || '').trim()
    if (!text) return `<section class="sec" data-key="${esc(key)}">${head}<div class="sec-body">${empty}</div></section>`
    body = `<p class="desc">${esc(text)}</p>`
    return `<section class="sec" data-key="${esc(key)}">${head}<div class="sec-body">${body}</div></section>`
  }

  if (key === 'work') {
    if (!r.work.length) return emptySection(head, key)
    body = r.work.map(w => `<div class="item" data-id="${esc(w.id)}"${w.pb ? ' data-pb="1"' : ''}${w.keep ? ' data-keep="1"' : ''}>
        <div class="item-head"><span class="dates">${esc(fmt(w.start, w.end))}</span>
        <span class="org">${esc(w.company || '—')}</span>
        <span class="sub">${esc(w.role || '')}</span></div>
        ${bullets(w.highlights)}</div>`).join('')
  } else if (key === 'projects') {
    if (!r.projects.length) return emptySection(head, key)
    body = r.projects.map(p => `<div class="item" data-id="${esc(p.id)}"${p.pb ? ' data-pb="1"' : ''}${p.keep ? ' data-keep="1"' : ''}>
        <div class="item-head"><span class="dates"></span>
        <span class="org">${esc(p.name || '—')}</span>
        <span class="sub">${esc(p.role || '')}</span></div>
        ${bullets(p.highlights)}</div>`).join('')
  } else if (key === 'skills') {
    const sk = (r.skills || []).map(cleanLine).filter(Boolean)
    if (!sk.length) return emptySection(head, key)
    const asList = sk.length > 6 || sk.some(s => s.replace(/\s/g, '').length > 24)
    body = asList
      ? `<ul class="skill-list">${sk.map((s, i) => `<li class="plain" data-bi="${i}">${esc(s)}</li>`).join('')}</ul>`
      : `<ul><li class="plain">${sk.map(s => esc(s)).join('　·　')}</li></ul>`
  } else if (key === 'education') {
    const ed = r.education.filter(e => e.institution || e.area)
    if (!ed.length) return emptySection(head, key)
    body = ed.map(e => `<div class="item" data-id="${esc(e.id)}">
        <div class="item-head"><span class="dates">${esc(fmt(e.start, e.end))}</span>
        <span class="org">${esc(e.institution || '')}</span>
        <span class="sub">${esc([e.studyType, e.area].filter(Boolean).join(' · '))}</span></div></div>`).join('')
  }

  const cls = title ? 'sec' : 'sec no-title'
  return `<section class="${cls}" data-key="${esc(key)}">${head}<div class="sec-body">${body}</div></section>`
}

/** 状态 → 纯 HTML 字符串（不碰 DOM，方便测量与复用） */
export function buildDoc(r: Resume): string {
  const b = r.basics
  const custom = (b.custom || []).filter(c => c.label || c.value)

  const parts = [b.phone, b.email, b.city].filter(Boolean).map(x => `<span>${esc(x)}</span>`)
  custom.forEach(c => {
    const t = `${c.label ? c.label + ' ' : ''}${c.value || ''}`.trim()
    if (t) parts.push(`<span>${esc(t)}</span>`)
  })

  let html = `<div class="doc doc-${r.meta.template}">`
  html += `<div class="doc-head" data-region="basics">`
  if (b.name) html += `<h1 class="name">${esc(b.name)}</h1>`
  if (b.label) html += `<p class="label">${esc(b.label)}</p>`
  if (parts.length) html += `<p class="contact">${parts.join('')}</p>`
  html += `</div>`

  if (r.meta.showSummary !== false && b.summary) html += `<p class="summary">${esc(b.summary)}</p>`

  const hidden = r.meta.hidden || []
  r.meta.order.forEach(key => {
    if (hidden.includes(key)) return
    html += sectionHtml(r, key)
  })
  html += `</div>`
  return html
}

/** 标准 JSON Resume 导出 */
export function toJSONResume(r: Resume) {
  return {
    basics: {
      name: r.basics.name,
      label: r.basics.label,
      email: r.basics.email,
      phone: r.basics.phone,
      summary: r.basics.summary,
      image: r.basics.image,
      custom: (r.basics.custom || []).filter(c => c.label || c.value),
      location: { city: r.basics.city }
    },
    work: r.work.map(w => ({
      name: w.company, position: w.role, startDate: w.start, endDate: w.end,
      highlights: w.highlights.filter(Boolean)
    })),
    projects: r.projects.map(p => ({
      name: p.name, description: p.role, highlights: p.highlights.filter(Boolean)
    })),
    skills: r.skills.filter(Boolean).map(name => ({ name })),
    education: r.education.map(e => ({
      institution: e.institution, area: e.area, studyType: e.studyType, startDate: e.start, endDate: e.end
    })),
    meta: { ...r.meta, generator: 'paperstack' }
  }
}
