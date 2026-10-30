/**
 * 排版引擎：测量 → 决策（是否压缩）→ 分页（条目级）→ 撑开
 * 不依赖框架，纯 DOM 计算
 */
import type { DensityId, FontId, TemplateId } from '../core/model'

export type PageTarget = 'auto' | '1' | '2' | '3'

export interface LayoutOpts {
  template: TemplateId
  font: FontId
  accent: string
  density: DensityId
  autoFit: boolean
  targetPages?: PageTarget
}

interface Comp { gap: number; padY: number; padX: number; lh: number; fs: number }

const DENSITY: Record<DensityId, { gap: number; lh: number }> = {
  compact: { gap: 0.86, lh: 0.94 },
  normal: { gap: 1, lh: 1 },
  loose: { gap: 1.14, lh: 1.05 }
}

const COMP_DEF: Comp = { gap: 1, padY: 1, padX: 1, lh: 1, fs: 1 }

let holder: HTMLDivElement | null = null
function measureHolder(): HTMLDivElement {
  if (!holder || !holder.isConnected) {
    holder = document.createElement('div')
    holder.style.cssText = 'position:absolute;left:-99999px;top:0;width:210mm;'
    document.body.appendChild(holder)
  }
  return holder
}

function applyVars(el: HTMLElement, comp: Comp, opts: LayoutOpts) {
  const d = DENSITY[opts.density] || DENSITY.normal
  el.style.setProperty('--gap', (comp.gap * d.gap).toFixed(3))
  el.style.setProperty('--lh-m', (comp.lh * d.lh).toFixed(3))
  el.style.setProperty('--pad-y', String(comp.padY))
  el.style.setProperty('--pad-x', String(comp.padX))
  el.style.setProperty('--fs-m', String(comp.fs))
  el.style.setProperty('--ex-li', '0px')
  el.style.setProperty('--ex-item', '0px')
  el.style.setProperty('--ex-sec', '0px')
}

function mkSheet(comp: Comp, opts: LayoutOpts): HTMLDivElement {
  const s = document.createElement('div')
  s.className = 'sheet'
  s.style.zoom = '1'
  s.style.height = '297mm'
  s.dataset.font = opts.font
  s.style.setProperty('--dc', opts.accent)
  applyVars(s, comp, opts)
  measureHolder().appendChild(s)
  return s
}

function contentArea(sheet: HTMLElement): number {
  const cs = getComputedStyle(sheet)
  return sheet.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
}

function measure(html: string, comp: Comp, opts: LayoutOpts) {
  const s = mkSheet(comp, opts)
  s.innerHTML = html
  const doc = s.firstElementChild as HTMLElement | null
  const r = { docH: doc ? doc.offsetHeight : 0, avail: contentArea(s) }
  s.remove()
  return r
}

/** 压缩阶梯：间距 → 页边距 → 行高 → 字号，顺序固定 */
function ladder(): Comp[] {
  const steps: Comp[] = []
  const c: Comp = { ...COMP_DEF }
  steps.push({ ...c })
  ;[0.9, 0.8, 0.7, 0.6, 0.55].forEach(v => { c.gap = v; steps.push({ ...c }) })
  ;[0.93, 0.86, 0.8, 0.75].forEach(v => { c.padY = v; c.padX = 1 - (1 - v) * 0.85; steps.push({ ...c }) })
  ;[0.98, 0.96, 0.94, 0.92, 0.906].forEach(v => { c.lh = v; steps.push({ ...c }) })
  ;[0.982, 0.964].forEach(v => { c.fs = v; steps.push({ ...c }) })
  return steps
}

/** 决定用哪一档样式 */
function decide(html: string, opts: LayoutOpts): Comp {
  const base = measure(html, COMP_DEF, opts)
  if (base.docH <= base.avail + 1) return COMP_DEF
  if (!opts.autoFit) return COMP_DEF
  const over = base.docH - base.avail
  if (over > base.avail * 0.08) return COMP_DEF          // 超出太多，不压，直接拆
  const steps = ladder()
  for (let i = 1; i < steps.length; i++) {
    const m = measure(html, steps[i], opts)
    if (m.docH <= m.avail + 1) return steps[i]
  }
  return COMP_DEF                                        // 压到底也不行 → 回默认再拆
}

