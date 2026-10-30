import type { Resume } from '../core/model'

export type Level = 'err' | 'warn' | 'info'

export interface Issue {
  level: Level
  title: string
  detail: string
  target?: string   // 定位用：work / projects / basics
}

export interface AuditResult {
  score: number
  issues: Issue[]
  good: string
  bullets: number
  withNumber: number
}

const ADJ = /(精通|熟练|熟悉|擅长|较强的|良好的|丰富的|优秀的)/g
const BANNED = ['某大型', '多个项目', '丰富的经验', '良好的沟通', '团队协作能力强', '抗压能力强', '认真负责', '吃苦耐劳']

function allBullets(r: Resume): string[] {
  const out: string[] = []
  r.work.forEach(w => w.highlights.forEach(t => { if (t.trim()) out.push(t.trim()) }))
  r.projects.forEach(p => p.highlights.forEach(t => { if (t.trim()) out.push(t.trim()) }))
  return out
}

/** 简历体检：查的是"像不像真话"，不是"漂不漂亮" */
export function audit(r: Resume): AuditResult {
  const issues: Issue[] = []
  const bl = allBullets(r)
  const all = bl.join('\n')

  if (!r.basics.name) issues.push({ level: 'err', title: '没填姓名', detail: '这是简历，不是文档。', target: 'basics' })
  if (!bl.length) issues.push({ level: 'err', title: '还没有任何经历要点', detail: '没有内容，体检没有意义。先写三条再说。', target: 'work' })

  // 无数字
  const noNum = bl.filter(t => !/\d/.test(t))
  if (bl.length && noNum.length) {
    issues.push({
      level: noNum.length / bl.length > 0.5 ? 'warn' : 'info',
      title: `${noNum.length} 条要点里没有任何数字`,
      detail: `例如「${noNum[0].slice(0, 26)}…」。数量、比例、时长、台数，有一个就行。`,
      target: 'work'
    })
  }

  // 百分比无基数
  const pctNoBase = bl.filter(t => /[%％]/.test(t) && !/(从|由|较|降到|降至|提升到|提升至|减少|缩短)/.test(t))
  if (pctNoBase.length) {
    issues.push({
      level: 'warn',
      title: `${pctNoBase.length} 处百分比没有基数`,
      detail: '「下降了 20%」——从多少降到多少？没有基数，面试官第一反应是编的。',
      target: 'work'
    })
  }

  // 形容词
  const adjHits = (all.match(ADJ) || []).length
  if (adjHits > 5) {
    issues.push({
      level: 'warn',
      title: `形容词用了 ${adjHits} 处`,
      detail: '精通、熟练、熟悉、擅长——这类词越多，可信度越低。留 3 处以内，其余换成动作和结果。',
      target: 'work'
    })
  }

  // 句式雷同
  if (bl.length >= 4) {
    const heads: Record<string, number> = {}
    bl.forEach(t => { const h = t.slice(0, 2); heads[h] = (heads[h] || 0) + 1 })
    const top = Object.entries(heads).sort((a, b) => b[1] - a[1])[0]
    if (top && top[1] / bl.length > 0.55) {
      issues.push({
        level: 'warn',
        title: `${Math.round((top[1] / bl.length) * 100)}% 的要点都以「${top[0]}」开头`,
        detail: '人写东西不会这么整齐。把句式打散：有的写动作，有的写结果，有的写难点。',
        target: 'work'
      })
    }
  }

  // 长度太整齐
  if (bl.length >= 4) {
    const lens = bl.map(t => t.length)
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length
    const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length)
    if (mean > 0 && sd / mean < 0.2) {
      issues.push({
        level: 'info',
        title: '每条要点长度几乎一样',
        detail: '这是 AI 生成的典型特征。真实的项目，有的三句话说清，有的要写五行。',
        target: 'work'
      })
    }
  }

  // 套话
  const hits = BANNED.filter(w => all.includes(w) || (r.basics.summary || '').includes(w))
  if (hits.length) {
    issues.push({
      level: 'info',
      title: `出现套话：${hits.slice(0, 3).join('、')}`,
      detail: '这些词对着镜子说说还行，写在简历上就是噪声。删掉，换成具体的事。',
      target: 'basics'
    })
  }

  // 篇幅
  const chars = (r.basics.summary || '').length + bl.join('').length
  if (chars && chars < 380) {
    issues.push({ level: 'warn', title: '内容偏少', detail: `目前约 ${chars} 字。6 年经验写到 600–900 字比较合适。`, target: 'work' })
  } else if (chars > 1500) {
    issues.push({ level: 'info', title: '内容偏多', detail: `目前约 ${chars} 字，超过一页半。挑最能证明能力的留。`, target: 'work' })
  }

  const withNumber = bl.filter(t => /\d/.test(t)).length
  const ratio = bl.length ? withNumber / bl.length : 0
  let good = ''
  if (ratio >= 0.6) good = `有 ${withNumber} 条要点带数字，占比 ${Math.round(ratio * 100)}%，这个比例是健康的。`
  else if (withNumber) good = `已经写了 ${withNumber} 条带数字的要点，再多两条会更好。`

  const err = issues.filter(i => i.level === 'err').length
  const warn = issues.filter(i => i.level === 'warn').length
  const info = issues.filter(i => i.level === 'info').length
  let score = 100 - err * 18 - warn * 8 - info * 3
  if (!bl.length) score = 0
  score = Math.max(0, Math.min(100, score))

  return { score, issues, good, bullets: bl.length, withNumber }
}
