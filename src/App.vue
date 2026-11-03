<script setup lang="ts">
import { onMounted, reactive, ref, shallowRef, watch, nextTick, computed } from 'vue'
import { sampleResume, blankResume, uid, type Resume, type TemplateId, type FontId, type DensityId, type CustomType } from './core/model'
import { normalize } from './core/store'
import { createHistory } from './core/history'
import {
  createLibrary, currentVersion, addVersion, updateVersion, addSnapshot,
  renameVersion as renameVersionIn, removeVersion, removeSnapshot, saveLibrary, loadLibrary,
  clearLibraryData, flushLibrary, serializeLibrary, deserializeLibrary,
  type Library
} from './core/versions'
import { buildDoc, toJSONResume } from './render/doc'
import { layout, type FitReport } from './layout/engine'

import OutlinePanel from './components/OutlinePanel.vue'
import { hitTest, findAnchor, type Target } from './inline/target'
import { formHTML } from './inline/inplace'
import ImportDialog from './components/ImportDialog.vue'
import StartScreen from './components/StartScreen.vue'
import AuditPanel from './components/AuditPanel.vue'
import SnapshotDialog from './components/SnapshotDialog.vue'
import DesignPanel from './components/DesignPanel.vue'
import AISettingsDialog from './components/AISettingsDialog.vue'
import AIReviewDialog from './components/AIReviewDialog.vue'
import PromptDialog from './components/PromptDialog.vue'
import { clearAISettings, loadAISettings, saveAISettings } from './ai/settings'
import type { AISettings } from './ai/types'

const resume = reactive<Resume>(sampleResume())
const wrap = ref<HTMLElement | null>(null)
const pages = ref(1)
const zoom = ref(0.82)
const importing = ref(false)
const showStart = ref(false)
const mode = ref<'edit' | 'design' | 'audit'>('edit')
const panelOpen = ref(false)
const snapshotOpen = ref(false)
const aiReviewOpen = ref(false)
const aiSettingsOpen = ref(false)
const aiBackedUp = ref(false)
const aiSettings = ref<AISettings>(loadAISettings())
interface PromptRequest {
  title: string
  label: string
  initial?: string
  allowEmpty?: boolean
  confirmText?: string
  resolve: (value: string | null) => void
}
const promptRequest = shallowRef<PromptRequest | null>(null)
const jsonInput = ref<HTMLInputElement | null>(null)
const backupInput = ref<HTMLInputElement | null>(null)
const backupMenuOpen = ref(false)
const editTarget = ref<Target | null>(null)
const showAddMenu = ref(false)
let editingActor: HTMLElement | null = null   // 正在原地编辑的那个块
let editingSheet: HTMLElement | null = null
let editingActive = false
let editingBackup = ''
let newlyCreatedTarget: Target | null = null
const ready = ref(false)
const booted = ref(false)
const compressed = ref(false)
const fit = ref<FitReport | null>(null)
const library = ref<Library | null>(null)
const currentId = ref('')
const versions = computed(() => library.value?.versions ?? [])
const snapshots = computed(() => currentVersion(library.value as any)?.snapshots ?? [])
const panelLabel = computed(() => mode.value === 'edit' ? '大纲' : mode.value === 'design' ? '设计' : '体检')
const histories = new Map<string, ReturnType<typeof createHistory>>()
const histVer = ref(0)          // 变化时刷新按钮可用状态
let applying = false            // 撤销/重做期间不回写历史
let histTimer: number | undefined

function askText(options: Omit<PromptRequest, 'resolve'>): Promise<string | null> {
  return new Promise(resolve => {
    promptRequest.value = { ...options, resolve }
  })
}

function resolvePrompt(value: string | null) {
  const current = promptRequest.value
  if (!current) return
  promptRequest.value = null
  current.resolve(value)
}

function hist() {
  const id = currentId.value || 'default'
  let h = histories.get(id)
  if (!h) { h = createHistory(100, 500); h.reset(JSON.stringify(resume)); histories.set(id, h) }
  return h
}

let renderTimer: number | undefined
function scheduleRender() {
  window.clearTimeout(renderTimer)
  renderTimer = window.setTimeout(doRender, 60)
}

function doRender() {
  if (editingActive) return
  if (!wrap.value) return
  const html = buildDoc(resume)
  const res = layout(html, wrap.value, {
    template: resume.meta.template,
    font: resume.meta.font,
    accent: resume.meta.accent,
    density: resume.meta.density,
    autoFit: resume.meta.autoFit,
    targetPages: resume.meta.targetPages
  })
  pages.value = res.pages
  compressed.value = res.compressed
  fit.value = res.report
}

const snapshot = () => JSON.stringify(resume)

function scheduleHistory() {
  window.clearTimeout(histTimer)
  histTimer = window.setTimeout(() => {
    if (applying) return
    hist().record(snapshot())
    histVer.value++
  }, 480)
}

function applySnapshot(snap: string | null) {
  if (!snap) return
  applying = true
  Object.assign(resume, normalize(JSON.parse(snap)))
  nextTick(() => {
    applying = false
    doRender()
    persist()
    histVer.value++
  })
}

