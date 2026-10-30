/**
 * 撤销 / 重做：状态快照栈
 * - 连续输入 500ms 内的修改合并成一步
 * - 最多保留 100 步
 * - 只存在内存里，刷新即清空
 */
export interface HistoryApi {
  reset(snap: string): void
  record(snap: string): void
  undo(current: string): string | null
  redo(current: string): string | null
  canUndo(): boolean
  canRedo(): boolean
  size(): number
}

export function createHistory(limit = 100, mergeMs = 500): HistoryApi {
  let stack: string[] = []
  let index = -1
  let lastAt = 0

  const canUndo = () => index > 0
  const canRedo = () => index >= 0 && index < stack.length - 1

  return {
    reset(snap: string) {
      stack = [snap]
      index = 0
      lastAt = 0            // 初始状态必须先能撤销到，首次修改另起一步
    },

    record(snap: string) {
      if (index < 0) {
        stack = [snap]; index = 0; lastAt = Date.now(); return
      }
      if (stack[index] === snap) return

      const now = Date.now()
      const merging = now - lastAt < mergeMs

      if (merging) {
        // 合并窗口：替换栈顶，不新增一步
        stack[index] = snap
      } else {
        stack = stack.slice(0, index + 1)
        stack.push(snap)
        if (stack.length > limit) stack.shift()
        index = stack.length - 1
      }
      lastAt = now
    },

    undo(current: string) {
      if (!canUndo()) return null
      if (stack[index] !== current) stack[index] = current
      index -= 1
      lastAt = 0            // 撤销之后的修改必须另起一步
      return stack[index]
    },

    redo(current: string) {
      if (!canRedo()) return null
      if (stack[index] !== current) stack[index] = current
      index += 1
      lastAt = 0
      return stack[index]
    },

    canUndo,
    canRedo,
    size: () => stack.length
  }
}
