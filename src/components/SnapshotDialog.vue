<script setup lang="ts">
import { ref } from 'vue'
import type { Snapshot } from '../core/versions'
import { diffSnapshots } from '../core/versions'
import type { Resume } from '../core/model'

const props = defineProps<{ snapshots: Snapshot[]; resume: Resume }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'save', name: string): void; (e: 'restore', id: string): void }>()

const name = ref('')

function save() {
  if (!name.value.trim()) return
  emit('save', name.value.trim())
  name.value = ''
}

const time = (t: number) => new Date(t).toLocaleString('zh-CN', { hour12: false })
const tags = (s: Snapshot) => {
  const d = diffSnapshots(props.resume, s.resume)
  const out: string[] = []
  if (d.contentChanged) out.push('内容')
  if (d.structureChanged) out.push('结构')
  if (d.styleChanged) out.push('样式')
  return out
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal snapshot-modal" style="width:min(520px,100%)">
      <div class="modal-head">
        <span class="modal-title">版本快照</span>
        <span class="modal-sub">保存当前内容和样式，恢复时生成新版本，不覆盖现有内容</span>
      </div>

      <div class="modal-body">
        <div class="snap-new">
          <input v-model="name" placeholder="快照名称，如「投递前」" @keyup.enter="save" />
          <button class="btn primary" :disabled="!name.trim()" @click="save">保存快照</button>
        </div>

        <div v-if="!snapshots.length" class="snap-empty">还没有快照。</div>
        <div v-for="s in snapshots" :key="s.id" class="snap-item">
          <div class="snap-main">
            <span class="snap-name">{{ s.name }}</span>
            <span class="snap-time">{{ time(s.createdAt) }}</span>
            <span v-if="tags(s).length" class="snap-tags"><i v-for="t in tags(s)" :key="t">{{ t }}</i></span>
          </div>
          <button class="btn tiny" type="button" @click="emit('restore', s.id)">恢复为新版本</button>
        </div>
      </div>

      <div class="modal-foot">
        <button class="btn" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.snap-new{display:flex;gap:8px;margin-bottom:16px}
.snap-new input{flex:1;font-family:var(--ui);font-size:12.5px;padding:7px 9px;border:1px solid var(--line);background:#fff;color:var(--ink)}
.snap-new input:focus{outline:none;border-color:var(--accent)}
.snap-empty{font-size:12px;color:var(--muted);padding:10px 0}
.snap-item{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px dashed var(--line-soft)}
.snap-main{display:flex;align-items:center;gap:8px;min-width:0}
.snap-tags{display:flex;gap:4px}
.snap-tags i{font-style:normal;font-size:9.5px;color:var(--muted);border:1px solid var(--line-soft);padding:1px 5px;border-radius:2px}
.snap-item:last-child{border-bottom:0}
.snap-name{font-size:13px;font-weight:600;color:var(--ink)}
.snap-time{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--muted)}
</style>
