<script setup lang="ts">
import { computed, ref } from 'vue'
import { parseText, readFile, type ParseResult, ocrAvailable } from '../import'
import type { Resume } from '../core/model'

const emit = defineEmits<{ (e: 'close'): void; (e: 'apply', r: Resume): void }>()

const tab = ref<'text' | 'file'>('text')
const text = ref('')
const busy = ref(false)
const error = ref('')
const result = ref<ParseResult | null>(null)

const conf = computed(() => result.value?.confidence ?? 0)
const confLabel = computed(() =>
  conf.value >= 85 ? '结构较完整，仍需核对字段与经历归属'
    : conf.value >= 55 ? '存在不确定内容，请重点核对'
      : '识别质量不高，请逐条核对'
)

const work = computed(() => result.value?.resume.work ?? [])
const projects = computed(() => result.value?.resume.projects ?? [])
const education = computed(() => result.value?.resume.education ?? [])
const skills = computed(() => result.value?.resume.skills.filter(Boolean) ?? [])
const customSections = computed(() =>
  (result.value?.resume.meta.customSections || []).filter(s => s.type === 'text' && s.text.trim())
)

const dateParts = (value: string): [string, string] => {
  const match = String(value || '').match(/^((?:19|20)\d{2})(?:[./年-]\s*(\d{1,2}))?$/)
  return match ? [match[1], match[2] ? match[2].padStart(2, '0') : ''] : ['', '']
}

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: currentYear + 6 - 1960 + 1 }, (_, i) => String(currentYear + 6 - i))

function setDatePart(target: any, field: string, part: 'year' | 'month', event: Event) {
  const [currentYearValue, currentMonth] = dateParts(target[field] || '')
  let year = currentYearValue
  let month = currentMonth
  if (part === 'year') year = (event.target as HTMLSelectElement).value
  else month = (event.target as HTMLSelectElement).value
  if (month && !year) year = String(currentYear)
  target[field] = year && month ? `${year}-${month}` : year || ''
}

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  busy.value = true
  error.value = ''
  try {
    text.value = await readFile(f)
    doParse()
  } catch (err: any) {
    error.value = err?.message || '这个文件读不出来，建议改用粘贴文本'
  } finally {
    busy.value = false
  }
}

function doParse() {
  error.value = ''
  if (!text.value.trim()) { error.value = '先粘贴简历文字，或选择一个文件'; return }
  try {
    result.value = parseText(text.value)
  } catch (e: any) {
    error.value = '解析失败：' + (e?.message || e)
  }
}