function undo() { applySnapshot(hist().undo(snapshot())) }
function redo() { applySnapshot(hist().redo(snapshot())) }

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && editTarget.value) { closeEditor(); return }
  if (e.key === 'Escape' && panelOpen.value) { panelOpen.value = false; return }
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return
  const target = e.target as HTMLElement | null
  if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
  const k = e.key.toLowerCase()
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
}

function flash(el: HTMLElement | null | undefined) {
  if (!el) return
  el.classList.add('flash')
  window.setTimeout(() => el.classList.remove('flash'), 1200)
}

/** 点大纲里的一行：编辑表单与预览同时定位 */
function locate(key: string, id?: string) {
  if (window.matchMedia('(max-width: 900px)').matches) panelOpen.value = false
  const formId = id ? 'item-' + id : 'sec-' + key
  const formEl = document.getElementById(formId) || document.getElementById('sec-work')
  formEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flash(formEl)

  const sel = id ? `[data-id="${id}"]` : `[data-key="${key}"]`
  const paperEl = wrap.value?.querySelector(sel) as HTMLElement | null
  paperEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flash(paperEl)

  if (paperEl) {
    setTimeout(() => {
      const t = id ? hitTest(paperEl, sectionTypeOf) : (firstTargetOf(key) || ({ kind: 'section-title', key } as Target))
      if (t) openEditorTarget(t)
    }, 320)
  }
}

function focusAddModule() {
  const el = document.querySelector('.add-row') as HTMLElement | null
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flash(el)
}

function sectionTypeOf(key: string): string {
  if (key === 'work' || key === 'projects' || key === 'skills' || key === 'education') return key
  return (resume.meta.customSections || []).find(s => s.id === key)?.type || 'text'
}

/** 决定表单插到哪个元素里：条目替换整块，模块标题只替换标题，列表模块替换正文 */
function holderFor(t: Target): HTMLElement | null {
  const el = findAnchor(t)
  if (!el) return null
  if (t.kind === 'section-title') return (el.querySelector('.sec-title') as HTMLElement) || el
  if ('id' in t) return (el.closest('[data-id]') as HTMLElement) || el
  return (el.querySelector('.sec-body') as HTMLElement) || el
}

/** 点模块时默认打开第一块内容，而不是只改标题 */
function firstTargetOf(key: string): Target | null {
  if (key === 'work' && resume.work[0]) return { kind: 'work', key, id: resume.work[0].id }
  if (key === 'projects' && resume.projects[0]) return { kind: 'projects', key, id: resume.projects[0].id }
  if (key === 'education' && resume.education[0]) return { kind: 'education', key, id: resume.education[0].id }
  const sec = (resume.meta.customSections || []).find(s => s.id === key)
  if (sec?.type === 'entry' && sec.entries[0]) return { kind: 'custom-entry', key, id: sec.entries[0].id }
  if (sec?.type === 'list') return { kind: 'skills', key }
  if (sec?.type === 'text') return { kind: 'custom-text', key }
  if (key === 'skills') return { kind: 'skills', key }
  return null
}

/** 空模块被点时，先补一条空条目，再编辑它 */
function ensureFirstItem(t: Target): Target | null {
  if (t.kind !== 'section-title') return null
  const key = t.key
  if (key === 'work' && !resume.work.length) {
    resume.work.push({ id: uid('w'), company: '', role: '', start: '', end: '', highlights: [] })
    return { kind: 'work', key, id: resume.work[0].id }
  }
  if (key === 'projects' && !resume.projects.length) {
    resume.projects.push({ id: uid('p'), name: '', role: '', highlights: [] })
    return { kind: 'projects', key, id: resume.projects[0].id }
  }
  if (key === 'education' && !resume.education.length) {
    resume.education.push({ id: uid('e'), institution: '', area: '', studyType: '', start: '', end: '' })
    return { kind: 'education', key, id: resume.education[0].id }
  }
  if (key !== 'work' && key !== 'projects' && key !== 'education') {
    const sec = (resume.meta.customSections || []).find(s => s.id === key)
    if (sec && sec.type === 'entry' && !sec.entries.length) {
      sec.entries.push({ id: uid('en'), title: '', subtitle: '', time: '', bullets: [] })
      return { kind: 'custom-entry', key, id: sec.entries[0].id }
    }
  }
  return null
}

/** 点预览里的内容 → 当场展开成表单 */
function openEditor(e: MouseEvent) {
  let t = hitTest(e.target as Element, sectionTypeOf)
  if (!t) return
  const created = ensureFirstItem(t)
  if (created) {
    newlyCreatedTarget = created
    doRender()
    t = { ...created, id: created.id } as Target
    nextTick(() => openEditorTarget(created))
    return
  }
  openEditorTarget(t)
}

function openEditorTarget(t: Target) {
  if (editTarget.value) finishInline()
  showAddMenu.value = false

  const holder = holderFor(t)
  if (!holder) return
  const html = formHTML(t, resume)
  if (!html) return

  editingActor = holder
  editingBackup = holder.innerHTML
  editingSheet = holder.closest('.sheet') as HTMLElement
  editingActive = true
  editTarget.value = t

  holder.innerHTML = html
  holder.classList.add('if-editing')
  editingSheet?.classList.add('if-sheet')
  nextTick(() => {
    const first = holder.querySelector('input, textarea') as HTMLInputElement | null
    first?.focus()
    first?.setSelectionRange?.(first.value.length, first.value.length)
  })
}

