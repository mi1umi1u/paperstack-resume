<script setup lang="ts">
import { computed, ref } from 'vue'
import { sampleResume, type Resume, type TemplateId } from '../core/model'
import { buildDoc } from '../render/doc'
import { TEMPLATES, type TemplateDef } from '../templates'

defineProps<{ resume: Resume }>()
const emit = defineEmits<{ (e: 'apply', id: TemplateId): void }>()

const filter = ref<'all' | 'single' | 'double' | 'photo' | 'en'>('all')
const selected = ref<TemplateId | null>(null)

const ready = computed(() => TEMPLATES.filter(t => t.ready))
const list = computed(() => {
  const src = ready.value
  if (filter.value === 'single') return src.filter(t => t.type === 'single')
  if (filter.value === 'double') return src.filter(t => t.type === 'double')
  if (filter.value === 'photo') return src.filter(t => t.photo)
  if (filter.value === 'en') return src.filter(t => t.lang === 'en')
  return src
})

const sample = sampleResume()
const thumbFor = (t: TemplateDef): string => {
  const r = JSON.parse(JSON.stringify(sample)) as Resume
  r.meta.template = t.id
  return buildDoc(r)
}

const metaLabel = (t: TemplateDef) =>
  [t.type === 'double' ? '双栏' : '单栏', t.photo ? '照片' : '', t.lang === 'en' ? '英文' : '']
    .filter(Boolean).join(' · ')

function apply() {
  if (selected.value) emit('apply', selected.value)
}
</script>

<template>
  <div class="gallery">
    <div class="gallery-filters">
      <button :aria-pressed="filter === 'all'" @click="filter = 'all'">全部</button>
      <button :aria-pressed="filter === 'single'" @click="filter = 'single'">单栏</button>
      <button :aria-pressed="filter === 'double'" @click="filter = 'double'">双栏</button>
      <button :aria-pressed="filter === 'photo'" @click="filter = 'photo'">照片</button>
      <button :aria-pressed="filter === 'en'" @click="filter = 'en'">英文</button>
    </div>

    <div v-if="!list.length" class="gallery-empty">没有符合条件的模板。</div>
    <div class="gallery-grid">
      <button v-for="t in list" :key="t.id" class="tpl-card" :class="{ on: selected === t.id }"
        type="button" @click="selected = t.id">
        <span class="tpl-thumb" v-html="thumbFor(t)" />
        <span class="tpl-info">
          <span class="tpl-name">{{ t.name }}</span>
          <span class="tpl-meta">{{ metaLabel(t) }}</span>
        </span>
      </button>
    </div>

    <div class="gallery-foot">
      <span class="gallery-hint">使用同一份示例简历渲染，切换不改变你的内容。</span>
      <button class="btn primary" :disabled="!selected" @click="apply">应用此模板</button>
    </div>
  </div>
</template>

<style scoped>
.gallery{display:flex;flex-direction:column;min-height:0}
.gallery-filters{display:flex;gap:5px;margin-bottom:12px}
.gallery-filters button{border:0;background:transparent;padding:3px 8px;font:11px var(--ui);color:var(--muted);cursor:pointer;border-radius:2px}
.gallery-filters button[aria-pressed="true"]{background:var(--paper);color:var(--accent)}
.gallery-grid{display:grid;grid-template-columns:1fr;gap:12px;overflow-y:auto;min-height:0}
.tpl-card{display:flex;gap:10px;padding:10px;border:1px solid var(--line-soft);background:transparent;text-align:left;cursor:pointer;border-radius:4px;align-items:flex-start}
.tpl-card:hover{border-color:var(--accent)}
.tpl-card.on{border-color:var(--accent);background:#FFFDF8}
.tpl-thumb{width:120px;height:150px;overflow:hidden;flex:none;background:#fff;border:1px solid var(--line-soft);display:block}
.tpl-thumb :deep(.doc){transform:scale(.15);transform-origin:top left;width:794px}
.tpl-info{display:flex;flex-direction:column;gap:5px;padding-top:4px}
.tpl-name{font-size:15px;font-weight:600;color:var(--ink)}
.tpl-meta{font-size:10.5px;color:var(--muted)}
.gallery-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line-soft)}
.gallery-hint{font-size:10.5px;color:var(--muted);line-height:1.6;max-width:190px}
.gallery-empty{font-size:12px;color:var(--muted);padding:20px 0}
</style>
