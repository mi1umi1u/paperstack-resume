<script setup lang="ts">
import { ref } from 'vue'
import type { Resume, FontId, DensityId, PageTarget, ResumeLang, TemplateId } from '../core/model'
import { ACCENTS } from '../core/model'
import { TEMPLATES } from '../templates'
import TemplateGallery from './TemplateGallery.vue'
import PhotoEditor from './PhotoEditor.vue'
import type { FitReport } from '../layout/engine'

const props = defineProps<{ resume: Resume; fit: FitReport | null }>()
const photoInput = ref<HTMLInputElement | null>(null)
const pendingPhoto = ref('')
const photoError = ref('')
function applyTemplate(id: TemplateId) {
  props.resume.meta.template = id
  const template = TEMPLATES.find(t => t.id === id)
  if (template) props.resume.meta.lang = template.lang
}

function choosePhoto(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  photoError.value = ''
  if (!file) return
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    photoError.value = '请选择 JPG、PNG 或 WebP 图片。'
    return
  }
  if (file.size > 8 * 1024 * 1024) {
    photoError.value = '原图不能超过 8 MB。'
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    pendingPhoto.value = String(reader.result || '')
  }
  reader.onerror = () => { photoError.value = '图片读取失败，请换一张。' }
  reader.readAsDataURL(file)
}

function savePhoto(value: string) {
  props.resume.basics.image = value
  pendingPhoto.value = ''
}
</script>

<template>
  <aside class="editor design-panel">
    <section v-if="fit" class="design-section fit-report">
      <div class="design-title">分页状态</div>
      <div class="fit-line"><b>{{ fit.pages }}</b> 页{{ fit.compressed ? '（已压缩）' : '' }}</div>
      <div class="fit-line">字号 <b>{{ fit.fontSize.toFixed(1) }}</b> px · 下限 13.5</div>
      <div class="fit-line">行高 <b>{{ fit.lineHeight.toFixed(2) }}</b> · 下限 {{ fit.minLineHeight }}</div>
      <p v-for="warning in fit.warnings" :key="warning" class="fit-warning">{{ warning }}</p>
      <p class="design-hint">无法在可读范围内容纳时会正常分页，不无限压缩。</p>
      <div class="chip-group">
        <button class="chip" :aria-pressed="resume.meta.targetPages === 'auto'" @click="resume.meta.targetPages = 'auto' as PageTarget">自动</button>
        <button class="chip" :aria-pressed="resume.meta.targetPages === '1'" @click="resume.meta.targetPages = '1' as PageTarget">1 页</button>
        <button class="chip" :aria-pressed="resume.meta.targetPages === '2'" @click="resume.meta.targetPages = '2' as PageTarget">2 页</button>
        <button class="chip" :aria-pressed="resume.meta.targetPages === '3'" @click="resume.meta.targetPages = '3' as PageTarget">3 页</button>
      </div>
    </section>
    <section class="design-section">
      <div class="design-title">模板</div>
      <TemplateGallery :resume="resume" @apply="applyTemplate" />
    </section>

    <section class="design-section">
      <div class="design-title">证件照</div>
      <div class="photo-design-row">
        <div class="photo-design-preview">
          <img v-if="resume.basics.image" :src="resume.basics.image" alt="当前证件照">
          <span v-else>未上传</span>
        </div>
        <div class="photo-design-actions">
          <button class="btn" type="button" @click="photoInput?.click()">{{ resume.basics.image ? '更换照片' : '上传照片' }}</button>
          <button v-if="resume.basics.image" class="photo-remove" type="button" @click="resume.basics.image = undefined">移除</button>
          <p>适合“照”和“栏”模板；自动裁剪为宽 300 px JPEG。</p>
        </div>
      </div>
      <p v-if="photoError" class="photo-error">{{ photoError }}</p>
      <input ref="photoInput" class="photo-input" type="file" accept="image/jpeg,image/png,image/webp"
        aria-label="选择证件照" @change="choosePhoto">
    </section>

    <section class="design-section">
      <div class="design-title">内容语言</div>
      <div class="chip-group">
        <button class="chip" :aria-pressed="resume.meta.lang === 'zh'" @click="resume.meta.lang = 'zh' as ResumeLang">中文</button>
        <button class="chip" :aria-pressed="resume.meta.lang === 'en'" @click="resume.meta.lang = 'en' as ResumeLang">English</button>
      </div>
    </section>

    <section class="design-section">
      <div class="design-title">字体</div>
      <div class="chip-group">
        <button class="chip" :aria-pressed="resume.meta.font === 'song'" @click="resume.meta.font = 'song' as FontId">宋体</button>
        <button class="chip" :aria-pressed="resume.meta.font === 'yahei'" @click="resume.meta.font = 'yahei' as FontId">雅黑</button>
        <button class="chip" :aria-pressed="resume.meta.font === 'hei'" @click="resume.meta.font = 'hei' as FontId">黑体</button>
      </div>
    </section>

    <section class="design-section">
      <div class="design-title">主题色</div>
      <div class="dots">
        <button v-for="a in ACCENTS" :key="a.value" class="dotbtn" :style="{ '--c': a.value }"
          :title="a.name" :aria-pressed="resume.meta.accent === a.value"
          @click="resume.meta.accent = a.value" />
      </div>
    </section>

    <section class="design-section">
      <div class="design-title">疏密</div>
      <div class="chip-group">
        <button class="chip" :aria-pressed="resume.meta.density === 'compact'" @click="resume.meta.density = 'compact' as DensityId">紧凑</button>
        <button class="chip" :aria-pressed="resume.meta.density === 'normal'" @click="resume.meta.density = 'normal' as DensityId">标准</button>
        <button class="chip" :aria-pressed="resume.meta.density === 'loose'" @click="resume.meta.density = 'loose' as DensityId">宽松</button>
      </div>
    </section>
  </aside>
  <PhotoEditor v-if="pendingPhoto" :src="pendingPhoto" @save="savePhoto" @close="pendingPhoto = ''" />
</template>

<style scoped>
.design-panel{padding-top:22px;position:relative}
.design-section{padding-bottom:22px;margin-bottom:20px;border-bottom:1px solid var(--line-soft)}
.design-section:last-child{border-bottom:0}
.design-title{font-size:12px;font-weight:600;color:var(--ink);margin-bottom:11px;letter-spacing:.08em}
.fit-line{font-size:12px;color:var(--ink2);line-height:1.9}
.fit-line b{font-family:var(--mono);color:var(--ink)}
.fit-warning{margin:9px 0 0;padding:8px 9px;border-left:2px solid #A63A2B;background:rgba(166,58,43,.06);
  font-size:10.5px;line-height:1.65;color:#6D3B32}
.photo-design-row{display:flex;gap:12px;align-items:flex-start}
.photo-design-preview{width:54px;height:68px;background:#EFEBE2;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none}
.photo-design-preview img{width:100%;height:100%;object-fit:cover}
.photo-design-preview span{font-size:9px;color:var(--muted)}
.photo-design-actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-width:0}
.photo-design-actions p{flex-basis:100%;margin:1px 0 0;font-size:10px;line-height:1.6;color:var(--muted)}
.photo-remove{border:0;background:transparent;color:var(--muted);font:10.5px var(--ui);cursor:pointer;padding:5px}
.photo-remove:hover{color:var(--accent)}
.photo-error{margin:9px 0 0;color:var(--accent);font-size:10.5px}
.photo-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
</style>