type Unit =
  | { kind: 'block'; node: Element; pb?: boolean }
  | { kind: 'title'; secId: string; cls: string; html: string; pb?: boolean; dataKey?: string }
  | { kind: 'head'; secId: string; g: string; html: string; keep?: boolean; pb?: boolean; dataKey?: string; itemId?: string }
  | { kind: 'bullet'; secId: string; g: string; node: Element; keep?: boolean; pb?: boolean; flat?: boolean; dataKey?: string; itemId?: string }
  | { kind: 'para'; secId: string; node: Element; dataKey?: string }

function extractUnits(src: Element): Unit[] {
  const units: Unit[] = []
  let secSeq = 0, gid = 0
  Array.from(src.children).forEach(ch => {
    const body = ch.querySelector('.sec-body')
    if (ch.tagName === 'SECTION' && body) {
      const secId = 's' + secSeq++
      const titleEl = ch.querySelector('.sec-title')
      const dataKey = (ch as HTMLElement).dataset.key || ''
      units.push({ kind: 'title', secId, cls: ch.className, html: titleEl ? titleEl.outerHTML : '', pb: (ch as HTMLElement).dataset.pb === '1', dataKey })
      const kids = Array.from(body.children)
      const hasItems = kids.some(el => el.classList.contains('item'))

      if (!hasItems) {
        // 要点式（ul>li）或段落式（p）：逐个 li / p 作为单元，可跨页
        kids.forEach(el => {
          if (el.tagName === 'UL') {
            const g = 'g' + gid++
            Array.from(el.children).forEach(li => {
              units.push({ kind: 'bullet', secId, g, node: li, keep: false, pb: false, flat: true, dataKey })
            })
          } else {
            units.push({ kind: 'para', secId, node: el, dataKey })
          }
        })
        return
      }

      kids.forEach(item => {
        const head = item.querySelector('.item-head')
        const lis = Array.from(item.querySelectorAll('li'))
        const keep = (item as HTMLElement).dataset.keep === '1'
        const pb = (item as HTMLElement).dataset.pb === '1'
        const itemId = (item as HTMLElement).dataset.id || ''
        const g = 'g' + gid++
        if (head) units.push({ kind: 'head', secId, g, html: head.outerHTML, keep, pb, dataKey, itemId })
        lis.forEach((li, j) => {
          units.push({ kind: 'bullet', secId, g, node: li, keep, pb: j === 0 && !head ? pb : false, dataKey, itemId })
        })
      })
    } else {
      units.push({ kind: 'block', node: ch })
    }
  })
  return units
}

interface PageBox { el: HTMLDivElement; units: Unit[] }

function renderPage(pg: PageBox, docClass: string) {
  const el = pg.el
  el.innerHTML = ''
  const doc = document.createElement('div')
  doc.className = docClass
  el.appendChild(doc)

  let sec: HTMLElement | null = null
  let body: HTMLElement | null = null
  let item: HTMLElement | null = null
  let ul: HTMLElement | null = null
  let flatUl: HTMLElement | null = null
  let secId: string | null = null

  const openSection = (u: any) => {
    sec = document.createElement('section')
    sec.className = u.cls || 'sec'
    if (u.dataKey) (sec as HTMLElement).dataset.key = u.dataKey
    doc.appendChild(sec)
    body = document.createElement('div')
    body.className = 'sec-body'
    sec.appendChild(body)
    secId = u.secId
    item = null; ul = null; flatUl = null
  }

  pg.units.forEach(u => {
    if (u.kind === 'block') {
      doc.appendChild(u.node as Node)
      sec = body = item = ul = flatUl = null; secId = null
      return
    }
    if (secId !== u.secId || !sec) openSection(u)
    if (!body) return

    if (u.kind === 'title') {
      if (u.html) {
        sec!.insertAdjacentHTML('beforeend', u.html)
        // 标题必须排在 .sec-body 之前
        sec!.insertBefore(sec!.lastElementChild!, body)
      }
      return
    }
    if (u.kind === 'para') {
      body.appendChild(u.node as Node)
      return
    }
    if (u.kind === 'head') {
      item = document.createElement('div')
      item.className = 'item'
      if (u.itemId) (item as HTMLElement).dataset.id = u.itemId
      item.insertAdjacentHTML('beforeend', u.html)
      body.appendChild(item)
      ul = null; flatUl = null
      return
    }
    if (u.kind === 'bullet') {
      if (u.flat) {
        if (!flatUl) { flatUl = document.createElement('ul'); flatUl.className = 'skill-list'; body.appendChild(flatUl) }
        flatUl.appendChild(u.node as Node)
        return
      }
      if (!item) {
        item = document.createElement('div')
        item.className = 'item'
        if (u.itemId) (item as HTMLElement).dataset.id = u.itemId
        body.appendChild(item)
      }
      if (!ul) { ul = document.createElement('ul'); item.appendChild(ul) }
      ul.appendChild(u.node as Node)
    }
  })
}

