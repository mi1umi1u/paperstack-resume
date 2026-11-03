/**
 * 数据模型：JSON Resume 子集 + meta
 * 导出时映射为标准 JSON Resume 字段，保证可迁移
 */

export interface CustomField { label: string; value: string }

export interface Basics {
  name: string
  label: string
  phone: string
  email: string
  city: string
  summary: string
  image?: string
  custom: CustomField[]
}

export interface WorkItem {
  id: string
  company: string
  role: string
  start: string
  end: string
  highlights: string[]
  pb?: boolean      // 此处分页
  keep?: boolean    // 整段不拆
}

export interface ProjectItem {
  id: string
  name: string
  role: string
  highlights: string[]
  pb?: boolean
  keep?: boolean
}

export interface EduItem {
  id: string
  institution: string
  area: string
  studyType: string
  start: string
  end: string
}

export type CustomType = 'entry' | 'list' | 'text'

export interface CustomEntry {
  id: string
  title: string        // 主标题，如"XX 实习"
  subtitle: string     // 副标题，如岗位/颁发机构
  time: string
  bullets: string[]
}

export interface CustomSection {
  id: string
  title: string
  type: CustomType
  entries: CustomEntry[]
  list: string[]
  text: string
}

export type TemplateId = 'su' | 'yin' | 'mi' | 'xian' | 'zhou' | 'zhao' | 'kuai' | 'lan' | 'lanq' | 'en'
export type FontId = 'song' | 'yahei' | 'hei'
export type DensityId = 'compact' | 'normal' | 'loose'
export type PageTarget = 'auto' | '1' | '2' | '3'
export type ResumeLang = 'zh' | 'en'

export interface Meta {
  template: TemplateId
  accent: string
  font: FontId
  density: DensityId
  autoFit: boolean
  targetPages: PageTarget
  lang: ResumeLang
  order: string[]                  // work | projects | skills | education | 自定义模块 id
  titles: Record<string, string>
  customSections: CustomSection[]
  hidden: string[]                  // 被隐藏的模块 key
  showSummary: boolean
}

export interface Resume {
  basics: Basics
  work: WorkItem[]
  projects: ProjectItem[]
  skills: string[]
  education: EduItem[]
  meta: Meta
}

let seq = 0
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`

export const DEFAULT_TITLES: Record<string, string> = {
  work: '工作经历',
  projects: '项目经历',
  skills: '技能',
  education: '教育背景'
}

export const DEFAULT_TITLES_EN: Record<string, string> = {
  work: 'Work Experience',
  projects: 'Projects',
  skills: 'Skills',
  education: 'Education'
}

export const ACCENTS = [
  { value: '#1B3557', name: '蓝' },
  { value: '#161614', name: '墨' },
  { value: '#26453A', name: '松' },
  { value: '#8E2F21', name: '朱' }
]

export function blankResume(): Resume {
  return {
    basics: { name: '', label: '', phone: '', email: '', city: '', summary: '', custom: [] },
    work: [],
    projects: [],
    skills: [],
    education: [],
    meta: {
      template: 'su',
      accent: '#1B3557',
      font: 'song',
      density: 'normal',
      autoFit: true,
      targetPages: 'auto',
      lang: 'zh',
      order: ['work', 'projects', 'skills', 'education'],
      titles: { ...DEFAULT_TITLES },
      customSections: [],
      hidden: [],
      showSummary: true
    }
  }
}

export function sampleResume(): Resume {
  const r = blankResume()
  r.basics = {
    name: '陈 一鸣',
    label: '运维工程师 / 项目实施',
    phone: '138 0013 8000',
    email: 'chen.yiming@example.com',
    city: '上海 · 可出差',
    summary:
      '6 年 IT 运维与项目实施经验，负责过 120 家门店的网络改造、600 台终端的批量切换和 20 余个客户的系统上线。习惯把重复问题做成清单和脚本，能独立处理现场问题。',
    custom: []
  }
  r.work = [
    {
      id: uid('w'),
      company: '星澜数据科技（上海）有限公司',
      role: '运维工程师',
      start: '2023.03',
      end: '至今',
      highlights: [
        '负责 600 余台办公终端的日常运维，服务 800 人，月均处理工单 90 余单。',
        '把 12 类高频故障整理成排查清单，新同事照做即可处理，平均响应时间从 40 分钟降到 15 分钟。',
        '负责 Windows 与统信 UOS 双系统装机、软件分发和账号权限开通，处理 IP、DNS、VLAN 等接入问题。'
      ]
    },
    {
      id: uid('w'),
      company: '云枢信息技术有限公司',
      role: '实施工程师',
      start: '2020.07',
      end: '2023.02',
      highlights: [
        '负责零售客户门店网络改造的现场实施，累计完成 120 家门店的布线与设备调试。',
        '第一批 30 家门店因交换机固件版本不一致返工，之后统一固件基线并写进实施手册。'
      ]
    }
  ]
  r.projects = [
    {
      id: uid('p'),
      name: '120 家连锁门店网络改造项目',
      role: '现场实施 · 2022.03—2022.11',
      highlights: [
        '负责门店侧现场勘测、布线、AP 与交换机安装调试，单店交付周期从 3 天压到 1.5 天。',
        '整理出《门店实施检查表》共 26 项，交付验收一次通过率从 78% 提升到 96%。'
      ]
    }
  ]
  r.skills = ['Windows / 统信 UOS 部署', 'Linux 常用运维', 'TCP/IP · VLAN · IP 规划', 'MySQL 安装与备份', '综合布线 · 设备上架']
  r.education = [
    { id: uid('e'), institution: '江南信息职业技术学院', area: '计算机网络技术', studyType: '专科', start: '2016.09', end: '2019.06' }
  ]
  return r
}
