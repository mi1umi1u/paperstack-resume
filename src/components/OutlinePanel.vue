<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Resume, WorkItem, ProjectItem, CustomEntry, CustomSection } from '../core/model'

const props = defineProps<{ resume: Resume }>()
const emit = defineEmits<{
  (e: 'locate', key: string, id?: string): void
  (e: 'add'): void
  (e: 'rename', key: string): void
}>()

const expanded = ref<Set<string>>(new Set())          // 默认全收起，只显示一级模块
const width = ref(232)
try {
  width.value = Number(localStorage.getItem('paperstack.outlineWidth')) || 232
} catch { /* local storage may be disabled */ }

function isOpen(key: string) { return expanded.value.has(key) }

function toggleExpand(key: string) {
  const s = new Set(expanded.value)
  s.has(key) ? s.delete(key) : s.add(key)
  expanded.value = s
}

/** 拖右边缘改宽 */
let resizing = false
function startResize(e: MouseEvent) {
  e.preventDefault()
  resizing = true
  const move = (ev: MouseEvent) => {
    if (!resizing) return
    const w = Math.max(160, Math.min(460, ev.clientX))
    width.value = Math.round(w)
    document.documentElement.style.setProperty('--outline-w', width.value + 'px')
  }
  const up = () => {
    resizing = false
    try { localStorage.setItem('paperstack.outlineWidth', String(width.value)) } catch { /* ignore */ }
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}

onMounted(() => {
  document.documentElement.style.setProperty('--outline-w', width.value + 'px')
})

/** 删掉一条空要点 */
function removeBullet(key: string, item: any, bi: number) {
  const arr: string[] = key === 'entry' ? item.bullets : item.highlights
  if (Array.isArray(arr)) arr.splice(bi, 1)
}
const dragging = ref<DragPayload | null>(null)
const dropAt = ref<DropTarget | null>(null)

type DragPayload =
  | { level: 1; key: string }
  | { level: 2; moduleKey: string; index: number }
  | { level: 3; moduleKey: string; itemIndex: number; index: number }

type DropTarget = { level: 1 | 2 | 3; moduleKey: string; index: number; ok: boolean; before: boolean }

const ENTRY_TYPES = new Set(['work', 'projects', 'entry'])
const PLAIN_TYPES = new Set(['skills', 'list'])

function moduleType(key: string): 'work' | 'projects' | 'skills' | 'education' | 'entry' | 'list' | 'text' {
  if (key === 'work' || key === 'projects' || key === 'skills' || key === 'education') return key
  const sec = sectionOf(key)
  return (sec?.type as any) || 'text'
}

function sectionOf(key: string): CustomSection | undefined {
  return (props.resume.meta.customSections || []).find(s => s.id === key)
}

function titleOf(key: string): string {
  if (key === 'work' || key === 'projects' || key === 'skills' || key === 'education') {
    return props.resume.meta.titles[key] || key
  }
  return sectionOf(key)?.title || '自定义模块'
}

function itemsOf(key: string): any[] {
  if (key === 'work') return props.resume.work
  if (key === 'projects') return props.resume.projects
  if (key === 'education') return props.resume.education
  if (key === 'skills') return props.resume.skills
  const sec = sectionOf(key)
  if (!sec || sec.type !== 'entry') return []       // 证书、自我评价没有二级
  return sec.entries
}

function countOf(key: string): number {
  if (key === 'skills') return props.resume.skills.length
  const sec = sectionOf(key)
  if (sec && sec.type === 'list') return sec.list.filter(Boolean).length
  if (sec && sec.type === 'text') return sec.text.trim() ? 1 : 0
  return itemsOf(key).length
}

const isCustom = (key: string) => !['work', 'projects', 'skills', 'education'].includes(key)

/** 双击模块名改名 */
function renameModule(key: string) {
  emit('rename', key)
}

/** 删除自定义模块（内置模块只能隐藏） */
function removeModule(key: string) {
  const sec = sectionOf(key)
  if (!sec) { alert('内置模块不能删除，可以点眼睛隐藏'); return }
  if (!confirm(`删除模块「${sec.title}」？里面的内容会一起删掉`)) return
  const m = props.resume.meta
  m.customSections = (m.customSections || []).filter(s => s.id !== key)
  m.order = m.order.filter(k => k !== key)
}

function isHidden(key: string): boolean {
  return (props.resume.meta.hidden || []).includes(key)
}

function toggleHidden(key: string) {
  const m = props.resume.meta
  m.hidden = m.hidden || []
  const i = m.hidden.indexOf(key)
  if (i >= 0) m.hidden.splice(i, 1)
  else m.hidden.push(key)
}

function toggleCollapse(key: string) {
  const s = new Set(collapsed.value)
  s.has(key) ? s.delete(key) : s.add(key)
  collapsed.value = s
}

const modules = computed(() => props.resume.meta.order)

/** 二级只显示名称：公司 / 项目名 / 学校，其他一律不显示 */
function itemLabel(key: string, item: any): string {
  if (key === 'work') return item.company || '（未填公司）'
  if (key === 'projects') return item.name || '（未填项目）'
  if (key === 'education') return item.institution || '（未填学校）'
  return item.title || '（未填标题）'
}

function itemMeta(key: string, item: any): string {
  if (typeof item === 'string') return ''
  if (key === 'work') return [item.role, item.start && item.end ? `${item.start}—${item.end}` : ''].filter(Boolean).join(' · ')
  if (key === 'projects') return item.role || ''
  if (key === 'education') return [item.studyType, item.start].filter(Boolean).join(' · ')
  return item.time || ''
}

function bulletsOf(key: string, item: any): string[] {
  if (key === 'work' || key === 'projects') return item.highlights || []
  if (key === 'entry') return item.bullets || []
  return []
}

function preview(text: string): string {
  const t = String(text || '').trim()
  return t.length > 14 ? t.slice(0, 14) + '…' : (t || '（空）')
}

/* ---------------- 拖拽 ---------------- */

function onDragStart(e: DragEvent, payload: DragPayload) {
  dragging.value = payload
  e.dataTransfer?.setData('text/plain', JSON.stringify(payload))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  dragging.value = null
  dropAt.value = null
}

function allowDrop(level: 1 | 2 | 3, moduleKey: string, index: number): boolean {
  const d = dragging.value
  if (!d) return false
  if (d.level !== level) return false

  if (level === 1) {
    // 模块排序：基本信息固定
    if (moduleKey === 'basics' || d.key === 'basics') return false
    return true
  }
  if (level === 2) {
    if ((d as any).moduleKey === moduleKey) return true
    const from = moduleType((d as any).moduleKey)
    const to = moduleType(moduleKey)
    return (ENTRY_TYPES.has(from) && ENTRY_TYPES.has(to)) || (PLAIN_TYPES.has(from) && PLAIN_TYPES.has(to))
  }
  return true   // 要点：任意条目之间都能拖
}

function onDragOver(e: DragEvent, level: 1 | 2 | 3, moduleKey: string, index: number) {
  if (!dragging.value) return
  e.preventDefault()

  // 拖到上下边缘自动滚动
  const body = (e.currentTarget as HTMLElement).closest('.outline-body') as HTMLElement | null
  if (body) {
    const r = body.getBoundingClientRect()
    if (e.clientY < r.top + 36) body.scrollTop -= 14
    else if (e.clientY > r.bottom - 36) body.scrollTop += 14
  }

  const ok = allowDrop(level, moduleKey, index)
  if (e.dataTransfer) e.dataTransfer.dropEffect = ok ? 'move' : 'none'
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const before = e.clientY < rect.top + rect.height / 2
  dropAt.value = { level, moduleKey, index, ok, before }
}

function onDrop(e: DragEvent, level: 1 | 2 | 3, moduleKey: string, index: number) {
  e.preventDefault()
  const d = dragging.value
  const t = dropAt.value
  dragging.value = null
  dropAt.value = null
  if (!d || !t || !t.ok) return

  if (d.level === 1 && t.level === 1) moveModule(d.key, t.index)
  if (d.level === 2 && t.level === 2) moveItem(d.moduleKey, d.index, t.moduleKey, t.index)
  if (d.level === 3 && t.level === 3) moveBullet(d.moduleKey, d.itemIndex, d.index, t.moduleKey, t.index)
}

function isDrop(kind: 'module' | 'item', moduleKey: string, index: number, before: boolean): boolean {
  const d = dropAt.value
  if (!d || !d.ok) return false
  if (kind === 'module') return d.level === 1 && d.moduleKey === moduleKey && d.before === before
  return d.level === 2 && d.moduleKey === moduleKey && d.index === index && d.before === before
}

function moveModule(key: string, toIndex: number) {
  const order = props.resume.meta.order
  const from = order.indexOf(key)
  if (from < 0) return
  let to = toIndex
  if (to > from) to -= 1
  if (to === from) return
  order.splice(from, 1)
  order.splice(to, 0, key)
}

function convertItem(fromKey: string, toKey: string, item: any): any {
  const from = moduleType(fromKey), to = moduleType(toKey)
  if (from === to) return item
  if (typeof item === 'string') return item          // 纯文本条目直接搬
  const base = { id: item.id, bullets: [], entries: [] } as any

  if (from === 'work' && to === 'projects') {
    return {
      id: item.id,
      name: item.company || '',
      role: [item.role, item.start && item.end ? `${item.start}—${item.end}` : ''].filter(Boolean).join(' · '),
      highlights: [...(item.highlights || [])],
      pb: item.pb, keep: item.keep
    }
  }
  if (from === 'projects' && to === 'work') {
    return {
      id: item.id, company: item.name || '', role: item.role || '', start: '', end: '',
      highlights: [...(item.highlights || [])], pb: item.pb, keep: item.keep
    }
  }
  if (to === 'entry') {
    if (from === 'work') return { id: item.id, title: item.company || '', subtitle: item.role || '', time: [item.start, item.end].filter(Boolean).join('—'), bullets: [...(item.highlights || [])] }
    if (from === 'projects') return { id: item.id, title: item.name || '', subtitle: item.role || '', time: '', bullets: [...(item.highlights || [])] }
  }
  if (from === 'entry' && to === 'work') {
    return { id: item.id, company: item.title || '', role: item.subtitle || '', start: '', end: '', highlights: [...(item.bullets || [])] }
  }
  if (from === 'entry' && to === 'projects') {
    return { id: item.id, name: item.title || '', role: [item.subtitle, item.time].filter(Boolean).join(' · '), highlights: [...(item.bullets || [])] }
  }
  return base
}

function moveItem(fromKey: string, fromIndex: number, toKey: string, toIndex: number) {
  const fromArr = itemsOf(fromKey)
  const [item] = fromArr.splice(fromIndex, 1)
  if (!item) return
  const converted = convertItem(fromKey, toKey, item)
  const toArr = itemsOf(toKey)
  let to = toIndex
  if (fromKey === toKey && to > fromIndex) to -= 1
  toArr.splice(Math.max(0, Math.min(to, toArr.length)), 0, converted)
}

function moveBullet(fromKey: string, fromItem: number, fromIndex: number, toKey: string, toIndex: number) {
  const fromItemObj = itemsOf(fromKey)[fromItem]
  const toItemObj = itemsOf(toKey)[Math.min(toIndex, itemsOf(toKey).length - 1)]
  if (!fromItemObj || !toItemObj) return
  const key = fromKey === 'entry' ? 'bullets' : 'highlights'
  const fromArr: string[] = fromItemObj[key] || []
  const toArr: string[] = toItemObj[key] || []
  if (!Array.isArray(fromArr) || !Array.isArray(toArr)) return
  const [b] = fromArr.splice(fromIndex, 1)
  if (b === undefined) return
  toArr.splice(Math.min(toArr.length, Math.max(0, toIndex)), 0, b)
}

/* ---------------- 收起模块悬停展开 ---------------- */
let hoverTimer: any
function onModuleOver(e: DragEvent, key: string, index: number) {
  onDragOver(e, 1, key, index)
  // 拖条目经过收起的模块，停半秒自动展开
  if (dragging.value?.level === 2 && !expanded.value.has(key)) {
    clearTimeout(hoverTimer)
    hoverTimer = setTimeout(() => {
      const s = new Set(expanded.value)
      s.add(key)
      expanded.value = s
    }, 500)
  }
}

/* ---------------- 键盘 ---------------- */
function moveItemBy(key: string, index: number, delta: number) {
  const arr = itemsOf(key)
  const to = index + delta
  if (to < 0 || to >= arr.length) return
  const [it] = arr.splice(index, 1)
  arr.splice(to, 0, it)
}

function moveBulletBy(key: string, itemIndex: number, bIndex: number, delta: number) {
  const item = itemsOf(key)[itemIndex]
  if (!item) return
  const arr: string[] = key === 'entry' ? item.bullets : item.highlights
  if (!Array.isArray(arr)) return
  const to = bIndex + delta
  if (to < 0 || to >= arr.length) return
  const [b] = arr.splice(bIndex, 1)
  arr.splice(to, 0, b)
}

function onKey(e: KeyboardEvent, level: 1 | 2 | 3, moduleKey: string, index: number, itemIndex?: number) {
  if (!e.altKey) return
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  e.preventDefault()
  const delta = e.key === 'ArrowUp' ? -1 : 1
  if (level === 1) {
    const order = props.resume.meta.order
    const to = index + delta
    if (to < 0 || to >= order.length) return
    const [k] = order.splice(index, 1)
    order.splice(to, 0, k)
  }
  if (level === 2) moveItemBy(moduleKey, index, delta)
  if (level === 3) moveBulletBy(moduleKey, itemIndex ?? 0, index, delta)
}
</script>

<template>
  <aside class="outline" :style="{ width: width + 'px' }">
    <div class="outline-resizer" title="拖动调整宽度" @mousedown="startResize" />
    <div class="outline-head">
      <span>结构大纲</span>
      <span class="outline-tip">拖动任意一行排序</span>
    </div>

    <div class="outline-body">
      <!-- 基本信息固定 -->
      <div class="row module fixed" @click="emit('locate', 'basics')">基本信息</div>

      <template v-for="(key, mi) in modules" :key="key">
        <div
          class="row module"
          :data-module="key"
          :class="{ hidden: isHidden(key), 'drop-before': isDrop('module', key, -1, true), 'drop-after': isDrop('module', key, -1, false) }"
          draggable="true"
          @dragstart="onDragStart($event, { level: 1, key })"
          @dragend="onDragEnd"
          @dragover="onModuleOver($event, key, mi)"
          @drop="onDrop($event, 1, key, mi)"
          @click="emit('locate', key)"
          @keydown="onKey($event, 1, key, mi)"
          tabindex="0"
        >
          <span class="caret" @click.stop="toggleExpand(key)">{{ isOpen(key) ? '▾' : '▸' }}</span>
          <span class="m-title" title="双击改名" @dblclick.stop="renameModule(key)">{{ titleOf(key) }}</span>
          <span class="m-count">({{ countOf(key) }})</span>
          <span v-if="isCustom(key)" class="del" title="删除模块" @click.stop="removeModule(key)">×</span>
          <span class="eye" :title="isHidden(key) ? '显示' : '隐藏'" @click.stop="toggleHidden(key)">
            {{ isHidden(key) ? '◌' : '👁' }}
          </span>
        </div>

        <template v-if="isOpen(key)">
          <template v-for="(item, ii) in itemsOf(key)" :key="item.id || ii">
            <div
              class="row item"
              :data-item="key + ':' + ii"
              :class="{ 'drop-before': isDrop('item', key, ii, true), 'drop-after': isDrop('item', key, ii, false) }"
              draggable="true"
              @dragstart.stop="onDragStart($event, { level: 2, moduleKey: key, index: ii })"
              @dragend="onDragEnd"
              @dragover="onDragOver($event, 2, key, ii)"
              @drop="onDrop($event, 2, key, ii)"
              @click="emit('locate', key, item.id)"
              @keydown="onKey($event, 2, key, ii)"
              tabindex="0"
            >
              <span class="dash">├</span>
              <span class="i-title">{{ itemLabel(key, item) }}</span>
            </div>

          </template>
        </template>
      </template>

      <button class="add-module" @click="emit('add')">＋ 新增模块</button>
    </div>
  </aside>
</template>

<style scoped>
.outline-resizer{position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;z-index:5}
.outline-resizer:hover{background:rgba(166,58,43,.16)}
.outline {
  position: relative;
  display: flex; flex-direction: column;
  border-right: 1px solid rgba(117,99,77,.13);
  background:
    linear-gradient(180deg,rgba(255,253,247,.58),rgba(239,233,222,.68)),
    var(--panel);
  min-width: 0;
  min-height: 0;          /* 不加这行，网格子项会被内容撑高，内部滚动失效 */
  overflow: hidden;
}
.outline-head {
  display: flex; align-items: baseline; gap: 8px;
  margin: 12px 10px 4px;padding: 4px 4px 11px; border-bottom: 1px solid rgba(117,99,77,.14);
  font-family:"Songti SC",STSong,SimSun,serif;font-size: 14px; font-weight: 600; letter-spacing: .12em; color: var(--ink2);
}
.outline-tip { font-size: 9.5px; color: var(--muted); letter-spacing: 0; font-weight: 400; margin-left: auto; }
.outline-body { flex: 1; overflow-y: auto; padding: 5px 8px 18px; }
.row {
  display: flex; align-items: baseline; gap: 5px;
  padding: 8px 9px; border-radius: 10px; cursor: pointer;
  font-size: 13px; color: var(--ink2); line-height: 1.4;
  border: 1px solid transparent;
}
.row:hover { background: rgba(255,253,247,.8); box-shadow:0 6px 18px -18px rgba(55,39,24,.5); }
.row.module { font-weight: 600; margin-top: 6px; }
.row.module.fixed { color: var(--muted); cursor: default; font-weight: 400; }
.row.module.fixed:hover { background: transparent; }
.row.hidden { opacity: .45; }
.row.over { border-color: var(--accent); background: var(--accent-soft); }
.row.drop-before { box-shadow: inset 0 2px 0 var(--accent); }
.row.drop-after { box-shadow: inset 0 -2px 0 var(--accent); }
.caret { width: 12px; color: var(--muted); font-size: 12px; }
.m-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.m-count { color: var(--muted); font-size: 11.5px; font-weight: 400; }
.del{margin-left:auto;font-size:14px;line-height:1;color:var(--muted);opacity:0;padding:0 3px}
.row.module:hover .del{opacity:.7}
.del:hover{color:var(--accent);opacity:1}
.eye { margin-left: 6px; font-size: 15px; line-height: 1; opacity: .55; padding: 0 2px; }
.row.module .eye{margin-left:6px}
.row.module.hidden .del{opacity:.4}
.eye:hover { opacity: 1; }
.row.item { padding-left: 20px; font-size: 12.2px; }
.dash { color: #C9C2B2; }
.i-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.i-meta { color: var(--muted); font-size: 9.5px; margin-left: auto; white-space: nowrap; }
.row.bullet { padding-left: 30px; font-size: 10.5px; color: var(--muted); }
.b-del{margin-left:auto;opacity:0;color:var(--muted);font-size:11px;padding:0 2px}
.row.bullet:hover .b-del{opacity:.8}
.b-del:hover{color:var(--accent)}
.row.item .caret{margin-right:1px;color:var(--muted);font-size:9px;width:9px}
.dot { color: #C9C2B2; }
.b-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.add-module {
  width: calc(100% - 18px); margin: 14px 9px 0; padding: 10px;
  border: 1px solid rgba(117,99,77,.18); background: rgba(255,253,247,.4); color: var(--muted);
  font-family: var(--ui); font-size: 11.5px; cursor: pointer; border-radius: 999px;
}
.add-module:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); transform:translateY(-1px); }
</style>