function finishInline() {
  if (!editingActive) return
  editingActive = false
  if (editingActor) {
    editingActor.classList.remove('if-editing')
    editingActor.innerHTML = editingBackup
    editingActor = null
  }
  editingSheet?.classList.remove('if-sheet')
  editingSheet = null
  editingBackup = ''
  editTarget.value = null
  pruneEmptyCreatedTarget()
  doRender()
}

function isEmptyTarget(t: Target): boolean {
  if (t.kind === 'work') {
    const item = resume.work.find(x => x.id === t.id)
    return !!item && ![item.company, item.role, item.start, item.end, ...item.highlights].some(x => String(x || '').trim())
  }
  if (t.kind === 'projects') {
    const item = resume.projects.find(x => x.id === t.id)
    return !!item && ![item.name, item.role, ...item.highlights].some(x => String(x || '').trim())
  }
  if (t.kind === 'education') {
    const item = resume.education.find(x => x.id === t.id)
    return !!item && ![item.institution, item.area, item.studyType, item.start, item.end].some(x => String(x || '').trim())
  }
  if (t.kind === 'custom-entry') {
    const item = resume.meta.customSections.find(x => x.id === t.key)?.entries.find(x => x.id === t.id)
    return !!item && ![item.title, item.subtitle, item.time, ...item.bullets].some(x => String(x || '').trim())
  }
  return false
}

function pruneEmptyCreatedTarget() {
  const t = newlyCreatedTarget
  newlyCreatedTarget = null
  if (!t || !isEmptyTarget(t)) return
  if (t.kind === 'work') resume.work = resume.work.filter(x => x.id !== t.id)
  else if (t.kind === 'projects') resume.projects = resume.projects.filter(x => x.id !== t.id)
  else if (t.kind === 'education') resume.education = resume.education.filter(x => x.id !== t.id)
  else if (t.kind === 'custom-entry') {
    const sec = resume.meta.customSections.find(x => x.id === t.key)
    if (sec) sec.entries = sec.entries.filter(x => x.id !== t.id)
  }
}

/** 原地表单里的输入：直接改状态，不重排 */
function onWrapInput(e: Event) {
  if (!editingActive) return
  const el = e.target as HTMLInputElement | HTMLTextAreaElement
  const k = el.dataset.k, f = el.dataset.f
  if (!k || !f) return
  const v = el.value
  const [kind, a, b] = k.split(':')

  if (kind === 'basics') { (resume.basics as any)[f] = v; return }
  if (kind === 'work') {
    const w = resume.work.find(x => x.id === a); if (!w) return
    if (f === 'bullet') w.highlights[Number(el.dataset.i)] = v
    else (w as any)[f] = v
    return
  }
  if (kind === 'projects') {
    const p = resume.projects.find(x => x.id === a); if (!p) return
    if (f === 'bullet') p.highlights[Number(el.dataset.i)] = v
    else (p as any)[f] = v
    return
  }
  if (kind === 'education') {
    const ed = resume.education.find(x => x.id === a); if (!ed) return
    ;(ed as any)[f] = v
    return
  }
  if (kind === 'entry') {
    const sec = (resume.meta.customSections || []).find(s => s.id === a)
    const en = sec?.entries.find(x => x.id === b); if (!en) return
    if (f === 'bullet') en.bullets[Number(el.dataset.i)] = v
    else (en as any)[f] = v
    return
  }
  if (kind === 'skills') { resume.skills = v.split('\n'); return }
  if (kind === 'list') {
    const sec = (resume.meta.customSections || []).find(s => s.id === a)
    if (sec) sec.list = v.split('\n')
    return
  }
  if (kind === 'text') {
    const sec = (resume.meta.customSections || []).find(s => s.id === a)
    if (sec) sec.text = v
    return
  }
  if (kind === 'title') {
    const sec = (resume.meta.customSections || []).find(s => s.id === a)
    if (sec) sec.title = v
    else resume.meta.titles[a] = v
  }
}

function bulletListFor(k: string): string[] | null {
  const [kind, a, b] = k.split(':')
  if (kind === 'work') return resume.work.find(x => x.id === a)?.highlights || null
  if (kind === 'projects') return resume.projects.find(x => x.id === a)?.highlights || null
  if (kind === 'entry') {
    const sec = (resume.meta.customSections || []).find(s => s.id === a)
    return sec?.entries.find(x => x.id === b)?.bullets || null
  }
  return null
}

function parentTargetForBullet(t: Extract<Target, { kind: 'bullet' }>): Target {
  if (t.key === 'work') return { kind: 'work', key: t.key, id: t.id }
  if (t.key === 'projects') return { kind: 'projects', key: t.key, id: t.id }
  return { kind: 'custom-entry', key: t.key, id: t.id }
}

