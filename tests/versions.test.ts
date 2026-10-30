import { describe, it, expect } from 'vitest'
import { blankResume, sampleResume } from '../src/core/model'
import {
  createLibrary, currentVersion, addVersion, updateVersion,
  renameVersion, removeVersion
} from '../src/core/versions'

const r1 = sampleResume()
const r2 = blankResume()

describe('多版本', () => {
  it('新建版本库：只有一个版本且为当前', () => {
    const lib = createLibrary(r1, '运维版')
    expect(lib.versions.length).toBe(1)
    expect(lib.currentId).toBe(lib.versions[0].id)
    expect(currentVersion(lib)?.name).toBe('运维版')
  })

  it('新建版本后自动切换过去，旧版本内容不变', () => {
    const lib = createLibrary(r1, 'A')
    const lib2 = addVersion(lib, 'B', r2)
    expect(lib2.versions.length).toBe(2)
    expect(lib2.currentId).toBe(lib2.versions[1].id)
    expect(currentVersion(lib2)?.name).toBe('B')
    expect(lib2.versions[0].resume).toBe(r1)
  })

  it('更新只影响指定版本', () => {
    const lib = createLibrary(r1, 'A')
    const lib2 = addVersion(lib, 'B', r2)
    const idB = lib2.currentId
    const changed = { ...r2, basics: { ...r2.basics, name: '改过了' } }
    const lib3 = updateVersion(lib2, idB, changed as any)
    expect((currentVersion(lib3)?.resume.basics.name)).toBe('改过了')
    expect(lib3.versions[0].resume.basics.name).toBe(sampleResume().basics.name)
  })

  it('重命名', () => {
    const lib = createLibrary(r1, 'A')
    const lib2 = renameVersion(lib, lib.versions[0].id, '  新名字 ')
    expect(lib2.versions[0].name).toBe('新名字')
  })

  it('空名字不生效', () => {
    const lib = createLibrary(r1, 'A')
    expect(renameVersion(lib, lib.versions[0].id, '   ')).toBe(lib)
  })

  it('删除当前版本时切换到剩下的第一个', () => {
    const lib = addVersion(createLibrary(r1, 'A'), 'B', r2)
    const lib2 = removeVersion(lib, lib.currentId)
    expect(lib2.versions.length).toBe(1)
    expect(lib2.currentId).toBe(lib2.versions[0].id)
  })

  it('只剩一个版本时不允许删除', () => {
    const lib = createLibrary(r1, 'A')
    expect(removeVersion(lib, lib.currentId)).toBe(lib)
  })

  it('删除非当前版本不改 currentId', () => {
    const lib = addVersion(createLibrary(r1, 'A'), 'B', r2)
    const keep = lib.currentId
    const lib2 = removeVersion(lib, lib.versions[0].id)
    expect(lib2.currentId).toBe(keep)
  })

  it('currentId 失效时回退到第一个版本', () => {
    const lib = { ...createLibrary(r1, 'A'), currentId: 'not-exist' }
    expect(currentVersion(lib)?.id).toBe(lib.versions[0].id)
  })
})
