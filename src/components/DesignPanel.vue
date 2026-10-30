<script setup lang="ts">
import type { Resume, TemplateId, FontId, DensityId } from '../core/model'
import { ACCENTS } from '../core/model'
import { TEMPLATES } from '../templates'

defineProps<{ resume: Resume }>()
const templates = TEMPLATES
</script>

<template>
  <aside class="editor design-panel">
    <section class="design-section">
      <div class="design-title">模板</div>
      <div class="design-templates">
        <button v-for="t in templates" :key="t.id" class="chip" :disabled="!t.ready"
          :title="t.ready ? t.desc : '即将上线'"
          :aria-pressed="resume.meta.template === t.id"
          @click="t.ready && (resume.meta.template = t.id)">{{ t.name }}</button>
      </div>
      <p class="design-hint">切换模板不会改变简历内容。</p>
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
.design-templates{display:flex;flex-wrap:wrap;gap:5px}
.design-hint{font-size:10.5px;line-height:1.7;color:var(--muted);margin-top:10px}
</style>
