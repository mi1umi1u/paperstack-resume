<script setup lang="ts">
import { computed } from 'vue'
import type { Resume } from '../core/model'
import { audit } from '../audit'

const props = defineProps<{ resume: Resume }>()
const emit = defineEmits<{ (e: 'close'): void }>()

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
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal" style="width:min(560px,100%)">
      <div class="modal-head">
        <span class="modal-title">简历体检</span>
        <span class="modal-sub">看的是“像不像真话”，不是“漂不漂亮”</span>
      </div>

      <div class="modal-body">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
          <div class="ring" :style="{ '--v': result.score, '--c': ringColor }">
            <b>{{ result.score }}</b>
          </div>
          <div style="font-size:12.5px;line-height:1.8;color:var(--ink2)">
            <b style="color:var(--accent)">{{ verdict }}</b><br />
            共 {{ result.bullets }} 条要点
          </div>
        </div>

        <div v-if="result.good" class="audit-good">✓ {{ result.good }}</div>

        <div v-for="(it, i) in result.issues" :key="i" class="audit-issue">
          <div class="audit-h">
            <span class="dot" :class="it.level" />
            {{ it.title }}
            <span class="audit-badge">{{ badge(it.level) }}</span>
          </div>
          <div class="audit-d">{{ it.detail }}</div>
        </div>

        <div v-if="!result.issues.length" class="audit-good">没发现问题。</div>
      </div>

      <div class="modal-foot">
        <button class="btn" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ring{
  width:74px;height:74px;border-radius:50%;display:grid;place-items:center;flex:none;position:relative;
  background:conic-gradient(var(--c) calc(var(--v) * 1%), #E8E2D4 0);
}
.ring::before{content:"";position:absolute;inset:6px;border-radius:50%;background:var(--paper)}
.ring b{position:relative;font-family:var(--mono);font-size:19px;color:var(--ink)}
.audit-good{font-size:12px;color:#4E6B4A;line-height:1.8;padding:6px 0 10px}
.audit-issue{padding:11px 0;border-bottom:1px dashed var(--line-soft)}
.audit-h{display:flex;align-items:center;gap:8px;font-size:12.8px;font-weight:600;color:var(--ink)}
.dot{width:6px;height:6px;border-radius:50%;flex:none}
.dot.err{background:#B3382A}.dot.warn{background:#C58B22}.dot.info{background:#7C8B78}
.audit-badge{margin-left:auto;font-family:var(--mono);font-size:9px;color:var(--muted)}
.audit-d{font-size:11.5px;color:var(--muted);line-height:1.75;margin-top:5px;padding-left:14px}
</style>