function onWrapKeydown(e: KeyboardEvent) {
  if (!editingActive || e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return
  const el = e.target as HTMLTextAreaElement | null
  if (!el || el.tagName !== 'TEXTAREA' || el.dataset.f !== 'bullet' || !el.dataset.k) return
  const list = bulletListFor(el.dataset.k)
  const index = Number(el.dataset.i)
  if (!list || (!list[index] && list[index] !== '')) return
  e.preventDefault()
  const caret = el.selectionStart ?? el.value.length
  list[index] = el.value.slice(0, caret)
  list.splice(index + 1, 0, el.value.slice(caret))
  const current = editTarget.value
  if (!current) return
  const target = current.kind === 'bullet' ? parentTargetForBullet(current) : current
  const holder = holderFor(target)
  if (!holder) return
  editTarget.value = target
  editingActor = holder
  editingActor.classList.add('if-editing')
  editingActor.innerHTML = formHTML(target, resume)
  nextTick(() => {
    const next = editingActor?.querySelector(`[data-f="bullet"][data-i="${index + 1}"]`) as HTMLTextAreaElement | null
    next?.focus()
    next?.setSelectionRange(0, 0)
  })
}

/** 原地表单里的按钮：加要点 / 删要点 / 完成 */
function onWrapClick(e: MouseEvent) {
  if (editingActive) {
    const btn = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null
    if (btn) {
      const act = btn.dataset.act
      const k = btn.dataset.k || ''
      const i = Number(btn.dataset.i)
      const [kind, a, b] = k.split(':')
      const bulletsOf = (): string[] | null => {
        if (kind === 'work') return resume.work.find(x => x.id === a)?.highlights || null
        if (kind === 'projects') return resume.projects.find(x => x.id === a)?.highlights || null
        if (kind === 'entry') {
          const sec = (resume.meta.customSections || []).find(s => s.id === a)
          return sec?.entries.find(x => x.id === b)?.bullets || null
        }
        return null
      }
      if (act === 'done') { finishInline(); return }
      if (act === 'add-item') {
        const t = editTarget.value!
        finishInline()
        nextTick(() => {
          const created = ensureFirstItem({ kind: 'section-title', key: t.kind === 'section-title' ? t.key : (t as any).key } as Target)
            || null
          const key = t.kind === 'section-title' ? t.key : (t as any).key
          let target: Target | null = created
          if (!target) {
            // 已有内容时，追加一条新的空记录
            if (key === 'work') { resume.work.push({ id: uid('w'), company: '', role: '', start: '', end: '', highlights: [] }); target = { kind: 'work', key, id: resume.work[resume.work.length - 1].id } }
            else if (key === 'projects') { resume.projects.push({ id: uid('p'), name: '', role: '', highlights: [] }); target = { kind: 'projects', key, id: resume.projects[resume.projects.length - 1].id } }
            else if (key === 'education') { resume.education.push({ id: uid('e'), institution: '', area: '', studyType: '', start: '', end: '' }); target = { kind: 'education', key, id: resume.education[resume.education.length - 1].id } }
            else {
              const s = (resume.meta.customSections || []).find(x => x.id === key)
              if (s) { s.entries.push({ id: uid('en'), title: '', subtitle: '', time: '', bullets: [] }); target = { kind: 'custom-entry', key, id: s.entries[s.entries.length - 1].id } }
            }
          }
          newlyCreatedTarget = target
          doRender()
          if (target) nextTick(() => openEditorTarget(target!))
        })
        return
      }
      if (act === 'add') {
        const list = bulletsOf(); if (!list) return
        list.push('')
        const t = editTarget.value!
        editingActive = false
        const holder = holderFor(t)
        editingActive = true
        if (holder) {
          editingActor = holder
          holder.innerHTML = formHTML(t, resume)
          nextTick(() => {
            const areas = holder.querySelectorAll('textarea')
            ;(areas[areas.length - 1] as HTMLTextAreaElement)?.focus()
          })
        }
        return
      }
      if (act === 'del') {
        const list = bulletsOf(); if (!list) return
        list.splice(i, 1)
        const t = editTarget.value!
        editingActive = false
        const holder = holderFor(t)
        editingActive = true
        if (holder) {
          editingActor = holder
          holder.innerHTML = formHTML(t, resume)
        }
        return
      }
    }
    e.stopPropagation()
    return
  }
  openEditor(e)
}

function closeEditor() {
  finishInline()
}

type Preset = 'work' | 'projects' | 'education' | 'skills' | 'advantage' | 'certs' | 'summary' | 'custom'

/** 新增模块：内置模块直接定位过去（不重复建），自定义模块按标题复用 */
async function addPreset(preset: Preset) {
  showAddMenu.value = false
  const m = resume.meta

  if (preset === 'work' || preset === 'projects' || preset === 'education' || preset === 'skills') {
    m.hidden = (m.hidden || []).filter(k => k !== preset)
    if (!m.order.includes(preset)) m.order.unshift(preset)
    nextTick(() => {
      doRender()
      nextTick(() => openEditorTarget(firstTargetOf(preset) || ({ kind: 'section-title', key: preset } as Target)))
    })
    return
  }

  const presetMap: Record<string, { title: string; type: CustomType }> = {
    advantage: { title: '个人优势', type: 'text' },
    certs: { title: '证书', type: 'list' },
    summary: { title: '自我评价', type: 'text' }
  }

  let id = ''
  if (preset === 'custom') {
    const name = await askText({ title: '新增自定义模块', label: '模块名称', initial: '自定义模块' })
    if (name === null) return
    id = 'sec_' + Date.now().toString(36)
    m.customSections.push({ id, title: name, type: 'entry', entries: [], list: [], text: '' })
    m.order.push(id)
  } else {
    const conf = presetMap[preset]
    const exist = (m.customSections || []).find(s => s.title === conf.title)
    if (exist) {
      id = exist.id
      m.order = m.order.includes(id) ? m.order : [...m.order, id]
    } else {
      id = 'sec_' + Date.now().toString(36)
      m.customSections.push({ id, title: conf.title, type: conf.type, entries: [], list: [], text: '' })
      m.order.push(id)
    }
  }

  nextTick(() => {
    doRender()
    nextTick(() => openEditorTarget({ kind: 'section-title', key: id }))
  })
}

function fitZoom() {
  const stage = wrap.value?.parentElement
  if (!stage) return
  const avail = Math.max(240, stage.clientWidth - 56)
  zoom.value = Math.max(0.35, Math.min(0.96, avail / 794))
  document.documentElement.style.setProperty('--z', String(zoom.value))
}

let ro: ResizeObserver | null = null
function watchStage() {
  const stage = wrap.value?.parentElement
  if (!stage || typeof ResizeObserver === 'undefined') return
  ro?.disconnect()
  let last = 0
  ro = new ResizeObserver(() => {
    const w = stage.clientWidth
    if (Math.abs(w - last) < 2) return
    last = w
    fitZoom()
  })
  ro.observe(stage)
}

onMounted(async () => {
  // 支持 ?tpl=su&font=yahei&density=compact 深链，方便演示与截图
  const q = new URLSearchParams(location.search)
  const tpl = q.get('tpl'), font = q.get('font'), dens = q.get('density'), accent = q.get('accent')
  if (tpl) {
    resume.meta.template = tpl as TemplateId
    if (tpl === 'en') resume.meta.lang = 'en'
  }
  if (font) resume.meta.font = font as FontId
  if (dens) resume.meta.density = dens as DensityId
  if (accent) resume.meta.accent = '#' + accent.replace('#', '')
  if (q.get('import')) importing.value = true
  if (q.get('audit')) mode.value = 'audit'

  // 测试钩子：仅供 Playwright 使用，?test=1 时才挂载
  if (q.get('test')) {
    ;(window as any).__ps = {
      set: async (data: any, opts?: { autoFit?: boolean }) => {
        Object.assign(resume, normalize(data))
        if (opts && typeof opts.autoFit === 'boolean') resume.meta.autoFit = opts.autoFit
        await nextTick()
        doRender()
      },
      stats: () => ({ pages: pages.value, compressed: compressed.value }),
      resume: () => JSON.parse(JSON.stringify(resume))
    }
  }

  ready.value = true
  hist().reset(snapshot())
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', () => fitZoom())
  window.addEventListener('beforeunload', () => {
    ro?.disconnect()
    void flushLibrary()
  })
  window.addEventListener('pagehide', () => { void flushLibrary() })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushLibrary()
  })

  // ?fresh=1 时跳过读取，测试用，避免上一个用例的数据串进来
  if (q.get('fresh')) {
    booted.value = true
    await nextTick()
    fitZoom()
    doRender()
    watchStage()
    return
  }

  // 读取完成前显示明确的载入态，避免把内置示例误认为用户简历。
  try {
    const lib = await loadLibrary()
    if (!lib) {
      showStart.value = true
    } else {
      library.value = lib
      currentId.value = lib.currentId
      const v = currentVersion(lib)
      if (v) {
        applying = true
        Object.assign(resume, normalize(v.resume))
      }
    }
  } catch {
    showStart.value = true
  } finally {
    booted.value = true
    await nextTick()
    applying = false
    fitZoom()
    doRender()
    watchStage()
    hist().reset(snapshot())
    histVer.value++
  }
})