function confirmApply() {
  if (result.value) emit('apply', result.value.resume)
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal import-modal">
      <div class="modal-head">
        <span class="modal-title">导入简历</span>
        <span class="modal-sub">左边原文，右边识别结果；核对无误再导入（会新建版本，不覆盖当前）</span>
      </div>

      <div class="import-body">
        <!-- 左：原文 -->
        <div class="pane left">
          <div class="pane-head">
            <button class="chip" :aria-pressed="tab === 'text'" @click="tab = 'text'">粘贴文本</button>
            <button class="chip" :aria-pressed="tab === 'file'" @click="tab = 'file'">选择文件</button>
            <span class="spacer" />
            <button class="btn tiny" @click="doParse">重新识别</button>
          </div>
          <div v-if="tab === 'file'" class="file-row">
            <input type="file" accept=".docx,.pdf,.txt,.md" @change="onFile" />
            <span class="hint">{{ ocrAvailable() ? '支持扫描件识别' : 'Word / PDF / 文本；扫描件请用粘贴' }}</span>
          </div>
          <textarea v-model="text" class="raw" placeholder="把简历全文粘贴到这里，然后点「重新识别」" />
          <div v-if="busy" class="hint">正在读取文件…</div>
          <div v-if="error" class="hint err">{{ error }}</div>
        </div>

        <!-- 右：识别结果 -->
        <div class="pane right">
          <div v-if="!result" class="empty">识别结果会显示在这里</div>

          <template v-else>
            <div class="conf">
              <span class="conf-score" :class="{ low: conf < 55 }">{{ conf }}</span>
              <span class="conf-text">
                {{ confLabel }}<br />
                <span class="hint">{{ result.lines }} 行 · 识别出 {{ result.sections.length }} 个栏目</span>
              </span>
            </div>

            <div class="block">
              <div class="block-title">基本信息</div>
              <label class="row edit"><span>姓名</span><input v-model="result.resume.basics.name" /></label>
              <label class="row edit"><span>电话</span><input v-model="result.resume.basics.phone" /></label>
              <label class="row edit"><span>邮箱</span><input v-model="result.resume.basics.email" /></label>
              <div v-if="result.resume.basics.summary" class="row">
                <span>简介</span><b class="clip">{{ result.resume.basics.summary }}</b>
              </div>
            </div>

            <div v-if="work.length" class="block">
              <div class="block-title">工作经历 <i>{{ work.length }}</i></div>
              <div v-for="(w, i) in work" :key="i" class="entry">
                <input v-model="w.company" class="entry-input" placeholder="公司名" />
                <div class="entry-line">
                  <input v-model="w.role" class="entry-input small" placeholder="职位" />
                  <div class="date-selects">
                    <select :value="dateParts(w.start)[0]" aria-label="工作开始年份" @change="setDatePart(w, 'start', 'year', $event)">
                      <option value="">年</option><option v-for="year in yearOptions" :key="year" :value="year">{{ year }}年</option>
                    </select>
                    <select :value="dateParts(w.start)[1]" aria-label="工作开始月份" @change="setDatePart(w, 'start', 'month', $event)">
                      <option value="">月</option><option v-for="month in 12" :key="month" :value="String(month).padStart(2, '0')">{{ month }}月</option>
                    </select>
                  </div>
                  <div class="date-selects">
                    <select :value="dateParts(w.end)[0]" aria-label="工作结束年份" @change="setDatePart(w, 'end', 'year', $event)">
                      <option value="">年</option><option v-for="year in yearOptions" :key="year" :value="year">{{ year }}年</option>
                    </select>
                    <select :value="dateParts(w.end)[1]" aria-label="工作结束月份" @change="setDatePart(w, 'end', 'month', $event)">
                      <option value="">月</option><option v-for="month in 12" :key="month" :value="String(month).padStart(2, '0')">{{ month }}月</option>
                    </select>
                  </div>
                </div>
                <div class="entry-bullets">{{ w.highlights.filter(Boolean).length }} 条要点</div>
              </div>
            </div>

            <div v-if="projects.length" class="block">
              <div class="block-title">项目经历 <i>{{ projects.length }}</i></div>
              <div v-for="(p, i) in projects" :key="i" class="entry">
                <input v-model="p.name" class="entry-input" placeholder="项目名" />
                <div class="entry-line">
                  <input v-model="p.role" class="entry-input small" placeholder="角色" />
                  <div class="date-selects">
                    <select :value="dateParts(p.start || '')[0]" aria-label="项目开始年份" @change="setDatePart(p, 'start', 'year', $event)">
                      <option value="">年</option><option v-for="year in yearOptions" :key="year" :value="year">{{ year }}年</option>
                    </select>
                    <select :value="dateParts(p.start || '')[1]" aria-label="项目开始月份" @change="setDatePart(p, 'start', 'month', $event)">
                      <option value="">月</option><option v-for="month in 12" :key="month" :value="String(month).padStart(2, '0')">{{ month }}月</option>
                    </select>
                  </div>
                  <div class="date-selects">
                    <select :value="dateParts(p.end || '')[0]" aria-label="项目结束年份" @change="setDatePart(p, 'end', 'year', $event)">
                      <option value="">年</option><option v-for="year in yearOptions" :key="year" :value="year">{{ year }}年</option>
                    </select>
                    <select :value="dateParts(p.end || '')[1]" aria-label="项目结束月份" @change="setDatePart(p, 'end', 'month', $event)">
                      <option value="">月</option><option v-for="month in 12" :key="month" :value="String(month).padStart(2, '0')">{{ month }}月</option>
                    </select>
                  </div>
                </div>
                <div class="entry-bullets">{{ p.highlights.filter(Boolean).length }} 条要点</div>
              </div>
            </div>

            <div v-if="education.length" class="block">
              <div class="block-title">教育背景 <i>{{ education.length }}</i></div>
              <div v-for="(e, i) in education" :key="i" class="entry">
                <input v-model="e.institution" class="entry-input" placeholder="学校" />
                <div class="entry-line">
                  <input v-model="e.area" class="entry-input small" placeholder="专业" />
                  <input v-model="e.studyType" class="entry-input tiny" placeholder="学历" />
                  <div class="date-selects">
                    <select :value="dateParts(e.start)[0]" aria-label="教育开始年份" @change="setDatePart(e, 'start', 'year', $event)">
                      <option value="">年</option><option v-for="year in yearOptions" :key="year" :value="year">{{ year }}年</option>
                    </select>
                    <select :value="dateParts(e.start)[1]" aria-label="教育开始月份" @change="setDatePart(e, 'start', 'month', $event)">
                      <option value="">月</option><option v-for="month in 12" :key="month" :value="String(month).padStart(2, '0')">{{ month }}月</option>
                    </select>
                  </div>
                  <div class="date-selects">
                    <select :value="dateParts(e.end)[0]" aria-label="教育结束年份" @change="setDatePart(e, 'end', 'year', $event)">
                      <option value="">年</option><option v-for="year in yearOptions" :key="year" :value="year">{{ year }}年</option>
                    </select>
                    <select :value="dateParts(e.end)[1]" aria-label="教育结束月份" @change="setDatePart(e, 'end', 'month', $event)">
                      <option value="">月</option><option v-for="month in 12" :key="month" :value="String(month).padStart(2, '0')">{{ month }}月</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="skills.length" class="block">
              <div class="block-title">技能 / 证书 <i>{{ skills.length }}</i></div>
              <div class="tags">
                <span v-for="(s, i) in skills.slice(0, 24)" :key="i" class="tag">{{ s }}</span>
                <span v-if="skills.length > 24" class="tag">…还有 {{ skills.length - 24 }} 条</span>
              </div>
            </div>

            <div v-for="sec in customSections" :key="sec.id" class="block">
              <div class="block-title">{{ sec.title }}</div>
              <div class="para">{{ sec.text }}</div>
            </div>

            <div v-if="result.unmatched.length" class="block warn">
              <div class="block-title">没归类的行 <i>{{ result.unmatched.length }}</i></div>
              <div v-for="(u, i) in result.unmatched.slice(0, 12)" :key="i" class="unmatched">{{ u }}</div>
              <div v-if="result.unmatched.length > 12" class="hint">…还有 {{ result.unmatched.length - 12 }} 行</div>
            </div>
          </template>
        </div>
      </div>

      <div class="modal-foot">
        <button class="btn" @click="emit('close')">取消</button>
        <button class="btn primary" :disabled="!result" @click="confirmApply">导入为新版本</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.import-modal{width:min(1020px,100%);height:min(86vh,760px)}
.import-body{flex:1;display:grid;grid-template-columns:1fr 1fr;min-height:0}
.pane{display:flex;flex-direction:column;min-height:0;padding:14px 16px;overflow:hidden}
.pane.left{border-right:1px solid var(--line)}
.pane-head{display:flex;align-items:center;gap:6px;margin-bottom:10px}
.spacer{flex:1}
.btn.tiny{font-size:11.5px;padding:4px 10px}
.file-row{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;font-size:11.5px}
.raw{flex:1;width:100%;font-family:var(--mono);font-size:12px;line-height:1.75;border:1px solid var(--line);
  padding:10px;background:#fff;resize:none;min-height:0}
.raw:focus{outline:none;border-color:var(--accent)}
.hint{font-size:10.5px;color:var(--muted);line-height:1.7}
.hint.err{color:#A63A2B}
.pane.right{overflow-y:auto}
.empty{color:var(--muted);font-size:12px;text-align:center;padding-top:80px}
.conf{display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--line-soft);margin-bottom:12px}
.conf-score{font-family:var(--mono);font-size:26px;color:var(--accent);line-height:1}
.conf-score.low{color:#C58B22}
.conf-text{font-size:12px;color:var(--ink2);line-height:1.6}
.block{margin-bottom:16px}
.block-title{font-size:12px;font-weight:600;color:var(--ink);letter-spacing:.08em;margin-bottom:7px}
.block-title i{font-style:normal;color:var(--muted);font-size:10.5px;margin-left:4px}
.row{display:flex;gap:10px;font-size:12px;line-height:1.9;color:var(--ink2)}
.row span{color:var(--muted);min-width:3em}
.row b{font-weight:500;color:var(--ink);word-break:break-all}
.clip{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.entry{padding:7px 0;border-bottom:1px dashed var(--line-soft)}
.entry:last-child{border-bottom:0}
.row.edit{align-items:center}
.row.edit input{flex:1;font-family:var(--ui);font-size:12px;color:var(--ink);border:0;
  border-bottom:1px dashed var(--line);padding:2px 4px;background:transparent}
.row.edit input:focus{outline:none;border-bottom-color:var(--accent);background:#FFFDF9}
.entry-input{width:100%;font-family:var(--ui);font-size:12.5px;color:var(--ink);font-weight:500;
  border:0;border-bottom:1px dashed var(--line);padding:2px 0;background:transparent;margin-bottom:3px}
.entry-input.small{font-size:11.5px;font-weight:400;color:var(--ink2)}
.entry-input.tiny{font-size:11px;width:5.2em;color:var(--muted)}
.entry-input:focus{outline:none;border-bottom-color:var(--accent);background:#FFFDF9}
.entry-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.entry-line .small{flex:1}
.date-selects{display:grid;grid-template-columns:5.2em 3.7em;gap:3px;flex:none}
.date-selects select{min-width:0;border:1px solid var(--line);border-radius:3px;background:#FFFDF9;
  color:var(--ink2);font:11px var(--ui);padding:3px 2px}
.date-selects select:focus{outline:none;border-color:var(--accent);background:#fff}
.entry-title{font-size:12.5px;color:var(--ink);font-weight:500}
.entry-meta{font-size:11px;color:var(--muted);margin-top:2px}
.entry-bullets{font-size:10.5px;color:var(--muted);margin-top:3px}
.tags{display:flex;flex-wrap:wrap;gap:5px}
.tag{font-size:11px;color:var(--ink2);border:1px solid var(--line);padding:2px 7px;border-radius:2px}
.warn .block-title{color:#C58B22}
.para{font-size:11.5px;color:var(--ink2);line-height:1.8;white-space:pre-line}
.unmatched{font-size:11px;color:var(--muted);line-height:1.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:900px){
  .import-body{grid-template-columns:1fr;grid-template-rows:1fr 1fr}
  .pane.left{border-right:0;border-bottom:1px solid var(--line)}
}
</style>
