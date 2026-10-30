import { describe, it, expect } from 'vitest'
import { cleanLine, buildDoc, toJSONResume } from '../src/render/doc.ts'
import { normalize } from '../src/core/store.ts'
import { parseText } from '../src/import/index.ts'
import { audit } from '../src/audit/index.ts'
import { blankResume, sampleResume } from '../src/core/model.ts'

describe('cleanLine 文本清洗', () => {
  it('剥掉 Word 粘来的私有区项目符号', () => {
    expect(cleanLine('\uF0B7 负责终端运维')).toBe('负责终端运维')
  })
  it('剥掉零宽字符和软连字符', () => {
    expect(cleanLine('\u200B负责\u00AD运维')).toBe('负责运维')
  })
  it('剥掉行首各种项目符号', () => {
    expect(cleanLine('• ▪ 负责机房巡检')).toBe('负责机房巡检')
    expect(cleanLine('— 负责机房巡检')).toBe('负责机房巡检')
  })
  it('保留正文里的破折号', () => {
    expect(cleanLine('2020.07 — 2023.02')).toBe('2020.07 — 2023.02')
  })
})

describe('normalize 结构归一化', () => {
  it('空对象 → 合法结构', () => {
    const r = normalize({})
    expect(r.work).toEqual([])
    expect(r.meta.order).toEqual(['work', 'projects', 'skills', 'education'])
    expect(r.meta.template).toBe('su')
  })

  it('兼容 v0.3 的 localStorage 结构', () => {
    const old = {
      basics: { name: '张伟', city: '北京' },
      work: [{ company: 'A 公司', role: '运维', start: '2020.01', end: '2021.01', highlights: ['一条'] }],
      skills: ['Linux'],
      meta: { template: 'yin', order: ['projects', 'work'] }
    }
    const r = normalize(old)
    expect(r.basics.name).toBe('张伟')
    expect(r.work[0].id).toBeTruthy()
    expect(r.meta.order[0]).toBe('projects')
    // 缺的版块补到末尾，不能丢
    expect(r.meta.order).toEqual(['projects', 'work', 'skills', 'education'])
  })

  it('兼容标准 JSON Resume 字段', () => {
    const std = {
      basics: { name: 'Li', location: { city: 'Shanghai' } },
      work: [{ name: 'B Ltd', position: 'SRE', startDate: '2019', endDate: '2020', highlights: ['x'] }],
      skills: [{ name: 'Go' }]
    }
    const r = normalize(std)
    expect(r.basics.city).toBe('Shanghai')
    expect(r.work[0].company).toBe('B Ltd')
    expect(r.work[0].role).toBe('SRE')
    expect(r.skills).toEqual(['Go'])
  })
})

describe('parseText 导入拆分', () => {
  const text = `张三
13800001111  zhangsan@example.com  北京
工作经历
2020.07 — 2023.02  星辰科技有限公司  运维工程师
• 负责 600 台终端日常运维，月均工单 90 单
• 把高频故障整理成清单，响应时间从 40 分钟降到 15 分钟
项目经历
2022.03 — 2022.11  某连锁门店网络改造
• 完成 120 家门店布线与设备调试
技能
Windows / Linux
TCP/IP · VLAN
教育背景
2016.09 — 2019.06  江南信息职业技术学院
`

  it('识别姓名、电话、邮箱', () => {
    const r = parseText(text).resume
    expect(r.basics.name).toBe('张三')
    expect(r.basics.phone).toBe('13800001111')
    expect(r.basics.email).toBe('zhangsan@example.com')
  })

  it('按日期行切分工作与项目', () => {
    const r = parseText(text).resume
    expect(r.work.length).toBe(1)
    expect(r.work[0].company).toContain('星辰')
    expect(r.projects.length).toBe(1)
  })

  it('要点归到正确的经历下', () => {
    const r = parseText(text).resume
    expect(r.work[0].highlights.length).toBe(2)
    expect(r.projects[0].highlights.length).toBe(1)
  })

  it('识别技能与教育', () => {
    const r = parseText(text).resume
    expect(r.skills.length).toBeGreaterThanOrEqual(2)
    expect(r.education.length).toBe(1)
  })
})

