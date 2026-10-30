import { describe, it, expect } from 'vitest'
import { createHistory } from '../src/core/history'

describe('createHistory 撤销重做', () => {
  it('初始状态不能撤销也不能重做', () => {
    const h = createHistory()
    h.reset('A')
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
    expect(h.size()).toBe(1)
  })

  it('超过合并窗口后，每次修改各记一步', async () => {
    const h = createHistory(100, 20)
    h.reset('A')
    await new Promise(r => setTimeout(r, 30))
    h.record('B')
    await new Promise(r => setTimeout(r, 30))
    h.record('C')
    expect(h.size()).toBe(3)
    expect(h.undo('C')).toBe('B')
    expect(h.undo('B')).toBe('A')
    expect(h.canUndo()).toBe(false)
  })

  it('合并窗口内的连续输入只记一步', async () => {
    const h = createHistory(100, 500)
    h.reset('A')
    h.record('AB')
    h.record('ABC')
    h.record('ABCD')
    expect(h.size()).toBe(2)              // A → ABCD
    expect(h.undo('ABCD')).toBe('A')
  })

  it('重做能回到撤销前', async () => {
    const h = createHistory(100, 10)
    h.reset('A')
    await new Promise(r => setTimeout(r, 20))
    h.record('B')
    expect(h.undo('B')).toBe('A')
    expect(h.redo('A')).toBe('B')
    expect(h.canRedo()).toBe(false)
  })

  it('撤销后再修改，重做栈被清空', async () => {
    const h = createHistory(100, 10)
    h.reset('A')
    await new Promise(r => setTimeout(r, 20))
    h.record('B')
    expect(h.undo('B')).toBe('A')          // 回到 A，栈顶是 B
    await new Promise(r => setTimeout(r, 20))
    h.record('C')
    expect(h.canRedo()).toBe(false)
    expect(h.undo('C')).toBe('A')
  })

  it('超过上限时丢弃最早的快照', async () => {
    const h = createHistory(3, 1)
    h.reset('S0')
    for (let i = 1; i <= 5; i++) {
      await new Promise(r => setTimeout(r, 5))
      h.record('S' + i)
    }
    expect(h.size()).toBe(3)
    expect(h.undo('S5')).toBe('S4')
    expect(h.undo('S4')).toBe('S3')
    expect(h.canUndo()).toBe(false)        // S2 及更早被丢弃
  })

  it('重复记录同一份快照不产生新步骤', () => {
    const h = createHistory(100, 10)
    h.reset('A')
    h.record('A')
    h.record('A')
    expect(h.size()).toBe(1)
  })
})
