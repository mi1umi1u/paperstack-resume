<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Resume } from '../core/model'
import { DeepSeekProvider } from '../ai/deepseek'
import { analyzeJDCoverage, applySelectedSuggestions, buildRewriteCandidates, coverageLabel, parseAISuggestions } from '../ai/jdCoverage'
import { buildDeepSeekMessages, buildRedactedResume } from '../ai/privacy'
import type { AISettings, AISuggestion, CoverageRequirement } from '../ai/types'

const props = defineProps<{
  resume: Resume
  settings: AISettings
  backedUp: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'settings'): void
  (e: 'backup'): void
  (e: 'apply', value: { resume: Resume; name: string }): void
}>()

const jd = ref('')
const coverage = ref<CoverageRequirement[]>([])
const suggestions = ref<AISuggestion[]>([])
const includeOrganizations = ref(true)
const previewOpen = ref(false)
const confirmed = ref(false)
const rememberConsent = ref(false)
const loading = ref(false)
const error = ref('')
const status = ref('')
const versionName = ref('AI 优化版')

const candidates = computed(() => buildRewriteCandidates(props.resume))
const redacted = computed(() => buildRedactedResume(
  props.resume,
  candidates.value,
  coverage.value,
  { includeOrganizations: includeOrganizations.value }
))
const messages = computed(() => buildDeepSeekMessages(redacted.value.text))
const provider = computed(() => new DeepSeekProvider(props.settings))
const requestPreview = computed(() => provider.value.request(messages.value))
const selectedCount = computed(() => suggestions.value.filter(s => s.selected !== false).length)
const counts = computed(() => ({
  covered: coverage.value.filter(x => x.status === 'covered').length,
  partial: coverage.value.filter(x => x.status === 'partial').length,
  missing: coverage.value.filter(x => x.status === 'missing').length
}))
const canUseAI = computed(() => props.settings.enabled && !!props.settings.apiKey)
const consentKey = computed(() => `paperstack.ai.consent.${props.settings.baseUrl}.${props.settings.model}.jd-v1`)

function analyze() {
  coverage.value = jd.value.trim() ? analyzeJDCoverage(props.resume, jd.value) : []
  suggestions.value = []
  error.value = coverage.value.length ? '' : '请先粘贴岗位描述。'
  status.value = ''
}

watch(jd, () => {
  if (jd.value.trim()) {
    coverage.value = analyzeJDCoverage(props.resume, jd.value)
    suggestions.value = []
    error.value = ''
  } else {
    coverage.value = []
    suggestions.value = []
  }
})

async function openSendPreview() {
  if (!canUseAI.value) {
    error.value = '请先在 AI 设置里启用 DeepSeek 并填写 API Key。'
    return
  }
  if (!coverage.value.length) analyze()
  if (!coverage.value.length) return
  try {
    confirmed.value = sessionStorage.getItem(consentKey.value) === '1'
  } catch {
    confirmed.value = false
  }
  error.value = ''
  if (confirmed.value) {
    previewOpen.value = false
    await send()
    return
  }
  previewOpen.value = true
}

async function send() {
  if (!confirmed.value) return
  loading.value = true
  error.value = ''
  status.value = '正在等待 DeepSeek 返回建议…'
  try {
    const raw = await provider.value.chat(messages.value)
    suggestions.value = parseAISuggestions(raw, candidates.value)
    if (!suggestions.value.length) {
      status.value = 'DeepSeek 没有给出可在不改变事实的前提下采用的建议。'
    } else {
      status.value = `收到 ${suggestions.value.length} 条建议，请逐条审阅。`
      if (rememberConsent.value) sessionStorage.setItem(consentKey.value, '1')
    }
    previewOpen.value = false
  } catch (e: any) {
    error.value = e?.message || 'DeepSeek 请求失败'
    status.value = ''
  } finally {
    loading.value = false
  }
}

function toggleAll(value: boolean) {
  suggestions.value.forEach(s => { s.selected = value })
}

