<script setup lang="ts">
import { reactive, ref } from 'vue'
import { DEFAULT_AI_SETTINGS, normalizeAISettings } from '../ai/settings'
import type { AISettings } from '../ai/types'

const props = defineProps<{ settings: AISettings }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', value: AISettings): void
}>()

const form = reactive<AISettings>({ ...props.settings })
const showKey = ref(false)
const error = ref('')

function save() {
  const clean = normalizeAISettings(form)
  if (clean.enabled && !clean.apiKey) {
    error.value = '启用 AI 前请填写 DeepSeek API Key。'
    return
  }
  emit('save', clean)
}

function clearKey() {
  form.apiKey = ''
  form.enabled = false
}

function resetBaseUrl() {
  form.baseUrl = DEFAULT_AI_SETTINGS.baseUrl
}
</script>

<template>
  <div class="modal-mask ai-settings-mask" @click.self="emit('close')">
    <div class="modal ai-settings" role="dialog" aria-modal="true" aria-label="DeepSeek AI 设置">
      <div class="modal-head">
        <span class="modal-title">DeepSeek AI 设置</span>
        <span class="modal-sub">默认关闭；只有主动启用并确认发送后才会联网</span>
      </div>

      <div class="modal-body">
        <section class="ai-setting-block">
          <div class="ai-setting-line">
            <div>
              <b>启用 AI 建议</b>
              <p>本地编辑、导入、模板、体检、分页和导出始终不需要 AI。</p>
            </div>
            <button class="ai-toggle" type="button" :aria-pressed="form.enabled"
              @click="form.enabled = !form.enabled">{{ form.enabled ? '已启用' : '已关闭' }}</button>
          </div>
        </section>

        <label class="ai-field">
          <span>DeepSeek API Key</span>
          <div class="ai-key-row">
            <input v-model="form.apiKey" :type="showKey ? 'text' : 'password'" autocomplete="off"
              placeholder="sk-..." aria-label="DeepSeek API Key">
            <button type="button" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button>
          </div>
          <small>Key 只保存在本机浏览器，不写入简历、快照或导出 JSON。</small>
        </label>

        <label class="ai-field">
          <span>API 地址</span>
          <div class="ai-key-row">
            <input v-model="form.baseUrl" type="url" aria-label="DeepSeek API 地址">
            <button type="button" @click="resetBaseUrl">恢复默认</button>
          </div>
          <small>请求地址为“API 地址 + /chat/completions”，默认使用官方 HTTPS 地址。</small>
        </label>

        <label class="ai-field">
          <span>模型</span>
          <select v-model="form.model" aria-label="DeepSeek 模型">
            <option value="deepseek-flash">deepseek-flash</option>
            <option value="deepseek-v4-pro">deepseek-v4-pro</option>
          </select>
        </label>

        <div class="ai-privacy-box">
          <b>默认脱敏</b>
          <span>姓名、电话、邮箱、城市和证件照不会发送。公司、项目名会先展示在发送预览中，由你确认。</span>
        </div>
        <p v-if="error" class="ai-error">{{ error }}</p>
      </div>

      <div class="modal-foot ai-settings-foot">
        <button class="ai-clear-key" type="button" @click="clearKey">清除 Key</button>
        <span class="spacer" />
        <button class="btn" type="button" @click="emit('close')">取消</button>
        <button class="btn primary" type="button" @click="save">保存设置</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-settings{width:min(620px,100%)}
.ai-setting-block{padding:2px 0 18px;border-bottom:1px solid var(--line-soft);margin-bottom:18px}
.ai-setting-line{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
.ai-setting-line b,.ai-field>span,.ai-privacy-box b{font-size:12px;color:var(--ink);font-weight:600;letter-spacing:.06em}
.ai-setting-line p{margin:6px 0 0;font-size:11px;color:var(--muted);line-height:1.7}
.ai-toggle{border:1px solid var(--line);background:transparent;color:var(--muted);font:11.5px var(--ui);
  padding:6px 12px;border-radius:999px;cursor:pointer;white-space:nowrap}
.ai-toggle[aria-pressed="true"]{border-color:#315B4A;background:#315B4A;color:#fff}
.ai-field{display:flex;flex-direction:column;gap:7px;margin-bottom:18px}
.ai-field small{font-size:10.5px;color:var(--muted);line-height:1.65}
.ai-field input,.ai-field select{width:100%;height:36px;border:1px solid var(--line);background:#fff;color:var(--ink);
  padding:7px 9px;font:12px var(--ui);border-radius:2px}
.ai-field input:focus,.ai-field select:focus{outline:none;border-color:var(--accent)}
.ai-key-row{display:flex;gap:6px}
.ai-key-row button{border:1px solid var(--line);background:transparent;color:var(--ink2);font:10.5px var(--ui);
  min-width:62px;padding:0 9px;cursor:pointer;white-space:nowrap}
.ai-privacy-box{display:flex;flex-direction:column;gap:5px;padding:11px 12px;background:#F1EEE6;border-left:2px solid #315B4A}
.ai-privacy-box span{font-size:11px;line-height:1.75;color:var(--ink2)}
.ai-error{margin:10px 0 0;color:var(--accent);font-size:11px}
.ai-settings-foot{align-items:center}
.ai-clear-key{border:0;background:transparent;color:var(--muted);font:10.5px var(--ui);cursor:pointer}
.ai-clear-key:hover{color:var(--accent)}
</style>
