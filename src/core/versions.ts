import { get, set, del } from 'idb-keyval'
import type { Resume } from './model'
import { normalize } from './store'

export interface VersionMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface Snapshot {
  id: string
  name: string
  createdAt: number
  resume: Resume
}

export interface Version extends VersionMeta {
  resume: Resume
  snapshots: Snapshot[]
}

export interface Library {
  versions: Version[]
  currentId: string
}

export interface LibraryBackup {
  format: 'paperstack-backup'
  version: 1
  exportedAt: string
  library: Library
}

const LIB_KEY = 'paperstack.library.v1'
export const MAX_SNAPSHOTS = 30

let seq = 0
export const vid = () => `v_${Date.now().toString(36)}_${(seq++).toString(36)}`
export const sid = () => `s_${Date.now().toString(36)}_${(seq++).toString(36)}`

export function createLibrary(resume: Resume, name = '我的简历'): Library {
  const now = Date.now()
  const v: Version = { id: vid(), name, createdAt: now, updatedAt: now, resume, snapshots: [] }
  return { versions: [v], currentId: v.id }
}

export function currentVersion(lib: Library): Version | undefined {
  return lib.versions.find(v => v.id === lib.currentId) || lib.versions[0]
}

export function serializeLibrary(lib: Library): string {
  const backup: LibraryBackup = {
    format: 'paperstack-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    library: JSON.parse(JSON.stringify(lib))
  }
  return JSON.stringify(backup, null, 2)
}

export function deserializeLibrary(raw: string): Library | null {
  try {
    const data = JSON.parse(raw)
    if (data?.format !== 'paperstack-backup' || data?.version !== 1 || !Array.isArray(data?.library?.versions)) return null
    const versions: Version[] = data.library.versions.map((v: any) => ({
      id: String(v.id || vid()),
      name: String(v.name || '未命名版本'),
      createdAt: Number(v.createdAt) || Date.now(),
      updatedAt: Number(v.updatedAt) || Date.now(),
      resume: normalize(v.resume),
      snapshots: Array.isArray(v.snapshots)
        ? v.snapshots.map((s: any) => ({
          id: String(s.id || sid()),
          name: String(s.name || '未命名快照'),
          createdAt: Number(s.createdAt) || Date.now(),
          resume: normalize(s.resume)
        }))
        : []
    }))
    if (!versions.length) return null
    const currentId = versions.some(v => v.id === data.library.currentId)
      ? data.library.currentId
      : versions[0].id
    return { versions, currentId }
  } catch {
    return null
  }
}

export function addVersion(lib: Library, name: string, resume: Resume): Library {
  const now = Date.now()
  const v: Version = { id: vid(), name, createdAt: now, updatedAt: now, resume, snapshots: [] }
  return { versions: [...lib.versions, v], currentId: v.id }
}

export function renameVersion(lib: Library, id: string, name: string): Library {
  const clean = name.trim()
  if (!clean) return lib
  return {
    ...lib,
    versions: lib.versions.map(v => (v.id === id ? { ...v, name: clean, updatedAt: Date.now() } : v))
  }
}

export function updateVersion(lib: Library, id: string, resume: Resume): Library {
  return {
    ...lib,
    versions: lib.versions.map(v => (v.id === id ? { ...v, resume, updatedAt: Date.now() } : v))
  }
}

export function addSnapshot(lib: Library, versionId: string, name: string, resume: Resume): Library {
  const clean = name.trim()
  if (!clean) return lib
  const version = lib.versions.find(v => v.id === versionId)
  if (!version || version.snapshots.length >= MAX_SNAPSHOTS) return lib
  const snap: Snapshot = { id: sid(), name: clean, createdAt: Date.now(), resume: normalize(resume) }
  return {
    ...lib,
    versions: lib.versions.map(v =>
      v.id === versionId
        ? { ...v, snapshots: [...v.snapshots, snap], updatedAt: Date.now() }
        : v
    )
  }
}