describe('导入识别（P4）', () => {
  const full = `张三
13800001111  zhangsan@example.com  北京
个人简介
六年运维经验，负责过 120 家门店的网络改造。
工作经历
2020.07 — 2023.02  星辰科技有限公司  运维工程师
• 负责 600 台终端日常运维，月均工单 90 单
项目经历
2022.03 — 2022.11  连锁门店网络改造
• 完成 120 家门店布线与设备调试
技能
Windows / Linux、TCP/IP、VLAN
教育背景
2016.09 — 2019.06  江南信息职业技术学院  计算机网络技术 专科
`

  it('公司名和职位正确切开，日期不被截断', () => {
    const r = parseText(full).resume
    expect(r.work[0].company).toBe('星辰科技有限公司')
    expect(r.work[0].role).toBe('运维工程师')
    expect(r.work[0].start).toBe('2020.07')
    expect(r.work[0].end).toBe('2023.02')
    expect(r.projects[0].name).toBe('连锁门店网络改造')
    expect(r.projects[0].role).toBe('')
  })

  it('月份是两位时不会只吃到一位', () => {
    const r = parseText('项目经历\n2022.11 — 2023.12 某系统上线\n• 上线成功').resume
    expect(r.projects[0].name).toBe('某系统上线')
    expect(r.projects[0].role).toBe('')
  })

  it('支持没有日期的公司行', () => {
    const r = parseText('工作经历\n某某科技有限公司 运维\n• 干过活').resume
    expect(r.work.length).toBe(1)
    expect(r.work[0].company).toContain('某某科技')
  })

  it('栏目别名能命中（实习经历 / 证书 / 个人优势）', () => {
    const r = parseText('实习经历\n2021.01 — 2021.06 某某公司 实习生\n• 打杂\n证书\nCET-6、软考中级\n个人优势\n熟悉 Linux，能独立排查故障。').resume
    expect(r.work.length).toBe(1)
    expect(r.skills).toContain('CET-6')
    expect(r.skills).toContain('软考中级')
    // 个人优势单独成段，不并进技能
    const adv = r.meta.customSections.find(s => s.title === '个人优势')
    expect(adv, '个人优势应单独成模块').toBeTruthy()
    expect(adv!.type).toBe('text')
    expect(adv!.text).toContain('熟悉 Linux')
  })

  it('技能按顿号拆成多条', () => {
    const r = parseText('技能\nWindows、Linux、TCP/IP').resume
    expect(r.skills).toEqual(['Windows', 'Linux', 'TCP/IP'])
  })

  it('简介不会被日期行或要点污染', () => {
    const r = parseText(full).resume
    expect(r.basics.summary).toContain('六年运维经验')
    expect(r.basics.summary).not.toContain('2020.07')
  })

  it('个人优势按段落保存，换行不丢', () => {
    const r = parseText('个人优势\n1、熟悉 Linux，能独立排查故障。\n2、能写实施文档。').resume
    const sec = r.meta.customSections.find(s => s.title === '个人优势')!
    expect(sec.type).toBe('text')
    expect(sec.text.split('\n').length).toBe(2)
    expect(r.meta.order[0]).toBe(sec.id)
  })

  it('完整样本置信度高，缺内容时低', () => {
    expect(parseText(full).confidence).toBeGreaterThanOrEqual(80)
    expect(parseText('随便一段话').confidence).toBeLessThan(50)
  })
})

describe('buildDoc 渲染', () => {
  it('空简历给引导文案', () => {
    expect(buildDoc(blankResume())).toContain('还没有内容')
  })

  it('清空标题后不渲染标题，但内容还在', () => {
    const r = sampleResume()
    r.meta.titles.work = ''
    const html = buildDoc(r)
    expect(html).not.toContain('工作经历')
    expect(html).toContain('星澜数据科技')
  })

  it('页面顺序跟随 meta.order', () => {
    const r = sampleResume()
    r.meta.order = ['skills', 'work', 'projects', 'education']
    const html = buildDoc(r)
    expect(html.indexOf('技能')).toBeLessThan(html.indexOf('工作经历'))
  })

  it('隐藏简介后不输出简介', () => {
    const r = sampleResume()
    r.meta.showSummary = false
    expect(buildDoc(r)).not.toContain('6 年 IT 运维与项目实施经验')
  })
})

