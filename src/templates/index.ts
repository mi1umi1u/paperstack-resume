import type { TemplateId } from '../core/model'

export interface TemplateDef {
  id: TemplateId
  name: string
  desc: string
  ready: boolean
}

/** 模板注册表：加模板只需在这里登记，并在 app.css 里写 .doc-<id> 的样式 */
export const TEMPLATES: TemplateDef[] = [
  { id: 'su', name: '素', desc: '经典单栏，最稳', ready: true },
  { id: 'yin', name: '引', desc: '左侧栏标题，结构感强', ready: true },
  { id: 'mi', name: '密', desc: '紧凑版，适合内容多', ready: true },
  { id: 'xian', name: '线', desc: '顶部色条 + 细分隔线', ready: true },
  { id: 'kuai', name: '块', desc: '标题用色块，醒目', ready: true },
  { id: 'zhou', name: '轴', desc: '时间轴串经历', ready: false },
  { id: 'zhao', name: '照', desc: '带证件照', ready: false },
  { id: 'lan', name: '栏', desc: '双栏 + 彩色侧栏', ready: false },
  { id: 'lanq', name: '栏·浅', desc: '浅灰侧栏，适合黑白打印', ready: false },
  { id: 'en', name: 'Classic EN', desc: '英文简历', ready: false }
]
