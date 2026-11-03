import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import mammoth from 'mammoth'
import { layoutPdfPage, parseText, type ParseResult } from '../src/import/index'

const fixtureRoot = resolve('tests/fixtures/resume-corpus')
const samples = JSON.parse(readFileSync(join(fixtureRoot, 'samples.json'), 'utf8')) as any[]

async function extractPdf(path: string): Promise<string> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(readFileSync(path))
  const doc = await pdfjs.getDocument({ data, disableWorker: true }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(layoutPdfPage(content.items as any[], page.getViewport({ scale: 1 }).width))
  }
  return pages.join('\n')
}

async function extractDocx(path: string): Promise<string> {
  return (await mammoth.extractRawText({ buffer: readFileSync(path) })).value
}

interface Score {
  basics: number
  basicsOk: number
  dates: number
  datesOk: number
  companyRole: number
  companyRoleOk: number
  bullets: number
  bulletsOk: number
  sections: number
  sectionsOk: number
  errors: string[]
}

function addScore(score: Score, sample: any, parsed: ParseResult, format: string) {
  const r = sample.resume
  const e = sample.expected

  for (const key of ['name', 'phone', 'email']) {
    score.basics++
    if ((parsed.resume.basics as any)[key] === e[key]) score.basicsOk++
    else score.errors.push(`${format}/${sample.id}: ${key}=${(parsed.resume.basics as any)[key]} expected ${e[key]}`)
  }

  score.dates++
  const actualDates = parsed.resume.work.map((w, i) => [w.start, w.end])
  if (JSON.stringify(actualDates) === JSON.stringify(e.workDates)) score.datesOk++
  else score.errors.push(`${format}/${sample.id}: dates=${JSON.stringify(actualDates)} expected ${JSON.stringify(e.workDates)}`)

  score.companyRole++
  const companyOk = r.work.every((w: any, i: number) =>
    parsed.resume.work[i]?.company === w.company && !!parsed.resume.work[i]?.role)
  if (companyOk) score.companyRoleOk++
  else score.errors.push(`${format}/${sample.id}: companies=${JSON.stringify(parsed.resume.work.map(w => [w.company, w.role]))}`)

  score.bullets++
  const workBulletCount = parsed.resume.work.reduce((n, w) => n + w.highlights.length, 0)
  const projectBulletCount = parsed.resume.projects.reduce((n, p) => n + p.highlights.length, 0)
  const expectedWorkBullets = r.work.reduce((n: number, w: any) => n + w.highlights.length, 0)
  const expectedProjectBullets = r.projects.reduce((n: number, p: any) => n + p.highlights.length, 0)
  if (workBulletCount === expectedWorkBullets && projectBulletCount === expectedProjectBullets) score.bulletsOk++
  else score.errors.push(`${format}/${sample.id}: bullets=${workBulletCount}/${projectBulletCount} expected ${expectedWorkBullets}/${expectedProjectBullets}`)

  score.sections++
  const requiredSections = ['summary', 'work', 'projects', 'skills', 'education']
  if (requiredSections.every(k => parsed.sections.includes(k))) score.sectionsOk++
  else score.errors.push(`${format}/${sample.id}: sections=${parsed.sections.join(',')}`)

  if (format === 'docx') {
    expect(parsed.resume.projects.map(p => p.name)).toContain(e.projectNames[0])
    expect(parsed.resume.education.map(x => x.institution)).toContain(e.educationSchools[0])
  }
}

describe('P4 公开样本脱敏验收', () => {
  it('DOCX 与 PDF 各 10 份，关键字段达到计划书准确率', async () => {
    const score: Score = {
      basics: 0, basicsOk: 0, dates: 0, datesOk: 0,
      companyRole: 0, companyRoleOk: 0, bullets: 0, bulletsOk: 0,
      sections: 0, sectionsOk: 0, errors: []
    }

    for (const [format, dir] of [['pdf', 'pdf'], ['docx', 'docx']] as const) {
      const files = readdirSync(join(fixtureRoot, dir)).filter(name => name.endsWith(`.${format}`))
      expect(files).toHaveLength(10)
      for (const file of files) {
        const id = file.slice(0, -format.length - 1)
        const sample = samples.find(x => x.id === id)
        expect(sample, `missing expected sample for ${file}`).toBeTruthy()
        const text = format === 'pdf'
          ? await extractPdf(join(fixtureRoot, dir, file))
          : await extractDocx(join(fixtureRoot, dir, file))
        addScore(score, sample, parseText(text), format)
      }
    }

    const report = {
      moduleBoundary: score.sectionsOk / score.sections,
      basics: score.basicsOk / score.basics,
      workDates: score.datesOk / score.dates,
      companyRole: score.companyRoleOk / score.companyRole,
      bulletAttribution: score.bulletsOk / score.bullets
    }
    console.info('P4 accuracy', report)
    if (score.errors.length) console.info('P4 errors', score.errors)
    expect(report.moduleBoundary).toBeGreaterThanOrEqual(0.9)
    expect(report.basics).toBeGreaterThanOrEqual(0.95)
    expect(report.workDates).toBeGreaterThanOrEqual(0.9)
    expect(report.companyRole).toBeGreaterThanOrEqual(0.8)
    expect(report.bulletAttribution).toBeGreaterThanOrEqual(0.85)
  }, 60_000)
})
