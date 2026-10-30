// 构建后把单文件产物复制到项目根目录，双击就能用，避免误开开发入口 index.html
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const src = resolve('dist/index.html')
const dst = resolve('纸栈.html')

if (!existsSync(src)) {
  console.error('[postbuild] 找不到 dist/index.html，先跑 vite build')
  process.exit(1)
}
copyFileSync(src, dst)
console.log('[postbuild] 已生成可双击的 纸栈.html')
