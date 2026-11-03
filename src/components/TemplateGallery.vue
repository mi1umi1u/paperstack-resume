<script setup lang="ts">
import { computed, ref } from 'vue'
import { sampleResume, type Resume, type TemplateId } from '../core/model'
import { buildDoc } from '../render/doc'
import { TEMPLATES, type TemplateDef } from '../templates'

const props = defineProps<{ resume: Resume }>()
const emit = defineEmits<{ (e: 'apply', id: TemplateId): void }>()

const filter = ref<'all' | 'single' | 'double' | 'photo' | 'en'>('all')
const selected = ref<TemplateId | null>(null)
const previewId = ref<TemplateId | null>(null)

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
  [t.type === 'double' ? '双栏' : '单栏', t.photo === 'optional' ? '照片可选' : t.photo ? '照片' : '', t.lang === 'en' ? '英文' : '']
    .filter(Boolean).join(' · ')

function applyPreview() {
  if (!previewTemplate.value) return
  selected.value = previewTemplate.value.id
  emit('apply', previewTemplate.value.id)
  previewId.value = null
}

const previewTemplate = computed(() => TEMPLATES.find(t => t.id === previewId.value) || null)
const previewHtml = computed(() => previewTemplate.value ? thumbFor(previewTemplate.value) : '')
const paperStyle = computed(() => ({
  '--dc': props.resume.meta.accent,
  '--doc-f': props.resume.meta.font === 'song'
    ? '"Times New Roman","Songti SC","STSong","SimSun",serif'
    : props.resume.meta.font === 'hei'
      ? '"Arial","SimHei","Heiti SC","STHeiti",sans-serif'
      : '"Arial","PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif',
  '--doc-lh': props.resume.meta.font === 'song' ? 1.66 : props.resume.meta.font === 'hei' ? 1.58 : 1.54
}))
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
      <div v-for="t in list" :key="t.id" class="tpl-card" :class="{ on: selected === t.id }" :data-template="t.id"
        role="button" tabindex="0" @click="selected = t.id" @keydown.enter="selected = t.id">
        <span class="tpl-thumb" :style="paperStyle" v-html="thumbFor(t)" />
        <span class="tpl-info">
          <span class="tpl-name">{{ t.name }}</span>
          <span class="tpl-meta">{{ metaLabel(t) }}</span>
          <span class="tpl-desc">{{ t.desc }}</span>
          <button class="tpl-preview" type="button" @click.stop="previewId = t.id">查看大图</button>
        </span>
      </div>
    </div>

    <div class="gallery-foot">
      <span class="gallery-hint">使用同一份示例简历渲染，切换不改变你的内容。</span>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="previewTemplate" class="gallery-preview-mask" role="dialog" aria-modal="true"
      :aria-label="`${previewTemplate.name}模板预览`" @click.self="previewId = null">
      <div class="gallery-preview-card">
        <div class="gallery-preview-head">
          <div>
            <b>{{ previewTemplate.name }}</b>
            <span>{{ metaLabel(previewTemplate) }} · {{ previewTemplate.desc }}</span>
          </div>
          <button type="button" aria-label="关闭模板预览" @click="previewId = null">×</button>
        </div>
        <div class="gallery-preview-stage">
          <div class="gallery-preview-sheet" :style="paperStyle" v-html="previewHtml" />
        </div>
        <div class="gallery-preview-foot">
          <span class="gallery-preview-hint">拖动设计面板右边缘，可以调整模板列表宽度。</span>
          <button class="btn" type="button" @click="previewId = null">返回</button>
          <button class="btn primary" type="button" @click="applyPreview">应用这套模板</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.gallery{display:flex;flex-direction:column;min-height:0}
.gallery-filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2px;margin-bottom:12px}
.gallery-filters button{border:0;background:transparent;padding:4px 2px;font:10px var(--ui);color:var(--muted);
  cursor:pointer;border-radius:2px;white-space:nowrap}
