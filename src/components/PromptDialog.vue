<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

const props = defineProps<{
  title: string
  label: string
  initial?: string
  allowEmpty?: boolean
  confirmText?: string
}>()

const emit = defineEmits<{
  (e: 'confirm', value: string): void
  (e: 'cancel'): void
}>()

const value = ref(props.initial || '')
const input = ref<HTMLInputElement | null>(null)

function submit() {
  if (!props.allowEmpty && !value.value.trim()) return
  emit('confirm', props.allowEmpty ? value.value : value.value.trim())
}

onMounted(() => nextTick(() => {
  input.value?.focus()
  input.value?.select()
}))
</script>

<template>
  <div class="modal-mask prompt-mask" @click.self="emit('cancel')">
    <div class="prompt-dialog" role="dialog" aria-modal="true" :aria-label="title">
      <div class="modal-title">{{ title }}</div>
      <label>
        <span>{{ label }}</span>
        <input ref="input" v-model="value" :aria-label="label" @keydown.enter.prevent="submit" @keydown.esc.prevent="emit('cancel')">
      </label>
      <div class="prompt-actions">
        <button class="btn" type="button" @click="emit('cancel')">取消</button>
        <button class="btn primary" type="button" :disabled="!allowEmpty && !value.trim()" @click="submit">
          {{ confirmText || '确定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prompt-dialog{width:min(390px,100%);background:var(--paper);padding:20px;box-shadow:0 24px 60px -28px rgba(0,0,0,.55)}
.modal-title{margin-bottom:14px}
label{display:flex;flex-direction:column;gap:6px}
label span{font-size:10px;color:var(--muted);letter-spacing:.08em}
input{height:36px;border:1px solid var(--line);background:#fff;color:var(--ink);padding:7px 9px;font:12px var(--ui)}
input:focus{outline:none;border-color:var(--accent)}
.prompt-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
</style>
