import { describe, it, expect } from 'vitest'
import { sampleResume, blankResume } from '../src/core/model'
import {
  createLibrary, addVersion, addSnapshot, removeSnapshot, currentVersion,
  diffSnapshots
} from '../src/core/versions'

const r1 = sampleResume()

describe('命名快照', () => {
  it('新建快照追加到当前版本，且持久化内容为独立副本', () => {
    const lib = createLibrary(r1, 'A')
    const snapResume = { ...r1, basics: { ...r1.basics, name: '快照时姓名' } }
    const lib2 = addSnapshot(lib, lib.currentId, '投递前', snapResume)
    const v = currentVersion(lib2)!
    expect(v.snapshots.length).toBe(1)
    expect(v.snapshots[0].name).toBe('投递前')
    expect(v.snapshots[0].resume.basics.name).toBe('快照时姓名')
    // 原版本内容不受快照影响
    expect(v.resume.basics.name).toBe(sampleResume().basics.name)
  })

  it('快照按版本隔离', () => {
    const lib = addVersion(createLibrary(r1, 'A'), 'B', blankResume())
    const idB = lib.currentId
    const lib2 = addSnapshot(lib, idB, 'B 的快照', r1)
    expect(currentVersion(lib2)!.snapshots.length).toBe(1)
    expect(lib2.versions[0].snapshots.length).toBe(0)
  })

  it('删除快照不影响版本内容', () => {
    const lib = createLibrary(r1, 'A')
    const lib2 = addSnapshot(lib, lib.currentId, 's1', r1)
    const id = lib2.versions[0].snapshots[0].id
    const lib3 = removeSnapshot(lib2, lib2.currentId, id)
    expect(currentVersion(lib3)!.snapshots.length).toBe(0)
    expect(currentVersion(lib3)!.resume.basics.name).toBe(sampleResume().basics.name)
  })

  it('快照数量达到上限时只保留最新的上限内快照', () => {
    let lib = createLibrary(r1, 'A')
    for (let i = 0; i < 32; i++) {
      lib = addSnapshot(lib, lib.currentId, `s${i}`, r1)
    }
    const snaps = currentVersion(lib)!.snapshots
    expect(snaps.length).toBe(30)
    expect(snaps[snaps.length - 1].name).toBe('s31')
    expect(snaps[0].name).toBe('s2')
  })

  it('diffSnapshots 能区分内容、结构与样式变化', () => {
    const a = r1
    const content = { ...r1, work: [{ ...r1.work[0], company: '改过公司' }] }
    const structure = { ...r1, meta: { ...r1.meta, order: ['projects', 'work', 'skills', 'education'] } }
    const style = { ...r1, meta: { ...r1.meta, template: 'yin' as any } }

    expect(diffSnapshots(a, content).contentChanged).toBe(true)
    expect(diffSnapshots(a, content).styleChanged).toBe(false)
    expect(diffSnapshots(a, structure).structureChanged).toBe(true)
    expect(diffSnapshots(a, structure).contentChanged).toBe(false)
    expect(diffSnapshots(a, style).styleChanged).toBe(true)
    expect(diffSnapshots(a, style).contentChanged).toBe(false)
  })
})
