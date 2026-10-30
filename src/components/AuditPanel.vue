<script setup lang="ts">
import { computed } from 'vue'
import type { Resume } from '../core/model'
import { audit } from '../audit'

const props = defineProps<{ resume: Resume }>()
const emit = defineEmits<{ (e: 'locate', target?: string): void }>()

const result = computed(() => audit(props.resume))
const verdict = computed(() => {
  const s = result.value.score
  if (s >= 85) return '像真的，可以投了'
  if (s >= 70) return '基本可用，还有几处会让人起疑'
  if (s >= 50) return '有几处明显是包装出来的'
  return '问题比较大，先改再投'
})
const ringColor = computed(() => {
  const s = result.value.score
  return s >= 80 ? '#4E6B4A' : s >= 60 ? '#C58B22' : '#B3382A'
})
const badge = (lv: string) => (lv === 'err' ? '必须改' : lv === 'warn' ? '建议改' : '可选')
</script>

<template>
  <aside class="editor audit-panel">
    <div class="audit-head">
      <div class="ring" :style="{ '--v': result.score, '--c': ringColor }"><b>{{ result.score }}</b></div>
      <div class="audit-verdict">
        <b>{{ verdict }}</b>
        <span>共 {{ result.bullets }} 条要点 · 点击问题可定位修改</span>
      </div>
    </div>

    <div v-if="result.good" class="audit-good">✓ {{ result.good }}</div>
    <button v-for="(it, i) in result.issues" :key="i" class="audit-issue" type="button" @click="emit('locate', it.target)">
      <span class="audit-h">
        <span class="dot" :class="it.level" />
        {{ it.title }}
        <span class="audit-badge">{{ badge(it.level) }}</span>
      </span>
      <span class="audit-d">{{ it.detail }}</span>
    </button>
    <div v-if="!result.issues.length" class="audit-good">没发现问题。</div>
  </aside>
</template>

<style scoped>
.audit-panel{padding-top:22px}
.audit-head{display:flex;align-items:center;gap:14px;padding-bottom:16px;margin-bottom:14px;border-bottom:1px solid var(--line-soft)}
.ring{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;flex:none;position:relative;
  background:conic-gradient(var(--c) calc(var(--v) * 1%), #E8E2D4 0)}
.ring::before{content:"";position:absolute;inset:5px;border-radius:50%;background:var(--panel)}
.ring b{position:relative;font-family:var(--mono);font-size:17px;color:var(--ink)}
.audit-verdict{display:flex;flex-direction:column;gap:4px;font-size:12.5px;line-height:1.5;color:var(--ink2)}
.audit-verdict b{color:var(--accent)}
.audit-verdict span{font-size:10.5px;color:var(--muted)}
.audit-good{font-size:12px;color:#4E6B4A;line-height:1.8;padding:4px 0 10px}
.audit-issue{display:block;width:100%;text-align:left;padding:11px 0;border:0;background:transparent;border-bottom:1px dashed var(--line-soft);cursor:pointer}
.audit-issue:hover .audit-h{color:var(--accent)}
.audit-h{display:flex;align-items:center;gap:8px;font-size:12.8px;font-weight:600;color:var(--ink)}
.dot{width:6px;height:6px;border-radius:50%;flex:none}
.dot.err{background:#B3382A}.dot.warn{background:#C58B22}.dot.info{background:#7C8B78}
.audit-badge{margin-left:auto;font-family:var(--mono);font-size:9px;color:var(--muted)}
.audit-d{display:block;font-size:11.5px;color:var(--muted);line-height:1.75;margin-top:5px;padding-left:14px}
</style>
