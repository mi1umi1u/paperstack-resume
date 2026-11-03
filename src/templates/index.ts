import type { TemplateId } from '../core/model'

export interface TemplateDef {
  id: TemplateId
  name: string
  desc: string
  ready: boolean
  type: 'single' | 'double'
  photo: boolean | 'optional'
  lang: 'zh' | 'en'
}

/** 模板注册表：加模板只需在这里登记，并在 app.css 里写 .doc-<id> 的样式 */
export const TEMPLATES: TemplateDef[] = [
  { id: 'su', name: '素', desc: '经典单栏，最稳', ready: true, type: 'single', photo: false, lang: 'zh' },
  { id: 'yin', name: '引', desc: '左侧栏标题，结构感强', ready: true, type: 'single', photo: false, lang: 'zh' },
  { id: 'mi', name: '密', desc: '紧凑版，适合内容多', ready: true, type: 'single', photo: false, lang: 'zh' },
  { id: 'xian', name: '线', desc: '顶部色条 + 细分隔线', ready: true, type: 'single', photo: false, lang: 'zh' },
  { id: 'kuai', name: '块', desc: '标题用色块，醒目', ready: true, type: 'single', photo: false, lang: 'zh' },
  { id: 'zhou', name: '轴', desc: '时间轴串经历', ready: true, type: 'single', photo: false, lang: 'zh' },
  { id: 'zhao', name: '照', desc: '经典中文简历 + 证件照', ready: true, type: 'single', photo: true, lang: 'zh' },
  { id: 'lan', name: '栏', desc: '彩色侧栏 + 主栏经历', ready: true, type: 'double', photo: true, lang: 'zh' },
  { id: 'lanq', name: '栏·浅', desc: '浅灰侧栏，适合黑白打印', ready: true, type: 'double', photo: 'optional', lang: 'zh' },
  { id: 'en', name: 'Classic EN', desc: '英文标题与日期格式', ready: true, type: 'single', photo: false, lang: 'en' }
]