/** 长段落断行：≥3 行、本页还剩 ≥2 行时，二分找切点 */
function splitBullet(pg: PageBox, u: Extract<Unit, { kind: 'bullet' }>, area: number) {
  const li = u.node as HTMLElement
  const full = li.textContent || ''
  if (!full.trim()) return null
  const cs = getComputedStyle(li)
  const lineH = parseFloat(cs.lineHeight) || 18

  li.textContent = full
  const totalH = li.offsetHeight
  if (Math.round(totalH / lineH) < 3) return null

  const docEl = pg.el.querySelector('.doc') as HTMLElement | null
  const used = docEl ? docEl.offsetHeight : 0
  const room = area - (used - totalH)
  if (room < lineH * 2) return null

  let lo = 1, hi = full.length - 1, best = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    li.textContent = full.slice(0, mid)
    const h = li.offsetHeight
    if (h <= room && Math.round(h / lineH) >= 2) { best = mid; lo = mid + 1 } else { hi = mid - 1 }
  }
  li.textContent = full
  if (!best) return null

  const tail = full.slice(best)
  li.textContent = tail
  const restLines = Math.round(li.offsetHeight / lineH)
  li.textContent = full
  if (restLines < 2) return null
  return { head: full.slice(0, best), tail }
}

/** 非末页均匀撑开：条目 8px、公司 20px、标题 24px 封顶 */
function stretch(sheet: HTMLElement, left: number) {
  const nLi = sheet.querySelectorAll('.doc li').length
  const nItem = sheet.querySelectorAll('.doc .item').length
  const nSec = sheet.querySelectorAll('.doc .sec').length
  if (!nLi && !nItem && !nSec) return

  let rest = left * 0.96
  let addLi = Math.min(rest, nLi * 8); rest -= addLi
  let addItem = Math.min(rest, nItem * 20); rest -= addItem
  let addSec = Math.min(rest, nSec * 24)

  const apply = () => {
    sheet.style.setProperty('--ex-li', nLi ? (addLi / nLi).toFixed(2) + 'px' : '0px')
    sheet.style.setProperty('--ex-item', nItem ? (addItem / nItem).toFixed(2) + 'px' : '0px')
    sheet.style.setProperty('--ex-sec', nSec ? (addSec / nSec).toFixed(2) + 'px' : '0px')
  }
  apply()

  // 撑开若导致溢出，按比例退回，宁可留白也不裁字
  for (let k = 0; k < 8 && sheet.scrollHeight > sheet.clientHeight + 1; k++) {
    addLi *= 0.6; addItem *= 0.6; addSec *= 0.6
    apply()
  }
}

export interface FitReport {
  pages: number
  compressed: boolean
  fontSize: number
  lineHeight: number
  minFontSize: number
  minLineHeight: number
}

export interface LayoutResult { pages: number; compressed: boolean; report: FitReport }

