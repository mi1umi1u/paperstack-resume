<script setup lang="ts">
withDefaults(defineProps<{ canCopy?: boolean }>(), { canCopy: false })
const emit = defineEmits<{
  (e: 'import'): void
  (e: 'blank'): void
  (e: 'copy'): void
}>()
</script>

<template>
  <main class="start-screen">
    <div class="start-brand"><span class="start-logo">纸栈</span><span>PAPERSTACK</span></div>
    <div class="start-intro">
      <p class="start-kicker">本地简历工作台</p>
      <h1>从旧简历继续，或从一张空白的纸开始。</h1>
      <p>导入后自动拆分栏目，再套模板、分页并导出 PDF。</p>
    </div>

    <div class="start-choices">
      <button class="start-choice" type="button" @click="emit('import')">
        <span class="start-choice-title">导入旧简历</span>
        <span class="start-choice-desc">支持 Word、PDF 和粘贴文本，核对后导入</span>
      </button>
      <button class="start-choice" type="button" @click="emit('blank')">
        <span class="start-choice-title">从零创建</span>
        <span class="start-choice-desc">使用默认模板，从一份空白简历开始</span>
      </button>
    </div>

    <button v-if="canCopy" class="start-copy" type="button" @click="emit('copy')">复制当前版本</button>
    <p class="start-privacy">数据只保存在本机浏览器，不注册、不上传，断网也能用。</p>
  </main>
</template>

<style scoped>
.start-screen{min-height:100vh;display:flex;flex-direction:column;justify-content:center;max-width:880px;margin:0 auto;padding:48px 28px;color:var(--ink)}
.start-brand{display:flex;align-items:baseline;gap:10px;margin-bottom:56px;font-size:10px;letter-spacing:.18em;color:var(--muted)}
.start-logo{font-size:25px;font-weight:700;letter-spacing:.08em;color:var(--accent)}
.start-intro{max-width:640px}
.start-kicker{font-size:11px;letter-spacing:.16em;color:var(--accent);margin-bottom:12px}
.start-intro h1{font-size:32px;line-height:1.35;font-weight:600;margin:0 0 14px}
.start-intro>p:last-child{font-size:13px;color:var(--muted);line-height:1.8}
.start-choices{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:38px}
.start-choice{display:flex;flex-direction:column;align-items:flex-start;gap:10px;min-height:132px;padding:24px;text-align:left;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);cursor:pointer;transition:border-color .15s,transform .15s}
.start-choice:hover{border-color:var(--accent);transform:translateY(-2px)}
.start-choice-title{font-size:18px;font-weight:600}
.start-choice-desc{font-size:12px;line-height:1.7;color:var(--muted)}
.start-copy{align-self:flex-start;margin-top:18px;padding:0;border:0;background:transparent;color:var(--accent);font-size:12px;cursor:pointer}
.start-privacy{margin-top:24px;font-size:11px;line-height:1.7;color:var(--muted)}
@media (max-width:640px){.start-choices{grid-template-columns:1fr}.start-intro h1{font-size:26px}.start-brand{margin-bottom:36px}}
</style>
