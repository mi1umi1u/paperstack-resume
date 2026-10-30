import { get, set } from 'idb-keyval'
import type { Resume } from './model'
import { normalize } from './store'

export interface VersionMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface Version extends VersionMeta {
  resume: Resume
}

export interface Library {
  versions: Version[]
  currentId: string
}

const LIB_KEY = 'paperstack.library.v1'

let seq = 0
export const vid = () => `v_${Date.now().toString(36)}_${(seq++).toString(36)}`

export function createLibrary(resume: Resume, name = '我的简历'): Library {
  const now = Date.now()
  const v: Version = { id: vid(), name, createdAt: now, updatedAt: now, resume }
  return { versions: [v], currentId: v.id }
}

export function currentVersion(lib: Library): Version | undefined {
  return lib.versions.find(v => v.id === lib.currentId) || lib.versions[0]
}

export function addVersion(lib: Library, name: string, resume: Resume): Library {
  const now = Date.now()
  const v: Version = { id: vid(), name, createdAt: now, updatedAt: now, resume }
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
        versions: saved.versions.map((v: any) => ({ ...v, resume: normalize(v.resume) }))
      }
    }
  } catch { /* ignore */ }

  // 旧数据：单份简历 → 包成一个版本
  const { loadResume } = await import('./store')
  const old = await loadResume()
  if (old) return createLibrary(old, '我的简历')
  return null
}

export function saveLibrary(lib: Library, delay = 300): void {
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    set(LIB_KEY, JSON.parse(JSON.stringify(lib))).catch(() => undefined)
  }, delay)
}

let saveTimer: any

const timeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p.catch(() => null), new Promise<null>(res => setTimeout(() => res(null), ms))])