describe('自定义模块', () => {
  const withCustom = () => {
    const r = sampleResume()
    r.meta.customSections = [
      { id: 'sec1', title: '证书', type: 'list', entries: [], list: ['CET-6', '软考中级'], text: '' },
      { id: 'sec2', title: '实习经历', type: 'entry', entries: [
        { id: 'en1', title: 'XX 公司实习', subtitle: '运维实习生', time: '2023.07 — 2023.09', bullets: ['负责机房巡检', '整理故障台账'] }
      ], list: [], text: '' },
      { id: 'sec3', title: '自我评价', type: 'text', entries: [], list: [], text: '动手能力强，习惯把问题做成清单。' }
    ]
    r.meta.order = ['work', 'sec1', 'sec2', 'sec3']
    return r
  }

  it('三种类型都能渲染', () => {
    const html = buildDoc(withCustom())
    expect(html).toContain('证书')
    expect(html).toContain('CET-6')
    expect(html).toContain('XX 公司实习')
    expect(html).toContain('负责机房巡检')
    expect(html).toContain('动手能力强')
  })

  it('空的自定义模块渲染占位提示', () => {
    const r = withCustom()
    r.meta.customSections[0].list = []
    const html = buildDoc(r)
    expect(html).toContain('证书')
    expect(html).toContain('placeholder')
    expect(html).toContain('点击填写')
  })

  it('顺序跟随 meta.order', () => {
    const html = buildDoc(withCustom())
    expect(html.indexOf('证书')).toBeLessThan(html.indexOf('实习经历'))
    expect(html.indexOf('实习经历')).toBeLessThan(html.indexOf('自我评价'))
  })

  it('所有模块都必须带 data-key，否则预览里点不中', () => {
    const r = withCustom()
    const html = buildDoc(r)
    const sections = html.match(/<section[^>]*>/g) || []
    expect(sections.length).toBeGreaterThan(3)
    for (const s of sections) expect(s).toContain('data-key=')
  })

  it('normalize 保留自定义模块并补进 order', () => {
    const r = normalize(withCustom())
    expect(r.meta.customSections.length).toBe(3)
    expect(r.meta.order).toContain('sec1')
  })
})

describe('toJSONResume 导出兼容', () => {
  it('映射成标准字段', () => {
    const out = toJSONResume(sampleResume())
    expect(out.basics.location.city).toBe('上海 · 可出差')
    expect(out.work[0].name).toContain('星澜')
    expect(out.work[0].position).toBe('运维工程师')
    expect(out.skills[0].name).toContain('Windows')
    expect(Array.isArray(out.work[0].highlights)).toBe(true)
  })
})

describe('audit 体检打分', () => {
  it('空洞简历分数低，并给出问题', () => {
    const r = blankResume()
    r.basics.name = '张三'
    r.work = [{ id: 'w', company: 'A', role: 'B', start: '', end: '', highlights: ['认真负责，团队协作能力强'] }]
    const res = audit(r)
    expect(res.score).toBeLessThan(88)
    expect(res.issues.length).toBeGreaterThan(0)
  })

  it('具体、带数字的简历分数高', () => {
    const res = audit(sampleResume())
    expect(res.score).toBeGreaterThanOrEqual(80)
  })

  it('抓出没有数字的要点', () => {
    const r = sampleResume()
    r.work[0].highlights = ['负责日常运维工作', '处理各种故障']
    const res = audit(r)
    expect(res.issues.some(i => i.title.includes('没有任何数字'))).toBe(true)
  })

  it('抓出百分比没有基数', () => {
    const r = sampleResume()
    r.work[0].highlights = ['设备故障率下降 20%']
    const res = audit(r)
    expect(res.issues.some(i => i.title.includes('百分比没有基数'))).toBe(true)
  })
})