.gallery-filters button[aria-pressed="true"]{background:var(--paper);color:var(--accent)}
.gallery-grid{display:grid;grid-template-columns:1fr;gap:12px;overflow-y:auto;min-height:0}
.tpl-card{display:flex;gap:10px;padding:10px;border:1px solid var(--line-soft);background:transparent;text-align:left;cursor:pointer;border-radius:4px;align-items:flex-start}
.tpl-card:hover{border-color:var(--accent)}
.tpl-card.on{border-color:var(--accent);background:#FFFDF8}
.tpl-thumb{width:102px;height:144px;overflow:hidden;flex:none;background:#fff;border:1px solid var(--line-soft);display:block;pointer-events:none}
.tpl-thumb :deep(.doc){transform:scale(.126);transform-origin:top left;width:794px}
.tpl-thumb :deep(.doc), .tpl-thumb :deep(.doc-double .doc-side), .tpl-thumb :deep(.doc-double .doc-main){height:1123px}
.tpl-info{display:flex;flex-direction:column;gap:4px;padding-top:2px;min-width:0}
.tpl-name{font-size:15px;font-weight:600;color:var(--ink)}
.tpl-meta{font-size:10.5px;color:var(--muted)}
.tpl-desc{font-size:10px;line-height:1.55;color:var(--muted)}
.tpl-preview{align-self:flex-start;border:0;background:transparent;padding:3px 0;margin-top:2px;
  font:10.5px var(--ui);color:var(--accent);cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.gallery-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line-soft)}
.gallery-hint{font-size:10.5px;color:var(--muted);line-height:1.6;max-width:190px}
.gallery-empty{font-size:12px;color:var(--muted);padding:20px 0}
.gallery-preview-mask{position:fixed;inset:0;z-index:210;background:rgba(30,26,20,.5);backdrop-filter:blur(5px);
  display:flex;align-items:center;justify-content:center;padding:20px}
.gallery-preview-card{width:min(920px,100%);max-height:92vh;background:var(--paper);display:flex;flex-direction:column;
  border:1px solid rgba(117,99,77,.18);border-radius:20px;overflow:hidden;box-shadow:0 34px 90px -36px rgba(0,0,0,.65)}
.gallery-preview-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:15px 18px;border-bottom:1px solid var(--line)}
.gallery-preview-head div{display:flex;flex-direction:column;gap:4px}
.gallery-preview-head b{font-family:var(--kai);font-size:18px;font-weight:400;letter-spacing:.12em}
.gallery-preview-head span{font-size:10.5px;color:var(--muted)}
.gallery-preview-head button{border:0;background:transparent;font-size:22px;line-height:1;color:var(--muted);cursor:pointer}
.gallery-preview-stage{overflow:auto;padding:24px 28px;background:
  linear-gradient(135deg,rgba(255,255,255,.38),transparent 40%),#E9E5DC;display:flex;justify-content:center}
.gallery-preview-sheet{width:477px;height:674px;flex:none;background:#fff;overflow:hidden;
  box-shadow:0 18px 40px -22px rgba(0,0,0,.5);pointer-events:none;user-select:none}
.gallery-preview-sheet :deep(.doc){transform:scale(.6);transform-origin:top left;width:794px;height:1123px;min-height:1123px;padding:56px 60px;background:#fff}
.gallery-preview-sheet :deep(.doc [data-region]),
.gallery-preview-sheet :deep(.doc [data-key]),
.gallery-preview-sheet :deep(.doc [data-id]),
.gallery-preview-sheet :deep(.doc li[data-bi]){box-shadow:none!important;background:transparent!important;cursor:default!important}
.gallery-preview-foot{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 18px 16px;border-top:1px solid var(--line)}
.gallery-preview-hint{margin-right:auto;font-size:9.5px;color:var(--muted)}
@media(max-width:620px){
  .gallery-preview-mask{padding:10px}
  .gallery-preview-card{max-height:96vh}
  .gallery-preview-stage{padding:14px}
  .gallery-preview-hint{display:none}
}
</style>