export function removeSnapshot(lib: Library, versionId: string, snapshotId: string): Library {
  return {
    ...lib,
    versions: lib.versions.map(v =>
      v.id === versionId ? { ...v, snapshots: v.snapshots.filter(s => s.id !== snapshotId) } : v
    )
  }
}

export interface SnapshotDiff {
  contentChanged: boolean
  structureChanged: boolean
  styleChanged: boolean
}

const strip = (r: Resume) => ({
  basics: r.basics,
  work: r.work,
  projects: r.projects,
  skills: r.skills,
  education: r.education,
  customSections: r.meta.customSections
})

/** 比较两份简历：内容（字段）、结构（模块顺序/自定义模块）、样式（模板/字体/颜色/疏密） */
export function diffSnapshots(a: Resume, b: Resume): SnapshotDiff {
  const contentChanged = JSON.stringify(strip(a)) !== JSON.stringify(strip(b))
  const aIds = a.meta.customSections.map(s => s.id).join(',')
  const bIds = b.meta.customSections.map(s => s.id).join(',')
  const structureChanged = JSON.stringify(a.meta.order) !== JSON.stringify(b.meta.order) || aIds !== bIds
  const styleChanged =
    a.meta.template !== b.meta.template ||
    a.meta.font !== b.meta.font ||
    a.meta.accent !== b.meta.accent ||
    a.meta.density !== b.meta.density
  return { contentChanged, structureChanged, styleChanged }
}

/** 删除版本；至少保留一个，删当前版本时自动切到剩下的第一个 */
export function removeVersion(lib: Library, id: string): Library {
  if (lib.versions.length <= 1) return lib
  const versions = lib.versions.filter(v => v.id !== id)
  const currentId = lib.currentId === id ? versions[0].id : lib.currentId
  return { versions, currentId }
}

/** 读取版本库；兼容只有单份简历的旧数据 */
export async function loadLibrary(): Promise<Library | null> {
  try {
    const saved = await timeout(get(LIB_KEY), 1200)
    if (saved && Array.isArray(saved.versions) && saved.versions.length) {
      return {
        currentId: saved.currentId,
        versions: saved.versions.map((v: any) => ({
          ...v,
          resume: normalize(v.resume),
          snapshots: Array.isArray(v.snapshots)
            ? v.snapshots.map((s: any) => ({ ...s, resume: normalize(s.resume) }))
            : []
        }))
      }
    }
  } catch { /* ignore */ }

  // 旧数据：单份简历 → 包成一个版本
  const { loadResume } = await import('./store')
  const old = await loadResume()
  if (old) return createLibrary(old, '我的简历')
  return null
}

/** 清空全部版本、快照与旧版单份简历数据，回到首次使用状态 */
export async function clearLibraryData(): Promise<void> {
  cancelLibrarySave()
  await del(LIB_KEY).catch(() => undefined)
  await del('paperstack.resume.v2').catch(() => undefined)
  try { localStorage.removeItem('paperstack.resume.v1') } catch { /* ignore */ }
}

export function saveLibrary(lib: Library, delay = 300): void {
  pendingLibrary = JSON.parse(JSON.stringify(lib))
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void flushLibrary()
  }, delay)
}

export function flushLibrary(): Promise<void> {
  clearTimeout(saveTimer)
  saveTimer = undefined
  const library = pendingLibrary
  pendingLibrary = null
  if (!library) return Promise.resolve()
  return set(LIB_KEY, JSON.parse(JSON.stringify(library))).catch(() => undefined)
}

export function cancelLibrarySave(): void {
  clearTimeout(saveTimer)
  saveTimer = undefined
  pendingLibrary = null
}

let saveTimer: any
let pendingLibrary: Library | null = null

const timeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p.catch(() => null), new Promise<null>(res => setTimeout(() => res(null), ms))])
