<script setup lang="ts">
import type { Resume, FontId, DensityId, PageTarget } from '../core/model'
import { ACCENTS } from '../core/model'
import TemplateGallery from './TemplateGallery.vue'
import type { FitReport } from '../layout/engine'

defineProps<{ resume: Resume; fit: FitReport | null }>()
</script>

<template>
  <aside class="editor design-panel">
    <section v-if="fit" class="design-section fit-report">
      <div class="design-title">分页状态</div>
      <div class="fit-line"><b>{{ fit.pages }}</b> 页{{ fit.compressed ? '（已压缩）' : '' }}</div>
      <div class="fit-line">字号 <b>{{ fit.fontSize.toFixed(1) }}</b> px · 下限 13.5</div>
      <div class="fit-line">行高 <b>{{ fit.lineHeight.toFixed(2) }}</b> · 下限 {{ fit.minLineHeight }}</div>
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
      <TemplateGallery :resume="resume" @apply="t => (resume.meta.template = t)" />
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
</template>

<style scoped>
.design-panel{padding-top:22px}
.design-section{padding-bottom:22px;margin-bottom:20px;border-bottom:1px solid var(--line-soft)}
.design-section:last-child{border-bottom:0}
.design-title{font-size:12px;font-weight:600;color:var(--ink);margin-bottom:11px;letter-spacing:.08em}
.fit-line{font-size:12px;color:var(--ink2);line-height:1.9}
.fit-line b{font-family:var(--mono);color:var(--ink)}

</style>
