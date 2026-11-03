import { execFileSync } from 'node:child_process'
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const fixtureRoot = join(root, 'tests/fixtures/resume-corpus')
const samples = JSON.parse(readFileSync(join(fixtureRoot, 'samples.json'), 'utf8'))
const pdfDir = join(fixtureRoot, 'pdf')
const docxDir = join(fixtureRoot, 'docx')
mkdirSync(pdfDir, { recursive: true })
mkdirSync(docxDir, { recursive: true })

const xmlEscape = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

function layoutData(sample, variant) {
  const r = sample.resume
  const labels = [
    { summary: '个人简介', work: '工作经历', projects: '项目经历', skills: '技能', education: '教育背景' },
    { summary: '简介', work: '工作经验', projects: '项目经验', skills: '专业技能', education: '教育经历' },
    { summary: '个人简介', work: '工作经历', projects: '项目经历', skills: '技能特长', education: '学习经历' }
  ][variant]
  const lines = [
    r.name,
    `${r.phone}  ${r.email}  ${r.city}`,
    labels.summary,
    r.summary,
    labels.work
  ]
  r.work.forEach(w => {
    lines.push(`${w.start} — ${w.end}  ${w.company}｜${w.role}`)
    w.highlights.forEach(text => lines.push(`• ${text}`))
  })
  lines.push(labels.projects)
  r.projects.forEach(p => {
    lines.push(`${p.name}｜${p.role}`)
    p.highlights.forEach(text => lines.push(`• ${text}`))
  })
  lines.push(labels.skills, r.skills.join('、'), labels.education)
  r.education.forEach(e => {
    lines.push(`${e.start} — ${e.end}  ${e.institution}｜${e.area}｜${e.studyType}`)
  })
  return lines
}

function writeDocx(sample, lines, index) {
  const temp = mkdtempSync(join(tmpdir(), `paperstack-docx-${sample.id}-`))
  mkdirSync(join(temp, '_rels'))
  mkdirSync(join(temp, 'word'))
  writeFileSync(join(temp, '[Content_Types].xml'),
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>')
  writeFileSync(join(temp, '_rels/.rels'),
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>')
  const paragraphs = lines.map((line, i) => {
    const style = i === 0 ? '<w:rPr><w:b/><w:sz w:val="36"/></w:rPr>' : ''
    return `<w:p><w:r>${style}<w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`
  }).join('')
  writeFileSync(join(temp, 'word/document.xml'),
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    paragraphs +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
    '</w:body></w:document>')
  const zip = join(temp, `${sample.id}.zip`)
  execFileSync('tar', ['-a', '-c', '-f', zip, '-C', temp, '.'])
  copyFileSync(zip, join(docxDir, `${sample.id}.docx`))
  rmSync(temp, { recursive: true, force: true })
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
for (let index = 0; index < samples.length; index++) {
  const sample = samples[index]
  const lines = layoutData(sample, index % 3)
  writeDocx(sample, lines, index)

  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    @page{size:A4;margin:18mm 17mm}
    body{font:12pt/1.75 "Microsoft YaHei",sans-serif;color:#1f211e}
    p{margin:0 0 ${index % 2 ? 3 : 5}pt;line-height:${index % 3 ? 1.65 : 1.85}}
    p:first-child{font:700 22pt "SimSun",serif;letter-spacing:.1em;margin-bottom:6pt}
    .heading{font-weight:700;border-bottom:${index % 2 ? 1 : 2}px solid #4d5d55;padding-bottom:2pt;margin-top:10pt}
    .bullet{padding-left:12pt;text-indent:-12pt}
  </style></head><body>${lines.map((line, i) => {
    const cls = /^(个人简介|简介|工作经历|工作经验|项目经历|项目经验|技能|专业技能|技能特长|教育背景|教育经历|学习经历)$/.test(line)
      ? ' class="heading"' : line.startsWith('•') ? ' class="bullet"' : ''
    return `<p${cls}>${xmlEscape(line)}</p>`
  }).join('')}</body></html>`
  await page.setContent(html)
  await page.pdf({
    path: join(pdfDir, `${sample.id}.pdf`),
    format: 'A4',
    printBackground: true
  })
}
await browser.close()

if (!existsSync(join(pdfDir)) || !existsSync(join(docxDir))) {
  throw new Error('Fixture output directories are missing')
}
console.log(`Built ${samples.length} PDF and ${samples.length} DOCX fixtures.`)
