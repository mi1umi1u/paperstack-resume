<script setup lang="ts">
import { nextTick, ref } from 'vue'

const props = defineProps<{ src: string }>()
const emit = defineEmits<{
  (e: 'save', value: string): void
  (e: 'close'): void
}>()

const VIEW_W = 240
const VIEW_H = 320
const image = ref<HTMLImageElement | null>(null)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const loading = ref(true)
const failed = ref(false)
const dragging = ref(false)
let dragStart = { x: 0, y: 0, px: 0, py: 0 }

function dimensions() {
  const img = image.value
  if (!img?.naturalWidth || !img.naturalHeight) return null
  const base = Math.max(VIEW_W / img.naturalWidth, VIEW_H / img.naturalHeight)
  const scale = base * zoom.value
  return {
    scale,
    width: img.naturalWidth * scale,
    height: img.naturalHeight * scale
  }
}

function clampPan() {
  const d = dimensions()
  if (!d) return
  const maxX = Math.max(0, (d.width - VIEW_W) / 2)
  const maxY = Math.max(0, (d.height - VIEW_H) / 2)
  panX.value = Math.max(-maxX, Math.min(maxX, panX.value))
  panY.value = Math.max(-maxY, Math.min(maxY, panY.value))
}

function onLoad() {
  loading.value = false
  failed.value = false
  zoom.value = 1
  panX.value = 0
  panY.value = 0
  nextTick(clampPan)
}

function onImageError() {
  loading.value = false
  failed.value = true
}

function startDrag(e: PointerEvent) {
  if (!image.value || failed.value) return
  dragging.value = true
  dragStart = { x: e.clientX, y: e.clientY, px: panX.value, py: panY.value }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function moveDrag(e: PointerEvent) {
  if (!dragging.value) return
  panX.value = dragStart.px + e.clientX - dragStart.x
  panY.value = dragStart.py + e.clientY - dragStart.y
  clampPan()
}

function endDrag(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  const el = e.currentTarget as HTMLElement
  if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
}

function save() {
  const img = image.value
  const d = dimensions()
  if (!img || !d || failed.value) return

  const canvas = document.createElement('canvas')
  canvas.width = 300
  canvas.height = 400
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const left = (VIEW_W - d.width) / 2 + panX.value
  const top = (VIEW_H - d.height) / 2 + panY.value
  const sourceX = Math.max(0, -left / d.scale)
  const sourceY = Math.max(0, -top / d.scale)
  const sourceW = Math.min(img.naturalWidth - sourceX, VIEW_W / d.scale)
  const sourceH = Math.min(img.naturalHeight - sourceY, VIEW_H / d.scale)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height)
  emit('save', canvas.toDataURL('image/jpeg', 0.86))
}
</script>

<template>
  <div class="photo-mask" role="dialog" aria-modal="true" aria-label="裁剪证件照" @click.self="emit('close')">
    <div class="photo-modal">
      <header>
        <div>
          <h2>裁剪证件照</h2>
          <p>拖动调整位置，缩放后保存为宽 300 px 的 JPEG。</p>
        </div>
        <button class="photo-x" type="button" aria-label="关闭" @click="emit('close')">×</button>
      </header>

      <div class="photo-body">
        <div class="photo-view"
          :class="{ dragging }"
          @pointerdown="startDrag"
          @pointermove="moveDrag"
          @pointerup="endDrag"
          @pointercancel="endDrag">
          <img ref="image" :src="props.src" alt="证件照预览" draggable="false"
            :style="{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              opacity: loading || failed ? 0 : 1
            }" @load="onLoad" @error="onImageError">
          <span v-if="loading" class="photo-loading">正在读取图片…</span>
          <span v-if="failed" class="photo-loading">图片无法读取，请换一张。</span>
        </div>
        <div class="photo-controls">
          <label for="photo-zoom">缩放</label>
          <input id="photo-zoom" v-model.number="zoom" type="range" min="1" max="3" step="0.02" @input="clampPan">
          <p>建议使用正面、背景干净的竖版照片。图片只保存在本机浏览器。</p>
        </div>
      </div>

      <footer>
        <button class="btn" type="button" @click="emit('close')">取消</button>
        <button class="btn primary" type="button" :disabled="loading || failed" @click="save">保存照片</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.photo-mask{position:fixed;inset:0;z-index:220;background:rgba(30,26,20,.46);display:flex;align-items:center;justify-content:center;padding:24px}
.photo-modal{width:min(620px,100%);background:var(--paper);box-shadow:0 30px 80px -40px rgba(0,0,0,.65)}
.photo-modal header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:20px 22px 16px;border-bottom:1px solid var(--line)}
h2{margin:0;font-family:var(--kai);font-size:20px;font-weight:400;letter-spacing:.12em}
header p{margin:6px 0 0;font-size:11px;color:var(--muted);line-height:1.6}
.photo-x{border:0;background:transparent;font-size:22px;line-height:1;color:var(--muted);cursor:pointer}
.photo-body{display:grid;grid-template-columns:240px 1fr;gap:24px;padding:22px}
.photo-view{position:relative;width:240px;height:320px;overflow:hidden;background:#E9E5DC;cursor:grab;touch-action:none;user-select:none}
.photo-view.dragging{cursor:grabbing}
.photo-view img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform-origin:center;pointer-events:none}
.photo-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;font-size:11px;color:var(--muted);line-height:1.7}
.photo-controls{padding-top:8px}
.photo-controls label{display:block;font-size:11px;letter-spacing:.12em;color:var(--ink2);margin-bottom:12px}
.photo-controls input{width:100%;accent-color:var(--accent)}
.photo-controls p{margin:20px 0 0;font-size:11px;line-height:1.8;color:var(--muted)}
.photo-modal footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 22px 20px;border-top:1px solid var(--line)}
@media (max-width:620px){
  .photo-body{grid-template-columns:1fr;justify-items:center}
  .photo-controls{width:100%}
}
</style>