function persist() {
  if (!library.value || !currentId.value) return
  library.value = updateVersion(library.value, currentId.value, JSON.parse(JSON.stringify(resume)))
  saveLibrary(library.value)
}

watch(resume, () => {
  if (!ready.value || applying) return
  persist()
  scheduleRender()
  scheduleHistory()
}, { deep: true })

watch(() => [resume.meta.template, resume.meta.font, resume.meta.accent, resume.meta.density, resume.meta.autoFit], () => {
  if (ready.value) scheduleRender()
})

const canUndo = computed(() => histVer.value >= 0 && hist().canUndo())
const canRedo = computed(() => histVer.value >= 0 && hist().canRedo())

function playSample() {
  finishInline()
  Object.assign(resume, sampleResume())
  setTimeout(() => { hist().record(snapshot()); histVer.value++ }, 30)
}
function printDoc() { window.print() }

function exportJSON() {
  const blob = new Blob([JSON.stringify(toJSONResume(resume), null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = (resume.basics.name || 'resume').replace(/\s/g, '') + '.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}

function exportLibraryBackup() {
  backupMenuOpen.value = false
  const data = library.value || createLibrary(JSON.parse(JSON.stringify(resume)), '我的简历')
  const blob = new Blob([serializeLibrary(data)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `paperstack-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}

async function restoreLibraryBackup(e: Event) {
  backupMenuOpen.value = false
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const lib = deserializeLibrary(await file.text())
  if (!lib) {
    alert('这不是有效的纸栈完整备份文件。')
    return
  }
  if (!confirm('恢复完整备份会替换当前所有版本和快照，是否继续？')) return
  finishInline()
  library.value = lib
  currentId.value = lib.currentId
  saveLibrary(lib)
  applying = true
  Object.assign(resume, currentVersion(lib)!.resume)
  showStart.value = false
  nextTick(() => {
    applying = false
    fitZoom()
    doRender()
    hist().reset(snapshot())
    histVer.value++
  })
}

async function importJSON(e: Event) {
  finishInline()
  const el = e.target as HTMLInputElement
  const f = el.files?.[0]
  if (!f) return
  try {
    const data = JSON.parse(await f.text())
    Object.assign(resume, normalize(data))
    nextTick(doRender)
  } catch {
    alert('这个文件读不了，确认是纸栈或 JSON Resume 格式的 JSON')
  }
  el.value = ''
}

function startBlank() {
  finishInline()
  const blank = blankResume()
  const base = library.value
  library.value = base
    ? addVersion(base, `版本 ${base.versions.length + 1}`, blank)
    : createLibrary(blank, '我的简历')
  currentId.value = library.value.currentId
  saveLibrary(library.value)
  applying = true
  Object.assign(resume, blank)
  showStart.value = false
  nextTick(() => {
    applying = false
    doRender()
    hist().reset(snapshot())
    histVer.value++
  })
}

function restoreSnapshot(id: string) {
  finishInline()
  const lib = library.value
  if (!lib || !currentId.value) return
  const v = currentVersion(lib)
  const s = v?.snapshots.find(x => x.id === id)
  if (!s) return
  library.value = addVersion(lib, `恢复「${s.name}」`, JSON.parse(JSON.stringify(s.resume)))
  currentId.value = library.value.currentId
  saveLibrary(library.value)
  snapshotOpen.value = false
  applying = true
  Object.assign(resume, normalize(s.resume))
  nextTick(() => {
    applying = false
    doRender()
    hist().reset(snapshot())
    histVer.value++
  })
}

function saveSnapshot(name: string) {
  const lib = library.value
  if (!lib || !currentId.value) return
  const before = lib.versions.find(v => v.id === currentId.value)?.snapshots.length || 0
  const next = addSnapshot(lib, currentId.value, name, JSON.parse(JSON.stringify(resume)))
  if (next === lib || (next.versions.find(v => v.id === currentId.value)?.snapshots.length || 0) === before) {
    alert('快照已达上限，请先删除不再需要的快照。系统不会自动删除旧快照。')
    return
  }
  library.value = next
  saveLibrary(library.value)
}

function deleteSnapshot(snapshotId: string) {
  const lib = library.value
  if (!lib || !currentId.value || !confirm('删除这个快照？此操作不可恢复')) return
  library.value = removeSnapshot(lib, currentId.value, snapshotId)
  saveLibrary(library.value)
}

function saveAISettingsAndClose(value: AISettings) {
  aiSettings.value = saveAISettings(value)
  aiSettingsOpen.value = false
}

function backupBeforeAI() {
  const lib = library.value
  if (!lib || !currentId.value) {
    alert('当前简历还没有保存为版本；采用 AI 建议时会创建新版本，原内容不会覆盖。')
    return
  }
  const before = lib.versions.find(v => v.id === currentId.value)?.snapshots.length || 0
  const next = addSnapshot(lib, currentId.value, 'AI 修改前', JSON.parse(JSON.stringify(resume)))
  const after = next.versions.find(v => v.id === currentId.value)?.snapshots.length || 0
  if (after === before) {
    alert('快照已达上限，请先删除旧快照，再保存 AI 修改前快照。')
    return
  }
  library.value = next
  saveLibrary(library.value)
  aiBackedUp.value = true
}

function applyAIVersion(value: { resume: Resume; name: string }) {
  finishInline()
  const base = library.value || createLibrary(JSON.parse(JSON.stringify(resume)), '原版本')
  library.value = addVersion(base, value.name || 'AI 优化版', normalize(value.resume))
  currentId.value = library.value.currentId
  saveLibrary(library.value)
  applying = true
  Object.assign(resume, normalize(value.resume))
  aiReviewOpen.value = false
  aiBackedUp.value = false
  nextTick(() => {
    applying = false
    doRender()
    hist().reset(snapshot())
    histVer.value++
  })
}

function applyImport(r: Resume) {
  finishInline()
  // 导入永远新建版本，不覆盖已有内容
  const name = `导入 ${new Date().toLocaleDateString('zh-CN')}`
  const base = library.value || createLibrary(JSON.parse(JSON.stringify(resume)))
  library.value = addVersion(base, name, r)
  currentId.value = library.value.currentId
  saveLibrary(library.value)
  applying = true
  Object.assign(resume, normalize(r))
  importing.value = false
  showStart.value = false
  nextTick(() => {
    applying = false
    doRender()
    hist().reset(snapshot())
    histVer.value++
  })
}

function onAuditLocate(target?: string) {
  mode.value = 'edit'
  if (window.matchMedia('(max-width: 900px)').matches) panelOpen.value = false
  nextTick(() => {
    if (target === 'basics') {
      const el = wrap.value?.querySelector('[data-region="basics"]') as HTMLElement | null
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      flash(el)
      openEditorTarget({ kind: 'basics' })
      return
    }
    locate(target || 'work')
  })
}

function switchVersion() {
  finishInline()
  const lib = library.value
  if (!lib) return
  const v = lib.versions.find(x => x.id === currentId.value)
  if (!v) return
  library.value = { ...lib, currentId: currentId.value }
  saveLibrary(library.value)
  applying = true
  Object.assign(resume, normalize(v.resume))
  nextTick(() => {
    applying = false
    doRender()
    histVer.value++
  })
}

async function newVersion() {
  finishInline()
  const base = library.value || createLibrary(JSON.parse(JSON.stringify(resume)))
  const name = await askText({ title: '新建版本', label: '版本名称', initial: `版本 ${base.versions.length + 1}` })
  if (name === null) return
  library.value = addVersion(base, name, JSON.parse(JSON.stringify(resume)))
  currentId.value = library.value.currentId
  saveLibrary(library.value)
  showStart.value = false
  histVer.value++
}

async function renameCurrent() {
  const lib = library.value
  if (!lib) return
  const v = lib.versions.find(x => x.id === currentId.value)
  if (!v) return
  const name = await askText({ title: '重命名版本', label: '版本名称', initial: v.name })
  if (name === null) return
  library.value = renameVersionIn(lib, v.id, name)
  saveLibrary(library.value)
}

async function clearAllData() {
  finishInline()
  if (!confirm('确定清空所有简历、快照和 DeepSeek 设置？此操作不可恢复')) return
  if (!confirm('再次确认：真的要清空全部数据吗？')) return
  await clearLibraryData()
  aiSettings.value = clearAISettings()
  library.value = null
  currentId.value = ''
  snapshotOpen.value = false
  showStart.value = true
  Object.assign(resume, blankResume())
  nextTick(doRender)
}

function deleteCurrent() {
  finishInline()
  const lib = library.value
  if (!lib || lib.versions.length <= 1) return alert('至少要保留一个版本')
  const v = lib.versions.find(x => x.id === currentId.value)
  if (!v || !confirm(`删除版本「${v.name}」？此操作不可撤销`)) return
  library.value = removeVersion(lib, v.id)
  currentId.value = library.value.currentId
  saveLibrary(library.value)
  switchVersion()
}

function setMode(next: 'edit' | 'design' | 'audit') {
  finishInline()
  mode.value = next
  panelOpen.value = false
}

function openStart() {
  finishInline()
  showStart.value = true
}

function openImport() {
  finishInline()
  importing.value = true
}

function openAIReview() {
  finishInline()
  aiBackedUp.value = false
  aiReviewOpen.value = true
}

function openSnapshot() {
  finishInline()
  snapshotOpen.value = true
}

async function renameModule(key: string) {
  const sec = (resume.meta.customSections || []).find(x => x.id === key)
  const current = sec ? sec.title : (resume.meta.titles[key] || '')
  const name = await askText({
    title: '修改模块名称',
    label: '模块名称（留空则不在简历中显示标题）',
    initial: current,
    allowEmpty: true
  })
  if (name === null) return
  if (sec) sec.title = name
  else resume.meta.titles[key] = name
}
</script>

<template>
  <div v-if="!booted" class="boot-screen">
    <span class="boot-mark">纸栈</span>
    <span>正在读取本机简历…</span>
  </div>
  <StartScreen v-else-if="showStart" :can-copy="versions.length > 0" @import="importing = true"
    @blank="startBlank" @copy="newVersion" @restore="backupInput?.click()" />
  <template v-else>
  <header class="topbar">
    <div class="brand">
      <span class="logo">纸栈</span>
      <span class="logo-sub">PAPERSTACK</span>
      <span class="brand-note"><i /> 本机</span>
    </div>
    <div class="mode-switch" aria-label="工作模式">
      <button :aria-pressed="mode === 'edit'" @click="setMode('edit')">编辑</button>
      <button :aria-pressed="mode === 'design'" @click="setMode('design')">设计</button>
      <button :aria-pressed="mode === 'audit'" @click="setMode('audit')">体检</button>
    </div>
    <div class="acts history-actions" aria-label="撤销与重做">
      <button class="btn" :disabled="!canUndo" title="撤销 Ctrl+Z" @click="undo">↶</button>
      <button class="btn" :disabled="!canRedo" title="重做 Ctrl+Y" @click="redo">↷</button>
    </div>
    <div class="ver version-cluster">
      <select v-model="currentId" class="ver-select" title="切换版本" @change="switchVersion">
        <option v-for="v in versions" :key="v.id" :value="v.id">{{ v.name }}</option>
      </select>
      <button class="btn" title="新建简历" @click="openStart">＋</button>
      <button class="btn" title="重命名当前版本" @click="renameCurrent">✎</button>
      <button class="btn" title="删除当前版本" @click="deleteCurrent">✕</button>
      <button class="btn" title="快照" @click="openSnapshot">快照</button>
      <button class="btn" title="清空全部数据" @click="clearAllData">清空数据</button>
    </div>
    <div class="spacer" />
    <div class="top-actions">
      <div class="action-cluster">
        <button class="btn" @click="openImport">导入简历</button>
        <button class="btn" @click="openAIReview">AI 优化</button>
        <button class="btn" @click="playSample">示例</button>
      </div>
      <div class="action-cluster">
        <button class="btn" @click="exportJSON">存 JSON</button>
        <button class="btn" :aria-expanded="backupMenuOpen" @click="backupMenuOpen = !backupMenuOpen">备份</button>
        <button class="btn" @click="jsonInput?.click()">读 JSON</button>
      </div>
      <div class="action-cluster action-cluster-output">
        <button class="btn" :aria-pressed="resume.meta.autoFit" @click="resume.meta.autoFit = !resume.meta.autoFit">压到一页</button>
        <button class="btn primary" @click="printDoc">导出 PDF</button>
      </div>
    </div>
  </header>

  <main class="workspace" :class="[`mode-${mode}`, { 'panel-open': panelOpen }]">
    <OutlinePanel v-if="mode === 'edit'" :resume="resume" @locate="locate" @add="showAddMenu = true" @rename="renameModule" />
    <DesignPanel v-else-if="mode === 'design'" :resume="resume" :fit="fit" />
    <AuditPanel v-else :resume="resume" @locate="onAuditLocate" />

    <section class="stage">
      <div class="stage-bar">
        <button class="btn mobile-panel-toggle" type="button" @click="panelOpen = true">打开{{ panelLabel }}</button>
        <span class="meta">{{ pages }} 页</span>
        <span class="stage-copy">写清楚，比写满更重要。</span>
        <span class="meta" style="margin-left:auto">{{ Math.round(zoom * 100) }}%</span>
      </div>

      <div ref="wrap" class="sheet-wrap" @click="onWrapClick" @input="onWrapInput" @keydown="onWrapKeydown" />
    </section>
  </main>
  <div v-if="panelOpen" class="mobile-panel-mask" @click="panelOpen = false" />
  <button v-if="panelOpen" class="mobile-panel-close" type="button" aria-label="关闭侧栏" @click="panelOpen = false">×</button>
  </template>

  <div v-if="showAddMenu" class="add-menu-mask" @click.self="showAddMenu = false">
    <div class="add-menu">
      <div class="add-menu-title">新增模块</div>
      <button @click="addPreset('advantage')">个人优势</button>
      <button @click="addPreset('work')">工作经历</button>
      <button @click="addPreset('projects')">项目经历</button>
      <button @click="addPreset('education')">教育经历</button>
      <button @click="addPreset('skills')">技能</button>
      <button @click="addPreset('certs')">证书 / 获奖</button>
      <button @click="addPreset('summary')">自我评价</button>
      <div class="add-menu-sep" />
      <button @click="addPreset('custom')">自定义模块（名字自己起）</button>
    </div>
  </div>
  <div v-if="backupMenuOpen" class="backup-menu-mask" @click.self="backupMenuOpen = false">
    <div class="backup-menu">
      <div class="add-menu-title">完整数据备份</div>
      <button type="button" @click="exportLibraryBackup">下载全部版本与快照</button>
      <button type="button" @click="backupInput?.click()">从备份文件恢复</button>
      <p>不包含 DeepSeek API Key。</p>
    </div>
  </div>

  <ImportDialog v-if="importing" @close="importing = false" @apply="applyImport" />
  <AIReviewDialog v-if="aiReviewOpen" :resume="resume" :settings="aiSettings" :backed-up="aiBackedUp"
    @close="aiReviewOpen = false" @settings="aiSettingsOpen = true" @backup="backupBeforeAI" @apply="applyAIVersion" />
  <AISettingsDialog v-if="aiSettingsOpen" :settings="aiSettings"
    @close="aiSettingsOpen = false" @save="saveAISettingsAndClose" />
  <PromptDialog v-if="promptRequest" :title="promptRequest.title" :label="promptRequest.label"
    :initial="promptRequest.initial" :allow-empty="promptRequest.allowEmpty" :confirm-text="promptRequest.confirmText"
    @confirm="resolvePrompt" @cancel="resolvePrompt(null)" />
  <SnapshotDialog v-if="snapshotOpen" :snapshots="snapshots" :resume="resume" @close="snapshotOpen = false"
    @save="saveSnapshot" @restore="restoreSnapshot" @delete="deleteSnapshot" />
  <input ref="jsonInput" type="file" accept=".json,application/json" hidden @change="importJSON" />
  <input ref="backupInput" type="file" accept=".json,application/json" aria-label="恢复完整备份文件" hidden @change="restoreLibraryBackup" />
</template>
