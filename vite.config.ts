import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 单文件产物：file:// 下禁止加载外部 ES 模块，必须内联才能"双击能用"
export default defineConfig({
  base: './',
  plugins: [vue(), viteSingleFile()],
  build: {
    target: 'es2018',
    cssCodeSplit: false,
    assetsInlineLimit: 100 * 1024 * 1024,
    chunkSizeWarningLimit: 5000
  }
})