function apply() {
  const chosen = suggestions.value.filter(s => s.selected !== false)
  if (!chosen.length) return
  emit('apply', {
    resume: applySelectedSuggestions(props.resume, chosen),
    name: versionName.value.trim() || 'AI 优化版'
  })
}
</script>

<template>
  <div class="modal-mask ai-review-mask" @click.self="!loading && emit('close')">
    <div class="modal ai-review" role="dialog" aria-modal="true" aria-label="DeepSeek JD 优化">
      <div class="modal-head ai-review-head">
        <div>
          <span class="modal-title">DeepSeek JD 优化</span>
          <p>先在本地分析岗位覆盖，再决定是否发送脱敏内容。</p>
        </div>
        <button class="ai-close" type="button" aria-label="关闭 AI 优化" :disabled="loading" @click="emit('close')">×</button>
      </div>

      <div class="ai-local-note">
        <span>本地规则</span>
        岗位覆盖分析不需要 API Key，也不会联网。
        <button v-if="!canUseAI" type="button" @click="emit('settings')">配置 DeepSeek</button>
        <b v-else>已连接 {{ settings.model }}</b>
      </div>

      <div class="modal-body ai-review-body">
        <div class="ai-workspace">
          <section class="ai-jd-column">
            <div class="ai-section-head">
              <div>
                <h3>岗位描述</h3>
                <p>岗位覆盖只表示简历是否提供了证据，不代表你本人不具备该能力。</p>
              </div>
              <button class="btn tiny" type="button" @click="analyze">分析覆盖</button>
            </div>
            <textarea v-model="jd" class="ai-jd-input" aria-label="岗位描述"
              placeholder="粘贴完整 JD，例如：&#10;负责 Linux 服务器日常运维&#10;熟悉 TCP/IP、VLAN，能够排查网络故障"></textarea>

            <div v-if="coverage.length" class="ai-coverage-head">
              <span class="covered">{{ counts.covered }} 已覆盖</span>
              <span class="partial">{{ counts.partial }} 部分覆盖</span>
              <span class="missing">{{ counts.missing }} 缺少证据</span>
            </div>
            <div v-if="coverage.length" class="ai-coverage-list">
              <article v-for="item in coverage" :key="item.id" class="ai-coverage-item" :class="item.status">
                <div class="ai-coverage-top">
                  <span class="ai-status">{{ coverageLabel(item.status) }}</span>
                  <b>{{ item.text }}</b>
                </div>
                <div v-if="item.matched.length" class="ai-terms">
                  命中：<span v-for="term in item.matched" :key="term">{{ term }}</span>
                </div>
                <div v-if="item.evidence.length" class="ai-evidence">
                  <p v-for="line in item.evidence" :key="line">{{ line }}</p>
                </div>
                <p v-else class="ai-no-evidence">当前简历没有找到对应证据；不要为了匹配 JD 编造经历。</p>
              </article>
            </div>
            <div v-else class="ai-empty">粘贴岗位描述后，这里会显示覆盖情况和简历证据。</div>
          </section>

          <section class="ai-result-column">
            <div class="ai-section-head">
              <div>
                <h3>修改建议</h3>
                <p>只会改写现有要点、简介或技能；不会改公司、职位和日期。</p>
              </div>
              <button class="btn primary tiny" type="button" :disabled="!coverage.length || loading" @click="openSendPreview">
                请求 DeepSeek
              </button>
            </div>

            <div class="ai-safety-row">
              <span>姓名 / 电话 / 邮箱 / 地址 / 证件照</span>
              <b>始终不发送</b>
            </div>

            <div v-if="error" class="ai-error">{{ error }}</div>
            <div v-if="status" class="ai-status-line">{{ status }}</div>

            <div v-if="suggestions.length" class="ai-suggestion-tools">
              <span>{{ selectedCount }} / {{ suggestions.length }} 条将采用</span>
              <button type="button" @click="toggleAll(true)">全选</button>
              <button type="button" @click="toggleAll(false)">全不选</button>
            </div>

            <div v-if="suggestions.length" class="ai-suggestions">
              <article v-for="s in suggestions" :key="s.id" class="ai-suggestion" :class="{ off: s.selected === false }">
                <label class="ai-suggestion-check">
                  <input v-model="s.selected" type="checkbox">
                  <span><i>{{ s.section }}</i>{{ s.label }}</span>
                </label>
                <div class="ai-diff">
                  <div><span>原文</span><p>{{ s.original }}</p></div>
                  <div class="suggested"><span>建议</span><p>{{ s.suggested }}</p></div>
                </div>
                <p class="ai-reason">{{ s.reason }}</p>
                <div v-if="s.risks.length" class="ai-risk">
                  <b>需要核对</b>
                  <p v-for="risk in s.risks" :key="risk">{{ risk }}</p>
                </div>
              </article>
            </div>

            <div v-else class="ai-empty result">
              <strong>建议只会来自你的真实经历</strong>
              <span>DeepSeek 不返回内容、或内容包含新增事实时，可以采用数量为零。</span>
            </div>
          </section>
        </div>
      </div>

      <div class="modal-foot ai-review-foot">
        <div class="ai-backup-state">
          <button class="btn" type="button" @click="emit('backup')" :disabled="backedUp">{{ backedUp ? '修改前快照已保存' : '先存修改前快照' }}</button>
          <span>恢复快照会生成新副本</span>
        </div>
        <div class="spacer" />
        <label class="ai-version-name">
          <span>新版本名称</span>
          <input v-model="versionName" aria-label="AI 新版本名称">
        </label>
        <button class="btn primary" type="button" :disabled="!selectedCount" @click="apply">采用所选并另存版本</button>
      </div>

      <div v-if="previewOpen" class="ai-confirm-mask">
        <div class="ai-confirm" role="dialog" aria-modal="true" aria-label="确认发送到 DeepSeek">
          <div class="ai-confirm-head">
            <div>
              <h3>确认发送内容</h3>
              <p>地址：{{ provider.endpoint() }}</p>
            </div>
            <button type="button" aria-label="返回" @click="previewOpen = false">×</button>
          </div>
          <div class="ai-confirm-body">
            <div class="ai-filter-row">
              <label><input v-model="includeOrganizations" type="checkbox"> 包含公司名和项目名</label>
              <span>关闭后只发送岗位要求、候选文本和栏目信息。</span>
            </div>
            <div class="ai-removed">
              <b>已移除</b>
              姓名、电话、邮箱、城市、详细地址、证件照、API Key 均不在请求体中。
            </div>
            <pre class="ai-payload" aria-label="实际发送载荷">{{ JSON.stringify(requestPreview, null, 2) }}</pre>
            <label class="ai-consent">
              <input v-model="confirmed" type="checkbox">
              我已核对上述实际发送内容，并同意发送到 DeepSeek。
            </label>
            <label class="ai-consent secondary">
              <input v-model="rememberConsent" type="checkbox">
              本次会话内，服务商和模型不变时不再展示发送确认
            </label>
          </div>
          <div class="ai-confirm-foot">
            <button class="btn" type="button" @click="previewOpen = false">返回修改</button>
            <button class="btn primary" type="button" :disabled="!confirmed || loading" @click="send">
              {{ loading ? '正在分析…' : '发送并获取建议' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-review-mask{padding:18px}
.ai-review{width:min(1120px,100%);height:min(900px,94vh);max-height:94vh;position:relative}
.ai-review-head{align-items:flex-start;justify-content:space-between}
.ai-review-head p{margin:5px 0 0;font-size:10.5px;color:var(--muted)}
.ai-close{border:0;background:transparent;font-size:24px;line-height:1;color:var(--muted);cursor:pointer}
.ai-local-note{display:flex;align-items:center;gap:8px;padding:8px 20px;background:#EFECE3;border-bottom:1px solid var(--line-soft);
  font-size:10.5px;color:var(--ink2)}
.ai-local-note>span{font-family:var(--mono);font-size:9px;color:#315B4A;border:1px solid #9BAFA4;padding:1px 5px;border-radius:2px}
.ai-local-note b{margin-left:auto;font-weight:500;color:#315B4A}
.ai-local-note button{margin-left:auto;border:0;background:transparent;color:var(--accent);font:10.5px var(--ui);cursor:pointer}
.ai-review-body{padding:0;min-height:0;flex:1}
.ai-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);height:100%;min-height:0}
.ai-jd-column,.ai-result-column{padding:18px 20px 24px;overflow-y:auto;min-width:0}
.ai-result-column{border-left:1px solid var(--line);background:#FBFAF6}
.ai-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.ai-section-head h3{margin:0;font-family:var(--kai);font-size:17px;font-weight:400;letter-spacing:.1em}
.ai-section-head p{margin:5px 0 0;font-size:10px;color:var(--muted);line-height:1.6}
.ai-jd-input{width:100%;height:150px;resize:vertical;border:1px solid var(--line);background:#fff;color:var(--ink);
  padding:10px 11px;font:11.5px/1.7 var(--ui)}
.ai-jd-input:focus{outline:none;border-color:var(--accent)}
.ai-coverage-head{display:flex;gap:6px;margin:14px 0 9px;flex-wrap:wrap}
.ai-coverage-head span{font-size:9.5px;padding:3px 7px;border-radius:999px;border:1px solid}
.ai-coverage-head .covered{color:#315B4A;border-color:#A9BCAF;background:#EDF3EE}
.ai-coverage-head .partial{color:#8A6427;border-color:#D2BD91;background:#F8F2E5}
.ai-coverage-head .missing{color:#8E3D31;border-color:#D2ADA4;background:#F8ECE9}
.ai-coverage-list{display:flex;flex-direction:column;gap:8px}
.ai-coverage-item{border:1px solid var(--line-soft);border-left:3px solid #B8B1A4;padding:9px 10px;background:#fff}
.ai-coverage-item.covered{border-left-color:#507A65}
.ai-coverage-item.partial{border-left-color:#B98B40}
.ai-coverage-item.missing{border-left-color:#B45B4C}
.ai-coverage-top{display:flex;align-items:flex-start;gap:8px}
.ai-coverage-top b{font-size:11.5px;line-height:1.55;color:var(--ink2);font-weight:600}
.ai-status{flex:none;font-size:9px;color:#fff;background:#8A857A;padding:2px 5px;border-radius:2px;margin-top:1px}
.covered .ai-status{background:#507A65}.partial .ai-status{background:#A87931}.missing .ai-status{background:#A94D40}
.ai-terms{margin-top:6px;font-size:9.5px;color:var(--muted)}
.ai-terms span{margin-left:4px;color:#315B4A;background:#EDF3EE;padding:1px 4px}
.ai-evidence{margin-top:7px;padding-left:8px;border-left:1px dashed var(--line)}
.ai-evidence p{margin:3px 0;font-size:10px;line-height:1.6;color:var(--muted)}
.ai-no-evidence{margin:7px 0 0;font-size:10px;color:#9A5A4F;line-height:1.6}
.ai-empty{margin-top:18px;padding:22px 14px;border:1px dashed var(--line);text-align:center;color:var(--muted)}
.ai-empty strong{display:block;font-family:var(--kai);font-size:15px;font-weight:400;color:var(--ink2);margin-bottom:6px}
.ai-empty span{font-size:10.5px;line-height:1.7}
.ai-safety-row{display:flex;justify-content:space-between;gap:10px;padding:7px 9px;background:#EDF3EE;border:1px solid #CBD8CF;
  font-size:9.5px;color:var(--ink2);margin-bottom:12px}
.ai-safety-row b{color:#315B4A}
.ai-error{margin:8px 0;padding:8px 9px;background:#F8ECE9;border-left:2px solid #A94D40;color:#803B31;font-size:10.5px;line-height:1.65}
.ai-status-line{margin:8px 0;font-size:10.5px;color:#315B4A}
.ai-suggestion-tools{display:flex;align-items:center;gap:8px;margin:8px 0;font-size:10px;color:var(--muted)}
.ai-suggestion-tools span{margin-right:auto}
.ai-suggestion-tools button{border:0;background:transparent;color:var(--accent);font:10px var(--ui);cursor:pointer}
.ai-suggestions{display:flex;flex-direction:column;gap:10px}
.ai-suggestion{border:1px solid var(--line);background:#fff;padding:11px;transition:.15s}
.ai-suggestion.off{opacity:.58}
.ai-suggestion-check{display:flex;gap:7px;align-items:center;font-size:11px;color:var(--ink);font-weight:600;cursor:pointer}
.ai-suggestion-check i{font-style:normal;color:var(--muted);font-weight:400;border:1px solid var(--line-soft);padding:1px 4px;margin-right:5px}
.ai-diff{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}
.ai-diff>div{padding:8px;background:#F3F0E9;min-width:0}
.ai-diff>div.suggested{background:#EDF3EE}
.ai-diff span{font-size:9px;color:var(--muted);letter-spacing:.08em}
.ai-diff p{margin:4px 0 0;font-size:10.5px;line-height:1.65;color:var(--ink2);word-break:break-word}
.ai-reason{margin:8px 0 0;font-size:10px;line-height:1.6;color:var(--muted)}
.ai-risk{margin-top:8px;padding:7px 8px;background:#FBF1EE;border-left:2px solid #B45B4C}
.ai-risk b{font-size:9.5px;color:#8E3D31}.ai-risk p{margin:3px 0 0;font-size:9.5px;line-height:1.55;color:#754239}
.ai-empty.result{margin-top:8px}
.ai-review-foot{align-items:center;gap:10px}
.ai-backup-state{display:flex;align-items:center;gap:8px}
.ai-backup-state span{font-size:9px;color:var(--muted)}
.ai-version-name{display:flex;align-items:center;gap:6px}
.ai-version-name span{font-size:9.5px;color:var(--muted);white-space:nowrap}
.ai-version-name input{width:126px;height:29px;border:1px solid var(--line);background:#fff;color:var(--ink);
  padding:4px 6px;font:11px var(--ui)}
.ai-confirm-mask{position:absolute;inset:0;z-index:20;background:rgba(30,26,20,.28);display:flex;align-items:center;justify-content:center;padding:20px}
.ai-confirm{width:min(760px,100%);max-height:88%;background:var(--paper);display:flex;flex-direction:column;box-shadow:0 24px 60px -28px rgba(0,0,0,.5)}
.ai-confirm-head{display:flex;justify-content:space-between;gap:12px;padding:15px 17px;border-bottom:1px solid var(--line)}
.ai-confirm-head h3{margin:0;font-family:var(--kai);font-size:17px;font-weight:400;letter-spacing:.1em}
.ai-confirm-head p{margin:5px 0 0;font:9px var(--mono);color:var(--muted);word-break:break-all}
.ai-confirm-head button{border:0;background:transparent;font-size:22px;color:var(--muted);cursor:pointer}
.ai-confirm-body{padding:14px 17px;overflow-y:auto}
.ai-filter-row{display:flex;align-items:center;gap:10px;font-size:10.5px;color:var(--ink2)}
.ai-filter-row span{color:var(--muted);font-size:9.5px}
.ai-removed{margin:10px 0;padding:8px 9px;background:#EDF3EE;border-left:2px solid #507A65;font-size:10px;line-height:1.65;color:#315B4A}
.ai-removed b{margin-right:8px}
.ai-payload{max-height:310px;overflow:auto;margin:0;padding:10px;background:#24221E;color:#ECE8DE;
  font:9px/1.55 var(--mono);white-space:pre-wrap;word-break:break-word}
.ai-consent{display:flex;align-items:flex-start;gap:7px;margin-top:12px;font-size:10.5px;color:var(--ink2);line-height:1.6}
.ai-consent.secondary{color:var(--muted);margin-top:7px;font-size:9.5px}
.ai-confirm-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 17px 15px;border-top:1px solid var(--line)}
@media (max-width:900px){
  .ai-review{height:94vh}
  .ai-workspace{grid-template-columns:1fr;overflow-y:auto}
  .ai-jd-column,.ai-result-column{overflow:visible}
  .ai-result-column{border-left:0;border-top:1px solid var(--line)}
  .ai-review-foot{flex-wrap:wrap}
  .ai-review-foot .spacer{display:none}
}
</style>
