import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Page } from '@playwright/test'

export const APP_URL = pathToFileURL(resolve('dist/index.html')).toString() + '?test=1&fresh=1'

/** 生成一份用于分页测试的简历 */
export function makeResume(opts: { jobs?: number; bullets?: number; extraBullets?: number } = {}) {
  const jobs = opts.jobs ?? 2
  const bullets = opts.bullets ?? 3
  const extra = opts.extraBullets ?? 0

  const work = Array.from({ length: jobs }, (_, i) => ({
    id: 'w' + i,
    company: `第${i + 1}家测试有限公司`,
    role: '运维工程师',
    start: `20${20 - i}.0${1 + (i % 9)}`,
    end: `20${21 - i}.0${2 + (i % 8)}`,
    highlights: Array.from({ length: bullets }, (_, j) =>
      `负责第 ${j + 1} 项工作：全区 600 余台终端与打印机的日常维护，处理系统安装、权限开通与外设故障，累计处理工单 90 余单。`
    )
  }))

  for (let k = 0; k < extra; k++) {
    work[0].highlights.push(`补充要点 ${k + 1}：负责门店侧现场勘测、布线与设备调试，单店交付周期从 3 天压到 1.5 天，验收一次通过率提升到 96%。`)
  }

  return {
    basics: {
      name: '陈 一鸣', label: '运维工程师 / 项目实施',
      phone: '138 0013 8000', email: 'chen@example.com', city: '上海 · 可出差',
      summary: '6 年 IT 运维与项目实施经验，负责过 120 家门店的网络改造、600 台终端的批量切换和 20 余个客户的系统上线。',
      custom: []
    },
    work,
    projects: [{
      id: 'p0', name: '120 家连锁门店网络改造项目', role: '现场实施 · 2022.03—2022.11',
      highlights: ['负责门店侧现场勘测、布线、AP 与交换机安装调试。', '整理《门店实施检查表》共 26 项，验收一次通过率从 78% 提升到 96%。']
    }],
    skills: ['Windows / UOS 部署', 'Linux 常用运维', 'TCP/IP · VLAN'],
    education: [{ id: 'e0', institution: '江南信息职业技术学院', area: '计算机网络技术', studyType: '专科', start: '2016.09', end: '2019.06' }],
    meta: {
      template: 'su', accent: '#1B3557', font: 'song', density: 'normal', autoFit: true,
      order: ['work', 'projects', 'skills', 'education'],
      titles: { work: '工作经历', projects: '项目经历', skills: '技能', education: '教育背景' },
      showSummary: true
    }
  }
}

export async function openApp(page: Page) {
  await page.goto(APP_URL)
  await page.waitForFunction(() => (window as any).__ps !== undefined, null, { timeout: 15000 })
  await page.waitForSelector('#app .sheet', { timeout: 15000 })
}

export async function setContent(page: Page, data: any, opts?: { autoFit?: boolean }) {
  await page.evaluate(async ([d, o]) => {
    await (window as any).__ps.set(d, o)
  }, [data, opts ?? {}] as const)
  await page.waitForTimeout(80)
}

export async function stats(page: Page) {
  return page.evaluate(() => (window as any).__ps.stats())
}

/** 每页的度量数据 */
export async function pages(page: Page) {
  return page.evaluate(() => {
    const sheets = Array.from(document.querySelectorAll('#app .sheet')) as HTMLElement[]
    return sheets.map(s => {
      const cs = getComputedStyle(s)
      const doc = s.querySelector('.doc') as HTMLElement
      const dcs = getComputedStyle(doc)
      const area = s.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      const used = doc.offsetHeight
      const last = doc.lastElementChild as HTMLElement | null
      const firstItem = doc.querySelector('.item') as HTMLElement | null
      const firstLi = doc.querySelector('li') as HTMLElement | null
      const lineH = parseFloat(dcs.lineHeight)
      return {
        gapPct: (area - used) / area,
        font: parseFloat(dcs.fontSize),
        lh: lineH / parseFloat(dcs.fontSize),
        overflow: s.scrollHeight > s.clientHeight + 1,
        lastTag: last ? last.tagName : '',
        lastHasItem: last ? !!last.querySelector('.item') : false,
        lastItemHasBullet: last ? !!last.querySelector('li') : false,
        firstItemHasHead: firstItem ? !!firstItem.querySelector('.item-head') : true,
        firstLiLines: firstLi ? Math.round(firstLi.offsetHeight / lineH) : 0,
        exLi: parseFloat(cs.getPropertyValue('--ex-li')) || 0,
        exItem: parseFloat(cs.getPropertyValue('--ex-item')) || 0,
        exSec: parseFloat(cs.getPropertyValue('--ex-sec')) || 0
      }
    })
  })
}
