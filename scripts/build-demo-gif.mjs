import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const width = 720
const height = 450
const files = [
  'docs/screenshots/editor.png',
  'docs/screenshots/gallery.png',
  'docs/screenshots/templates.png',
  'docs/screenshots/deepseek-jd.png'
].map(file => resolve(root, file))

const urls = files.map(file => `data:image/png;base64,${readFileSync(file).toString('base64')}`)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
const frames = await page.evaluate(async ({ urls, width, height }) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const output = []
  for (const url of urls) {
    const image = new Image()
    image.src = url
    await image.decode()
    ctx.fillStyle = '#f3f0e9'
    ctx.fillRect(0, 0, width, height)
    const scale = Math.max(width / image.width, height / image.height)
    const dw = image.width * scale
    const dh = image.height * scale
    ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh)
    const data = ctx.getImageData(0, 0, width, height).data
    const indices = new Uint8Array(width * height)
    for (let p = 0, i = 0; p < data.length; p += 4, i++) {
      const r = data[p], g = data[p + 1], b = data[p + 2]
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      if (max - min < 12) {
        indices[i] = 216 + Math.round(((r + g + b) / 3) * 39 / 255)
      } else {
        indices[i] = Math.round(r / 51) * 36 + Math.round(g / 51) * 6 + Math.round(b / 51)
      }
    }
    output.push(Array.from(indices))
  }
  return output
}, { urls, width, height })
await browser.close()

function u16(value) {
  return Buffer.from([value & 255, (value >> 8) & 255])
}

function subBlocks(bytes, prefix = Buffer.alloc(0)) {
  const chunks = [prefix]
  for (let i = 0; i < bytes.length; i += 255) {
    const part = Buffer.from(bytes.slice(i, i + 255))
    chunks.push(Buffer.from([part.length]), part)
  }
  chunks.push(Buffer.from([0]))
  return Buffer.concat(chunks)
}

/** Valid GIF LZW stream using literal codes and frequent clear codes. */
function literalLzw(indices) {
  const bytes = []
  let bits = 0
  let count = 0
  const emit = code => {
    bits |= code << count
    count += 9
    while (count >= 8) {
      bytes.push(bits & 255)
      bits >>>= 8
      count -= 8
    }
  }
  emit(256)
  let literals = 0
  for (const index of indices) {
    emit(index)
    literals++
    if (literals === 200) {
      emit(256)
      literals = 0
    }
  }
  emit(257)
  if (count) bytes.push(bits & 255)
  return subBlocks(bytes, Buffer.from([8]))
}

const palette = Buffer.alloc(256 * 3)
for (let i = 0; i < 216; i++) {
  palette[i * 3] = Math.floor(i / 36) * 51
  palette[i * 3 + 1] = Math.floor(i / 6) % 6 * 51
  palette[i * 3 + 2] = i % 6 * 51
}
for (let i = 0; i < 40; i++) {
  const gray = Math.round(i * 255 / 39)
  palette[(216 + i) * 3] = gray
  palette[(216 + i) * 3 + 1] = gray
  palette[(216 + i) * 3 + 2] = gray
}

const parts = [
  Buffer.from('GIF89a'),
  u16(width),
  u16(height),
  Buffer.from([0xf7, 0, 0]),
  palette,
  Buffer.from([0x21, 0xff, 0x0b]),
  Buffer.from('NETSCAPE2.0'),
  Buffer.from([0x03, 0x01, 0x00, 0x00, 0x00])
]

for (const frame of frames) {
  parts.push(
    Buffer.from([0x21, 0xf9, 0x04, 0x04, 0x96, 0x00, 0x00, 0x00]),
    Buffer.from([0x2c]),
    u16(0), u16(0), u16(width), u16(height),
    Buffer.from([0]),
    literalLzw(frame)
  )
}
parts.push(Buffer.from([0x3b]))

const output = resolve(root, 'docs/demo.gif')
writeFileSync(output, Buffer.concat(parts))
console.log(`Built ${output} with ${frames.length} frames.`)
