/**
 * 内联编辑锚点：从被点中的 DOM 元素反推出"改的是哪一块"
 */
export type Target =
  | { kind: 'basics' }
  | { kind: 'bullet'; key: string; id: string; bi: number }
  | { kind: 'work'; key: string; id: string }
  | { kind: 'projects'; key: string; id: string }
  | { kind: 'education'; key: string; id: string }
  | { kind: 'custom-entry'; key: string; id: string }
  | { kind: 'skills'; key: string }
  | { kind: 'custom-list'; key: string }
  | { kind: 'custom-text'; key: string }
  | { kind: 'section-title'; key: string }

const CUSTOM_ENTRY = 'custom-entry'

export function hitTest(el: Element | null, sectionType: (key: string) => string): Target | null {
  if (!el) return null

  if (el.closest('.doc-head') || el.closest('.summary')) return { kind: 'basics' }

  const li = el.closest('li[data-bi]')
  const item = el.closest('[data-id]')
  const section = el.closest('[data-key]')

  if (li && item && section) {
    return {
      kind: 'bullet',
      key: (section as HTMLElement).dataset.key!,
      id: (item as HTMLElement).dataset.id!,
      bi: Number((li as HTMLElement).dataset.bi)
    }
  }

  if (item && section) {
    const key = (section as HTMLElement).dataset.key!
    const id = (item as HTMLElement).dataset.id!
    if (key === 'work') return { kind: 'work', key, id }
    if (key === 'projects') return { kind: 'projects', key, id }
    if (key === 'education') return { kind: 'education', key, id }
    if (sectionType(key) === 'entry') return { kind: CUSTOM_ENTRY, key, id }
  }

  if (section) {
    const key = (section as HTMLElement).dataset.key!
    const t = sectionType(key)
    if (key === 'skills' || t === 'list') return { kind: 'skills', key }
    if (t === 'text') return { kind: 'custom-text', key }
    if (key === 'education') return { kind: 'section-title', key }
    return { kind: 'section-title', key }
  }

  return null
}

/** 重排后按锚点重新找回元素 */
export function findAnchor(t: Target): HTMLElement | null {
  if (t.kind === 'basics') return document.querySelector('[data-region="basics"]')
  if ('id' in t) {
    const sel = t.kind === 'bullet' ? `[data-id="${t.id}"] li[data-bi="${t.bi}"]` : `[data-id="${t.id}"]`
    const el = document.querySelector(sel)
    if (el) return el as HTMLElement
  }
  return document.querySelector(`[data-key="${t.key}"]`) as HTMLElement | null
}

export const sameTarget = (a: Target | null, b: Target | null): boolean =>
  !!a && !!b && JSON.stringify(a) === JSON.stringify(b)
