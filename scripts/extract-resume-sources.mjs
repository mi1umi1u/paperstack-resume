import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import mammoth from 'mammoth'

// Local-source audit helper. extracted.json may contain private data; never commit its output.
const sourceDir = resolve(process.argv[2] || '')
if (!process.argv[2]) {
  console.error('Usage: node scripts/extract-resume-sources.mjs <source-directory>')
  process.exit(1)
}

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const files = readdirSync(sourceDir)
  .filter(name => /\.(pdf|docx)$/i.test(name))
  .sort()

const extracted = []
for (const name of files) {
  const path = join(sourceDir, name)
  const buffer = readFileSync(path)
  let text = ''
  let pages = 0
  if (extname(name).toLowerCase() === '.pdf') {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise
    pages = doc.numPages
    const out = []
    for (let pageNo = 1; pageNo <= pages; pageNo++) {
      const page = await doc.getPage(pageNo)
      const content = await page.getTextContent()
      out.push(content.items.map(item => item.str || '').join(' '))
    }
    text = out.join('\n')
  } else {
    text = (await mammoth.extractRawText({ buffer })).value
  }
  extracted.push({ name, pages, text })
  const chars = text.replace(/\s/g, '').length
  console.log(`${name}: ${pages || 'docx'} page(s), ${chars} compact chars`)
}

const output = join(sourceDir, 'extracted.json')
writeFileSync(output, JSON.stringify(extracted, null, 2))
console.log(`Wrote ${output}`)