export function layout(docHtml: string, host: HTMLElement, opts: LayoutOpts): LayoutResult {
  const target: PageTarget = opts.targetPages ?? 'auto'

  function paginate(comp: Comp): PageBox[] {
    const temp = mkSheet(comp, opts)
    temp.innerHTML = docHtml
    const src = temp.firstElementChild as Element | null
    const docClass = src ? src.className : `doc doc-${opts.template}`
    const units = src ? extractUnits(src) : []
    temp.remove()

    const pages: PageBox[] = []
    let cur: PageBox

    const newPage = () => {
      const el = mkSheet(comp, opts)
      const pg: PageBox = { el, units: [] }
      pages.push(pg)
      cur = pg
      renderPage(cur, docClass)
      return pg
    }
    const area = () => contentArea(cur.el)
    const over = () => cur.el.scrollHeight > cur.el.clientHeight + 1

    const popDangling = () => {
      const out: Unit[] = []
      while (cur.units.length) {
        const last = cur.units[cur.units.length - 1]
        if (last.kind === 'title' || last.kind === 'head') { out.unshift(cur.units.pop() as Unit); continue }
        break
      }
      return out
    }

    newPage()
    const queue: Unit[] = units.slice()
    let guard = 0

    while (queue.length && guard++ < 4000) {
      const u = queue.shift() as Unit

      if (u.pb && cur.units.length) newPage()

      cur.units.push(u)
      renderPage(cur, docClass)
      if (!over()) continue

      if (u.kind === 'bullet') {
        const sp = splitBullet(cur, u, area())
        if (sp) {
          const tailLi = document.createElement('li')
          tailLi.textContent = sp.tail
          tailLi.dataset.split = '1'
          if ((u.node as HTMLElement).dataset.bi !== undefined) {
            tailLi.dataset.bi = (u.node as HTMLElement).dataset.bi
          }
          ;(u.node as HTMLElement).textContent = sp.head
          renderPage(cur, docClass)
          queue.unshift({
            kind: 'bullet', secId: u.secId, g: u.g, node: tailLi,
            keep: false, pb: false, flat: u.flat, dataKey: u.dataKey, itemId: u.itemId
          })
          continue
        }
      }

      let carry: Unit[] = [u]
      if (u.kind !== 'block' && u.keep && (u as any).g) {
        const g = (u as any).g as string
        const idx = cur.units.findIndex(x => (x as any).g === g)
        if (idx >= 0) carry = cur.units.splice(idx)
        else cur.units.pop()
      } else {
        cur.units.pop()
      }

      carry = popDangling().concat(carry)
      renderPage(cur, docClass)

      if (cur.units.length === 0) {
        cur.units.push(...carry)
        renderPage(cur, docClass)
        continue
      }

      newPage()
      cur.units.push(...carry)
      renderPage(cur, docClass)
    }

    pages.forEach((pg, i) => {
      if (i === pages.length - 1) return
      const docEl = pg.el.querySelector('.doc') as HTMLElement | null
      if (!docEl) return
      const left = contentArea(pg.el) - docEl.offsetHeight
      if (left >= 2) stretch(pg.el, left)
    })
    return pages
  }

  let comp: Comp
  let compressedApplied = false
  let pages: PageBox[]

  if (target === 'auto') {
    comp = decide(docHtml, opts)
    compressedApplied = comp !== COMP_DEF
    pages = paginate(comp)
  } else {
    const want = Number(target)
    const steps = ladder()
    let chosenIndex = 0
    let chosenPages: PageBox[] | null = null
    steps.forEach((s, i) => {
      if (chosenPages) return
      const trial = paginate(s)
      if (trial.length <= want) {
        chosenIndex = i
        chosenPages = trial
      } else {
        trial.forEach(pg => pg.el.remove())
      }
    })
    comp = steps[chosenIndex]
    compressedApplied = chosenIndex !== 0
    pages = chosenPages || paginate(comp)
  }

  host.innerHTML = ''
  pages.forEach(pg => {
    pg.el.style.zoom = ''
    pg.el.style.height = ''
    host.appendChild(pg.el)
  })

  const firstDoc = pages[0]?.el.querySelector('.doc') as HTMLElement | null
  const cs = firstDoc ? getComputedStyle(firstDoc) : null
  const fontSize = cs ? parseFloat(cs.fontSize) : 14
  const lineHeight = cs ? parseFloat(cs.lineHeight) / (fontSize || 1) : 1.66
  const report: FitReport = {
    pages: pages.length,
    compressed: compressedApplied,
    fontSize,
    lineHeight,
    minFontSize: 13.5,
    minLineHeight: 1.41
  }
  return { pages: pages.length, compressed: compressedApplied, report }
}
